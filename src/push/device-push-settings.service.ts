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

export const listPushSettings = async () => {
  await connectToDatabase();
  const model = getModel();
  return model.find().exec();
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
