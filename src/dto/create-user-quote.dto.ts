import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserQuoteDto {
  @IsMongoId()
  @IsNotEmpty()
  author: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  quote: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(100)
  deviceId: string;
}
