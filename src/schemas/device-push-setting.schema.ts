import { Schema, Document } from 'mongoose';

export interface DevicePushSettingDocument extends Document {
  expoPushToken: string;
  // No hour/minute = no scheduled daily quote (app 2.0+ shows it locally);
  // the token is kept for broadcast announcements.
  hour?: number;
  minute?: number;
  timeZone?: string;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DevicePushSettingSchema = new Schema<DevicePushSettingDocument>(
  {
    expoPushToken: { type: String, required: true, unique: true },
    hour: { type: Number, min: 0, max: 23 },
    minute: { type: Number, min: 0, max: 59 },
    timeZone: { type: String },
    lastSentAt: { type: Date },
  },
  {
    collection: 'device_push_settings',
    versionKey: false,
    timestamps: true,
  },
);

