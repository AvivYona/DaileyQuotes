import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserQuoteDocument = UserQuote &
  Document & { createdAt: Date; updatedAt: Date };

@Schema({ collection: 'userQuotes', timestamps: true, versionKey: false })
export class UserQuote {
  @Prop({ type: Types.ObjectId, ref: 'Author', required: true })
  author: Types.ObjectId;

  @Prop({ required: true })
  quote: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  deviceId: string;
}

export const UserQuoteSchema = SchemaFactory.createForClass(UserQuote);
