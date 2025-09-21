import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class PasswordGuard implements CanActivate {
  private readonly expectedPassword = process.env.API_PASSWORD;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const password = request.headers['x-api-password'];

    if (!password) {
      throw new UnauthorizedException('Password header is required');
    }

    if (password !== this.expectedPassword) {
      throw new UnauthorizedException('Invalid password');
    }

    return true;
  }
}
