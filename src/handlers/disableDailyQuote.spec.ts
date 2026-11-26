/* eslint-disable @typescript-eslint/no-explicit-any */
const disableDailyQuote = jest.fn();
const deletePushSetting = jest.fn();
jest.mock('../push/device-push-settings.service', () => ({
  disableDailyQuote: (...args: any[]) => disableDailyQuote(...args),
  deletePushSetting: (...args: any[]) => deletePushSetting(...args),
}));

import { handler } from './disableDailyQuote';

const invoke = (event: any) =>
  (handler as any)(event, {} as any, () => undefined);

describe('disable-daily-quote', () => {
  beforeEach(() => jest.clearAllMocks());

  it('disables the daily quote and never deletes the token', async () => {
    disableDailyQuote.mockResolvedValue({});
    const res = await invoke({
      httpMethod: 'POST',
      body: JSON.stringify({ expoPushToken: 'ExponentPushToken[abc]' }),
    });
    expect(res.statusCode).toBe(200);
    expect(disableDailyQuote).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(deletePushSetting).not.toHaveBeenCalled();
  });

  it('rejects a missing token', async () => {
    const res = await invoke({ httpMethod: 'POST', body: '{}' });
    expect(res.statusCode).toBe(400);
    expect(disableDailyQuote).not.toHaveBeenCalled();
  });

  it('returns 500 when the database fails', async () => {
    disableDailyQuote.mockRejectedValue(new Error('db down'));
    const res = await invoke({
      httpMethod: 'POST',
      body: JSON.stringify({ expoPushToken: 'ExponentPushToken[abc]' }),
    });
    expect(res.statusCode).toBe(500);
  });
});
