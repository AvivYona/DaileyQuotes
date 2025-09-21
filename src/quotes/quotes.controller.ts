import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { UpdateQuoteDto } from '../dto/update-quote.dto';
import { PasswordProtected } from '../auth/password-protected.decorator';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @PasswordProtected()
  create(@Body() createQuoteDto: CreateQuoteDto) {
    return this.quotesService.create(createQuoteDto);
  }

  @Get()
  findAll(
    @Query('author') authorId?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const skipNum = skip ? parseInt(skip, 10) : 0;

    if (authorId) {
      return this.quotesService.findByAuthor(authorId, limitNum, skipNum);
    }
    return this.quotesService.findAll(limitNum, skipNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quotesService.findOne(id);
  }

  @Patch(':id')
  @PasswordProtected()
  update(@Param('id') id: string, @Body() updateQuoteDto: UpdateQuoteDto) {
    return this.quotesService.update(id, updateQuoteDto);
  }

  @Delete(':id')
  @PasswordProtected()
  remove(@Param('id') id: string) {
    return this.quotesService.remove(id);
  }
}
