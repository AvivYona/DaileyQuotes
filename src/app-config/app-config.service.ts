import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig, AppConfigDocument } from '../schemas/app-config.schema';
import { UpdateAppConfigDto } from '../dto/update-app-config.dto';

const CONFIG_KEY = 'app';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectModel(AppConfig.name)
    private appConfigModel: Model<AppConfigDocument>,
  ) {}

  // Returns the single config document, creating it with defaults if missing.
  async getConfig(): Promise<AppConfigDocument> {
    return this.appConfigModel
      .findOneAndUpdate(
        { key: CONFIG_KEY },
        { $setOnInsert: { key: CONFIG_KEY } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async updateConfig(
    dto: UpdateAppConfigDto,
  ): Promise<AppConfigDocument> {
    const updates: Partial<AppConfig> = {};
    if (dto.minimumVersion !== undefined)
      updates.minimumVersion = dto.minimumVersion;
    if (dto.iosAppId !== undefined) updates.iosAppId = dto.iosAppId;
    if (dto.androidPackage !== undefined)
      updates.androidPackage = dto.androidPackage;
    if (dto.updateTitle !== undefined) updates.updateTitle = dto.updateTitle;
    if (dto.updateMessage !== undefined)
      updates.updateMessage = dto.updateMessage;

    return this.appConfigModel
      .findOneAndUpdate(
        { key: CONFIG_KEY },
        { $set: updates, $setOnInsert: { key: CONFIG_KEY } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }
}
