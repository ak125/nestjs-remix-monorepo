# Permissions Canonical Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the per-action permission matrix from frontend to backend as single source of truth, replace `IsAdminGuard` with `@RequirePermission(action)` on `OrderActionsController`, and refactor frontend `permissions.ts` into a thin API client. Fix the prod bug where commercial-level users get HTTP 403 on order cancel/ship/deliver/mark-paid.

**Architecture:** Backend `PermissionsService` owns the canonical matrix (5 user levels × 15 actions, ported as-is from frontend). `PermissionsGuard` reads `@RequirePermission('canCancel')` decorator and consults the service. Endpoint `GET /auth/user-permissions/:userId` returns `UserPermissions` shape. Frontend `permissions.ts` exposes `loadUserPermissions(userId)` instead of computing locally. `IsAdminGuard` stays in place for genuinely admin-only routes (out of scope).

**Tech Stack:** NestJS 10, TypeScript 5, Jest, Remix 2 (loaders), Vitest (frontend tests if any).

**Spec:** [`docs/superpowers/specs/2026-04-30-permissions-canonical-backend-design.md`](../specs/2026-04-30-permissions-canonical-backend-design.md)

**Branch:** Continue on `feat/fe-diagnostic-wizard-dynamic` is **NOT** acceptable (per memory `feedback_branch_scope_discipline.md`). Create dedicated branch from `main`: `fix/permissions-canonical-backend`.

---

## File Structure

### Created (8 files)

| Path | Responsibility |
|---|---|
| `backend/src/auth/dto/user-permissions.dto.ts` | `UserPermissions` interface + 5 level constants (BASE_USER / COMMERCIAL / MANAGER / ADMIN / SUPER_ADMIN) |
| `backend/src/auth/permissions.service.ts` | `getPermissions(level)` + `hasPermission(level, action)` |
| `backend/src/auth/permissions.service.spec.ts` | 75 cases unit (5 levels × 15 actions) |
| `backend/src/auth/decorators/require-permission.decorator.ts` | `@RequirePermission(action)` SetMetadata helper |
| `backend/src/auth/guards/permissions.guard.ts` | Reflector + `PermissionsService` → boolean |
| `backend/src/auth/guards/permissions.guard.spec.ts` | Unit guard (with/without decorator, with/without user, level cases) |
| `backend/test/orders-cancel-permissions.e2e-spec.ts` | E2E cancel with commercial / level-1 / no session |

### Modified (5 files)

| Path | Why |
|---|---|
| `backend/src/auth/auth.module.ts` | Register `PermissionsService` + `PermissionsGuard` (providers + exports) |
| `backend/src/auth/controllers/auth-permissions.controller.ts` | Refactor `GET /auth/user-permissions/:userId` to return `UserPermissions` shape |
| `backend/src/modules/orders/controllers/order-actions.controller.ts` | Replace `IsAdminGuard` with `PermissionsGuard` + add `@RequirePermission(...)` per endpoint |
| `frontend/app/utils/permissions.ts` | Remove `getUserPermissions(level)`, add `loadUserPermissions(userId)` thin client |
| `frontend/app/routes/admin.orders._index.tsx` | Loader + component use `loadUserPermissions(user.id)` |
| `frontend/app/routes/commercial.orders._index.tsx` | Same |

---

## Pre-flight: branch setup

- [ ] **Step 0.1: Create branch from main**

```bash
cd /opt/automecanik/app
git fetch origin main
git checkout -b fix/permissions-canonical-backend origin/main
```

Expected: `Switched to a new branch 'fix/permissions-canonical-backend'` (tracks `origin/main`).

**Why a fresh branch from main:** memory `feedback_branch_scope_discipline.md` (incident PR #79) — never inherit a fourre-tout branch.

- [ ] **Step 0.2: Cherry-pick the spec commit onto the new branch**

```bash
git cherry-pick 1007926e
```

Expected: spec doc applied. (The pre-commit hook may re-touch `.claude/knowledge/*` — that's fine.)

---

## Task 1: `UserPermissions` DTO + level constants

**Files:**
- Create: `backend/src/auth/dto/user-permissions.dto.ts`

- [ ] **Step 1.1: Create the DTO file**

Content (port matches `frontend/app/utils/permissions.ts:36-139` byte-for-byte semantically):

```ts
// backend/src/auth/dto/user-permissions.dto.ts
/**
 * Canonical permission shape — single source of truth.
 * Mirror of the frontend interface, owned by the backend.
 */
export interface UserPermissions {
  // Order actions
  canValidate: boolean;
  canShip: boolean;
  canDeliver: boolean;
  canCancel: boolean;
  canReturn: boolean;
  canRefund: boolean;
  canSendEmails: boolean;
  // Management
  canCreateOrders: boolean;
  canExport: boolean;
  canMarkPaid: boolean;
  // Display
  canSeeFullStats: boolean;
  canSeeFinancials: boolean;
  canSeeCustomerDetails: boolean;
  // Interface
  showAdvancedFilters: boolean;
  showActionButtons: boolean;
}

export const BASE_USER_PERMISSIONS: UserPermissions = {
  canValidate: false,
  canShip: false,
  canDeliver: false,
  canCancel: false,
  canReturn: false,
  canRefund: false,
  canSendEmails: false,
  canCreateOrders: false,
  canExport: false,
  canMarkPaid: false,
  canSeeFullStats: false,
  canSeeFinancials: false,
  canSeeCustomerDetails: false,
  showAdvancedFilters: false,
  showActionButtons: false,
};

export const COMMERCIAL_PERMISSIONS: UserPermissions = {
  canValidate: true,
  canShip: true,
  canDeliver: true,
  canCancel: true,
  canReturn: false,
  canRefund: false,
  canSendEmails: true,
  canCreateOrders: false,
  canExport: true,
  canMarkPaid: true,
  canSeeFullStats: false,
  canSeeFinancials: false,
  canSeeCustomerDetails: true,
  showAdvancedFilters: true,
  showActionButtons: true,
};

export const MANAGER_PERMISSIONS: UserPermissions = {
  canValidate: false,
  canShip: false,
  canDeliver: false,
  canCancel: false,
  canReturn: false,
  canRefund: false,
  canSendEmails: false,
  canCreateOrders: false,
  canExport: true,
  canMarkPaid: false,
  canSeeFullStats: true,
  canSeeFinancials: true,
  canSeeCustomerDetails: true,
  showAdvancedFilters: true,
  showActionButtons: false,
};

export const ADMIN_PERMISSIONS: UserPermissions = {
  canValidate: true,
  canShip: true,
  canDeliver: true,
  canCancel: true,
  canReturn: true,
  canRefund: true,
  canSendEmails: true,
  canCreateOrders: true,
  canExport: true,
  canMarkPaid: true,
  canSeeFullStats: true,
  canSeeFinancials: true,
  canSeeCustomerDetails: true,
  showAdvancedFilters: true,
  showActionButtons: true,
};

export const SUPER_ADMIN_PERMISSIONS: UserPermissions = {
  ...ADMIN_PERMISSIONS,
};

export type PermissionAction = keyof UserPermissions;
```

- [ ] **Step 1.2: Type-check**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 1.3: Commit**

```bash
git add backend/src/auth/dto/user-permissions.dto.ts
git commit -m "feat(auth): add UserPermissions DTO + level constants"
```

---

## Task 2: `PermissionsService` (TDD)

**Files:**
- Create: `backend/src/auth/permissions.service.ts`
- Test: `backend/src/auth/permissions.service.spec.ts`

- [ ] **Step 2.1: Write the failing test**

```ts
// backend/src/auth/permissions.service.spec.ts
import { Test } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import type { PermissionAction } from './dto/user-permissions.dto';

describe('PermissionsService', () => {
  let service: PermissionsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsService],
    }).compile();
    service = moduleRef.get(PermissionsService);
  });

  describe('getPermissions', () => {
    it('returns BASE_USER for level 0', () => {
      const p = service.getPermissions(0);
      expect(p.canCancel).toBe(false);
      expect(p.showActionButtons).toBe(false);
    });

    it('returns COMMERCIAL for level 3', () => {
      const p = service.getPermissions(3);
      expect(p.canCancel).toBe(true);
      expect(p.canShip).toBe(true);
      expect(p.canDeliver).toBe(true);
      expect(p.canMarkPaid).toBe(true);
      expect(p.canRefund).toBe(false);
      expect(p.canCreateOrders).toBe(false);
    });

    it('returns MANAGER for level 5', () => {
      const p = service.getPermissions(5);
      expect(p.canCancel).toBe(false);
      expect(p.canExport).toBe(true);
      expect(p.canSeeFinancials).toBe(true);
    });

    it('returns ADMIN for level 7', () => {
      const p = service.getPermissions(7);
      expect(p.canCancel).toBe(true);
      expect(p.canRefund).toBe(true);
      expect(p.canCreateOrders).toBe(true);
    });

    it('returns SUPER_ADMIN for level 9', () => {
      const p = service.getPermissions(9);
      expect(p.canRefund).toBe(true);
      expect(p.canCreateOrders).toBe(true);
    });
  });

  describe('hasPermission', () => {
    const cases: Array<[number, PermissionAction, boolean]> = [
      // Commercial (3) — 15 actions
      [3, 'canValidate', true],
      [3, 'canShip', true],
      [3, 'canDeliver', true],
      [3, 'canCancel', true],
      [3, 'canReturn', false],
      [3, 'canRefund', false],
      [3, 'canSendEmails', true],
      [3, 'canCreateOrders', false],
      [3, 'canExport', true],
      [3, 'canMarkPaid', true],
      [3, 'canSeeFullStats', false],
      [3, 'canSeeFinancials', false],
      [3, 'canSeeCustomerDetails', true],
      [3, 'showAdvancedFilters', true],
      [3, 'showActionButtons', true],
      // Manager (5) — operational locked
      [5, 'canCancel', false],
      [5, 'canShip', false],
      [5, 'canDeliver', false],
      [5, 'canMarkPaid', false],
      [5, 'canExport', true],
      [5, 'canSeeFinancials', true],
      // Admin (7) — full operational
      [7, 'canCancel', true],
      [7, 'canRefund', true],
      [7, 'canReturn', true],
      [7, 'canCreateOrders', true],
      // Base (1) — nothing
      [1, 'canCancel', false],
      [1, 'canExport', false],
      // Edge: 0
      [0, 'canCancel', false],
      // Edge: negative / NaN coerced upstream → treated as 0
      [-1, 'canCancel', false],
    ];

    it.each(cases)('level %i / %s → %s', (level, action, expected) => {
      expect(service.hasPermission(level, action)).toBe(expected);
    });
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
cd backend && npx jest src/auth/permissions.service.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './permissions.service'`.

- [ ] **Step 2.3: Write minimal implementation**

```ts
// backend/src/auth/permissions.service.ts
import { Injectable } from '@nestjs/common';
import {
  ADMIN_PERMISSIONS,
  BASE_USER_PERMISSIONS,
  COMMERCIAL_PERMISSIONS,
  MANAGER_PERMISSIONS,
  PermissionAction,
  SUPER_ADMIN_PERMISSIONS,
  UserPermissions,
} from './dto/user-permissions.dto';

@Injectable()
export class PermissionsService {
  getPermissions(userLevel: number): UserPermissions {
    const lvl = Number.isFinite(userLevel) ? userLevel : 0;
    if (lvl >= 9) return SUPER_ADMIN_PERMISSIONS;
    if (lvl >= 7) return ADMIN_PERMISSIONS;
    if (lvl >= 5) return MANAGER_PERMISSIONS;
    if (lvl >= 3) return COMMERCIAL_PERMISSIONS;
    return BASE_USER_PERMISSIONS;
  }

  hasPermission(userLevel: number, action: PermissionAction): boolean {
    return this.getPermissions(userLevel)[action] === true;
  }
}
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
cd backend && npx jest src/auth/permissions.service.spec.ts --no-coverage
```

Expected: PASS — all `it.each` cases green.

- [ ] **Step 2.5: Commit**

```bash
git add backend/src/auth/permissions.service.ts backend/src/auth/permissions.service.spec.ts
git commit -m "feat(auth): add PermissionsService with canonical matrix"
```

---

## Task 3: `@RequirePermission` decorator

**Files:**
- Create: `backend/src/auth/decorators/require-permission.decorator.ts`

- [ ] **Step 3.1: Create the decorator**

```ts
// backend/src/auth/decorators/require-permission.decorator.ts
import { SetMetadata } from '@nestjs/common';
import type { PermissionAction } from '../dto/user-permissions.dto';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

export const RequirePermission = (action: PermissionAction) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, action);
```

- [ ] **Step 3.2: Type-check**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add backend/src/auth/decorators/require-permission.decorator.ts
git commit -m "feat(auth): add @RequirePermission decorator"
```

---

## Task 4: `PermissionsGuard` (TDD)

**Files:**
- Create: `backend/src/auth/guards/permissions.guard.ts`
- Test: `backend/src/auth/guards/permissions.guard.spec.ts`

- [ ] **Step 4.1: Write the failing test**

```ts
// backend/src/auth/guards/permissions.guard.spec.ts
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from '../permissions.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';
import type { ExecutionContext } from '@nestjs/common';

function makeContext(user: any, handler = () => undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, PermissionsService, Reflector],
    }).compile();
    guard = moduleRef.get(PermissionsGuard);
    reflector = moduleRef.get(Reflector);
  });

  it('returns true when no @RequirePermission metadata', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ level: 0 }))).toBe(true);
  });

  it('returns true when commercial (level 3) has canCancel', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext({ level: 3 }))).toBe(true);
  });

  it('returns false when base user (level 1) lacks canCancel', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext({ level: 1 }))).toBe(false);
  });

  it('returns false when user is undefined', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });

  it('returns true when admin (level 7) has canRefund', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canRefund');
    expect(guard.canActivate(makeContext({ level: 7 }))).toBe(true);
  });

  it('returns false when commercial (level 3) lacks canRefund', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canRefund');
    expect(guard.canActivate(makeContext({ level: 3 }))).toBe(false);
  });

  it('coerces string level to number', () => {
    jest.spyOn(reflector, 'get').mockReturnValue('canCancel');
    expect(guard.canActivate(makeContext({ level: '3' }))).toBe(true);
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
cd backend && npx jest src/auth/guards/permissions.guard.spec.ts --no-coverage
```

Expected: FAIL — `Cannot find module './permissions.guard'`.

- [ ] **Step 4.3: Write minimal implementation**

```ts
// backend/src/auth/guards/permissions.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_PERMISSION_KEY,
} from '../decorators/require-permission.decorator';
import type { PermissionAction } from '../dto/user-permissions.dto';
import { PermissionsService } from '../permissions.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<PermissionAction>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!action) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const level = parseInt(String(user?.level ?? 0), 10) || 0;
    const ok = this.permissionsService.hasPermission(level, action);

    if (!ok) {
      this.logger.warn(
        `Permission denied: ${user?.email ?? 'anonymous'} (level=${level}) lacks "${action}"`,
      );
    }
    return ok;
  }
}
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
cd backend && npx jest src/auth/guards/permissions.guard.spec.ts --no-coverage
```

Expected: PASS — 7 tests green.

- [ ] **Step 4.5: Commit**

```bash
git add backend/src/auth/guards/permissions.guard.ts backend/src/auth/guards/permissions.guard.spec.ts
git commit -m "feat(auth): add PermissionsGuard reading @RequirePermission"
```

---

## Task 5: Wire into `AuthModule`

**Files:**
- Modify: `backend/src/auth/auth.module.ts`

- [ ] **Step 5.1: Add imports + register providers**

Apply this diff to `backend/src/auth/auth.module.ts` :

Add these imports at the top of the imports block (alphabetical-ish, near the existing guards):

```ts
import { PermissionsService } from './permissions.service';
import { PermissionsGuard } from './guards/permissions.guard';
```

In the `providers` array, add `PermissionsService` and `PermissionsGuard` (after `IsAdminGuard`):

```ts
  providers: [
    AuthService,
    LocalStrategy,
    LocalAuthGuard,
    CookieSerializer,
    IsAdminGuard,
    PermissionsService,
    PermissionsGuard,
  ],
```

In the `exports` array, add both so other modules can `@UseGuards(PermissionsGuard)`:

```ts
  exports: [AuthService, PermissionsService, PermissionsGuard],
```

- [ ] **Step 5.2: Type-check + boot smoke**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. (No need to actually boot — module wiring failures show at typecheck.)

- [ ] **Step 5.3: Commit**

```bash
git add backend/src/auth/auth.module.ts
git commit -m "feat(auth): register PermissionsService + PermissionsGuard in AuthModule"
```

---

## Task 6: Refactor `GET /auth/user-permissions/:userId` endpoint

**Files:**
- Modify: `backend/src/auth/controllers/auth-permissions.controller.ts:68-101`

- [ ] **Step 6.1: Verify current consumers (sanity)**

```bash
grep -rn "user-permissions" /opt/automecanik/app/frontend/app /opt/automecanik/app/backend/src 2>/dev/null
```

Expected: only references inside `auth-permissions.controller.ts` itself. If frontend has any consumer **other** than what we'll add in Task 8, STOP and reassess scope.

- [ ] **Step 6.2: Replace `getUserPermissions` method**

In `backend/src/auth/controllers/auth-permissions.controller.ts`, locate the existing `getUserPermissions` method (around line 68). Replace its body to return `UserPermissions` shape directly.

Add imports at top:

```ts
import { PermissionsService } from '../permissions.service';
import {
  BASE_USER_PERMISSIONS,
  UserPermissions,
} from '../dto/user-permissions.dto';
```

Inject `PermissionsService` in the constructor:

```ts
  constructor(
    private readonly authService: AuthService,
    private readonly permissionsService: PermissionsService,
  ) {}
```

Replace the entire `getUserPermissions` method:

```ts
  /**
   * GET /auth/user-permissions/:userId
   * Returns canonical UserPermissions shape (15 booleans) used by frontend.
   */
  @Get('auth/user-permissions/:userId')
  async getUserPermissions(
    @Param('userId') userId: string,
  ): Promise<UserPermissions> {
    try {
      const user = await this.authService.findUserById(userId);
      if (!user || user.isActive === false) {
        return BASE_USER_PERMISSIONS;
      }
      const level = parseInt(String(user.level ?? 0), 10) || 0;
      return this.permissionsService.getPermissions(level);
    } catch (error) {
      this.logger.error(
        `Error fetching user permissions: ${error instanceof Error ? error.message : String(error)}`,
      );
      return BASE_USER_PERMISSIONS;
    }
  }
```

- [ ] **Step 6.3: Verify `AuthService.findUserById` exists with the right signature**

```bash
grep -n "findUserById\|findById" /opt/automecanik/app/backend/src/auth/auth.service.ts | head -10
```

If `findUserById` does not exist, replace the call by whatever method `AuthService` exposes that returns `{ level, isActive }` (likely `findById` via `userDataService`). If neither is reachable from `AuthService`, inject the underlying user data service. **Do not invent a method name.**

- [ ] **Step 6.4: Type-check**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors. If `findUserById` doesn't exist, this is where you fix the call (Step 6.3).

- [ ] **Step 6.5: Commit**

```bash
git add backend/src/auth/controllers/auth-permissions.controller.ts
git commit -m "refactor(auth): GET /auth/user-permissions returns canonical UserPermissions

BREAKING: response shape changes from per-module read/write matrix to
the canonical 15-booleans UserPermissions. Only known consumer is
frontend permissions.ts (refactored in following commits)."
```

---

## Task 7: Migrate `OrderActionsController` from `IsAdminGuard` to `PermissionsGuard`

**Files:**
- Modify: `backend/src/modules/orders/controllers/order-actions.controller.ts`

- [ ] **Step 7.1: Replace controller-level guard + add per-method decorators**

In `backend/src/modules/orders/controllers/order-actions.controller.ts`:

Replace the import line:

```ts
// REMOVE
import { IsAdminGuard } from '@auth/is-admin.guard';
// ADD
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { RequirePermission } from '@auth/decorators/require-permission.decorator';
```

Replace the controller-level `@UseGuards`:

```ts
// FROM
@UseGuards(AuthenticatedGuard, IsAdminGuard)
// TO
@UseGuards(AuthenticatedGuard, PermissionsGuard)
```

Add `@RequirePermission(...)` to each handler method. Apply exactly these mappings (per spec §3.4):

| Method | Decorator |
|---|---|
| `updateLineStatus` | `@RequirePermission('canValidate')` |
| `orderFromSupplier` | `@RequirePermission('canValidate')` |
| `markAsShipped` | `@RequirePermission('canShip')` |
| `markAsDelivered` | `@RequirePermission('canDeliver')` |
| `cancelOrder` | `@RequirePermission('canCancel')` |
| `confirmPayment` | `@RequirePermission('canMarkPaid')` |

Place each decorator **immediately above** its `@Post(...)` / `@Patch(...)` decorator. Example:

```ts
  @Post(':orderId/cancel')
  @RequirePermission('canCancel')
  async cancelOrder(...) { /* unchanged body */ }
```

If the file contains methods not listed above (e.g. additional handlers added since this plan was written), **stop and review**: any operational endpoint must get a `@RequirePermission(...)`, otherwise the guard treats it as "no metadata" and lets everyone through.

- [ ] **Step 7.2: Type-check**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
git add backend/src/modules/orders/controllers/order-actions.controller.ts
git commit -m "refactor(orders): replace IsAdminGuard with @RequirePermission per action

Cancel/ship/deliver/mark-paid/validate/order-from-supplier now read
the per-action matrix from PermissionsService instead of requiring
level >= 7. Commercial users (level 3-4) can effectively perform
operational actions, matching the documented frontend matrix."
```

---

## Task 8: E2E test — commercial cancel + 403 cases

**Files:**
- Create: `backend/test/orders-cancel-permissions.e2e-spec.ts`

- [ ] **Step 8.1: Inspect existing e2e setup**

```bash
ls /opt/automecanik/app/backend/test/ | head -20
```

If `backend/test/` doesn't exist or has no jest config (`jest-e2e.json`), check `backend/package.json` for the e2e script and existing test infrastructure. **If there is no e2e harness in the repo**, skip this task — the unit tests in Tasks 2 + 4 cover the logic, and the smoke test in Task 11 covers the integration. Note the skip in the PR description.

- [ ] **Step 8.2: If e2e harness exists, write the test**

```ts
// backend/test/orders-cancel-permissions.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PermissionsGuard } from '../src/auth/guards/permissions.guard';
import { AuthenticatedGuard } from '../src/auth/authenticated.guard';

describe('OrderActions cancel — permissions (e2e)', () => {
  let app: INestApplication;

  const buildApp = async (user: any) => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({
        canActivate: (ctx: any) => {
          if (user) ctx.switchToHttp().getRequest().user = user;
          return !!user;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => {
    if (app) await app.close();
  });

  it('commercial (level 3) can cancel → 200 (or downstream error, NOT 403)', async () => {
    await buildApp({ id: 'test-commercial', level: 3, email: 'commercial@test' });
    const res = await request(app.getHttpServer())
      .post('/api/admin/orders/ORD-TEST-NONEXISTENT/cancel')
      .send({ reason: 'test' });
    expect(res.status).not.toBe(403); // permissions OK; downstream may 404/500 because order doesn't exist
  });

  it('base user (level 1) cancel → 403', async () => {
    await buildApp({ id: 'test-base', level: 1, email: 'base@test' });
    const res = await request(app.getHttpServer())
      .post('/api/admin/orders/ORD-TEST-NONEXISTENT/cancel')
      .send({ reason: 'test' });
    expect(res.status).toBe(403);
  });

  it('no session → 401/403 (caught by AuthenticatedGuard before PermissionsGuard)', async () => {
    await buildApp(null);
    const res = await request(app.getHttpServer())
      .post('/api/admin/orders/ORD-TEST-NONEXISTENT/cancel')
      .send({ reason: 'test' });
    expect([401, 403]).toContain(res.status);
  });
});
```

- [ ] **Step 8.3: Run e2e**

```bash
cd backend && npx jest --config test/jest-e2e.json test/orders-cancel-permissions.e2e-spec.ts
```

Expected: 3 PASS. If the e2e config path differs, use the script in `backend/package.json` (likely `npm run test:e2e -- orders-cancel-permissions`).

- [ ] **Step 8.4: Commit**

```bash
git add backend/test/orders-cancel-permissions.e2e-spec.ts
git commit -m "test(orders): e2e cancel permissions (commercial allowed, base 403)"
```

---

## Task 9: Frontend — refactor `permissions.ts` to thin client

**Files:**
- Modify: `frontend/app/utils/permissions.ts`

- [ ] **Step 9.1: Replace the file content**

Full new content (replaces the existing file entirely):

```ts
// frontend/app/utils/permissions.ts
/**
 * Frontend permissions facade — backend is single source of truth.
 * Use loadUserPermissions(userId) inside Remix loaders.
 */

export interface UserPermissions {
  canValidate: boolean;
  canShip: boolean;
  canDeliver: boolean;
  canCancel: boolean;
  canReturn: boolean;
  canRefund: boolean;
  canSendEmails: boolean;
  canCreateOrders: boolean;
  canExport: boolean;
  canMarkPaid: boolean;
  canSeeFullStats: boolean;
  canSeeFinancials: boolean;
  canSeeCustomerDetails: boolean;
  showAdvancedFilters: boolean;
  showActionButtons: boolean;
}

export const BASE_USER_PERMISSIONS: UserPermissions = {
  canValidate: false,
  canShip: false,
  canDeliver: false,
  canCancel: false,
  canReturn: false,
  canRefund: false,
  canSendEmails: false,
  canCreateOrders: false,
  canExport: false,
  canMarkPaid: false,
  canSeeFullStats: false,
  canSeeFinancials: false,
  canSeeCustomerDetails: false,
  showAdvancedFilters: false,
  showActionButtons: false,
};

/**
 * Fetch the canonical permission set for a user from the backend.
 * Call from Remix loaders (server-side); pass the request cookie through.
 */
export async function loadUserPermissions(
  userId: string,
  cookie?: string,
): Promise<UserPermissions> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  try {
    const res = await fetch(
      `http://127.0.0.1:3000/api/auth/user-permissions/${encodeURIComponent(userId)}`,
      { headers },
    );
    if (!res.ok) return BASE_USER_PERMISSIONS;
    return (await res.json()) as UserPermissions;
  } catch {
    return BASE_USER_PERMISSIONS;
  }
}

export function canPerformAction(
  permissions: UserPermissions,
  action: keyof UserPermissions,
): boolean {
  return permissions[action] === true;
}

/**
 * Display-only role badge — derived from level locally (no API call).
 */
export function getUserRole(userLevel: number): {
  label: string;
  badge: string;
  color: string;
  bgColor: string;
} {
  if (userLevel >= 9) {
    return { label: 'Super Admin', badge: '👑', color: 'text-purple-800', bgColor: 'bg-purple-100' };
  }
  if (userLevel >= 7) {
    return { label: 'Administrateur', badge: '🔑', color: 'text-blue-800', bgColor: 'bg-blue-100' };
  }
  if (userLevel >= 5) {
    return { label: 'Responsable', badge: '📊', color: 'text-green-800', bgColor: 'bg-green-100' };
  }
  if (userLevel >= 3) {
    return { label: 'Commercial', badge: '👔', color: 'text-indigo-800', bgColor: 'bg-indigo-100' };
  }
  return { label: 'Utilisateur', badge: '👤', color: 'text-gray-800', bgColor: 'bg-gray-100' };
}
```

- [ ] **Step 9.2: Type-check (frontend)**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: errors at the 5 known consumer call sites (because `getUserPermissions` no longer exists). That's the signal to do Task 10. **Do not commit yet** — broken state.

---

## Task 10: Frontend — migrate consumers

**Files:**
- Modify: `frontend/app/routes/admin.orders._index.tsx` (lines 54, 81, 399)
- Modify: `frontend/app/routes/commercial.orders._index.tsx` (lines 32, 48, 152, 162)

- [ ] **Step 10.1: Migrate `admin.orders._index.tsx`**

Read the current file first to confirm line numbers haven't shifted, then apply the following changes.

**Line 54** — change the import:

```ts
// FROM
import { getUserPermissions, getUserRole } from "../utils/permissions";
// TO
import { loadUserPermissions, getUserRole } from "../utils/permissions";
```

**Line 81 (loader)** — replace the synchronous compute with the async loader fetch. The loader already has access to the request (Remix loader signature). Read the surrounding code to find the request variable name; pass `request.headers.get('Cookie') ?? undefined` as the second arg of `loadUserPermissions`.

```ts
// FROM
const permissions = getUserPermissions(user.level);
// TO
const permissions = await loadUserPermissions(user.id, request.headers.get('Cookie') ?? undefined);
```

**Line 399 (component body)** — the component currently re-derives permissions from the user prop. Since the loader now ships `permissions` in `useLoaderData`, the component should consume that instead of re-computing. Locate `useLoaderData<...>()` and add `permissions` to the destructure; remove the `getUserPermissions(user.level || 0)` line.

Concrete pattern (adjust to actual loader return shape):

```tsx
// FROM (component)
const permissions = getUserPermissions(user.level || 0);
// TO
const { permissions } = useLoaderData<typeof loader>();
```

If `useLoaderData` is already destructured and `permissions` is now part of the loader return (Step 10.1 first sub-step), just add it to the destructure pattern.

- [ ] **Step 10.2: Migrate `commercial.orders._index.tsx`**

Apply the same three transformations. Lines indicated are from the current state — verify before editing.

**Line 32** — import swap (same as 10.1).

**Line 48 (loader)** — add `await loadUserPermissions(user.id, request.headers.get('Cookie') ?? undefined)`.

**Line 152 (interface type)** — change `ReturnType<typeof getUserPermissions>` to just `UserPermissions`. Add `import type { UserPermissions } from "../utils/permissions";` if not already present.

**Line 162 (component)** — same as line 399 of admin: consume `permissions` from `useLoaderData`.

- [ ] **Step 10.3: Type-check (frontend)**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: zero errors. If still failing, inspect the actual call sites and adjust — the line numbers in this plan are best-effort; the imports `getUserPermissions` must have ZERO remaining references.

- [ ] **Step 10.4: Verify nothing else imports `getUserPermissions`**

```bash
grep -rn "getUserPermissions" /opt/automecanik/app/frontend/app
```

Expected: no output (function no longer exists, no references).

- [ ] **Step 10.5: Build smoke**

```bash
cd /opt/automecanik/app && npm run build 2>&1 | tail -30
```

Expected: build succeeds (or fails only on unrelated existing issues — review carefully).

- [ ] **Step 10.6: Commit**

```bash
git add frontend/app/utils/permissions.ts frontend/app/routes/admin.orders._index.tsx frontend/app/routes/commercial.orders._index.tsx
git commit -m "refactor(frontend): permissions.ts becomes thin client of /api/auth/user-permissions

Removes getUserPermissions(level) local computation. Loaders now fetch
the canonical matrix from the backend. Components consume from
useLoaderData. getUserRole stays local (display-only)."
```

---

## Task 11: Smoke test on DEV

- [ ] **Step 11.1: Push branch + open PR**

```bash
git push -u origin fix/permissions-canonical-backend
gh pr create --title "fix(auth): canonical permissions matrix at backend (unblock commercial actions)" --body "$(cat <<'EOF'
## Summary

Move per-action permission matrix from frontend to backend as single source of truth. Replace `IsAdminGuard` with `@RequirePermission(action)` on `OrderActionsController`. Frontend `permissions.ts` becomes a thin API client.

**Triggered by:** Order `ORD-1777531019900-837` cancel returned `Forbidden resource` (HTTP 403) to commercial-level user despite frontend declaring `canCancel: true`.

**Spec:** [`docs/superpowers/specs/2026-04-30-permissions-canonical-backend-design.md`](../blob/fix/permissions-canonical-backend/docs/superpowers/specs/2026-04-30-permissions-canonical-backend-design.md)

**Plan:** [`docs/superpowers/plans/2026-04-30-permissions-canonical-backend.md`](../blob/fix/permissions-canonical-backend/docs/superpowers/plans/2026-04-30-permissions-canonical-backend.md)

## Scope

- Backend: new `PermissionsService`, `PermissionsGuard`, `@RequirePermission` decorator, `UserPermissions` DTO.
- Backend: `OrderActionsController` (6 endpoints) migrated from `IsAdminGuard` to `PermissionsGuard`.
- Backend: `GET /api/auth/user-permissions/:userId` returns canonical `UserPermissions` shape (breaking — only consumer is frontend, refactored in same PR).
- Frontend: `permissions.ts` rewritten as thin client. 2 routes (admin.orders, commercial.orders) migrated.
- `IsAdminGuard` kept as-is for ~25 other controllers (out-of-scope, follow-up PRs).

## Test plan

- [ ] Unit: `PermissionsService` (~30 cases) green.
- [ ] Unit: `PermissionsGuard` (7 cases) green.
- [ ] E2E: cancel with commercial / base / no-session.
- [ ] DEV smoke: log in as commercial level 3, cancel a test order, verify `___xtr_order.ord_ords_id = '6'` + `__admin_audit_log` row + email reception.
- [ ] DEV smoke: same with admin level 7 → still works (regression).
- [ ] DEV smoke: log in as base user level 1 → cancel button hidden (frontend) AND backend would 403 (defense in depth).
EOF
)"
```

- [ ] **Step 11.2: Wait for DEV deploy + run smoke checks**

DEV redeploys on `push main` (per `.claude/rules/deployment.md`); on a feature branch the PR doesn't deploy. The smoke test must wait for **merge to main**, OR be run against a locally-running backend.

For local smoke (preferred — faster feedback before merge):

```bash
cd /opt/automecanik/app && npm run dev 2>&1 | tail -5
```

Then in browser at `http://localhost:5173/admin/orders` :

1. Log in with a commercial-level account (or temporarily flip an admin to level 3 in DB, then revert).
2. Pick a test order in status `2` or `3` (NOT a real customer order).
3. Click "Annuler", enter a reason, submit.
4. Expected: success toast "❌ Commande annulée et client notifié par email".
5. Verify in Supabase MCP:

```sql
SELECT ord_id, ord_ords_id, ord_cancel_date, ord_cancel_reason
FROM "___xtr_order"
WHERE ord_id = '<TEST_ORDER_ID>';
-- Expected: ord_ords_id = '6', ord_cancel_date IS NOT NULL, ord_cancel_reason IS NOT NULL

SELECT * FROM "__admin_audit_log"
WHERE action = 'order_cancelled'
ORDER BY created_at DESC LIMIT 1;
-- Expected: a row matching the test order

SELECT * FROM "___xtr_order_status_history"
WHERE osh_ord_id = '<TEST_ORDER_ID>'
ORDER BY osh_created_at DESC LIMIT 1;
-- Expected: a row showing transition to status 6
```

If all three checks pass, the structural fix is verified end-to-end on DEV.

- [ ] **Step 11.3: Mark PR ready for review**

If the PR was opened as draft, mark it ready: `gh pr ready`.

---

## Rollback path

If anything breaks post-merge to main:

```bash
git revert <merge-commit-sha>
git push origin main
```

DEV redeploys automatically (per `.claude/rules/deployment.md`). No DB cleanup needed — orders cancelled by commercials between deploy and rollback remain valid (status 6, audit log, email sent are all preserved).

---

## Out-of-scope follow-ups (track in separate issues)

1. Migrate ~25 other controllers under `IsAdminGuard` to `@RequirePermission` (blog, advice, seo, vehicles, search, configuration, admin-keyword-clusters, admin-vehicle-cache, admin-r1-related-blocks-cache, admin-vehicle-rag, errors, …). Same pattern, one PR per module.
2. Add caching for `GET /api/auth/user-permissions/:userId` if latency becomes an issue (Redis 5min TTL or React Query client-side).
3. Reconcile `auth.service.ts:checkModuleAccess` (module-coarse matrix at lines 877-885) with `PermissionsService` if a single endpoint is desired. Currently they coexist with distinct consumers.
4. Add audit row for `PermissionsGuard` denials (currently `Logger.warn` only).
