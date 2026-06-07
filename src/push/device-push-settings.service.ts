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

export const listPushSettingsDue = async (
  referenceDate: Date = new Date(),
): Promise<DevicePushSettingDocument[]> => {
  await connectToDatabase();
  const model = getModel();

  const timeZones = (await model.distinct('timeZone').exec()) as string[];
  if (!timeZones.length) return [];

  const conditions: { timeZone: string; hour: number; minute: number }[] = [];
  for (const timeZone of timeZones) {
    const snapshot = toLocalTimeSnapshot(timeZone, referenceDate);
    if (!snapshot) continue;
    conditions.push({
      timeZone,
      hour: snapshot.hour,
      minute: snapshot.minute,
    });
  }

  if (!conditions.length) return [];
  return model.find({ $or: conditions }).exec();
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
