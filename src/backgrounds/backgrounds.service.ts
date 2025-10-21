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

export interface BackgroundMetadata {
  id: string;
  contentType: string;
  filename: string;
  clean: boolean;
  size?: number;
}

export interface BackgroundFile {
  stream: Readable;
  contentType: string;
  contentLength?: number;
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
    this.bucketName = process.env.BUCKET ?? '';
    if (!this.bucketName) {
      throw new Error('AWS_S3_BUCKET environment variable is not set');
    }

    const region = process.env.REGION ?? 'il-central-1';

    this.s3Client = new S3Client({ region });
  }

  async create(
    clean: boolean,
    file: UploadedImage | undefined,
  ): Promise<BackgroundMetadata> {
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
        clean,
        size: file.buffer.length,
      });

      const savedBackground = await createdBackground.save();
      return this.toMetadata(savedBackground);
    } catch (error) {
      await this.safeDeleteFromS3(filename);
      this.logger.error(
        'Failed to persist background metadata',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to save background');
    }
  }

  async findAll(): Promise<BackgroundMetadata[]> {
    const backgrounds = await this.backgroundModel.find().exec();
    return backgrounds.map((background) => this.toMetadata(background));
  }

  async findClean(): Promise<BackgroundMetadata[]> {
    const backgrounds = await this.backgroundModel
      .find({ clean: true })
      .exec();
    return backgrounds.map((background) => this.toMetadata(background));
  }

  async getFile(fileName: string): Promise<BackgroundFile> {
    const background = await this.backgroundModel
      .findOne({ filename: fileName })
      .exec();
    if (!background) {
      throw new NotFoundException(
        `Background with filename ${fileName} not found`,
      );
    }

    const { stream, contentType, contentLength } =
      await this.fetchObjectStream(fileName);

    return {
      stream,
      contentType:
        contentType ?? background.contentType ?? 'application/octet-stream',
      contentLength: contentLength ?? background.size,
    };
  }

  async removeByFileName(fileName: string): Promise<void> {
    const background = await this.backgroundModel
      .findOne({ filename: fileName })
      .exec();
    if (!background) {
      throw new NotFoundException(
        `Background with filename ${fileName} not found`,
      );
    }

    await this.deleteFromS3(fileName);

    await this.backgroundModel.deleteOne({ _id: background._id }).exec();
  }

  private async fetchObjectStream(filename: string): Promise<{
    stream: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
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

      let stream: Readable;
      if (response.Body instanceof Readable) {
        stream = response.Body;
      } else if (Buffer.isBuffer(response.Body)) {
        stream = Readable.from(response.Body);
      } else if (
        typeof (response.Body as any).transformToByteArray === 'function'
      ) {
        const arrayBuffer = await (response.Body as any).transformToByteArray();
        stream = Readable.from(Buffer.from(arrayBuffer));
      } else {
        throw new InternalServerErrorException(
          'Unsupported S3 response body type',
        );
      }

      return {
        stream,
        contentType: response.ContentType ?? undefined,
        contentLength: response.ContentLength ?? undefined,
      };
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

    if (file.mimetype) {
      return file.mimetype;
    }

    return 'application/octet-stream';
  }

  private toMetadata(background: BackgroundDocument): BackgroundMetadata {
    return {
      id: background.id,
      contentType: background.contentType,
      filename: background.filename,
      clean: Boolean(background.clean),
      size: background.size,
    };
  }
}
