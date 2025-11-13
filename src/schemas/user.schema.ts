import { Schema, Document, Types } from 'mongoose';

export type AuthProvider = 'apple' | 'google';

export interface NotificationPreference {
  hour: number;
  minute: number;
  lastSentAt?: Date;
}

export interface DeviceRegistration {
  expoPushToken: string;
  platform?: 'ios' | 'android' | 'web';
  lastActiveAt: Date;
}

export interface CurrentQuoteEntry {
  hour: number;
  minute: number;
  quoteId: Types.ObjectId | string;
  sentAt: Date;
}

export interface UserDocument extends Document {
  authProvider: AuthProvider;
  providerUserId: string;
  email?: string;
  fullName?: string;
  timeZone: string;
  notificationSchedule: NotificationPreference[];
  devices: DeviceRegistration[];
  currentQuotes: CurrentQuoteEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const NotificationScheduleSchema = new Schema<NotificationPreference>(
  {
    hour: { type: Number, required: true, min: 0, max: 23 },
    minute: { type: Number, required: true, min: 0, max: 59 },
    lastSentAt: { type: Date },
  },
  { _id: false },
);

const DeviceRegistrationSchema = new Schema<DeviceRegistration>(
  {
    expoPushToken: { type: String, required: true },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      default: 'ios',
    },
    lastActiveAt: { type: Date, default: () => new Date(), required: true },
  },
  { _id: false },
);

const CurrentQuoteSchema = new Schema<CurrentQuoteEntry>(
  {
    hour: { type: Number, required: true, min: 0, max: 23 },
    minute: { type: Number, required: true, min: 0, max: 59 },
    quoteId: {
      type: Schema.Types.ObjectId,
      ref: 'Quote',
      required: true,
    },
    sentAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

export const UserSchema = new Schema<UserDocument>(
  {
    authProvider: {
      type: String,
      enum: ['apple', 'google'],
      required: true,
    },
    providerUserId: { type: String, required: true },
    email: { type: String },
    fullName: { type: String },
    timeZone: { type: String, required: true },
    notificationSchedule: {
      type: [NotificationScheduleSchema],
      required: true,
      default: [],
    },
    devices: {
      type: [DeviceRegistrationSchema],
      required: true,
      default: [],
    },
    currentQuotes: {
      type: [CurrentQuoteSchema],
      required: true,
      default: [],
    },
  },
  {
    collection: 'users',
    versionKey: false,
    timestamps: true,
  },
);

UserSchema.index({ authProvider: 1, providerUserId: 1 }, { unique: true });
UserSchema.index({ 'devices.expoPushToken': 1 });
UserSchema.index({ 'currentQuotes.hour': 1, 'currentQuotes.minute': 1 });
