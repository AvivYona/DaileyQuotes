import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { VerifyAdminDto } from '../dto/verify-admin.dto';

@Controller('admin')
export class AdminController {
  @Post('verify')
  verify(@Body() verifyAdminDto: VerifyAdminDto) {
    const adminPassword = process.env.ADMIN_PASS;

    if (!adminPassword) {
      throw new UnauthorizedException('Admin password is not configured');
    }

    if (verifyAdminDto.password !== adminPassword) {
      throw new UnauthorizedException('Invalid password');
    }

    return { valid: true };
  }
}
