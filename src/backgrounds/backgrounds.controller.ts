import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  BackgroundsService,
  BackgroundMetadata,
  UploadedImage,
} from './backgrounds.service';
import { PasswordProtected } from '../auth/password-protected.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';

@Controller('backgrounds')
export class BackgroundsController {
  constructor(private readonly backgroundsService: BackgroundsService) {}

  @Post()
  @PasswordProtected()
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(@UploadedFile() file?: UploadedImage) {
    const background = await this.backgroundsService.create(file);
    return this.serialize(background);
  }

  @Get()
  async findAll() {
    const backgrounds = await this.backgroundsService.findAll();
    return backgrounds.map((background) => this.serialize(background));
  }

  @Get(':fileName')
  async streamByFileName(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.backgroundsService.getFile(fileName);
    res.setHeader('Content-Type', file.contentType);
    if (file.contentLength !== undefined) {
      res.setHeader('Content-Length', file.contentLength.toString());
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName}"`,
    );
    return new StreamableFile(file.stream);
  }

  @Delete(':fileName')
  @PasswordProtected()
  async removeByFileName(@Param('fileName') fileName: string) {
    await this.backgroundsService.removeByFileName(fileName);
    return { message: 'Background deleted successfully' };
  }

  private serialize(background: BackgroundMetadata) {
    return {
      id: background.id,
      contentType: background.contentType,
      filename: background.filename,
      size: background.size,
    };
  }
}
