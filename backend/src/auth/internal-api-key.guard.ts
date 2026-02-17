import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

/**
 * Guard for internal-only endpoints (cron jobs, scripts).
 * Validates X-Internal-Key header against INTERNAL_API_KEY env var.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(InternalApiKeyGuard.name);
  private readonly expectedKey: string;

  constructor(private readonly configService: ConfigService) {
    this.expectedKey = this.configService.get<string>('INTERNAL_API_KEY', '');
    if (!this.expectedKey) {
      this.logger.warn(
        'INTERNAL_API_KEY not set — internal endpoints will reject all requests',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-internal-key'] as string;

    if (!this.expectedKey || !providedKey) {
      this.logger.warn('Internal endpoint access denied: missing key');
      throw new ForbiddenException('Access denied');
    }

    const expected = Buffer.from(this.expectedKey, 'utf8');
    const provided = Buffer.from(providedKey, 'utf8');

    if (
      expected.length !== provided.length ||
      !timingSafeEqual(expected, provided)
    ) {
      this.logger.warn('Internal endpoint access denied: invalid key');
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
