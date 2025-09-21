"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const author_schema_1 = require("../schemas/author.schema");
let AuthorsService = class AuthorsService {
    constructor(authorModel) {
        this.authorModel = authorModel;
    }
    async create(createAuthorDto) {
        const createdAuthor = new this.authorModel(createAuthorDto);
        return createdAuthor.save();
    }
    async findAll() {
        console.log('Database name:', this.authorModel.db.name);
        console.log('Collection name:', this.authorModel.collection.name);
        const result = await this.authorModel.find().exec();
        console.log('Query result:', result);
        return result;
    }
    async findOne(id) {
        const author = await this.authorModel.findById(id).exec();
        if (!author) {
            throw new common_1.NotFoundException(`Author with ID ${id} not found`);
        }
        return author;
    }
    async update(id, updateAuthorDto) {
        const updatedAuthor = await this.authorModel
            .findByIdAndUpdate(id, updateAuthorDto, { new: true })
            .exec();
        if (!updatedAuthor) {
            throw new common_1.NotFoundException(`Author with ID ${id} not found`);
        }
        return updatedAuthor;
    }
    async remove(id) {
        const result = await this.authorModel.findByIdAndDelete(id).exec();
        if (!result) {
            throw new common_1.NotFoundException(`Author with ID ${id} not found`);
        }
    }
};
exports.AuthorsService = AuthorsService;
exports.AuthorsService = AuthorsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(author_schema_1.Author.name)),
    __metadata("design:paramtypes", [mongoose_2.Model])
], AuthorsService);
//# sourceMappingURL=authors.service.js.map