import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserQuotesService } from './user-quotes.service';
import { CreateUserQuoteDto } from '../dto/create-user-quote.dto';
import { UpdateUserQuoteDto } from '../dto/update-user-quote.dto';
import { PasswordProtected } from '../auth/password-protected.decorator';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('user-quotes')
export class UserQuotesController {
  constructor(private readonly userQuotesService: UserQuotesService) {}

  // Public: the end-user app has no admin secret. Spam is deterred via a
  // per-device rate limit in the service, not auth.
  @Post()
  create(@Body() createUserQuoteDto: CreateUserQuoteDto) {
    return this.userQuotesService.create(createUserQuoteDto);
  }

  @Get()
  @PasswordProtected()
  findAll() {
    return this.userQuotesService.findAll();
  }

  @Patch(':id')
  @PasswordProtected()
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateUserQuoteDto: UpdateUserQuoteDto,
  ) {
    return this.userQuotesService.update(id, updateUserQuoteDto);
  }

  @Post(':id/approve')
  @PasswordProtected()
  approve(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() edits: UpdateUserQuoteDto,
  ) {
    return this.userQuotesService.approve(id, edits);
  }

  @Delete(':id')
  @PasswordProtected()
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.userQuotesService.remove(id);
  }
}
