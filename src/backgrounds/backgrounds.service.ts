import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Background, BackgroundDocument } from '../schemas/background.schema';

interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

@Injectable()
export class BackgroundsService {
  constructor(
    @InjectModel(Background.name)
    private readonly backgroundModel: Model<BackgroundDocument>,
  ) {}

  async create(file: UploadedImage | undefined): Promise<BackgroundDocument> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const createdBackground = new this.backgroundModel({
      data: file.buffer,
      contentType: file.mimetype,
      filename: file.originalname,
    });
    return createdBackground.save();
  }

  async findAll(): Promise<BackgroundDocument[]> {
    return this.backgroundModel.find().exec();
  }

  async remove(id: string): Promise<void> {
    const result = await this.backgroundModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Background with ID ${id} not found`);
    }
  }
}
