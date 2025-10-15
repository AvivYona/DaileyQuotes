import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { fromBuffer as detectFileTypeFromBuffer } from 'file-type';
import { Readable } from 'stream';
import { Background, BackgroundDocument } from '../schemas/background.schema';

export interface UploadedImage {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
  fieldname?: string;
}

export interface BackgroundWithData {
  id: string;
  contentType: string;
  filename: string;
  data: Buffer;
}

@Injectable()
export class BackgroundsService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(BackgroundsService.name);

  constructor(
    @InjectModel(Background.name)
    private readonly backgroundModel: Model<BackgroundDocument>,
  ) {
    this.bucketName = process.env.AWS_S3_BUCKET ?? '';
    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET environment variable is not set');
    }

    const region = process.env.AWS_REGION ?? 'us-east-1';

    this.s3Client = new S3Client({ region });
  }

  async create(file: UploadedImage | undefined): Promise<BackgroundWithData> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const filename = await this.generateStoredFilename();
    const contentType = await this.detectContentType(file);

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: filename,
          Body: file.buffer,
          ContentType: contentType,
        }),
      );
    } catch (error) {
      this.logger.error(
        'Failed to upload background to S3',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to upload background');
    }

    try {
      const createdBackground = new this.backgroundModel({
        contentType,
        filename,
        size: file.buffer.length,
      });

      const savedBackground = await createdBackground.save();
      return this.mapToBackgroundWithData(savedBackground, file.buffer);
    } catch (error) {
      await this.safeDeleteFromS3(filename);
      this.logger.error(
        'Failed to persist background metadata',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to save background');
    }
  }

  async findAll(): Promise<BackgroundWithData[]> {
    const backgrounds = await this.backgroundModel.find().exec();
    return Promise.all(
      backgrounds.map((background) => this.mapToBackgroundWithData(background)),
    );
  }

  async remove(id: string): Promise<void> {
    const background = await this.backgroundModel.findById(id).exec();
    if (!background) {
      throw new NotFoundException(`Background with ID ${id} not found`);
    }

    if (!background.filename) {
      throw new NotFoundException(
        `Background ${background.id} has no associated image filename`,
      );
    }

    await this.deleteFromS3(background.filename);

    await this.backgroundModel.deleteOne({ _id: id }).exec();
  }

  private async mapToBackgroundWithData(
    background: BackgroundDocument,
    preload?: Buffer,
  ): Promise<BackgroundWithData> {
    if (!background.filename) {
      throw new NotFoundException(
        `Background ${background.id} has no associated image filename`,
      );
    }

    const data = preload ?? (await this.fetchObjectBuffer(background.filename));

    return {
      id: background.id,
      contentType: background.contentType,
      filename: background.filename,
      data,
    };
  }

  private async fetchObjectBuffer(filename: string): Promise<Buffer> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: filename,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException('Background image data not found');
      }

      if (Buffer.isBuffer(response.Body)) {
        return response.Body;
      }

      if (response.Body instanceof Readable) {
        return this.streamToBuffer(response.Body);
      }

      if (typeof (response.Body as any).transformToByteArray === 'function') {
        const arrayBuffer = await (response.Body as any).transformToByteArray();
        return Buffer.from(arrayBuffer);
      }

      throw new InternalServerErrorException(
        'Unsupported S3 response body type',
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        'Failed to fetch background from S3',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to load background');
    }
  }

  private async deleteFromS3(filename: string) {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: filename,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete S3 object with key ${filename}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to delete background');
    }
  }

  private async safeDeleteFromS3(filename: string) {
    try {
      await this.deleteFromS3(filename);
    } catch (error) {
      this.logger.warn(
        `Cleanup of S3 object ${filename} failed`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  private async generateStoredFilename(): Promise<string> {
    let nextIndex = (await this.backgroundModel.countDocuments().exec()) + 1;
    let candidate = `background${nextIndex}`;

    while (await this.backgroundModel.exists({ filename: candidate }).exec()) {
      nextIndex += 1;
      candidate = `background${nextIndex}`;
    }

    return candidate;
  }

  private async detectContentType(file: UploadedImage): Promise<string> {
    const detected = await detectFileTypeFromBuffer(file.buffer);
    if (detected?.mime) {
      return detected.mime;
    }

    return 'application/octet-stream';
  }
}
