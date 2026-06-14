import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppConfigDocument = AppConfig & Document;

@Schema({ collection: 'app_config', versionKey: false, timestamps: true })
export class AppConfig {
  // Fixed key so there is always a single config document.
  @Prop({ required: true, unique: true, default: 'app' })
  key: string;

  // Installs with a version lower than this are forced to update.
  // Default keeps the gate inert until it is raised.
  @Prop({ required: true, default: '1.0.0' })
  minimumVersion: string;

  @Prop({ default: '6754076269' })
  iosAppId: string;

  @Prop({ default: 'com.aviv.Emuna' })
  androidPackage: string;

  @Prop()
  updateTitle?: string;

  @Prop()
  updateMessage?: string;
}

export const AppConfigSchema = SchemaFactory.createForClass(AppConfig);
