import mongoose, { Model } from 'mongoose';
import {
  DevicePushSettingDocument,
  DevicePushSettingSchema,
} from '../schemas/device-push-setting.schema';
import { connectToDatabase } from '../database/connection';

type UpsertDetails = {
  expoPushToken: string;
  hour: number;
  minute: number;
  timeZone: string;
};

let cachedModel: Model<DevicePushSettingDocument> | null = null;

const getModel = (): Model<DevicePushSettingDocument> => {
  if (cachedModel) {
    return cachedModel;
  }

  cachedModel =
    (mongoose.models.DevicePushSetting as
      | Model<DevicePushSettingDocument>
      | undefined) ||
    mongoose.model<DevicePushSettingDocument>(
      'DevicePushSetting',
      DevicePushSettingSchema,
    );

  return cachedModel;
};

export const upsertPushSetting = async (details: UpsertDetails) => {
  await connectToDatabase();
  const model = getModel();

  return model
    .findOneAndUpdate(
      { expoPushToken: details.expoPushToken },
      {
        $set: {
          expoPushToken: details.expoPushToken,
          hour: details.hour,
          minute: details.minute,
          timeZone: details.timeZone,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        timestamps: true,
      },
    )
    .exec();
};

// Random-time pushes are drawn inside this local-time window so a "random"
// quote never lands in the middle of the night.
export const RANDOM_WINDOW_START_HOUR = 8; // inclusive
export const RANDOM_WINDOW_END_HOUR = 22; // exclusive

// "Magic" mirror times (11:11, 12:12, ...) are deliberately over-represented:
// this fraction of draws lands exactly on hour:hour instead of a uniform
// minute. At 0.5, roughly half of pushes arrive at a magic time.
export const MAGIC_TIME_PROBABILITY = 0.5;

const DAY_MS = 24 * 60 * 60_000;

type LocalDateTime = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
};

const toLocalDateTime = (
  timeZone: string,
  date: Date,
): LocalDateTime | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(date);

    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    if (!year || !month || !day || !hour || !minute) {
      return null;
    }

    return {
      year: Number.parseInt(year, 10),
      month: Number.parseInt(month, 10),
      day: Number.parseInt(day, 10),
      // en-US returns "24" for midnight; normalize to 0.
      hour: Number.parseInt(hour, 10) % 24,
      minute: Number.parseInt(minute, 10),
    };
  } catch (error) {
    console.error(`[push:tz] failed to compute local date for tz=${timeZone}`, error);
    return null;
  }
};

// Convert a wall-clock time in a time zone to a UTC instant. The correction
// passes let Intl resolve the zone's offset (including DST) for us.
const utcFromLocal = (timeZone: string, local: LocalDateTime): Date | null => {
  const target = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
  );

  let guess = target;
  for (let i = 0; i < 2; i++) {
    const seen = toLocalDateTime(timeZone, new Date(guess));
    if (!seen) return null;
    const seenUtc = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
    );
    guess += target - seenUtc;
  }

  return new Date(guess);
};

// Draw the device's next random push instant: a random minute inside the
// allowed local window (biased toward magic mirror times like 11:11), today if
// that moment is still ahead (and allowed), otherwise tomorrow.
// `allowToday: false` is used after a send so a device never gets two random
// pushes on the same local day.
export const drawNextRandomSendAt = (
  timeZone: string,
  from: Date = new Date(),
  { allowToday = true }: { allowToday?: boolean } = {},
): Date | null => {
  const hour =
    RANDOM_WINDOW_START_HOUR +
    Math.floor(
      Math.random() * (RANDOM_WINDOW_END_HOUR - RANDOM_WINDOW_START_HOUR),
    );
  const minute =
    Math.random() < MAGIC_TIME_PROBABILITY
      ? hour // mirror time: 09:09, 11:11, 21:21, ...
      : Math.floor(Math.random() * 60);

  if (allowToday) {
    const today = toLocalDateTime(timeZone, from);
    if (!today) return null;
    const candidate = utcFromLocal(timeZone, { ...today, hour, minute });
    if (candidate && candidate.getTime() > from.getTime()) {
      return candidate;
    }
  }

  const tomorrow = toLocalDateTime(timeZone, new Date(from.getTime() + DAY_MS));
  if (!tomorrow) return null;
  return utcFromLocal(timeZone, { ...tomorrow, hour, minute });
};

export const updateWantRandomQuote = async (
  expoPushToken: string,
  wantRandomQuote: boolean,
) => {
  await connectToDatabase();
  const model = getModel();

  const existing = await model.findOne({ expoPushToken }).exec();
  if (!existing) {
    return null;
  }

  const update = wantRandomQuote
    ? {
        $set: {
          wantRandomQuote: true,
          // Seed the first slot now so the scheduler can pick the device up.
          nextRandomSendAt:
            drawNextRandomSendAt(existing.timeZone) ??
            new Date(Date.now() + DAY_MS),
        },
      }
    : {
        $set: { wantRandomQuote: false },
        $unset: { nextRandomSendAt: 1 },
      };

  return model
    .findOneAndUpdate({ expoPushToken }, update, {
      new: true,
      timestamps: true,
    })
    .exec();
};

export const deletePushSetting = async (expoPushToken: string) => {
  await connectToDatabase();
  const model = getModel();
  return model.deleteOne({ expoPushToken }).exec();
};

export const listPushSettings = async () => {
  await connectToDatabase();
  const model = getModel();
  return model.find().exec();
};

export const getDistinctTimeZones = async (): Promise<string[]> => {
  await connectToDatabase();
  const model = getModel();
  return model.distinct('timeZone').exec();
};

const toLocalTimeSnapshot = (
  timeZone: string,
  referenceDate: Date,
): { hour: number; minute: number } | null => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(referenceDate);

    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const minutePart = parts.find((p) => p.type === 'minute')?.value;

    if (hourPart === undefined || minutePart === undefined) {
      return null;
    }

    // en-US returns "24" for midnight; normalize to 0.
    const hour = Number.parseInt(hourPart, 10) % 24;
    return {
      hour,
      minute: Number.parseInt(minutePart, 10),
    };
  } catch (error) {
    console.error(`[push:tz] failed to compute local time for tz=${timeZone}`, error);
    return null;
  }
};

// How many minutes back to also match. EventBridge's per-minute schedule only
// guarantees "at least once" — a tick can fire late or be skipped — so matching
// only the exact current minute silently drops a whole cohort whenever that one
// tick misfires. We also match the previous few minutes so a delayed/missed tick
// still delivers; duplicates are prevented by the lastSentAt dedup in the handler
// (whose window must exceed this one).
export const MATCH_WINDOW_MINUTES = 5;

export const listPushSettingsDue = async (
  referenceDate: Date = new Date(),
): Promise<DevicePushSettingDocument[]> => {
  await connectToDatabase();
  const model = getModel();

  const timeZones = (await model.distinct('timeZone').exec()) as string[];
  if (!timeZones.length) return [];

  const conditions: { timeZone: string; hour: number; minute: number }[] = [];
  for (const timeZone of timeZones) {
    // Match the current local minute plus the previous few minutes. Using
    // separate snapshots per minute lets Intl handle hour/day/DST rollover for us.
    const seen = new Set<string>();
    for (let back = 0; back <= MATCH_WINDOW_MINUTES; back++) {
      const at = new Date(referenceDate.getTime() - back * 60_000);
      const snapshot = toLocalTimeSnapshot(timeZone, at);
      if (!snapshot) continue;

      const key = `${snapshot.hour}:${snapshot.minute}`;
      if (seen.has(key)) continue;
      seen.add(key);

      conditions.push({
        timeZone,
        hour: snapshot.hour,
        minute: snapshot.minute,
      });
    }
  }

  if (!conditions.length) return [];
  // Every device with a matching fixed slot is due here — including devices that
  // also want a random push. Those get their random one separately via
  // listRandomPushSettingsDue, so a random-enabled device receives both.
  return model.find({ $or: conditions }).exec();
};

export const listRandomPushSettingsDue = async (
  referenceDate: Date = new Date(),
): Promise<DevicePushSettingDocument[]> => {
  await connectToDatabase();
  const model = getModel();
  return model
    .find({ wantRandomQuote: true, nextRandomSendAt: { $lte: referenceDate } })
    .exec();
};

// Draw tomorrow's slot for each device. Called for every random device that
// was due this tick — success or failure — so a permanently failing token
// gets one attempt per day instead of retrying every minute.
export const bulkScheduleNextRandomSendAt = async (
  devices: Pick<DevicePushSettingDocument, '_id' | 'timeZone'>[],
  referenceDate: Date = new Date(),
) => {
  if (!devices.length) return;
  await connectToDatabase();
  const model = getModel();

  const operations = devices.flatMap((device) => {
    const nextRandomSendAt =
      drawNextRandomSendAt(device.timeZone, referenceDate, {
        allowToday: false,
      }) ?? new Date(referenceDate.getTime() + DAY_MS);

    return [
      {
        updateOne: {
          filter: { _id: device._id },
          update: { $set: { nextRandomSendAt } },
        },
      },
    ];
  });

  await model.bulkWrite(operations);
};

export const updateLastSentAt = async (
  id: mongoose.Types.ObjectId,
  timestamp: Date,
) => {
  await connectToDatabase();
  const model = getModel();
  return model
    .findByIdAndUpdate(
      id,
      {
        $set: {
          lastSentAt: timestamp,
        },
      },
      { new: true, timestamps: true },
    )
    .exec();
};

export const bulkUpdateLastSentAt = async (
  ids: mongoose.Types.ObjectId[],
  timestamp: Date,
) => {
  if (!ids.length) return;
  await connectToDatabase();
  const model = getModel();
  await model
    .updateMany({ _id: { $in: ids } }, { $set: { lastSentAt: timestamp } })
    .exec();
};
