import { APIGatewayProxyHandler } from 'aws-lambda';
import { disableDailyQuote } from '../push/device-push-settings.service';
import { tokenSuffix } from '../push/logging';

/**
 * POST /disable-daily-quote { expoPushToken }
 *
 * App 2.0+ schedules the daily quote locally, so the server must stop sending
 * it. This removes the device's hour/minute (so the scheduler never matches
 * it) but keeps the token, so broadcast announcements still reach it. Creates the record for devices that were never
 * registered. Unlike delete-user-push, nothing is removed.
 */

type DisableDailyQuotePayload = {
  expoPushToken?: string;
};

const buildResponse = (
  statusCode: number,
  body: Record<string, unknown>,
): ReturnType<APIGatewayProxyHandler> =>
  Promise.resolve({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  });

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { message: 'Method Not Allowed' });
  }

  let payload: DisableDailyQuotePayload;
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return buildResponse(400, { message: 'Invalid JSON payload' });
  }

  const { expoPushToken } = payload;
  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return buildResponse(400, {
      message: 'expoPushToken must be a non-empty string',
    });
  }

  const tokenLabel = tokenSuffix(expoPushToken);
  console.log(`[push:disable-daily] req token=${tokenLabel}`);

  try {
    await disableDailyQuote(expoPushToken);
    console.log(`[push:disable-daily] ok token=${tokenLabel}`);
    // Idempotent: succeeds whether or not the device was registered before.
    return buildResponse(200, { success: true });
  } catch (error) {
    console.error(`[push:disable-daily] ERR token=${tokenLabel} err=`, error);
    return buildResponse(500, { message: 'Failed to update push settings' });
  }
};
