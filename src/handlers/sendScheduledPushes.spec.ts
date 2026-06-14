/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScheduledEvent, Context } from 'aws-lambda';

// --- Mock all external dependencies of the handler ---
jest.mock('../common/shabbat-restriction', () => ({
  isShabbatOrYomTov: jest.fn().mockResolvedValue(null),
}));

jest.mock('../database/connection', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

const listPushSettingsDue = jest.fn();
const bulkUpdateLastSentAt = jest.fn().mockResolvedValue(undefined);
jest.mock('../push/device-push-settings.service', () => ({
  listPushSettingsDue: (...args: any[]) => listPushSettingsDue(...args),
  bulkUpdateLastSentAt: (...args: any[]) => bulkUpdateLastSentAt(...args),
}));

const findRandomMany = jest.fn();
jest.mock('../quotes/quotes.service', () => ({
  QuotesService: jest.fn().mockImplementation(() => ({
    findRandomMany: (...args: any[]) => findRandomMany(...args),
  })),
}));

// Import AFTER mocks are registered.
import { handler } from './sendScheduledPushes';

const invoke = () =>
  (handler as any)({} as ScheduledEvent, {} as Context, () => undefined);

const makeDevice = (i: number, lastSentAt?: Date) => ({
  _id: `id-${i}`,
  expoPushToken: `ExponentPushToken[token-${i}]`,
  lastSentAt,
});

const makeQuotes = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    _id: `q-${i}`,
    quote: `quote text ${i}`,
    description: '',
    author: { _id: `a-${i}`, name: `Author ${i}` },
  }));

// fetch mock that records each chunk size and returns a ticket per message.
const installFetch = (
  ticketStatusFor: (token: string) => 'ok' | 'error' = () => 'ok',
) => {
  const chunkSizes: number[] = [];
  const fetchMock = jest.fn(async (_url: string, init: any) => {
    const messages = JSON.parse(init.body) as { to: string }[];
    chunkSizes.push(messages.length);
    const data = messages.map((m) => {
      const status = ticketStatusFor(m.to);
      return status === 'ok'
        ? { status: 'ok', id: 'ticket' }
        : { status: 'error', message: 'DeviceNotRegistered' };
    });
    return { ok: true, json: async () => ({ data }) };
  });
  (global as any).fetch = fetchMock;
  return { chunkSizes, fetchMock };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sendScheduledPushes handler', () => {
  it('chunks 250 devices into 100/100/50 and records all as sent', async () => {
    const devices = Array.from({ length: 250 }, (_, i) => makeDevice(i));
    listPushSettingsDue.mockResolvedValue(devices);
    findRandomMany.mockResolvedValue(makeQuotes(250));
    const { chunkSizes, fetchMock } = installFetch();

    await invoke();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(chunkSizes.sort((a, b) => b - a)).toEqual([100, 100, 50]);

    // every device recorded exactly once, no duplicates / drops
    const ids = bulkUpdateLastSentAt.mock.calls[0][0];
    expect(ids).toHaveLength(250);
    expect(new Set(ids).size).toBe(250);
  });

  it('aligns failures to the correct device and excludes them from lastSentAt', async () => {
    const devices = Array.from({ length: 120 }, (_, i) => makeDevice(i));
    listPushSettingsDue.mockResolvedValue(devices);
    findRandomMany.mockResolvedValue(makeQuotes(120));
    // device 5 and device 117 fail (different chunks)
    installFetch((token) =>
      token === 'ExponentPushToken[token-5]' ||
      token === 'ExponentPushToken[token-117]'
        ? 'error'
        : 'ok',
    );

    await invoke();

    const ids: string[] = bulkUpdateLastSentAt.mock.calls[0][0];
    expect(ids).toHaveLength(118);
    expect(ids).not.toContain('id-5');
    expect(ids).not.toContain('id-117');
    expect(ids).toContain('id-6');
  });

  it('skips devices notified within the last minute (dedup)', async () => {
    const now = Date.now();
    const devices = [
      makeDevice(0),
      makeDevice(1, new Date(now - 10_000)), // 10s ago -> skip
      makeDevice(2, new Date(now - 120_000)), // 2min ago -> send
    ];
    listPushSettingsDue.mockResolvedValue(devices);
    findRandomMany.mockResolvedValue(makeQuotes(2));
    const { fetchMock } = installFetch();

    await invoke();

    expect(findRandomMany).toHaveBeenCalledWith(2); // only 2 eligible
    const sentMessages = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentMessages.map((m: any) => m.to)).toEqual([
      'ExponentPushToken[token-0]',
      'ExponentPushToken[token-2]',
    ]);
  });

  it('does not send and does not crash when no quotes are available', async () => {
    listPushSettingsDue.mockResolvedValue([makeDevice(0)]);
    findRandomMany.mockResolvedValue([]);
    const { fetchMock } = installFetch();

    await invoke();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(bulkUpdateLastSentAt).not.toHaveBeenCalled();
  });
});
