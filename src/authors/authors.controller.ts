import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from '../dto/create-author.dto';
import { UpdateAuthorDto } from '../dto/update-author.dto';

@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Post()
  async create(@Body() createAuthorDto: CreateAuthorDto) {
    const result = await this.authorsService.create(createAuthorDto);
    return result;
  }

  @Get()
  async findAll() {
    const result = await this.authorsService.findAll();
    return result;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const result = await this.authorsService.findOne(id);
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateAuthorDto: UpdateAuthorDto) {
    const result = await this.authorsService.update(id, updateAuthorDto);
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.authorsService.remove(id);
    return { message: 'Author deleted successfully' };
  }
}
