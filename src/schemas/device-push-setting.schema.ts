import { Schema, Document } from 'mongoose';

export interface DevicePushSettingDocument extends Document {
  expoPushToken: string;
  hour: number;
  minute: number;
  timeZone: string;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DevicePushSettingSchema = new Schema<DevicePushSettingDocument>(
  {
    expoPushToken: { type: String, required: true, unique: true },
    hour: { type: Number, required: true, min: 0, max: 23 },
    minute: { type: Number, required: true, min: 0, max: 59 },
    timeZone: { type: String, required: true },
    lastSentAt: { type: Date },
  },
  {
    collection: 'device_push_settings',
    versionKey: false,
    timestamps: true,
  },
);

DevicePushSettingSchema.index({ expoPushToken: 1 }, { unique: true });
