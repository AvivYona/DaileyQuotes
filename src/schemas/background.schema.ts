import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BackgroundDocument = Background & Document;

@Schema({ collection: 'backgrounds', versionKey: false })
export class Background {
  @Prop({ required: true })
  data: Buffer;

  @Prop({ required: true })
  contentType: string;

  @Prop()
  filename?: string;
}

export const BackgroundSchema = SchemaFactory.createForClass(Background);
