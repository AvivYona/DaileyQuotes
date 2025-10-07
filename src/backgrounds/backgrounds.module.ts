import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BackgroundsService } from './backgrounds.service';
import { BackgroundsController } from './backgrounds.controller';
import { Background, BackgroundSchema } from '../schemas/background.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Background.name, schema: BackgroundSchema }]),
  ],
  controllers: [BackgroundsController],
  providers: [BackgroundsService],
  exports: [BackgroundsService],
})
export class BackgroundsModule {}
