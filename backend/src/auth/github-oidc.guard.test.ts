import { Test } from '@nestjs/testing';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { GithubOidcGuard } from './github-oidc.guard';
import {
  GithubOidcService,
  type GithubOidcClaims,
} from './github-oidc.service';

const FAKE_CLAIMS: GithubOidcClaims = {
  repository: 'ak125/nestjs-remix-monorepo',
  repository_owner: 'ak125',
  event_name: 'schedule',
  ref: 'refs/heads/main',
  workflow: 'sitemap-daily-regen',
  workflow_ref:
    'ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main',
  job_workflow_ref:
    'ak125/nestjs-remix-monorepo/.github/workflows/sitemap-daily-regen.yml@refs/heads/main',
  run_id: '12345',
  run_number: '7',
  run_attempt: '1',
  actor: 'ak125',
  sha: 'abc123',
  sub: 'repo:ak125/nestjs-remix-monorepo:ref:refs/heads/main',
};

function makeCtx(headers: Record<string, string>): {
  ctx: ExecutionContext;
  req: {
    headers: Record<string, string>;
    _authPath?: string;
    _authClaims?: GithubOidcClaims;
  };
} {
  const req: {
    headers: Record<string, string>;
    _authPath?: string;
    _authClaims?: GithubOidcClaims;
  } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('GithubOidcGuard', () => {
  let guard: GithubOidcGuard;
  let mockOidc: { validate: jest.Mock };

  beforeEach(async () => {
    mockOidc = { validate: jest.fn() };
    const m = await Test.createTestingModule({
      providers: [
        GithubOidcGuard,
        { provide: GithubOidcService, useValue: mockOidc },
      ],
    }).compile();
    guard = m.get(GithubOidcGuard);
  });

  it('rejects when Authorization header is absent', async () => {
    const { ctx } = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Bearer token required/,
    );
    expect(mockOidc.validate).not.toHaveBeenCalled();
  });

  it('rejects when Authorization header uses non-Bearer scheme', async () => {
    const { ctx } = makeCtx({ authorization: 'Basic dXNlcjpwYXNz' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      /Bearer token required/,
    );
    expect(mockOidc.validate).not.toHaveBeenCalled();
  });

  it('rejects when Bearer header has empty token (just "Bearer ")', async () => {
    const { ctx } = makeCtx({ authorization: 'Bearer   ' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(/Empty Bearer token/);
    expect(mockOidc.validate).not.toHaveBeenCalled();
  });

  it('delegates to GithubOidcService.validate() when Bearer present', async () => {
    mockOidc.validate.mockResolvedValue(FAKE_CLAIMS);
    const { ctx, req } = makeCtx({ authorization: 'Bearer abc.def.ghi' });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    expect(mockOidc.validate).toHaveBeenCalledWith('abc.def.ghi');
    expect(req._authPath).toBe('github-oidc');
    expect(req._authClaims).toBe(FAKE_CLAIMS);
  });

  it('propagates GithubOidcService.validate() error (fail-closed, no fallback)', async () => {
    const err = new UnauthorizedException('bad signature');
    mockOidc.validate.mockRejectedValue(err);
    const { ctx, req } = makeCtx({ authorization: 'Bearer tampered.jwt.here' });

    await expect(guard.canActivate(ctx)).rejects.toBe(err);
    expect(req._authPath).toBeUndefined();
    expect(req._authClaims).toBeUndefined();
  });
});
