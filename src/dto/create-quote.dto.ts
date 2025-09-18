import { IsString, IsNotEmpty, IsMongoId } from 'class-validator';

export class CreateQuoteDto {
  @IsMongoId()
  @IsNotEmpty()
  author: string;

  @IsString()
  @IsNotEmpty()
  quote: string;
}
