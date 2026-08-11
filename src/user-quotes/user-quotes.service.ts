import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserQuote, UserQuoteDocument } from '../schemas/user-quote.schema';
import { CreateUserQuoteDto } from '../dto/create-user-quote.dto';
import { UpdateUserQuoteDto } from '../dto/update-user-quote.dto';
import { QuotesService } from '../quotes/quotes.service';
import { Quote } from '../schemas/quote.schema';

const DAILY_LIMIT = 3;
const MIN_GAP_MS = 60 * 1000;
const WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UserQuotesService {
  constructor(
    @InjectModel(UserQuote.name)
    private userQuoteModel: Model<UserQuoteDocument>,
    private readonly quotesService: QuotesService,
  ) {}

  async create(
    createUserQuoteDto: CreateUserQuoteDto,
  ): Promise<{ status: string }> {
    const authorId = await this.quotesService.ensureAuthorExists(
      createUserQuoteDto.author,
    );
    await this.checkRateLimit(createUserQuoteDto.deviceId);

    await this.userQuoteModel.create({
      ...createUserQuoteDto,
      author: authorId,
    });

    return { status: 'pending' };
  }

  private async checkRateLimit(deviceId: string): Promise<void> {
    const cutoff = new Date(Date.now() - WINDOW_MS);
    const recent = await this.userQuoteModel
      .find({ createdAt: { $gte: cutoff }, deviceId })
      .sort({ createdAt: -1 })
      .limit(DAILY_LIMIT + 1)
      .select('createdAt')
      .lean()
      .exec();

    if (
      recent.length &&
      Date.now() - new Date(recent[0].createdAt).getTime() < MIN_GAP_MS
    ) {
      throw new HttpException(
        'נא להמתין לפני שליחה נוספת',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (recent.length >= DAILY_LIMIT) {
      throw new HttpException(
        'הגעת למגבלת השליחות היומית',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async findAll(): Promise<UserQuote[]> {
    return this.userQuoteModel
      .find()
      .select('-deviceId')
      .populate('author', 'name')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async update(
    id: string,
    updateUserQuoteDto: UpdateUserQuoteDto,
  ): Promise<UserQuote> {
    const updateData: any = { ...updateUserQuoteDto };
    if (updateUserQuoteDto.author) {
      updateData.author = await this.quotesService.ensureAuthorExists(
        updateUserQuoteDto.author,
      );
    }

    const updated = await this.userQuoteModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .select('-deviceId')
      .populate('author', 'name')
      .exec();
    if (!updated) {
      throw new NotFoundException(`User quote with ID ${id} not found`);
    }
    return updated;
  }

  // Sequential (not transactional): edit -> create real Quote -> delete pending
  // doc. Acceptable for a low-traffic, single-admin approval tool; a crash
  // between the create and the delete could leave a duplicate + orphaned
  // pending row, but that's an easy manual cleanup rather than a real risk.
  async approve(id: string, edits?: UpdateUserQuoteDto): Promise<Quote> {
    const doc = await this.userQuoteModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`User quote with ID ${id} not found`);
    }

    if (edits?.author || edits?.quote || edits?.description) {
      if (edits.author) {
        doc.author = await this.quotesService.ensureAuthorExists(edits.author);
      }
      if (edits.quote) {
        doc.quote = edits.quote;
      }
      if (edits.description) {
        doc.description = edits.description;
      }
      await doc.save();
    }

    const quote = await this.quotesService.create({
      author: doc.author.toString(),
      quote: doc.quote,
      description: doc.description,
    });
    await this.userQuoteModel.findByIdAndDelete(id).exec();
    return quote;
  }

  async remove(id: string): Promise<void> {
    const result = await this.userQuoteModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`User quote with ID ${id} not found`);
    }
  }
}
