import { Model } from 'mongoose';
import { AuthorDocument } from '../schemas/author.schema';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { UpdateAuthorDto } from '../dto/update-author.dto';
export declare class AuthorsService {
    private authorModel;
    constructor(authorModel: Model<AuthorDocument>);
    create(createAuthorDto: CreateAuthorDto): Promise<AuthorDocument>;
    findAll(): Promise<AuthorDocument[]>;
    findOne(id: string): Promise<AuthorDocument>;
    update(id: string, updateAuthorDto: UpdateAuthorDto): Promise<AuthorDocument>;
    remove(id: string): Promise<void>;
}
