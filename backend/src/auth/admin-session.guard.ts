/**
 * AdminSessionGuard — atomic guard for admin session-based auth.
 *
 * Phase 2/11 of sitemap regen auth plan. One of three atomic guards composed
 * via `AnyOf(AdminSessionGuard, GithubOidcGuard, LegacyInternalKeyGuard)` on
 * sitemap write endpoints (Phase 5 cutover).
 *
 * Logic : cookie-based session (Passport.js local strategy, established at
 * `/auth/login`) → `req.user` populated → check `level >= 7` OR `isAdmin === true`.
 *
 * Fail-closed : throws `UnauthorizedException` on missing user or insufficient
 * level. NO fallback to other auth paths inside this guard — the AnyOf composite
 * handles the "try next path" semantics externally.
 *
 * Writes `req._authPath = 'admin-session'` on success for audit middleware.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  private readonly logger = new Logger(AdminSessionGuard.name);

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();

    if (!req.user) {
      throw new UnauthorizedException('Authentication required');
    }

    const level = parseInt(String(req.user.level || 0), 10);
    const isAdmin = req.user.isAdmin === true || level >= 7;

    if (!isAdmin) {
      this.logger.warn(
        `Admin denied: ${req.user.email || 'anonymous'} (level=${level}) on ${req.method} ${req.url}`,
      );
      throw new UnauthorizedException('Admin level required');
    }

    req._authPath = 'admin-session';
    return true;
  }
}
