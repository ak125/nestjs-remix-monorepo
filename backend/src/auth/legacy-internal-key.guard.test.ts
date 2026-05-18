import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { LegacyInternalKeyGuard } from './legacy-internal-key.guard';
import { InternalApiKeyGuard } from './internal-api-key.guard';

jest.mock('@sentry/nestjs', () => ({
  captureMessage: jest.fn(),
}));

function makeCtx(headers: Record<string, string>): {
  ctx: ExecutionContext;
  req: {
    headers: Record<string, string>;
    _authPath?: string;
    method: string;
    url: string;
  };
} {
  const req = {
    headers,
    method: 'POST',
    url: '/api/sitemap/v10/generate-all',
  } as {
    headers: Record<string, string>;
    _authPath?: string;
    method: string;
    url: string;
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('LegacyInternalKeyGuard', () => {
  let guard: LegacyInternalKeyGuard;
  let mockInternal: { canActivate: jest.Mock };
  let envValues: Record<string, string | undefined>;

  beforeEach(async () => {
    (Sentry.captureMessage as jest.Mock).mockClear();
    mockInternal = { canActivate: jest.fn() };
    envValues = { SITEMAP_LEGACY_INTERNAL_KEY_ENABLED: 'true' };
    const m = await Test.createTestingModule({
      providers: [
        LegacyInternalKeyGuard,
        { provide: InternalApiKeyGuard, useValue: mockInternal },
        {
          provide: ConfigService,
          useValue: { get: (k: string) => envValues[k] },
        },
      ],
    }).compile();
    guard = m.get(LegacyInternalKeyGuard);
  });

  it('rejects when X-Internal-Key header is absent', async () => {
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /x-internal-key header required/,
    );
    expect(mockInternal.canActivate).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('rejects when kill-switch is OFF (env=false)', async () => {
    envValues.SITEMAP_LEGACY_INTERNAL_KEY_ENABLED = 'false';
    const { ctx, req } = makeCtx({ 'x-internal-key': 'somekey' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Legacy auth disabled/,
    );
    expect(mockInternal.canActivate).not.toHaveBeenCalled();
    expect(req._authPath).toBeUndefined();
  });

  it('rejects when kill-switch is UNSET (any non-"true" value)', async () => {
    delete envValues.SITEMAP_LEGACY_INTERNAL_KEY_ENABLED;
    const { ctx } = makeCtx({ 'x-internal-key': 'somekey' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Legacy auth disabled/,
    );
  });

  it('delegates to InternalApiKeyGuard when kill-switch=true and header present', async () => {
    mockInternal.canActivate.mockResolvedValue(true);
    const { ctx, req } = makeCtx({ 'x-internal-key': 'validkey' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(mockInternal.canActivate).toHaveBeenCalledWith(ctx);
    expect(req._authPath).toBe('internal-key-legacy');
  });

  it('emits Sentry warning breadcrumb on accept (deprecation tracking)', async () => {
    mockInternal.canActivate.mockResolvedValue(true);
    const { ctx } = makeCtx({ 'x-internal-key': 'validkey' });

    await guard.canActivate(ctx);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'legacy_auth_used',
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({
          endpoint: '/api/sitemap/v10/generate-all',
          method: 'POST',
          deprecation: 'PR-E',
        }),
      }),
    );
  });

  it('does not emit Sentry when InternalApiKeyGuard rejects', async () => {
    mockInternal.canActivate.mockResolvedValue(false);
    const { ctx, req } = makeCtx({ 'x-internal-key': 'wrongkey' });

    await expect(guard.canActivate(ctx)).resolves.toBe(false);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
    expect(req._authPath).toBeUndefined();
  });

  it('propagates InternalApiKeyGuard thrown error (fail-closed, no fallback)', async () => {
    const err = new UnauthorizedException('invalid internal key');
    mockInternal.canActivate.mockRejectedValue(err);
    const { ctx } = makeCtx({ 'x-internal-key': 'wrongkey' });

    await expect(guard.canActivate(ctx)).rejects.toBe(err);
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });
});
