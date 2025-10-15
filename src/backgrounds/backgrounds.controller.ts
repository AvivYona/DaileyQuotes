import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  BackgroundsService,
  BackgroundWithData,
  UploadedImage,
} from './backgrounds.service';
import { PasswordProtected } from '../auth/password-protected.decorator';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

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

  @Delete(':id')
  @PasswordProtected()
  async remove(@Param('id', ParseMongoIdPipe) id: string) {
    await this.backgroundsService.remove(id);
    return { message: 'Background deleted successfully' };
  }

  private serialize(background: BackgroundWithData) {
    return {
      id: background.id,
      contentType: background.contentType,
      filename: background.filename,
      data: background.data.toString('base64'),
    };
  }
}
