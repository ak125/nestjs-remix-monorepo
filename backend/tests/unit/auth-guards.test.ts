/**
 * Auth Guards Unit Tests
 *
 * Tests the four authentication/authorization guards:
 * - IsAdminGuard: user.isAdmin or user.level >= 7
 * - AuthenticatedGuard: delegates to Passport request.isAuthenticated()
 * - InternalApiKeyGuard: validates X-Internal-Key header via timingSafeEqual
 * - OptionalAuthGuard: always passes (never blocks)
 *
 * 11 tests total.
 *
 * @see backend/src/auth/is-admin.guard.ts
 * @see backend/src/auth/authenticated.guard.ts
 * @see backend/src/auth/internal-api-key.guard.ts
 * @see backend/src/auth/guards/optional-auth.guard.ts
 */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { IsAdminGuard } from '../../src/auth/is-admin.guard';
import { AuthenticatedGuard } from '../../src/auth/authenticated.guard';
import { InternalApiKeyGuard } from '../../src/auth/internal-api-key.guard';
import { OptionalAuthGuard } from '../../src/auth/guards/optional-auth.guard';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Creates a minimal ExecutionContext mock.
 * The `request` object is returned as-is from getRequest().
 */
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

// ─── IsAdminGuard ─────────────────────────────────────────────────────────────

describe('IsAdminGuard', () => {
  let guard: IsAdminGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IsAdminGuard],
    }).compile();

    guard = module.get<IsAdminGuard>(IsAdminGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when user.isAdmin is true', () => {
    const ctx = createMockExecutionContext({
      user: { email: 'admin@test.com', isAdmin: true },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should return true when user.level is "7" (string, parseInt converts)', () => {
    const ctx = createMockExecutionContext({
      user: { email: 'admin@test.com', isAdmin: false, level: '7' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should return false when user.level is "3" (below 7)', () => {
    const ctx = createMockExecutionContext({
      user: { email: 'user@test.com', isAdmin: false, level: '3' },
    });

    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('should return false when user is undefined (no session)', () => {
    const ctx = createMockExecutionContext({
      user: undefined,
    });

    expect(guard.canActivate(ctx)).toBe(false);
  });
});

// ─── AuthenticatedGuard ───────────────────────────────────────────────────────

describe('AuthenticatedGuard', () => {
  let guard: AuthenticatedGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthenticatedGuard],
    }).compile();

    guard = module.get<AuthenticatedGuard>(AuthenticatedGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when request.isAuthenticated() returns true', () => {
    const ctx = createMockExecutionContext({
      path: '/api/user/profile',
      isAuthenticated: () => true,
      user: { email: 'user@test.com' },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should return false when request.isAuthenticated() returns false', () => {
    const ctx = createMockExecutionContext({
      path: '/api/user/profile',
      isAuthenticated: () => false,
      user: undefined,
    });

    expect(guard.canActivate(ctx)).toBe(false);
  });
});

// ─── InternalApiKeyGuard ──────────────────────────────────────────────────────

describe('InternalApiKeyGuard', () => {
  const VALID_KEY = 'super-secret-internal-key-32chars!';

  function buildGuard(configuredKey: string): InternalApiKeyGuard {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'INTERNAL_API_KEY') return configuredKey;
        return defaultValue ?? '';
      }),
    };

    // Instantiate directly (no NestJS module needed — no other deps)
    return new InternalApiKeyGuard(mockConfigService as unknown as ConfigService);
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when X-Internal-Key header matches the configured key', () => {
    const guard = buildGuard(VALID_KEY);
    const ctx = createMockExecutionContext({
      headers: { 'x-internal-key': VALID_KEY },
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException when X-Internal-Key header is wrong', () => {
    const guard = buildGuard(VALID_KEY);
    // Wrong key must have same length to reach timingSafeEqual; different content
    const wrongKey = 'wrong-secret-internal-key-32chars!';
    const ctx = createMockExecutionContext({
      headers: { 'x-internal-key': wrongKey },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when X-Internal-Key header is missing', () => {
    const guard = buildGuard(VALID_KEY);
    const ctx = createMockExecutionContext({
      headers: {},
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when INTERNAL_API_KEY env var is not configured', () => {
    // Empty string = not configured (guard warns and rejects all)
    const guard = buildGuard('');
    const ctx = createMockExecutionContext({
      headers: { 'x-internal-key': VALID_KEY },
    });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

// ─── OptionalAuthGuard ────────────────────────────────────────────────────────

describe('OptionalAuthGuard', () => {
  let guard: OptionalAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OptionalAuthGuard],
    }).compile();

    guard = module.get<OptionalAuthGuard>(OptionalAuthGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return true even with no session and no Authorization header (never blocks)', async () => {
    const ctx = createMockExecutionContext({
      // No isAuthenticated, no headers.authorization — unauthenticated public request
      isAuthenticated: () => false,
      headers: {},
      user: undefined,
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
