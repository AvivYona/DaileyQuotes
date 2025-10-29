import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quote, QuoteDocument } from '../schemas/quote.schema';
import { Author, AuthorDocument } from '../schemas/author.schema';
import { CreateQuoteDto } from '../dto/create-quote.dto';
import { UpdateQuoteDto } from '../dto/update-quote.dto';

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Author.name) private authorModel: Model<AuthorDocument>,
  ) {}

  private async ensureAuthorExists(authorId: string): Promise<Types.ObjectId> {
    if (!Types.ObjectId.isValid(authorId)) {
      throw new NotFoundException(`Author with ID ${authorId} not found`);
    }

    const normalizedId = new Types.ObjectId(authorId);
    const authorExists = await this.authorModel.exists({ _id: normalizedId });
    if (!authorExists) {
      throw new NotFoundException(`Author with ID ${authorId} not found`);
    }

    return normalizedId;
  }

  async create(createQuoteDto: CreateQuoteDto): Promise<Quote> {
    const authorId = await this.ensureAuthorExists(createQuoteDto.author);
    const createdQuote = new this.quoteModel({
      ...createQuoteDto,
      author: authorId,
    });
    return createdQuote.save();
  }

  async findAll(): Promise<Quote[]> {
    return this.quoteModel
      .find()
      .populate('author', 'name')
      .lean() // Use lean() to return plain JavaScript objects instead of Mongoose documents
      .exec();
  }

  async findRandom(): Promise<Quote> {
    const totalQuotes = await this.quoteModel.countDocuments().exec();
    if (totalQuotes === 0) {
      throw new NotFoundException('No quotes found');
    }

    const randomIndex = Math.floor(Math.random() * totalQuotes);
    const randomQuote = await this.quoteModel
      .findOne()
      .skip(randomIndex)
      .populate('author', 'name')
      .lean()
      .exec();

    if (!randomQuote) {
      throw new NotFoundException('No quotes found');
    }

    return randomQuote;
  }

  async findOne(id: string): Promise<Quote> {
    const quote = await this.quoteModel
      .findById(id)
      .populate('author', 'name')
      .exec();
    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }
    return quote;
  }

  async findByAuthor(authorId: string): Promise<Quote[]> {
    return this.quoteModel
      .find({ author: new Types.ObjectId(authorId) })
      .populate('author', 'name')
      .lean() // Use lean() to return plain JavaScript objects instead of Mongoose documents
      .exec();
  }

  async update(id: string, updateQuoteDto: UpdateQuoteDto): Promise<Quote> {
    const updateData: any = { ...updateQuoteDto };
    if (updateQuoteDto.author) {
      updateData.author = await this.ensureAuthorExists(updateQuoteDto.author);
    }

    const updatedQuote = await this.quoteModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('author', 'name')
      .exec();
    if (!updatedQuote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }
    return updatedQuote;
  }

  async remove(id: string): Promise<void> {
    const result = await this.quoteModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }
  }
}
