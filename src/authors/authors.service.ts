import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Author, AuthorDocument } from '../schemas/author.schema';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { UpdateAuthorDto } from '../dto/update-author.dto';
import { Quote, QuoteDocument } from '../schemas/quote.schema';

@Injectable()
export class AuthorsService {
  constructor(
    @InjectModel(Author.name) private authorModel: Model<AuthorDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
  ) {}

  async create(createAuthorDto: CreateAuthorDto): Promise<AuthorDocument> {
    // Check if author with this name already exists
    const existingAuthor = await this.authorModel
      .findOne({ name: createAuthorDto.name })
      .exec();
    if (existingAuthor) {
      throw new ConflictException(
        `Author with name '${createAuthorDto.name}' already exists`,
      );
    }

    const createdAuthor = new this.authorModel(createAuthorDto);
    return createdAuthor.save();
  }

  async findAll(): Promise<Author[]> {
    return this.authorModel.find().lean().exec();
  }

  async findOne(id: string): Promise<AuthorDocument> {
    const author = await this.authorModel.findById(id).exec();
    if (!author) {
      throw new NotFoundException(`Author with ID ${id} not found`);
    }
    return author;
  }

  async update(
    id: string,
    updateAuthorDto: UpdateAuthorDto,
  ): Promise<AuthorDocument> {
    // If updating the name, check if another author with this name already exists
    if (updateAuthorDto.name) {
      const existingAuthor = await this.authorModel
        .findOne({ name: updateAuthorDto.name, _id: { $ne: id } })
        .exec();
      if (existingAuthor) {
        throw new ConflictException(
          `Author with name '${updateAuthorDto.name}' already exists`,
        );
      }
    }

    const updatedAuthor = await this.authorModel
      .findByIdAndUpdate(id, updateAuthorDto, { new: true })
      .exec();
    if (!updatedAuthor) {
      throw new NotFoundException(`Author with ID ${id} not found`);
    }
    return updatedAuthor;
  }

  async remove(id: string): Promise<void> {
    const result = await this.authorModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Author with ID ${id} not found`);
    }

    await this.quoteModel.deleteMany({ author: result._id }).exec();
  }
}
