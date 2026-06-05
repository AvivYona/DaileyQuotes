import { ScheduledHandler } from 'aws-lambda';
import mongoose, { Model, Types } from 'mongoose';
import {
  listPushSettingsDue,
  updateLastSentAt,
} from '../push/device-push-settings.service';
import { DevicePushSettingDocument } from '../schemas/device-push-setting.schema';
import { Quote, QuoteDocument, QuoteSchema } from '../schemas/quote.schema';
import { Author, AuthorDocument, AuthorSchema } from '../schemas/author.schema';
import { QuotesService } from '../quotes/quotes.service';
import { connectToDatabase } from '../database/connection';
import { isShabbatOrYomTov } from '../common/shabbat-restriction';
import { tokenSuffix } from '../push/logging';

type SendResult = { ok: boolean; reason?: string };

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
): Promise<SendResult> => {
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
      return { ok: false, reason: `http ${response.status}` };
    }

    const result = await response.json();
    if (result?.data?.status === 'ok') {
      return { ok: true };
    }

    if (Array.isArray(result?.data)) {
      const first = result.data[0];
      if (first?.status === 'ok') {
        return { ok: true };
      }
      const reason =
        first?.message ?? first?.details?.error ?? 'expo error';
      return { ok: false, reason };
    }

    return { ok: false, reason: 'unexpected response shape' };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'fetch failed';
    return { ok: false, reason };
  }
};


export const handler: ScheduledHandler = async () => {
  const startedAt = Date.now();
  let sent = 0;
  let failed = 0;
  let skippedDedup = 0;

  try {
    const restriction = await isShabbatOrYomTov();
    console.log(
      `[push:send] restriction=${restriction ? restriction.title : 'none'}`,
    );
    if (restriction) {
      return;
    }

    const now = new Date();
    const devices: DevicePushSettingDocument[] = await listPushSettingsDue(now);
    console.log(`[push:send] start due=${devices.length}`);
    if (!devices.length) {
      return;
    }

    const quotesService = await getQuotesService();

    for (const device of devices) {
      const lastSentAt =
        device.lastSentAt instanceof Date
          ? device.lastSentAt
          : device.lastSentAt
            ? new Date(device.lastSentAt)
            : undefined;

      if (lastSentAt && now.getTime() - lastSentAt.getTime() < 60_000) {
        skippedDedup++;
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

      const result = await sendExpoNotification(device.expoPushToken, quote);
      if (result.ok) {
        sent++;
        await updateLastSentAt(device._id as Types.ObjectId, now);
      } else {
        failed++;
        console.error(
          `[push:send] FAIL deviceId=${device._id} token=${tokenSuffix(device.expoPushToken)} reason=${result.reason}`,
        );
      }
    }
  } catch (error) {
    console.error('[push:send] ERR', error);
  } finally {
    console.log(
      `[push:send] done sent=${sent} failed=${failed} skipped_dedup=${skippedDedup} dur=${Date.now() - startedAt}ms`,
    );
  }
};
