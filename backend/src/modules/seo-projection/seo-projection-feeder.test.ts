/**
 * Tests SeoProjectionFeederService : discoverAndEnqueue + triggerNow (slurp cron R1) ET triggerEntity
 * (single-entity role-scoped P2-B). fs + app.config mockés ; queues + FeatureFlags = stubs jest.
 */
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import { promises as fs } from 'node:fs';
import { SeoProjectionFeederService } from './seo-projection-feeder.service';
import { PROJECTION_FEED_JOB } from './seo-projection.types';
import { getAppConfig } from '../../config/app.config';
import type { FeatureFlagsService } from '../../config/feature-flags.service';

jest.mock('node:fs', () => ({
  promises: {
    readdir: jest.fn(),
    realpath: jest.fn(),
    readFile: jest.fn(),
  },
}));
jest.mock('../../config/app.config', () => ({ getAppConfig: jest.fn() }));

const mockReaddir = fs.readdir as jest.Mock;
const mockRealpath = fs.realpath as unknown as jest.Mock;
const mockReadFile = fs.readFile as jest.Mock;
const mockGetAppConfig = getAppConfig as jest.Mock;

const EXPORTS_ROOT = '/abs/seo';

function makeService(
  opts: {
    exportsDir?: string;
    enabled?: boolean;
    repeatables?: Array<{ name: string; key: string }>;
  } = {},
) {
  const feedQueue = {
    add: jest.fn().mockResolvedValue({ id: 'feed-1' }),
    getRepeatableJobs: jest.fn().mockResolvedValue(opts.repeatables ?? []),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  };
  const writeQueue = { add: jest.fn().mockResolvedValue({ id: 'write-1' }) };
  const config = {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'SEO_PROJECTION_R1_FEED_ENABLED')
        return opts.enabled ? 'true' : def;
      if (key === 'SEO_PROJECTION_R1_EXPORTS_DIR')
        return opts.exportsDir ?? '/abs/exports';
      if (key === 'SEO_PROJECTION_EXPORTS_ROOT') return EXPORTS_ROOT;
      return def;
    }),
  };
  const featureFlags = {
    seoProjectionWritableTypes: ['gamme', 'constructeur', 'vehicle'],
    seoProjectionWritableRoles: (type: string) =>
      type === 'gamme'
        ? ['R3_CONSEILS', 'R4_REFERENCE', 'R6_GUIDE_ACHAT']
        : type === 'constructeur'
          ? ['R7_BRAND']
          : type === 'vehicle'
            ? ['R8_VEHICLE']
            : [],
  };
  const svc = new SeoProjectionFeederService(
    feedQueue as unknown as Queue,
    writeQueue as unknown as Queue,
    config as unknown as ConfigService,
    featureFlags as unknown as FeatureFlagsService,
  );
  return { svc, feedQueue, writeQueue };
}

describe('SeoProjectionFeederService — slurp cron (discoverAndEnqueue / triggerNow)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppConfig.mockReturnValue({ supabase: { readOnly: false } });
  });

  it('READ_ONLY → skip observable, aucun enqueue', async () => {
    mockGetAppConfig.mockReturnValue({ supabase: { readOnly: true } });
    const { svc, writeQueue } = makeService();
    const r = await svc.discoverAndEnqueue('manual');
    expect(r.reason).toBe('READ_ONLY');
    expect(r.enqueued).toBe(false);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('dossier absent → NO_EXPORTS_DIR, no-op (pas une erreur fatale)', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    const { svc, writeQueue } = makeService();
    const r = await svc.discoverAndEnqueue('scheduler');
    expect(r.reason).toBe('NO_EXPORTS_DIR');
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('exports présents → 1 write-job (cron) triés, SANS pipeline_version non-semver', async () => {
    mockReaddir.mockResolvedValue(['b.json', 'a.json', 'note.md']);
    const { svc, writeQueue } = makeService({ exportsDir: '/abs/exports' });
    const r = await svc.discoverAndEnqueue('manual');
    expect(r.enqueued).toBe(true);
    expect(r.discovered).toBe(2);
    const [jobName, data] = writeQueue.add.mock.calls[0];
    expect(jobName).toBe('seo-projection-write');
    expect(data.triggeredBy).toBe('cron');
    expect(data.exportPaths).toEqual([
      '/abs/exports/a.json',
      '/abs/exports/b.json',
    ]);
    // Le feeder ne pose PLUS de runMeta.pipeline_version (le writer résout les versions semver).
    expect(data.runMeta?.pipeline_version).toBeUndefined();
    expect(data.projectionRole).toBeUndefined();
  });

  it('triggerNow → enqueue one-off sur la feed queue', async () => {
    const { svc, feedQueue } = makeService();
    const id = await svc.triggerNow();
    expect(id).toBe('feed-1');
    expect(feedQueue.add).toHaveBeenCalled();
  });
});

describe('SeoProjectionFeederService.triggerEntity — single-entity role-scoped', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppConfig.mockReturnValue({ supabase: { readOnly: false } });
    // realpath identité par défaut (le candidat reste sous exportsRoot).
    mockRealpath.mockImplementation(async (p: string) => p);
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        entity_id: 'gamme:filtre-a-huile',
        roles_allowed: ['R3_CONSEILS', 'R4_REFERENCE', 'R6_GUIDE_ACHAT'],
      }),
    );
  });

  const input = {
    entityType: 'gamme',
    entityId: 'filtre-a-huile',
    projectionRole: 'R3_CONSEILS',
  };

  it('happy path → 1 write-job single-element role-scoped', async () => {
    const { svc, writeQueue } = makeService();
    const res = await svc.triggerEntity(input);
    expect(writeQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, data] = writeQueue.add.mock.calls[0];
    expect(jobName).toBe('seo-projection-write');
    expect(data.triggeredBy).toBe('manual');
    expect(data.exportPaths).toHaveLength(1);
    expect(data.exportPaths[0]).toBe(
      `${EXPORTS_ROOT}/gamme/filtre-a-huile.json`,
    );
    expect(data.projectionRole).toBe('R3_CONSEILS');
    expect(res.entityId).toBe('gamme:filtre-a-huile');
  });

  it('type non projetable (diagnostic) → rejeté, aucun enqueue', async () => {
    const { svc, writeQueue } = makeService();
    await expect(
      svc.triggerEntity({ ...input, entityType: 'diagnostic' }),
    ).rejects.toThrow(/non projetable/);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('rôle non autorisé pour le type (gamme + R8_VEHICLE) → rejeté', async () => {
    const { svc, writeQueue } = makeService();
    await expect(
      svc.triggerEntity({ ...input, projectionRole: 'R8_VEHICLE' }),
    ).rejects.toThrow(/non autorisé/);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('entityId avec traversal (../) → rejeté AVANT tout accès disque', async () => {
    const { svc, writeQueue } = makeService();
    await expect(
      svc.triggerEntity({ ...input, entityId: '../secret' }),
    ).rejects.toThrow(/invalide/);
    expect(mockRealpath).not.toHaveBeenCalled();
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('realpath hors exportsRoot (symlink escape) → rejeté', async () => {
    mockRealpath.mockImplementation(async (p: string) =>
      p === `${EXPORTS_ROOT}/gamme/filtre-a-huile.json` ? '/etc/passwd' : p,
    );
    const { svc, writeQueue } = makeService();
    await expect(svc.triggerEntity(input)).rejects.toThrow(/hors exportsRoot/);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('export.entity_id ≠ namespaced attendu → rejeté (fichier mal placé)', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        entity_id: 'gamme:autre-chose',
        roles_allowed: ['R3_CONSEILS'],
      }),
    );
    const { svc, writeQueue } = makeService();
    await expect(svc.triggerEntity(input)).rejects.toThrow(/attendu/);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('rôle absent de roles_allowed de l’export → rejeté', async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        entity_id: 'gamme:filtre-a-huile',
        roles_allowed: ['R4_REFERENCE'],
      }),
    );
    const { svc, writeQueue } = makeService();
    await expect(svc.triggerEntity(input)).rejects.toThrow(/roles_allowed/);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });
});

describe('SeoProjectionFeederService.onModuleInit — réconciliation fail-safe OFF', () => {
  // `onModuleInit` lance ses effets en fire-and-forget (`void`, non-bloquant,
  // backend.md). `flush()` draine microtasks + macrotasks (toutes les queues
  // sont mockées → résolues) pour observer l'état APRÈS la réconciliation.
  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const STALE = {
    name: PROJECTION_FEED_JOB,
    key: `repeat:${PROJECTION_FEED_JOB}:0 2 * * *`,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAppConfig.mockReturnValue({ supabase: { readOnly: false } });
  });

  it('OFF + repeatable résiduel (activation passée) → dérégistré au boot, jamais réenregistré', async () => {
    const { svc, feedQueue } = makeService({
      enabled: false,
      repeatables: [STALE],
    });
    svc.onModuleInit();
    await flush();
    expect(feedQueue.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(feedQueue.removeRepeatableByKey).toHaveBeenCalledWith(STALE.key);
    // OFF ne doit JAMAIS (ré)enregistrer un repeatable.
    expect(feedQueue.add).not.toHaveBeenCalled();
  });

  it('OFF + aucun repeatable → no-op (rien supprimé, rien enregistré)', async () => {
    const { svc, feedQueue } = makeService({
      enabled: false,
      repeatables: [],
    });
    svc.onModuleInit();
    await flush();
    expect(feedQueue.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(feedQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(feedQueue.add).not.toHaveBeenCalled();
  });

  it('OFF ne touche PAS un repeatable d’un autre job (filtre par nom)', async () => {
    const { svc, feedQueue } = makeService({
      enabled: false,
      repeatables: [{ name: 'un-autre-job', key: 'repeat:un-autre-job:x' }],
    });
    svc.onModuleInit();
    await flush();
    expect(feedQueue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(feedQueue.add).not.toHaveBeenCalled();
  });

  it('ON → purge des obsolètes PUIS enregistre le repeatable (cron + jobId stable)', async () => {
    const { svc, feedQueue } = makeService({
      enabled: true,
      repeatables: [STALE],
    });
    svc.onModuleInit();
    await flush();
    // La purge tourne d'abord (idempotence au redeploy)…
    expect(feedQueue.removeRepeatableByKey).toHaveBeenCalledWith(STALE.key);
    // …puis un unique repeatable est (ré)enregistré.
    expect(feedQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, , addOpts] = feedQueue.add.mock.calls[0];
    expect(jobName).toBe(PROJECTION_FEED_JOB);
    expect(addOpts.jobId).toBe('seo-projection-r1-nightly-feed');
    expect(addOpts.repeat).toMatchObject({ cron: '0 2 * * *', tz: 'UTC' });
  });
});
