import { Model } from 'mongoose';
import { Quote, QuoteDocument } from '../schemas/quote.schema';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { UpdateQuoteDto } from '../dto/update-quote.dto';
export declare class QuotesService {
    private quoteModel;
    constructor(quoteModel: Model<QuoteDocument>);
    create(createQuoteDto: CreateQuoteDto): Promise<Quote>;
    findAll(): Promise<Quote[]>;
    findOne(id: string): Promise<Quote>;
    findByAuthor(authorId: string): Promise<Quote[]>;
    update(id: string, updateQuoteDto: UpdateQuoteDto): Promise<Quote>;
    remove(id: string): Promise<void>;
}
