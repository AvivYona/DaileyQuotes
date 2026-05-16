const HEBCAL_BASE_URL = 'https://www.hebcal.com/hebcal/';
const GEONAME_ID_ISRAEL = '293397'; // Jerusalem
const DEFAULT_TZ_OFFSET = '+03:00'; // Asia/Jerusalem

const MS_IN_MINUTE = 60_000;
const MS_IN_HOUR = 60 * MS_IN_MINUTE;
const MS_IN_DAY = 24 * MS_IN_HOUR;

type HebcalItem = {
  title?: string;
  hebrew?: string;
  category?: string;
  yomtov?: boolean;
  date?: string;
};

export type RestrictionReason = 'shabbat' | 'yomtov';

export type RestrictionInfo = {
  reason: RestrictionReason;
  title: string;
  start: Date;
  end: Date;
};

const isValidDate = (d: Date | null): d is Date =>
  !!d && !Number.isNaN(d.getTime());

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  if (value.includes('T')) {
    const d = new Date(value);
    return isValidDate(d) ? d : null;
  }
  const d = new Date(`${value}T12:00:00${DEFAULT_TZ_OFFSET}`);
  return isValidDate(d) ? d : null;
};

const formatDateParam = (d: Date) =>
  [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');

const fetchCalendar = async (start: Date, end: Date): Promise<HebcalItem[]> => {
  const params = new URLSearchParams({
    v: '1',
    cfg: 'json',
    maj: 'on',
    min: 'on',
    mod: 'on',
    nx: 'on',
    c: 'on',
    i: 'on',
    geo: 'geoname',
    geonameid: GEONAME_ID_ISRAEL,
    start: formatDateParam(start),
    end: formatDateParam(end),
  });

  try {
    const response = await fetch(`${HEBCAL_BASE_URL}?${params}`);
    if (!response.ok) throw new Error(`Hebcal HTTP ${response.status}`);
    const data = (await response.json()) as { items?: HebcalItem[] };
    return data.items ?? [];
  } catch (err) {
    console.warn('Unable to load Hebcal calendar', err);
    return [];
  }
};

const buildWindows = (items: HebcalItem[]): RestrictionInfo[] => {
  const byCategory = (cat: string) =>
    items
      .filter((i) => i.category === cat)
      .map((i) => ({ ...i, parsedDate: parseDate(i.date) }))
      .filter((i): i is HebcalItem & { parsedDate: Date } =>
        isValidDate(i.parsedDate),
      )
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());

  const candles = byCategory('candles');
  const havdalahs = byCategory('havdalah');

  if (!candles.length || !havdalahs.length) return [];

  const windows: RestrictionInfo[] = [];
  let hCursor = 0;

  for (const candle of candles) {
    while (
      hCursor < havdalahs.length &&
      havdalahs[hCursor].parsedDate.getTime() <= candle.parsedDate.getTime()
    ) {
      hCursor++;
    }
    if (hCursor >= havdalahs.length) break;

    const havdalah = havdalahs[hCursor];

    // Check for a Yom Tov that overlaps this candle→havdalah window
    const windowStart = candle.parsedDate;
    const windowEnd = havdalah.parsedDate;
    const startKey = windowStart.toISOString().split('T')[0];
    const endKey = windowEnd.toISOString().split('T')[0];

    const holiday = items.find((item) => {
      if (!item.yomtov || !item.date) return false;
      const key = item.date.split('T')[0];
      return key && key >= (startKey ?? '') && key <= (endKey ?? '');
    });

    windows.push({
      reason: holiday ? 'yomtov' : 'shabbat',
      title: holiday
        ? (holiday.hebrew ?? holiday.title ?? 'חג')
        : 'שבת',
      start: windowStart,
      end: windowEnd,
    });
  }

  return windows;
};

type Cache = {
  windows: RestrictionInfo[];
  validUntil: number;
};

let cache: Cache | null = null;

const computeNextCheckMs = (now: number, windows: RestrictionInfo[]): number => {
  const active = windows.find((w) => now >= w.start.getTime() && now < w.end.getTime());
  if (active) {
    // Re-check more frequently near the end of the restriction
    const untilEnd = active.end.getTime() - now;
    return Math.max(Math.min(untilEnd, 10 * MS_IN_MINUTE), MS_IN_MINUTE);
  }

  const nextStart = windows
    .map((w) => w.start.getTime())
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0];

  if (!nextStart) return 60 * MS_IN_MINUTE;

  const delta = nextStart - now;
  if (delta <= 15 * MS_IN_MINUTE) return 5 * MS_IN_MINUTE;
  return Math.min(delta, 2 * MS_IN_HOUR);
};

export const isShabbatOrYomTov = async (
  referenceDate = new Date(),
): Promise<RestrictionInfo | null> => {
  const now = referenceDate.getTime();

  if (cache && now < cache.validUntil) {
    return (
      cache.windows.find((w) => now >= w.start.getTime() && now < w.end.getTime()) ??
      null
    );
  }

  const windowStart = new Date(now - 3 * MS_IN_DAY);
  const windowEnd = new Date(now + 5 * MS_IN_DAY);

  const items = await fetchCalendar(windowStart, windowEnd);
  const windows = buildWindows(items);
  const nextCheckMs = computeNextCheckMs(now, windows);

  cache = { windows, validUntil: now + nextCheckMs };

  return (
    windows.find((w) => now >= w.start.getTime() && now < w.end.getTime()) ??
    null
  );
};
