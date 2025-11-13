import { APIGatewayProxyHandler } from 'aws-lambda';
import { verifyIdentityToken } from '../auth/social-auth.service';
import { AuthProvider } from '../schemas/user.schema';
import { upsertUserDetails } from '../users/users.service';

type NotificationInput = {
  hour?: number;
  minute?: number;
};

type SavePushPayload = {
  expoPushToken?: string;
  timeZone?: string;
  notifications?: NotificationInput[];
  provider?: AuthProvider;
  idToken?: string;
  fullName?: string;
  email?: string;
  platform?: 'ios' | 'android' | 'web';
};

const MAX_NOTIFICATIONS_PER_DAY = 5;

const buildResponse = (
  statusCode: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): ReturnType<APIGatewayProxyHandler> =>
  Promise.resolve({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

const isValidTimeZone = (timeZone: unknown): timeZone is string => {
  if (!timeZone || typeof timeZone !== 'string') {
    return false;
  }

  try {
    Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

const isValidHour = (hour: unknown): hour is number =>
  typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23;

const isValidMinute = (minute: unknown): minute is number =>
  typeof minute === 'number' &&
  Number.isInteger(minute) &&
  minute >= 0 &&
  minute <= 59;

const normalizeNotifications = (
  notifications: unknown,
):
  | { ok: true; schedule: Array<{ hour: number; minute: number }> }
  | { ok: false; message: string } => {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return {
      ok: false,
      message: 'notifications must be a non-empty array',
    };
  }

  if (notifications.length > MAX_NOTIFICATIONS_PER_DAY) {
    return {
      ok: false,
      message: `notifications must include at most ${MAX_NOTIFICATIONS_PER_DAY} entries`,
    };
  }

  const seen = new Set<string>();
  const schedule: Array<{ hour: number; minute: number }> = [];

  for (const entry of notifications) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !isValidHour((entry as NotificationInput).hour) ||
      !isValidMinute((entry as NotificationInput).minute)
    ) {
      return {
        ok: false,
        message:
          'each notification entry must include integer hour 0-23 and minute 0-59',
      };
    }

    const hour = (entry as NotificationInput).hour!;
    const minute = (entry as NotificationInput).minute!;
    const key = `${hour}:${minute}`;

    if (seen.has(key)) {
      return {
        ok: false,
        message: 'notifications entries must be unique',
      };
    }

    seen.add(key);
    schedule.push({ hour, minute });
  }

  return { ok: true, schedule };
};

const isSupportedProvider = (value: unknown): value is AuthProvider =>
  value === 'apple' || value === 'google';

const isSupportedPlatform = (
  value: unknown,
): value is 'ios' | 'android' | 'web' =>
  value === 'ios' || value === 'android' || value === 'web';

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { message: 'Method Not Allowed' });
  }

  let payload: SavePushPayload;
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return buildResponse(400, { message: 'Invalid JSON payload' });
  }

  const {
    expoPushToken,
    timeZone,
    notifications,
    provider,
    idToken,
    fullName,
    email,
    platform,
  } = payload;

  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return buildResponse(400, {
      message: 'expoPushToken must be a non-empty string',
    });
  }

  if (!isValidTimeZone(timeZone)) {
    return buildResponse(400, { message: 'timeZone must be a valid IANA name' });
  }

  if (!isSupportedProvider(provider)) {
    return buildResponse(400, { message: 'provider must be apple or google' });
  }

  if (!idToken || typeof idToken !== 'string') {
    return buildResponse(400, { message: 'idToken must be provided' });
  }

  if (platform && !isSupportedPlatform(platform)) {
    return buildResponse(400, {
      message: 'platform must be ios, android or web when provided',
    });
  }

  const normalizedNotificationsResult = normalizeNotifications(notifications);
  if (normalizedNotificationsResult.ok === false) {
    const { message } = normalizedNotificationsResult;
    return buildResponse(400, { message });
  }
  const notificationSchedule = normalizedNotificationsResult.schedule;

  try {
    const verifiedProfile = await verifyIdentityToken(provider, idToken);

    await upsertUserDetails({
      authProvider: provider,
      providerUserId: verifiedProfile.providerUserId,
      fullName: fullName ?? verifiedProfile.fullName,
      email: email ?? verifiedProfile.email,
      expoPushToken,
      timeZone,
      platform,
      notificationSchedule,
    });

    return buildResponse(200, { success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return buildResponse(401, { message: 'Invalid identity token' });
    }

    console.error('Failed to save user details', error);
    return buildResponse(500, { message: 'Failed to save user details' });
  }
};
