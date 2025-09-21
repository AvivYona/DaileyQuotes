import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Author, AuthorDocument } from '../schemas/author.schema';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { UpdateAuthorDto } from '../dto/update-author.dto';

@Injectable()
export class AuthorsService {
  constructor(
    @InjectModel(Author.name) private authorModel: Model<AuthorDocument>,
  ) {}

  async create(createAuthorDto: CreateAuthorDto): Promise<AuthorDocument> {
    const createdAuthor = new this.authorModel(createAuthorDto);
    return createdAuthor.save();
  }

  async findAll(): Promise<AuthorDocument[]> {
    console.log('Database name:', this.authorModel.db.name);
    console.log('Collection name:', this.authorModel.collection.name);
    const result = await this.authorModel.find().exec();
    console.log('Query result:', result);
    return result;
  }

  async findOne(id: string): Promise<AuthorDocument> {
    const author = await this.authorModel.findById(id).exec();
    if (!author) {
      throw new NotFoundException(`Author with ID ${id} not found`);
    }
    return author;
  }

  async update(id: string, updateAuthorDto: UpdateAuthorDto): Promise<AuthorDocument> {
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
  }
}
