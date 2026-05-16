import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InternalApiKeyGuard } from './internal-api-key.guard';

/**
 * Composite guard that accepts EITHER an admin browser session OR a valid
 * `X-Internal-Key` header. Useful for endpoints that must be reachable from
 * both the admin UI (manual op) and an automated cron/CI (GitHub Action,
 * internal script).
 *
 * When the header is present we delegate strict validation (timing-safe
 * comparison + ForbiddenException on mismatch) to `InternalApiKeyGuard` so
 * a misconfigured caller fails fast rather than silently falling back to
 * session auth.
 */
@Injectable()
export class AdminOrInternalKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminOrInternalKeyGuard.name);

  constructor(private readonly internalKeyGuard: InternalApiKeyGuard) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.headers['x-internal-key']) {
      return this.internalKeyGuard.canActivate(context);
    }

    const user = request.user;
    const isAdmin =
      user?.isAdmin === true || parseInt(String(user?.level || 0), 10) >= 7;

    if (!isAdmin) {
      this.logger.warn(
        `Admin/internal access denied for ${user?.email || 'anonymous'} on ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException(
        'Admin session or X-Internal-Key required',
      );
    }
    return true;
  }
}
