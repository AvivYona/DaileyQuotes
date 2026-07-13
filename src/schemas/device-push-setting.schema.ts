import { Schema, Document } from 'mongoose';

export interface DevicePushSettingDocument extends Document {
  expoPushToken: string;
  hour: number;
  minute: number;
  timeZone: string;
  wantRandomQuote: boolean;
  // When wantRandomQuote is true: the UTC instant of the next randomly drawn
  // daily push. Redrawn for the next day after each attempt.
  nextRandomSendAt?: Date;
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
    wantRandomQuote: { type: Boolean, required: true, default: false },
    nextRandomSendAt: { type: Date },
    lastSentAt: { type: Date },
  },
  {
    collection: 'device_push_settings',
    versionKey: false,
    timestamps: true,
  },
);

// The scheduler queries due devices every minute by exact local time, so index
// the fields it filters on to keep that lookup O(matches) instead of a full scan.
DevicePushSettingSchema.index({ timeZone: 1, hour: 1, minute: 1 });

// Random-time devices are looked up by "next slot has passed" instead.
DevicePushSettingSchema.index({ wantRandomQuote: 1, nextRandomSendAt: 1 });

