import { APIGatewayProxyHandler } from 'aws-lambda';
import { updateWantRandomQuote } from '../push/device-push-settings.service';
import { tokenSuffix } from '../push/logging';

type UpdateWantRandomQuotePayload = {
  expoPushToken?: string;
  wantRandomQuote?: boolean;
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

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return buildResponse(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return buildResponse(405, { message: 'Method Not Allowed' });
  }

  let payload: UpdateWantRandomQuotePayload;
  try {
    payload = JSON.parse(event.body ?? '{}');
  } catch {
    return buildResponse(400, { message: 'Invalid JSON payload' });
  }

  const { expoPushToken, wantRandomQuote } = payload;

  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return buildResponse(400, {
      message: 'expoPushToken must be a non-empty string',
    });
  }

  if (typeof wantRandomQuote !== 'boolean') {
    return buildResponse(400, {
      message: 'wantRandomQuote must be a boolean',
    });
  }

  const tokenLabel = tokenSuffix(expoPushToken);

  try {
    const updated = await updateWantRandomQuote(expoPushToken, wantRandomQuote);

    if (!updated) {
      return buildResponse(404, {
        message: 'No push settings found for this device',
      });
    }

    return buildResponse(200, {
      success: true,
      wantRandomQuote: updated.wantRandomQuote,
      nextRandomSendAt: updated.nextRandomSendAt ?? null,
    });
  } catch (error) {
    console.error(`[push:wantRandomQuote] ERR token=${tokenLabel} err=`, error);
    return buildResponse(500, { message: 'Failed to update wantRandomQuote' });
  }
};
