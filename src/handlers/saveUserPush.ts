import { APIGatewayProxyHandler } from 'aws-lambda';
import { upsertPushSetting } from '../push/device-push-settings.service';

type SavePushPayload = {
  expoPushToken?: string;
  hour?: number;
  minute?: number;
  timeZone?: string;
};

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

  const { expoPushToken, hour, minute, timeZone } = payload;

  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return buildResponse(400, {
      message: 'expoPushToken must be a non-empty string',
    });
  }

  if (!isValidHour(hour)) {
    return buildResponse(400, { message: 'hour must be an integer 0-23' });
  }

  if (!isValidMinute(minute)) {
    return buildResponse(400, { message: 'minute must be an integer 0-59' });
  }

  if (!isValidTimeZone(timeZone)) {
    return buildResponse(400, { message: 'timeZone must be a valid IANA name' });
  }

  try {
    await upsertPushSetting({
      expoPushToken,
      hour,
      minute,
      timeZone,
    });

    return buildResponse(200, { success: true });
  } catch (error) {
    console.error('Failed to save push settings', error);
    return buildResponse(500, { message: 'Failed to save push settings' });
  }
};
