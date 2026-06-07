import { ScheduledHandler } from 'aws-lambda';
import mongoose, { Model, Types } from 'mongoose';
import {
  listPushSettingsDue,
  bulkUpdateLastSentAt,
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

// Expo accepts up to 100 messages per push request.
const EXPO_CHUNK_SIZE = 100;

// How many chunks to send to Expo at the same time.
const EXPO_SEND_CONCURRENCY = 10;

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: {
    quoteId: string;
    authorId?: string;
  };
};

const buildExpoMessage = (
  expoPushToken: string,
  quote: QuoteForPush,
): ExpoMessage => ({
  to: expoPushToken,
  title: `${quote.author?.name}`,
  body: quote.quote,
  data: {
    quoteId: quote._id,
    authorId: quote.author?._id,
  },
});

// Sends one chunk (<=100 messages) and returns a per-message result, aligned by index.
const sendExpoChunk = async (
  messages: ExpoMessage[],
): Promise<SendResult[]> => {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const reason = `http ${response.status}`;
      return messages.map(() => ({ ok: false, reason }));
    }

    const result = await response.json();
    const tickets = Array.isArray(result?.data) ? result.data : null;
    if (!tickets) {
      return messages.map(() => ({
        ok: false,
        reason: 'unexpected response shape',
      }));
    }

    return messages.map((_, index) => {
      const ticket = tickets[index];
      if (ticket?.status === 'ok') {
        return { ok: true };
      }
      const reason =
        ticket?.message ?? ticket?.details?.error ?? 'expo error';
      return { ok: false, reason };
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'fetch failed';
    return messages.map(() => ({ ok: false, reason }));
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

    // 1. Filter out devices that were notified in the last minute (dedup).
    const eligible = devices.filter((device) => {
      const lastSentAt =
        device.lastSentAt instanceof Date
          ? device.lastSentAt
          : device.lastSentAt
            ? new Date(device.lastSentAt)
            : undefined;

      if (lastSentAt && now.getTime() - lastSentAt.getTime() < 60_000) {
        skippedDedup++;
        return false;
      }
      return true;
    });

    if (!eligible.length) {
      return;
    }

    // 2. Fetch one random quote per device in a single query (no per-device round trips).
    const quotePool = await quotesService.findRandomMany(eligible.length);
    if (!quotePool.length) {
      console.error('[push:send] no quotes available');
      return;
    }

    // 3. Build the Expo messages, pairing each device with a quote.
    const outgoing = eligible
      .map((device, index) => {
        const quote = mapQuoteForPush(quotePool[index % quotePool.length]);
        if (!quote.quote) {
          return null;
        }
        return {
          device,
          message: buildExpoMessage(device.expoPushToken, quote),
        };
      })
      .filter(
        (item): item is { device: DevicePushSettingDocument; message: ReturnType<typeof buildExpoMessage> } =>
          item !== null,
      );

    // 4. Send in chunks of 100 (Expo's per-request limit) and collect successes.
    const sentIds: Types.ObjectId[] = [];
    const chunks: (typeof outgoing)[] = [];
    for (let i = 0; i < outgoing.length; i += EXPO_CHUNK_SIZE) {
      chunks.push(outgoing.slice(i, i + EXPO_CHUNK_SIZE));
    }

    // Send chunks concurrently (bounded) so total time stays flat as the audience grows.
    let cursor = 0;
    const worker = async () => {
      while (cursor < chunks.length) {
        const chunk = chunks[cursor++];
        const results = await sendExpoChunk(chunk.map((item) => item.message));

        results.forEach((result, index) => {
          const { device } = chunk[index];
          if (result.ok) {
            sent++;
            sentIds.push(device._id as Types.ObjectId);
          } else {
            failed++;
            console.error(
              `[push:send] FAIL deviceId=${device._id} token=${tokenSuffix(device.expoPushToken)} reason=${result.reason}`,
            );
          }
        });
      }
    };

    const concurrency = Math.min(EXPO_SEND_CONCURRENCY, chunks.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    // 5. Bulk-record lastSentAt for everything that went out.
    await bulkUpdateLastSentAt(sentIds, now);
  } catch (error) {
    console.error('[push:send] ERR', error);
  } finally {
    console.log(
      `[push:send] done sent=${sent} failed=${failed} skipped_dedup=${skippedDedup} dur=${Date.now() - startedAt}ms`,
    );
  }
};
