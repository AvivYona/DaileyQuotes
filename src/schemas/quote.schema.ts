import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Author, AuthorSchema } from './author.schema';

export type QuoteDocument = Quote & Document;

@Schema({ collection: 'quotes', versionKey: false })
export class Quote {
  @Prop({ type: Types.ObjectId, ref: 'Author', required: true })
  author: Types.ObjectId;

  @Prop({ required: true })
  quote: string;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);
