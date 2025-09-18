import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuthorDocument = Author & Document;

@Schema({ collection: 'authors' })
export class Author {
  @Prop({ required: true, unique: true })
  name: string;
}

export const AuthorSchema = SchemaFactory.createForClass(Author);
