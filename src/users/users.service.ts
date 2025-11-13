import mongoose, { Model } from 'mongoose';
import { connectToDatabase } from '../database/connection';
import {
  AuthProvider,
  CurrentQuoteEntry,
  DeviceRegistration,
  NotificationPreference,
  UserDocument,
  UserSchema,
} from '../schemas/user.schema';

type NotificationInput = {
  hour: number;
  minute: number;
};

export type UpsertUserDetails = {
  authProvider: AuthProvider;
  providerUserId: string;
  expoPushToken: string;
  timeZone: string;
  notificationSchedule: NotificationInput[];
  fullName?: string;
  email?: string;
  platform?: 'ios' | 'android' | 'web';
};

let cachedModel: Model<UserDocument> | null = null;

const getModel = (): Model<UserDocument> => {
  if (cachedModel) {
    return cachedModel;
  }

  cachedModel =
    (mongoose.models.User as Model<UserDocument> | undefined) ||
    mongoose.model<UserDocument>('User', UserSchema);

  return cachedModel;
};

const normalizeSchedule = (
  schedule: NotificationInput[],
  existing: NotificationPreference[] = [],
): NotificationPreference[] => {
  const seen = new Set<string>();

  return schedule
    .map((slot) => {
      const key = `${slot.hour}:${slot.minute}`;
      if (seen.has(key)) {
        return null;
      }
      seen.add(key);

      const existingSlot = existing.find(
        (entry) => entry.hour === slot.hour && entry.minute === slot.minute,
      );

      const normalizedSlot: NotificationPreference = {
        hour: slot.hour,
        minute: slot.minute,
      };

      if (existingSlot?.lastSentAt) {
        normalizedSlot.lastSentAt = existingSlot.lastSentAt;
      }

      return normalizedSlot;
    })
    .filter((slot): slot is NotificationPreference => slot !== null);
};

const mergeDevices = (
  expoPushToken: string,
  platform: UpsertUserDetails['platform'],
  existing: DeviceRegistration[] = [],
): DeviceRegistration[] => {
  const now = new Date();

  const sanitizedOthers = existing.filter(
    (device) => device.expoPushToken !== expoPushToken,
  );

  const currentDevice: DeviceRegistration = {
    expoPushToken,
    platform: platform ?? 'ios',
    lastActiveAt: now,
  };

  return [...sanitizedOthers, currentDevice];
};

const pruneCurrentQuotes = (
  schedule: NotificationPreference[],
  currentQuotes: CurrentQuoteEntry[] = [],
): CurrentQuoteEntry[] => {
  const allowedSlots = new Set(
    schedule.map((slot) => `${slot.hour}:${slot.minute}`),
  );

  return currentQuotes?.filter((entry) =>
    allowedSlots.has(`${entry.hour}:${entry.minute}`),
  );
};

export const upsertUserDetails = async (details: UpsertUserDetails) => {
  await connectToDatabase();
  const model = getModel();

  const existing =
    (await model
      .findOne({
        authProvider: details.authProvider,
        providerUserId: details.providerUserId,
      })
      .lean()) ?? undefined;

  const notificationSchedule = normalizeSchedule(
    details.notificationSchedule,
    existing?.notificationSchedule,
  );
  const devices = mergeDevices(
    details.expoPushToken,
    details.platform,
    existing?.devices,
  );
  const currentQuotes = pruneCurrentQuotes(
    notificationSchedule,
    existing?.currentQuotes,
  );

  return model
    .findOneAndUpdate(
      {
        authProvider: details.authProvider,
        providerUserId: details.providerUserId,
      },
      {
        $set: {
          authProvider: details.authProvider,
          providerUserId: details.providerUserId,
          fullName: details.fullName,
          email: details.email,
          timeZone: details.timeZone,
          notificationSchedule,
          devices,
          currentQuotes,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    )
    .exec();
};

export const listUsers = async () => {
  await connectToDatabase();
  const model = getModel();
  return model.find().exec();
};

export const recordQuoteDelivery = async (
  userId: mongoose.Types.ObjectId,
  hour: number,
  minute: number,
  quoteId: mongoose.Types.ObjectId | string,
  timestamp: Date,
) => {
  await connectToDatabase();
  const model = getModel();

  let normalizedQuoteId: mongoose.Types.ObjectId;
  if (typeof quoteId === 'string') {
    if (!mongoose.Types.ObjectId.isValid(quoteId)) {
      throw new Error('Invalid quote id supplied for delivery tracking');
    }
    normalizedQuoteId = new mongoose.Types.ObjectId(quoteId);
  } else {
    normalizedQuoteId = quoteId;
  }

  return model
    .updateOne(
      { _id: userId },
      {
        $set: {
          'notificationSchedule.$[slot].lastSentAt': timestamp,
        },
        $pull: {
          currentQuotes: { hour, minute },
        },
        $push: {
          currentQuotes: {
            hour,
            minute,
            quoteId: normalizedQuoteId,
            sentAt: timestamp,
          },
        },
      },
      {
        arrayFilters: [{ 'slot.hour': hour, 'slot.minute': minute }],
      },
    )
    .exec();
};
