import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  SignJWT,
  generateKeyPair,
  exportJWK,
  createLocalJWKSet,
  type JWK,
  type KeyLike,
} from 'jose';

import {
  GithubOidcService,
  type GithubOidcClaims,
} from './github-oidc.service';

// ───────────────────────────────────────────────────────────────────
// Test fixtures
// ───────────────────────────────────────────────────────────────────

const KID = 'test-kid-1';

const VALID_CLAIMS: Omit<GithubOidcClaims, 'iat' | 'exp' | 'iss' | 'aud'> = {
  repository: GithubOidcService.REPOSITORY,
  repository_owner: 'ak125',
  event_name: 'schedule',
  ref: 'refs/heads/main',
  workflow: 'sitemap-daily-regen',
  workflow_ref: GithubOidcService.ALLOWED_JOB_REFS[0],
  job_workflow_ref: GithubOidcService.ALLOWED_JOB_REFS[0],
  run_id: '12345',
  run_number: '7',
  run_attempt: '1',
  actor: 'ak125',
  sha: 'abc123def456',
  sub: GithubOidcService.ALLOWED_SUBS[0],
};

async function setupKeysAndService(): Promise<{
  privateKey: KeyLike;
  service: GithubOidcService;
}> {
  const { publicKey, privateKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  const jwk: JWK = await exportJWK(publicKey);
  jwk.kid = KID;
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const localJwks = createLocalJWKSet({ keys: [jwk] });

  const moduleRef = await Test.createTestingModule({
    providers: [GithubOidcService],
  }).compile();

  const service = moduleRef.get(GithubOidcService);
  service.setJwksForTesting(localJwks);
  return { privateKey, service };
}

async function signClaims(
  privateKey: KeyLike,
  overrides: Partial<typeof VALID_CLAIMS> = {},
  opts: { exp?: string; nbf?: string; aud?: string } = {},
): Promise<string> {
  const claims = { ...VALID_CLAIMS, ...overrides };
  let jwt = new SignJWT(claims as Record<string, unknown>)
    .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
    .setIssuer(GithubOidcService.ISSUER)
    .setAudience(opts.aud ?? GithubOidcService.AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '10m')
    .setJti(`jti-${Math.random()}`);
  if (opts.nbf) jwt = jwt.setNotBefore(opts.nbf);
  return jwt.sign(privateKey);
}

// ───────────────────────────────────────────────────────────────────
// Happy path
// ───────────────────────────────────────────────────────────────────

describe('GithubOidcService — validate() happy path', () => {
  it('accepts a fully-conformant JWT and returns claims', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey);

    const claims = await service.validate(token);

    expect(claims.repository).toBe(GithubOidcService.REPOSITORY);
    expect(claims.sub).toBe(GithubOidcService.ALLOWED_SUBS[0]);
    expect(claims.event_name).toBe('schedule');
    expect(claims.actor).toBe('ak125');
  });

  it('accepts workflow_dispatch event_name', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, {
      event_name: 'workflow_dispatch',
    });

    const claims = await service.validate(token);
    expect(claims.event_name).toBe('workflow_dispatch');
  });
});

// ───────────────────────────────────────────────────────────────────
// Claim mismatches — fail-closed
// ───────────────────────────────────────────────────────────────────

describe('GithubOidcService — claim validation (5 pinned invariants)', () => {
  it('rejects when repository claim mismatches', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, { repository: 'evil/fork' });
    await expect(service.validate(token)).rejects.toThrow(ForbiddenException);
    await expect(service.validate(token)).rejects.toThrow(
      /claim repository mismatch/,
    );
  });

  it('rejects when event_name is not in allow-list', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, { event_name: 'push' });
    await expect(service.validate(token)).rejects.toThrow(
      /claim event_name not allowed/,
    );
  });

  it('rejects when ref is not refs/heads/main', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, { ref: 'refs/heads/dev' });
    await expect(service.validate(token)).rejects.toThrow(
      /claim ref not allowed/,
    );
  });

  it('rejects when job_workflow_ref points to a different workflow file', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, {
      job_workflow_ref:
        'ak125/nestjs-remix-monorepo/.github/workflows/other.yml@refs/heads/main',
    });
    await expect(service.validate(token)).rejects.toThrow(
      /claim job_workflow_ref not allowed/,
    );
  });

  it('rejects when sub claim has unexpected format (defense in depth alongside job_workflow_ref)', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, {
      sub: 'repo:ak125/nestjs-remix-monorepo:ref:refs/heads/feature-branch',
    });
    await expect(service.validate(token)).rejects.toThrow(
      /claim sub not allowed/,
    );
  });
});

// ───────────────────────────────────────────────────────────────────
// Signature / time / audience — built-in jose checks
// ───────────────────────────────────────────────────────────────────

describe('GithubOidcService — jose built-in checks', () => {
  it('rejects when audience claim is wrong', async () => {
    const { privateKey, service } = await setupKeysAndService();
    const token = await signClaims(privateKey, {}, { aud: 'wrong-audience' });
    await expect(service.validate(token)).rejects.toThrow();
  });

  it('rejects when exp is in the past (beyond clockTolerance)', async () => {
    const { privateKey, service } = await setupKeysAndService();
    // Sign with already-past expiration. clockTolerance is 30s, so -60s is rejected.
    const token = await signClaims(privateKey, {}, { exp: '-60s' });
    await expect(service.validate(token)).rejects.toThrow();
  });

  it('rejects when signed by an untrusted key (wrong kid / no match in JWKS)', async () => {
    const { service } = await setupKeysAndService();
    // Generate a different key pair NOT in the local JWKS
    const { privateKey: otherPrivate } = await generateKeyPair('RS256', {
      extractable: true,
    });
    const token = await signClaims(otherPrivate);
    await expect(service.validate(token)).rejects.toThrow();
  });
});

// ───────────────────────────────────────────────────────────────────
// Constants exposed for downstream Phase 2-5 consumers
// ───────────────────────────────────────────────────────────────────

describe('GithubOidcService — exposed constants (Phase 0.6 paradigm)', () => {
  it('exposes ISSUER as a public static readonly', () => {
    expect(GithubOidcService.ISSUER).toBe(
      'https://token.actions.githubusercontent.com',
    );
  });

  it('exposes AUDIENCE as a public static readonly', () => {
    expect(GithubOidcService.AUDIENCE).toBe('automecanik-sitemap-regen');
  });

  it('exposes REPOSITORY as a public static readonly', () => {
    expect(GithubOidcService.REPOSITORY).toBe('ak125/nestjs-remix-monorepo');
  });

  it('exposes ALLOWED_EVENTS as readonly array', () => {
    expect(GithubOidcService.ALLOWED_EVENTS).toEqual([
      'schedule',
      'workflow_dispatch',
    ]);
  });

  it('exposes ALLOWED_REFS, ALLOWED_JOB_REFS, ALLOWED_SUBS as readonly arrays', () => {
    expect(GithubOidcService.ALLOWED_REFS).toEqual(['refs/heads/main']);
    expect(GithubOidcService.ALLOWED_JOB_REFS).toHaveLength(1);
    expect(GithubOidcService.ALLOWED_SUBS).toHaveLength(1);
  });

  it('exposes CLOCK_TOLERANCE_SECONDS = 30 (runner ↔ VPS clock drift budget)', () => {
    expect(GithubOidcService.CLOCK_TOLERANCE_SECONDS).toBe(30);
  });
});
