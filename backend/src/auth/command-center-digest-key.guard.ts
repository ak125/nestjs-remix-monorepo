import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Guard for GET /api/internal/command-center/digest only (Hermes supervisor collector).
 * Validates X-Command-Center-Key against COMMAND_CENTER_DIGEST_KEY_SHA256, the SHA-256
 * hex of the key: the backend keeps a verifier, the key itself stays with the collector.
 * Unlike INTERNAL_API_KEY, this key opens no other route.
 *
 * Unset or malformed variable → every key rejected. Revocation: remove or replace the
 * variable, then restart the backend. The key is never logged.
 */
@Injectable()
export class CommandCenterDigestKeyGuard implements CanActivate {
  private readonly logger = new Logger(CommandCenterDigestKeyGuard.name);
  private readonly expectedDigest: Buffer | null;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>(
      'COMMAND_CENTER_DIGEST_KEY_SHA256',
      '',
    );
    this.expectedDigest = /^[0-9a-f]{64}$/i.test(configured)
      ? Buffer.from(configured, 'hex')
      : null;
    if (!this.expectedDigest) {
      this.logger.warn(
        configured
          ? 'COMMAND_CENTER_DIGEST_KEY_SHA256 is not a SHA-256 hex digest — digest key rejected'
          : 'COMMAND_CENTER_DIGEST_KEY_SHA256 not set — digest key rejected',
      );
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-command-center-key'];

    // No key here: the request may carry another credential accepted on this route.
    if (
      !this.expectedDigest ||
      typeof providedKey !== 'string' ||
      !providedKey
    ) {
      throw new ForbiddenException('Access denied');
    }

    const provided = createHash('sha256').update(providedKey, 'utf8').digest();
    if (!timingSafeEqual(this.expectedDigest, provided)) {
      this.logger.warn(
        'Command Center digest access denied: invalid digest key',
      );
      throw new ForbiddenException('Access denied');
    }

    this.logger.log('Command Center digest read with the digest key');
    return true;
  }
}
