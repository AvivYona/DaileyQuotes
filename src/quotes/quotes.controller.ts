import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { UpdateQuoteDto } from '../dto/update-quote.dto';
import { PasswordProtected } from '../auth/password-protected.decorator';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @PasswordProtected()
  create(@Body() createQuoteDto: CreateQuoteDto) {
    return this.quotesService.create(createQuoteDto);
  }

  @Get()
  findAll() {
    return this.quotesService.findAll();
  }

  @Get('/author/:id')
  findByAuthor(@Param('id', ParseMongoIdPipe) authorId: string) {
    return this.quotesService.findByAuthor(authorId);
  }

  @Get(':id')
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.quotesService.findOne(id);
  }

  @Patch(':id')
  @PasswordProtected()
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
  ) {
    return this.quotesService.update(id, updateQuoteDto);
  }

  @Delete(':id')
  @PasswordProtected()
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.quotesService.remove(id);
  }
}
