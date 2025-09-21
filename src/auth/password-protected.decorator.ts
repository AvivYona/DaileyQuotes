import { UseGuards, applyDecorators } from '@nestjs/common';
import { PasswordGuard } from './password.guard';

export function PasswordProtected() {
  return applyDecorators(UseGuards(PasswordGuard));
}
