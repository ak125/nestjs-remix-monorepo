/**
 * Served-metadata write authorization — broken-access-control P0.
 *
 * All HTTP-reachable mutators of the SERVED `___meta_tags_ariane` table must
 * require an admin session (isAdmin === true OR level >= 7), i.e. the canonical
 * `@UseGuards(AuthenticatedGuard, IsAdminGuard)` boundary already used on ~40
 * admin-write controllers (incl. the sibling `BreadcrumbAdminController` that
 * writes this exact table).
 *
 * Before the fix:
 *   - `PUT /api/seo/metadata` + `POST /api/seo/batch-update` were guarded by
 *     `AuthenticatedGuard` ONLY → any logged-in customer (self-register grants a
 *     level-1 account) could rewrite served meta_title/description/H1/robots.
 *   - `PUT /api/metadata/{*path}`, `DELETE /api/metadata/{*path}` and
 *     `POST /api/breadcrumb/{*path}` had NO guard at all → fully anonymous.
 *
 * This test asserts the security CONTRACT (anon refused · non-admin refused ·
 * admin preserved) by evaluating the guards ACTUALLY APPLIED to each handler —
 * so it fails RED until every mutator wires the canonical admin boundary.
 *
 * @see backend/src/modules/seo/seo.controller.ts
 * @see backend/src/modules/metadata/controllers/optimized-metadata.controller.ts
 * @see backend/src/modules/metadata/controllers/optimized-breadcrumb.controller.ts
 * @see backend/src/auth/is-admin.guard.ts
 * @see backend/src/auth/authenticated.guard.ts
 */
import { ExecutionContext, Type } from '@nestjs/common';

import { IsAdminGuard } from '@auth/is-admin.guard';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { SeoController } from '../../src/modules/seo/seo.controller';
import { OptimizedMetadataController } from '../../src/modules/metadata/controllers/optimized-metadata.controller';
import { OptimizedBreadcrumbController } from '../../src/modules/metadata/controllers/optimized-breadcrumb.controller';

// NestJS stores `@UseGuards(...)` classes under this reflection key
// (`GUARDS_METADATA` from `@nestjs/common/constants` — stable literal).
const GUARDS_METADATA = '__guards__';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Same minimal ExecutionContext mock shape as `tests/unit/auth-guards.test.ts`. */
function createMockExecutionContext(request: any): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

/**
 * Effective guard chain for a route = class-level guards ++ method-level guards
 * (both must pass in NestJS). Returns the guard CLASSES as applied by @UseGuards.
 */
function effectiveGuards(
  controller: Type<any>,
  method: string,
): Array<Type<any>> {
  const classGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller) || [];
  const methodGuards: Array<Type<any>> =
    Reflect.getMetadata(GUARDS_METADATA, controller.prototype[method]) || [];
  return [...classGuards, ...methodGuards];
}

/**
 * Runs the applied guard chain against a request. Denied if ANY guard returns
 * non-true or throws. An empty chain (no guards) => allowed — which is exactly
 * how an unguarded endpoint lets anyone through.
 */
function isAllowed(guards: Array<Type<any>>, request: any): boolean {
  const ctx = createMockExecutionContext(request);
  for (const Guard of guards) {
    const instance = new Guard();
    let result: unknown;
    try {
      result = instance.canActivate(ctx);
    } catch {
      return false; // guard threw (e.g. UnauthorizedException) => denied
    }
    if (result !== true) return false;
  }
  return true;
}

// ─── Principals ───────────────────────────────────────────────────────────────

const anonymous = () => ({
  path: '/x',
  isAuthenticated: () => false,
  user: undefined,
});

// A logged-in NON-admin customer — exactly what public self-register grants.
const nonAdminCustomer = () => ({
  path: '/x',
  isAuthenticated: () => true,
  user: { email: 'customer@test.com', isAdmin: false, level: '1' },
});

const admin = () => ({
  path: '/x',
  isAuthenticated: () => true,
  user: { email: 'admin@test.com', isAdmin: true, level: '9' },
});

// ─── The complete served-metadata mutator surface ─────────────────────────────

const WRITE_ENDPOINTS: Array<{
  label: string;
  controller: Type<any>;
  method: string;
}> = [
  { label: 'PUT /api/seo/metadata', controller: SeoController, method: 'updateMetadata' },
  { label: 'POST /api/seo/batch-update', controller: SeoController, method: 'batchUpdateMetadata' },
  { label: 'PUT /api/metadata/{*path}', controller: OptimizedMetadataController, method: 'updateMetadata' },
  { label: 'DELETE /api/metadata/{*path}', controller: OptimizedMetadataController, method: 'deleteMetadata' },
  { label: 'POST /api/breadcrumb/{*path}', controller: OptimizedBreadcrumbController, method: 'updateBreadcrumb' },
];

describe('served-metadata write endpoints enforce the admin boundary (P0 broken access control)', () => {
  describe.each(WRITE_ENDPOINTS)('$label', ({ controller, method }) => {
    it('wires the canonical AuthenticatedGuard + IsAdminGuard', () => {
      const guards = effectiveGuards(controller, method);
      expect(guards).toContain(AuthenticatedGuard);
      expect(guards).toContain(IsAdminGuard);
    });

    it('refuses anonymous requests', () => {
      expect(isAllowed(effectiveGuards(controller, method), anonymous())).toBe(false);
    });

    it('refuses authenticated non-admin (level 1) requests', () => {
      expect(isAllowed(effectiveGuards(controller, method), nonAdminCustomer())).toBe(false);
    });

    it('allows admin (isAdmin / level >= 7) — existing behavior preserved', () => {
      expect(isAllowed(effectiveGuards(controller, method), admin())).toBe(true);
    });
  });
});
