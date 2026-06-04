import { APIGatewayProxyHandler } from 'aws-lambda';
import { deletePushSetting } from '../push/device-push-settings.service';

type DeletePushPayload = {
  expoPushToken?: string;
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

  let payload: DeletePushPayload;
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

  try {
    const result = await deletePushSetting(expoPushToken);

    // Idempotent: succeed whether or not a document existed.
    return buildResponse(200, {
      success: true,
      deletedCount: result?.deletedCount ?? 0,
    });
  } catch (error) {
    console.error('Failed to delete push settings', error);
    return buildResponse(500, { message: 'Failed to delete push settings' });
  }
};
