import { ScheduledHandler } from 'aws-lambda';
import mongoose, { Model, Types } from 'mongoose';
import {
  listPushSettings,
  updateLastSentAt,
} from '../push/device-push-settings.service';
import { DevicePushSettingDocument } from '../schemas/device-push-setting.schema';
import { Quote, QuoteDocument, QuoteSchema } from '../schemas/quote.schema';
import { Author, AuthorDocument, AuthorSchema } from '../schemas/author.schema';
import { QuotesService } from '../quotes/quotes.service';
import { connectToDatabase } from '../database/connection';

type LocalTimeSnapshot = {
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday ... 6 = Saturday
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

const isDuringShabbat = ({ weekday, hour }: LocalTimeSnapshot): boolean => {
  if (weekday === 5 && hour >= 16) {
    return true;
  }
  if (weekday === 6 && hour < 20) {
    return true;
  }
  return false;
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
  lastSentAt?: Date,
): boolean => {
  if (snapshot.hour !== targetHour || snapshot.minute !== targetMinute) {
    return false;
  }

  if (isDuringShabbat(snapshot)) {
    return false;
  }

  if (!lastSentAt) {
    return true;
  }

  const diffMs = Date.now() - lastSentAt.getTime();
  return diffMs >= 60_000;
};

export const handler: ScheduledHandler = async () => {
  try {
    const devices: DevicePushSettingDocument[] = await listPushSettings();
    if (!devices.length) {
      return;
    }

    const quotesService = await getQuotesService();

    for (const device of devices) {
      const snapshot = toLocalTimeSnapshot(device.timeZone);
      if (!snapshot) {
        continue;
      }

      const lastSentAt =
        device.lastSentAt instanceof Date
          ? device.lastSentAt
          : device.lastSentAt
            ? new Date(device.lastSentAt)
            : undefined;

      if (!shouldSendNow(snapshot, device.hour, device.minute, lastSentAt)) {
        continue;
      }

      const quoteDocument = await quotesService.findRandom();
      if (!quoteDocument) {
        continue;
      }

      const quote = mapQuoteForPush(quoteDocument);
      if (!quote.quote) {
        continue;
      }

      const success = await sendExpoNotification(device.expoPushToken, quote);
      if (!success) {
        continue;
      }

      const id =
        device._id instanceof Types.ObjectId
          ? device._id
          : new Types.ObjectId(String(device._id));

      await updateLastSentAt(id, new Date());
    }
  } catch (error) {
    console.error('Failed to process scheduled pushes', error);
  }
};
