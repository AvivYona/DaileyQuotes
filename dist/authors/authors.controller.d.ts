import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { UpdateAuthorDto } from '../dto/update-author.dto';
export declare class AuthorsController {
    private readonly authorsService;
    constructor(authorsService: AuthorsService);
    create(createAuthorDto: CreateAuthorDto): Promise<import("../schemas/author.schema").AuthorDocument>;
    findAll(): Promise<import("../schemas/author.schema").AuthorDocument[]>;
    findOne(id: string): Promise<import("../schemas/author.schema").AuthorDocument>;
    update(id: string, updateAuthorDto: UpdateAuthorDto): Promise<import("../schemas/author.schema").AuthorDocument>;
    remove(id: string): Promise<{
        message: string;
    }>;
}
