import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserQuotesService } from './user-quotes.service';
import { UserQuotesController } from './user-quotes.controller';
import { UserQuote, UserQuoteSchema } from '../schemas/user-quote.schema';
import { QuotesModule } from '../quotes/quotes.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserQuote.name, schema: UserQuoteSchema },
    ]),
    QuotesModule,
  ],
  controllers: [UserQuotesController],
  providers: [UserQuotesService],
})
export class UserQuotesModule {}
