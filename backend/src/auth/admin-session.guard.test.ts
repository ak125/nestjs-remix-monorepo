import { Test } from '@nestjs/testing';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { AdminSessionGuard } from './admin-session.guard';

function makeCtx(user?: unknown): {
  ctx: ExecutionContext;
  req: { user?: unknown; _authPath?: string; method: string; url: string };
} {
  const req: {
    user?: unknown;
    _authPath?: string;
    method: string;
    url: string;
  } = {
    user,
    method: 'POST',
    url: '/api/sitemap/v10/generate-all',
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AdminSessionGuard', () => {
  let guard: AdminSessionGuard;

  beforeEach(async () => {
    const m = await Test.createTestingModule({
      providers: [AdminSessionGuard],
    }).compile();
    guard = m.get(AdminSessionGuard);
  });

  it('accepts user with isAdmin=true (regardless of level)', () => {
    const { ctx, req } = makeCtx({ isAdmin: true, level: 0 });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req._authPath).toBe('admin-session');
  });

  it('accepts user with numeric level >= 7', () => {
    const { ctx, req } = makeCtx({ level: 7, email: 'admin@x.com' });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req._authPath).toBe('admin-session');
  });

  it('accepts user with numeric level = 9 (superadmin)', () => {
    const { ctx } = makeCtx({ level: 9 });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('accepts user with string level "8" (legacy MD5 session)', () => {
    const { ctx } = makeCtx({ level: '8' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects user with level < 7 (commercial = 3)', () => {
    const { ctx, req } = makeCtx({ level: 3, email: 'sales@x.com' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow(/Admin level required/);
    expect(req._authPath).toBeUndefined();
  });

  it('rejects user with no level (treated as 0)', () => {
    const { ctx } = makeCtx({ email: 'guest@x.com' });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('rejects when req.user is absent (anonymous)', () => {
    const { ctx } = makeCtx(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow(/Authentication required/);
  });
});
