import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BackgroundDocument = Background & Document;

@Schema({ collection: 'backgrounds', versionKey: false })
export class Background {
  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ type: Boolean, default: false })
  clean: boolean;

  @Prop()
  size?: number;
}

export const BackgroundSchema = SchemaFactory.createForClass(Background);
