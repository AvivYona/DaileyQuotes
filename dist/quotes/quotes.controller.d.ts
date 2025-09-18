import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { UpdateQuoteDto } from '../dto/update-quote.dto';
export declare class QuotesController {
    private readonly quotesService;
    constructor(quotesService: QuotesService);
    create(createQuoteDto: CreateQuoteDto): Promise<import("../schemas/quote.schema").Quote>;
    findAll(authorId?: string): Promise<import("../schemas/quote.schema").Quote[]>;
    findOne(id: string): Promise<import("../schemas/quote.schema").Quote>;
    update(id: string, updateQuoteDto: UpdateQuoteDto): Promise<import("../schemas/quote.schema").Quote>;
    remove(id: string): Promise<void>;
}
