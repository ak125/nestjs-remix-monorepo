/**
 * AnyOf — composite guard factory mixin.
 *
 * Phase 2/11 of sitemap regen auth plan. Tries each provided guard in sequence
 * and returns `true` at the first success. If all guards throw or reject,
 * throws the first error encountered.
 *
 * Each composed guard remains atomic and independently testable — Phase E
 * cleanly removes a path by retiring it from the AnyOf list + provider, with
 * zero touch on the other auth flows. Cf. memory
 * `feedback_separate_guard_per_auth_path`.
 *
 * Usage on a controller method :
 * ```ts
 * @UseGuards(AnyOf(AdminSessionGuard, GithubOidcGuard, LegacyInternalKeyGuard))
 * @Post('generate-all')
 * async generateAll() { ... }
 * ```
 *
 * Resolution uses `ModuleRef` so the composite can hydrate each underlying
 * guard from the DI container at request time. The underlying guards must be
 * registered as providers in the consuming module (e.g. `seo.module.ts`).
 */

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

export function AnyOf(...guards: Type<CanActivate>[]): Type<CanActivate> {
  @Injectable()
  class AnyOfComposite implements CanActivate {
    private readonly logger = new Logger('AnyOfGuard');

    constructor(private readonly moduleRef: ModuleRef) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
      const errors: Array<{ name: string; err: unknown }> = [];

      for (const GuardClass of guards) {
        let instance: CanActivate;
        try {
          instance = this.moduleRef.get(GuardClass, { strict: false });
        } catch (_err) {
          // Provider not registered in any module. This is a wiring error —
          // surface immediately rather than silently skipping the guard.
          throw new Error(
            `AnyOf: guard ${GuardClass.name} not found in DI container — register it as a provider in the consuming module`,
          );
        }

        try {
          const result = await instance.canActivate(ctx);
          if (result === true) {
            return true;
          }
          errors.push({
            name: GuardClass.name,
            err: new Error(`${GuardClass.name}.canActivate returned false`),
          });
        } catch (err) {
          errors.push({ name: GuardClass.name, err });
        }
      }

      this.logger.warn(
        `All auth paths rejected: ${errors.map((e) => e.name).join(', ')}`,
      );

      // Re-throw the first underlying error. If it's already an HttpException
      // it'll propagate with its proper status; otherwise wrap.
      const first = errors[0]?.err;
      if (first instanceof Error) {
        throw first;
      }
      throw new UnauthorizedException('No auth method matched');
    }
  }
  return AnyOfComposite;
}
