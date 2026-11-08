jest.mock('../../src/cache/cache.service', () => ({ CacheService: class {} }));
jest.mock(
  '../../src/modules/admin/services/command-center-actions.service',
  () => ({ CommandCenterActionsService: class {} }),
);
jest.mock(
  '../../src/modules/admin/services/command-center-kpi.service',
  () => ({ CommandCenterKpiService: class {} }),
);
/**
 * Accès au digest Command Center — GET /api/internal/command-center/digest, en HTTP.
 *
 * Garanties :
 *   1. la clé dédiée (X-Command-Center-Key) ouvre le digest ; X-Internal-Key aussi ;
 *   2. la clé dédiée n'ouvre rien d'autre : InternalApiKeyGuard, qui garde les autres
 *      routes /api/internal/*, la refuse quel que soit l'en-tête ;
 *   3. variable absente ou malformée → clé refusée (révocation) ;
 *   4. aucune valeur de clé dans les journaux.
 */
import { createHash } from 'node:crypto';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CommandCenterDigestKeyGuard } from '../../src/auth/command-center-digest-key.guard';
import { InternalApiKeyGuard } from '../../src/auth/internal-api-key.guard';
import { InternalCommandCenterController } from '../../src/modules/admin/controllers/internal-command-center.controller';
import * as reader from '../../src/modules/admin/services/command-center-reader.service';

const DIGEST_KEY = 'digest-fixture';
const INTERNAL_KEY = 'internal-fixture';
const DIGEST_SHA256 = createHash('sha256').update(DIGEST_KEY).digest('hex');
const ROUTE = '/api/internal/command-center/digest';
const DIGEST = { schema_version: 'command-center-digest.v1' };

describe('Command Center digest access', () => {
  let app: INestApplication;
  let logged: string[];

  async function start(env: Record<string, string>): Promise<void> {
    const testing = await Test.createTestingModule({
      controllers: [InternalCommandCenterController],
      providers: [
        CommandCenterDigestKeyGuard,
        InternalApiKeyGuard,
        {
          provide: ConfigService,
          useValue: { get: (k: string, d?: string) => env[k] ?? d },
        },
        {
          provide: reader.CommandCenterReaderService,
          useValue: {
            getMode: () => 'full',
            getCommandCenter: async () => ({}),
          },
        },
      ],
    }).compile();
    app = testing.createNestApplication({ logger: false });
    await app.init();
  }

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation(
          (message: unknown) => void logged.push(String(message)),
        );
    }
    jest
      .spyOn(reader, 'toCommandCenterDigest')
      .mockReturnValue(
        DIGEST as unknown as ReturnType<typeof reader.toCommandCenterDigest>,
      );
  });

  afterEach(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    for (const line of logged) {
      expect(line).not.toContain(DIGEST_KEY);
      expect(line).not.toContain(INTERNAL_KEY);
    }
  });

  const configured = {
    COMMAND_CENTER_DIGEST_KEY_SHA256: DIGEST_SHA256,
    INTERNAL_API_KEY: INTERNAL_KEY,
  };

  it('opens the digest with the dedicated key, and logs that use', async () => {
    await start(configured);
    const res = await request(app.getHttpServer())
      .get(ROUTE)
      .set('X-Command-Center-Key', DIGEST_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(DIGEST);
    expect(logged).toContain('Command Center digest read with the digest key');
  });

  it('still opens the digest with X-Internal-Key', async () => {
    await start(configured);
    const res = await request(app.getHttpServer())
      .get(ROUTE)
      .set('X-Internal-Key', INTERNAL_KEY);
    expect(res.status).toBe(200);
  });

  it('refuses no key and a wrong digest key with 403', async () => {
    await start(configured);
    expect((await request(app.getHttpServer()).get(ROUTE)).status).toBe(403);
    const wrong = await request(app.getHttpServer())
      .get(ROUTE)
      .set('X-Command-Center-Key', `${DIGEST_KEY}x`);
    expect(wrong.status).toBe(403);
    expect(logged).toContain(
      'Command Center digest access denied: invalid digest key',
    );
  });

  it('the digest key opens no other internal route', async () => {
    await start(configured);
    const internal = app.get(InternalApiKeyGuard);
    for (const headers of [
      { 'x-command-center-key': DIGEST_KEY },
      { 'x-internal-key': DIGEST_KEY },
    ]) {
      const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers }) }) };
      expect(() => internal.canActivate(ctx as never)).toThrow('Access denied');
    }
  });

  it.each([
    ['unset', {}],
    ['malformed', { COMMAND_CENTER_DIGEST_KEY_SHA256: DIGEST_KEY }],
    [
      'a truncated digest',
      { COMMAND_CENTER_DIGEST_KEY_SHA256: DIGEST_SHA256.slice(1) },
    ],
  ])('refuses the digest key when the variable is %s', async (_label, env) => {
    await start({ INTERNAL_API_KEY: INTERNAL_KEY, ...env });
    const res = await request(app.getHttpServer())
      .get(ROUTE)
      .set('X-Command-Center-Key', DIGEST_KEY);
    expect(res.status).toBe(403);
    const internal = await request(app.getHttpServer())
      .get(ROUTE)
      .set('X-Internal-Key', INTERNAL_KEY);
    expect(internal.status).toBe(200);
  });
});
