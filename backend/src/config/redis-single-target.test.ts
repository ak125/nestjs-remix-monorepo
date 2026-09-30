/**
 * Cible Redis unique — REDIS_URL (requis au boot) fait autorité pour tout
 * consommateur qui ouvre sa propre connexion.
 *
 * Avant : cache, session et workers suivaient REDIS_URL, mais l'anti-rejeu OIDC,
 * le verrou d'écriture et la file BullMQ `seo-audit` lisaient REDIS_HOST ||
 * localhost. Une instance lancée avec son propre REDIS_URL partageait donc
 * encore ces clés et cette file avec une autre instance.
 */
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';

import {
  createAppConfig,
  redisConnectionOptions,
  resetAppConfig,
} from './app.config';
import { WriteGuardLockService } from './write-guard-lock.service';
import { GithubOidcService } from '../auth/github-oidc.service';
import { SeoAuditSchedulerService } from '../modules/seo-logs/services/seo-audit-scheduler.service';

jest.mock('ioredis', () => {
  const MockRedis = jest.fn().mockImplementation(() => ({
    connect: () => Promise.resolve(),
    on: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),
  }));
  (MockRedis as unknown as { default: unknown }).default = MockRedis;
  return MockRedis;
});

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({ close: jest.fn() })),
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    close: jest.fn(),
  })),
}));

const RedisMock = Redis as unknown as jest.Mock;
const QueueMock = Queue as unknown as jest.Mock;
const WorkerMock = Worker as unknown as jest.Mock;

const REDIS_KEYS = ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'];

function reader(env: Record<string, string>) {
  return (key: string): string | undefined => env[key];
}

function fakeConfig(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

class OidcRedisProbe extends GithubOidcService {
  open(): Redis {
    return this.createRedis();
  }
}

let savedEnv: NodeJS.ProcessEnv;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  savedEnv = { ...process.env };
  for (const key of REDIS_KEYS) delete process.env[key];
  resetAppConfig();
  RedisMock.mockClear();
  QueueMock.mockClear();
  WorkerMock.mockClear();
  warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  process.env = savedEnv;
  resetAppConfig();
  warnSpy.mockRestore();
});

describe('redisConnectionOptions — REDIS_URL fait autorité', () => {
  it('dérive hôte et port de REDIS_URL', () => {
    expect(
      redisConnectionOptions(reader({ REDIS_URL: 'redis://redis_prod:6379' })),
    ).toEqual({
      host: 'redis_prod',
      port: 6379,
      username: undefined,
      password: undefined,
      db: undefined,
    });
  });

  it('ignore un REDIS_HOST divergent et le signale sans secret', () => {
    const target = redisConnectionOptions(
      reader({
        REDIS_URL: 'redis://:s3cr3t@isolated-redis:6390',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
      }),
    );
    expect(target).toMatchObject({ host: 'isolated-redis', port: 6390 });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = String(warnSpy.mock.calls[0][0]);
    expect(message).toContain('localhost:6379');
    expect(message).toContain('isolated-redis:6390');
    expect(message).not.toContain('s3cr3t');
  });

  it("n'avertit pas quand REDIS_HOST/REDIS_PORT désignent la même cible", () => {
    redisConnectionOptions(
      reader({
        REDIS_URL: 'redis://redis_prod:6379',
        REDIS_HOST: 'redis_prod',
        REDIS_PORT: '6379',
      }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('décode identifiant, mot de passe et base', () => {
    expect(
      redisConnectionOptions(
        reader({ REDIS_URL: 'redis://app%2Fuser:p%40ss@cache:6380/2' }),
      ),
    ).toMatchObject({
      host: 'cache',
      port: 6380,
      username: 'app/user',
      password: 'p@ss',
      db: 2,
    });
  });

  it('active TLS pour rediss://', () => {
    expect(
      redisConnectionOptions(reader({ REDIS_URL: 'rediss://cache' })),
    ).toMatchObject({ host: 'cache', port: 6379, tls: {} });
    expect(
      redisConnectionOptions(reader({ REDIS_URL: 'redis://cache' })),
    ).not.toHaveProperty('tls');
  });

  it('accepte un hôte IPv6', () => {
    expect(
      redisConnectionOptions(reader({ REDIS_URL: 'redis://[::1]:6379' })),
    ).toMatchObject({ host: '::1', port: 6379 });
  });

  it("REDIS_PASSWORD complète une URL sans mot de passe, jamais l'inverse", () => {
    expect(
      redisConnectionOptions(
        reader({ REDIS_URL: 'redis://cache:6379', REDIS_PASSWORD: 'fromenv' }),
      ).password,
    ).toBe('fromenv');
    expect(
      redisConnectionOptions(
        reader({
          REDIS_URL: 'redis://:fromurl@cache:6379',
          REDIS_PASSWORD: 'fromenv',
        }),
      ).password,
    ).toBe('fromurl');
  });

  it('sans REDIS_URL, garde le comportement antérieur (REDIS_HOST || localhost)', () => {
    expect(redisConnectionOptions(reader({}))).toEqual({
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
    expect(
      redisConnectionOptions(
        reader({
          REDIS_HOST: 'redis',
          REDIS_PORT: '6380',
          REDIS_PASSWORD: 'pw',
        }),
      ),
    ).toEqual({ host: 'redis', port: 6380, password: 'pw' });
  });

  it.each([
    ['illisible', 'not a url'],
    ['schéma', 'localhost:6379'],
    ['schéma', 'http://:s3cr3t@cache:6379'],
    ['hôte absent', 'redis://'],
    ['base', 'redis://:s3cr3t@cache:6379/abc'],
    ['base', 'redis://:s3cr3t@cache:6379/-1'],
  ])(
    'refuse une REDIS_URL (%s) sans divulguer son mot de passe : %s',
    (detail, url) => {
      let thrown: unknown;
      try {
        redisConnectionOptions(reader({ REDIS_URL: url }));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      const message = (thrown as Error).message;
      expect(message).toContain(`REDIS_URL invalide (${detail})`);
      expect(message).not.toContain('s3cr3t');
    },
  );
});

describe('createAppConfig().redis suit REDIS_URL', () => {
  it('hôte et port viennent de REDIS_URL, pas de REDIS_HOST', () => {
    process.env.REDIS_URL = 'redis://isolated-redis:6390';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    expect(createAppConfig().redis).toEqual({
      url: 'redis://isolated-redis:6390',
      host: 'isolated-redis',
      port: 6390,
    });
  });
});

describe('consommateurs Redis — même cible que REDIS_URL', () => {
  const env = {
    REDIS_URL: 'redis://isolated-redis:6390/3',
    REDIS_HOST: 'localhost',
    REDIS_PORT: '6379',
  };

  it('anti-rejeu OIDC : cible REDIS_URL, base dédiée conservée', () => {
    new OidcRedisProbe(fakeConfig(env)).open();
    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(RedisMock.mock.calls[0][0]).toMatchObject({
      host: 'isolated-redis',
      port: 6390,
      db: GithubOidcService.REDIS_DB_INDEX,
      lazyConnect: true,
    });
  });

  it("verrou d'écriture : cible REDIS_URL", () => {
    new WriteGuardLockService(fakeConfig(env));
    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(RedisMock.mock.calls[0][0]).toMatchObject({
      host: 'isolated-redis',
      port: 6390,
      db: 3,
      enableOfflineQueue: false,
    });
  });

  it("verrou d'écriture : une REDIS_URL invalide échoue au lieu de basculer en mémoire", () => {
    expect(
      () =>
        new WriteGuardLockService(fakeConfig({ REDIS_URL: 'http://cache' })),
    ).toThrow('REDIS_URL invalide (schéma)');
    expect(RedisMock).not.toHaveBeenCalled();
  });

  it('file BullMQ seo-audit : queue et worker ciblent REDIS_URL', async () => {
    Object.assign(process.env, env);
    const service = new SeoAuditSchedulerService();
    const setups = service as unknown as Record<string, () => Promise<void>>;
    jest.spyOn(setups, 'setupWeeklyAudit').mockResolvedValue(undefined);
    jest.spyOn(setups, 'setupDailyCleanup').mockResolvedValue(undefined);

    await service.onModuleInit();

    const expected = { host: 'isolated-redis', port: 6390, db: 3 };
    expect(QueueMock).toHaveBeenCalledTimes(1);
    expect(QueueMock.mock.calls[0][1].connection).toMatchObject(expected);
    expect(WorkerMock).toHaveBeenCalledTimes(1);
    expect(WorkerMock.mock.calls[0][2].connection).toMatchObject(expected);
  });
});
