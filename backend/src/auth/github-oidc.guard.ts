/**
 * GithubOidcGuard — atomic guard for GitHub Actions OIDC Bearer tokens.
 *
 * Phase 2/11 of sitemap regen auth plan. Atomic wrapper over `GithubOidcService`
 * — extracts the Bearer token from the `Authorization` header and delegates
 * validation. Composed with `AdminSessionGuard` + `LegacyInternalKeyGuard` via
 * `AnyOf()` on sitemap controllers (Phase 5).
 *
 * Logic : require `Authorization: Bearer <jwt>` header → delegate to service.
 * Service handles signature verification, claim validation, and (Phase 4)
 * anti-replay.
 *
 * Fail-closed : throws if header missing, malformed scheme, OR service throws.
 * NO fallback — wrong/missing Bearer = reject. The AnyOf composite handles
 * "try next path" externally.
 *
 * Writes `req._authPath = 'github-oidc'` and `req._authClaims = <claims>` on
 * success for audit middleware.
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  GithubOidcService,
  type GithubOidcClaims,
} from './github-oidc.service';

@Injectable()
export class GithubOidcGuard implements CanActivate {
  constructor(private readonly oidc: GithubOidcService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization;

    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer token required');
    }

    const token = auth.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Empty Bearer token');
    }

    const claims: GithubOidcClaims = await this.oidc.validate(token);
    req._authPath = 'github-oidc';
    req._authClaims = claims;
    return true;
  }
}
