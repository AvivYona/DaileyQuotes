import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyAdminDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}
