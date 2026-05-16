import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminOrInternalKeyGuard } from './admin-or-internal-key.guard';
import { InternalApiKeyGuard } from './internal-api-key.guard';

const VALID_KEY = 'test-internal-key-32bytes-aaaa';

function makeContext(opts: {
  user?: any;
  headers?: Record<string, string>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        user: opts.user,
        headers: opts.headers ?? {},
        method: 'POST',
        url: '/api/test',
      }),
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('AdminOrInternalKeyGuard', () => {
  let guard: AdminOrInternalKeyGuard;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminOrInternalKeyGuard,
        InternalApiKeyGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (k: string, def?: string) =>
              k === 'INTERNAL_API_KEY' ? VALID_KEY : def,
          },
        },
      ],
    }).compile();
    guard = moduleRef.get(AdminOrInternalKeyGuard);
  });

  describe('internal key path', () => {
    it('accepts request with matching x-internal-key header', () => {
      const ctx = makeContext({ headers: { 'x-internal-key': VALID_KEY } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects request with mismatched x-internal-key (does NOT fall back to session)', () => {
      const ctx = makeContext({
        headers: { 'x-internal-key': 'wrong-key' },
        user: { isAdmin: true, level: 7 },
      });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });

  describe('admin session path', () => {
    it('accepts request with isAdmin=true', () => {
      const ctx = makeContext({ user: { isAdmin: true, level: 0 } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('accepts request with numeric level >= 7', () => {
      const ctx = makeContext({ user: { level: 7 } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('accepts request with string level >= 7 (legacy MD5 session)', () => {
      const ctx = makeContext({ user: { level: '9' } });
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects request with level < 7', () => {
      const ctx = makeContext({ user: { level: 3, email: 'sales@x.com' } });
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });

    it('rejects anonymous request (no user, no header)', () => {
      const ctx = makeContext({});
      expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    });
  });
});
