import { ScheduledHandler } from 'aws-lambda';
import mongoose, { Model, Types } from 'mongoose';
import { listUsers, recordQuoteDelivery } from '../users/users.service';
import { UserDocument } from '../schemas/user.schema';
import { Quote, QuoteDocument, QuoteSchema } from '../schemas/quote.schema';
import { Author, AuthorDocument, AuthorSchema } from '../schemas/author.schema';
import { QuotesService } from '../quotes/quotes.service';
import { connectToDatabase } from '../database/connection';

type LocalTimeSnapshot = {
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday ... 6 = Saturday
};

type ShabbatWindow = {
  start: Date;
  end: Date;
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const toLocalTimeSnapshot = (
  timeZone: string,
  referenceDate = new Date(),
): LocalTimeSnapshot | null => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    const parts = formatter.formatToParts(referenceDate);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const minutePart = parts.find((p) => p.type === 'minute')?.value;
    const weekdayPart = parts.find((p) => p.type === 'weekday')?.value;

    if (
      hourPart === undefined ||
      minutePart === undefined ||
      weekdayPart === undefined
    ) {
      return null;
    }

    const weekday = weekdayMap[weekdayPart];
    if (weekday === undefined) {
      return null;
    }

    return {
      hour: Number.parseInt(hourPart, 10),
      minute: Number.parseInt(minutePart, 10),
      weekday,
    };
  } catch (error) {
    console.error(
      `Failed to compute local time for timezone ${timeZone}`,
      error,
    );
    return null;
  }
};

const shabbatWindowCache = new Map<
  string,
  { window: ShabbatWindow | null; expiresAt: number }
>();

const SHABBAT_CACHE_FALLBACK_MS = 60 * 60 * 1000; // 1 hour

const isWithinWindow = (window: ShabbatWindow, timestamp: number): boolean => {
  const start = window.start.getTime();
  const end = window.end.getTime();
  return timestamp >= start && timestamp < end;
};

const fetchShabbatWindow = async (
  timeZone: string,
): Promise<ShabbatWindow | null> => {
  try {
    const url = new URL('https://www.hebcal.com/shabbat');
    url.searchParams.set('cfg', 'json');
    url.searchParams.set('tzid', timeZone);
    url.searchParams.set('m', '50');

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(
        `Hebcal shabbat request failed with status ${response.status} for tz ${timeZone}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      items?: Array<{ category?: string; date?: string }>;
    };

    if (!Array.isArray(data.items)) {
      return null;
    }

    for (let index = 0; index < data.items.length; index += 1) {
      const item = data.items[index];
      if (item?.category !== 'candles' || typeof item.date !== 'string') {
        continue;
      }

      const start = new Date(item.date);
      if (Number.isNaN(start.getTime())) {
        continue;
      }

      const havdalahItem = data.items
        .slice(index + 1)
        .find(
          (entry) =>
            entry?.category === 'havdalah' && typeof entry.date === 'string',
        );

      if (!havdalahItem) {
        continue;
      }

      const end = new Date(havdalahItem.date);
      if (Number.isNaN(end.getTime())) {
        continue;
      }

      return { start, end };
    }

    return null;
  } catch (error) {
    console.error(
      `Failed to fetch shabbat window from Hebcal for tz ${timeZone}`,
      error,
    );
    return null;
  }
};

const isDuringShabbat = async (
  timeZone: string,
  referenceDate = new Date(),
): Promise<boolean> => {
  const timestamp = referenceDate.getTime();
  const cached = shabbatWindowCache.get(timeZone);

  if (cached && timestamp < cached.expiresAt) {
    return cached.window ? isWithinWindow(cached.window, timestamp) : false;
  }

  const window = await fetchShabbatWindow(timeZone);
  let expiresAt = timestamp + SHABBAT_CACHE_FALLBACK_MS;

  if (window) {
    const beforeStart = timestamp < window.start.getTime();
    expiresAt = beforeStart ? window.start.getTime() : window.end.getTime();
  }

  shabbatWindowCache.set(timeZone, { window, expiresAt });

  return window ? isWithinWindow(window, timestamp) : false;
};

type QuoteForPush = {
  _id: string;
  quote: string;
  description: string;
  author?: {
    _id?: string;
    name?: string;
  };
};

let cachedQuotesService: QuotesService | null = null;

const MAX_QUOTE_SELECTION_ATTEMPTS = 5;

const getQuotesService = async (): Promise<QuotesService> => {
  if (cachedQuotesService) {
    return cachedQuotesService;
  }

  await connectToDatabase();

  const quoteModel =
    (mongoose.models[Quote.name] as Model<QuoteDocument>) ||
    mongoose.model<QuoteDocument>(
      Quote.name,
      QuoteSchema as unknown as mongoose.Schema<QuoteDocument>,
    );

  const authorModel =
    (mongoose.models[Author.name] as Model<AuthorDocument>) ||
    mongoose.model<AuthorDocument>(
      Author.name,
      AuthorSchema as unknown as mongoose.Schema<AuthorDocument>,
    );

  cachedQuotesService = new QuotesService(quoteModel, authorModel);
  return cachedQuotesService;
};

const mapQuoteForPush = (quote: any): QuoteForPush => {
  const quoteId =
    typeof quote._id === 'string'
      ? quote._id
      : quote._id
        ? String(quote._id)
        : '';

  let author: QuoteForPush['author'];
  if (quote.author && typeof quote.author === 'object') {
    const rawAuthor = quote.author as { _id?: unknown; name?: string };
    const authorId =
      typeof rawAuthor._id === 'string'
        ? rawAuthor._id
        : rawAuthor._id
          ? String(rawAuthor._id)
          : undefined;

    author = {
      _id: authorId,
      name: rawAuthor.name,
    };
  }

  return {
    _id: quoteId,
    quote: quote.quote,
    description: quote.description ?? '',
    author,
  };
};

const toObjectIdString = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Types.ObjectId) {
    return value.toHexString();
  }

  if (typeof value === 'object' && '_id' in (value as Record<string, unknown>)) {
    const nested = (value as { _id?: unknown })._id;
    return toObjectIdString(nested);
  }

  return null;
};

const pickQuoteWithExclusions = async (
  quotesService: QuotesService,
  excludedIds: Set<string>,
): Promise<Quote | null> => {
  let fallbackQuote: Quote | null = null;

  for (
    let attempt = 0;
    attempt < MAX_QUOTE_SELECTION_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = await quotesService.findRandom();
    fallbackQuote = candidate;

    const candidateId = toObjectIdString((candidate as any)?._id);
    if (!candidateId) {
      return candidate;
    }

    if (!excludedIds.has(candidateId)) {
      return candidate;
    }
  }

  return fallbackQuote;
};

const sendExpoNotification = async (
  expoPushToken: string,
  quote: QuoteForPush,
): Promise<boolean> => {
  const body = quote.quote;
  const authorName = quote.author?.name;
  const title = `${authorName}`;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        title,
        body,
        data: {
          quoteId: quote._id,
          authorId: quote.author?._id,
        },
      }),
    });

    if (!response.ok) {
      console.error(`Expo push request failed with status ${response.status}`);
      return false;
    }

    const result = await response.json();
    if (result?.data?.status === 'ok') {
      return true;
    }

    if (Array.isArray(result?.data)) {
      const first = result.data[0];
      if (first?.status === 'ok') {
        return true;
      }
      console.error('Expo push returned errors', first);
    } else {
      console.error('Unexpected Expo push response', result);
    }

    return false;
  } catch (error) {
    console.error('Failed to send Expo push notification', error);
    return false;
  }
};

const shouldSendNow = (
  snapshot: LocalTimeSnapshot,
  targetHour: number,
  targetMinute: number,
  referenceDate: Date,
  lastSentAt?: Date,
): boolean => {
  if (snapshot.hour !== targetHour || snapshot.minute !== targetMinute) {
    return false;
  }

  if (!lastSentAt) {
    return true;
  }

  const diffMs = referenceDate.getTime() - lastSentAt.getTime();
  return diffMs >= 60_000;
};

export const handler: ScheduledHandler = async () => {
  try {
    const users: UserDocument[] = await listUsers();
    if (!users.length) {
      return;
    }

    const quotesService = await getQuotesService();

    for (const user of users) {
      if (!user.timeZone || !Array.isArray(user.notificationSchedule)) {
        continue;
      }

      if (!Array.isArray(user.devices) || user.devices.length === 0) {
        continue;
      }

      const referenceDate = new Date();
      const snapshot = toLocalTimeSnapshot(user.timeZone, referenceDate);
      if (!snapshot) {
        continue;
      }

      if (await isDuringShabbat(user.timeZone, referenceDate)) {
        continue;
      }

      const runtimeUsedQuoteIds = new Set<string>();

      for (const schedule of user.notificationSchedule) {
        if (typeof schedule?.hour !== 'number' || typeof schedule?.minute !== 'number') {
          continue;
        }

        const lastSentAt =
          schedule.lastSentAt instanceof Date
            ? schedule.lastSentAt
            : schedule.lastSentAt
              ? new Date(schedule.lastSentAt)
              : undefined;

        if (
          !shouldSendNow(
            snapshot,
            schedule.hour,
            schedule.minute,
            referenceDate,
            lastSentAt,
          )
        ) {
          continue;
        }

        const excludedQuoteIds = new Set<string>(runtimeUsedQuoteIds);
        for (const entry of user.currentQuotes ?? []) {
          if (
            typeof entry?.hour !== 'number' ||
            typeof entry?.minute !== 'number'
          ) {
            continue;
          }

          if (
            entry.hour === schedule.hour &&
            entry.minute === schedule.minute
          ) {
            continue;
          }

          const entryQuoteId = toObjectIdString(entry.quoteId);
          if (entryQuoteId) {
            excludedQuoteIds.add(entryQuoteId);
          }
        }

        const quoteDocument = await pickQuoteWithExclusions(
          quotesService,
          excludedQuoteIds,
        );
        if (!quoteDocument) {
          continue;
        }

        const quote = mapQuoteForPush(quoteDocument);
        if (!quote.quote) {
          continue;
        }
        const quoteIdString = toObjectIdString((quoteDocument as any)?._id);

        let delivered = false;
        for (const device of user.devices) {
          if (!device?.expoPushToken) {
            continue;
          }

          const success = await sendExpoNotification(
            device.expoPushToken,
            quote,
          );
          delivered = delivered || success;
        }

        if (!delivered) {
          continue;
        }

        const id =
          user._id instanceof Types.ObjectId
            ? user._id
            : new Types.ObjectId(String(user._id));

        if (!quoteIdString) {
          continue;
        }

        runtimeUsedQuoteIds.add(quoteIdString);
        const deliveryTimestamp = new Date();
        await recordQuoteDelivery(
          id,
          schedule.hour,
          schedule.minute,
          quoteIdString,
          deliveryTimestamp,
        );

        if (!Array.isArray(user.currentQuotes)) {
          user.currentQuotes = [];
        }

        user.currentQuotes = user.currentQuotes.filter(
          (entry) =>
            !(
              entry?.hour === schedule.hour &&
              entry?.minute === schedule.minute
            ),
        );

        user.currentQuotes.push({
          hour: schedule.hour,
          minute: schedule.minute,
          quoteId: quoteIdString,
          sentAt: deliveryTimestamp,
        } as any);
      }
    }
  } catch (error) {
    console.error('Failed to process scheduled pushes', error);
  }
};
