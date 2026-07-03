/**
 * Tests SeoProjectionFeederService.discoverAndEnqueue + triggerNow (ADR-059 PR-6c).
 * fs + app.config mockés ; queues = stubs jest. Aucune dépendance BullMQ/DB réelle.
 */
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import { promises as fs } from 'node:fs';
import { SeoProjectionFeederService } from './seo-projection-feeder.service';
import { getAppConfig } from '../../config/app.config';

jest.mock('node:fs', () => ({ promises: { readdir: jest.fn() } }));
jest.mock('../../config/app.config', () => ({ getAppConfig: jest.fn() }));

const mockReaddir = fs.readdir as jest.Mock;
const mockGetAppConfig = getAppConfig as jest.Mock;

function makeService(opts: { exportsDir?: string } = {}) {
  const feedQueue = {
    add: jest.fn().mockResolvedValue({ id: 'feed-1' }),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn(),
  };
  const writeQueue = { add: jest.fn().mockResolvedValue({ id: 'write-1' }) };
  const config = {
    get: jest.fn((key: string, def?: string) => {
      if (key === 'SEO_PROJECTION_R1_EXPORTS_DIR')
        return opts.exportsDir ?? '/abs/exports';
      return def;
    }),
  };
  const svc = new SeoProjectionFeederService(
    feedQueue as unknown as Queue,
    writeQueue as unknown as Queue,
    config as unknown as ConfigService,
  );
  return { svc, feedQueue, writeQueue };
}

describe('SeoProjectionFeederService', () => {
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
    expect(r.enqueued).toBe(false);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('dossier sans .json → EMPTY, no-op', async () => {
    mockReaddir.mockResolvedValue(['readme.txt', 'note.md']);
    const { svc, writeQueue } = makeService();
    const r = await svc.discoverAndEnqueue('scheduler');
    expect(r.reason).toBe('EMPTY');
    expect(r.discovered).toBe(0);
    expect(writeQueue.add).not.toHaveBeenCalled();
  });

  it('exports présents → 1 write-job (triggeredBy=cron) avec les .json triés', async () => {
    mockReaddir.mockResolvedValue(['b.json', 'a.json', 'note.md']);
    const { svc, writeQueue } = makeService({ exportsDir: '/abs/exports' });
    const r = await svc.discoverAndEnqueue('manual');
    expect(r.enqueued).toBe(true);
    expect(r.discovered).toBe(2);
    expect(writeQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, data] = writeQueue.add.mock.calls[0];
    expect(jobName).toBe('seo-projection-write');
    expect(data.triggeredBy).toBe('cron');
    expect(data.exportPaths).toEqual([
      '/abs/exports/a.json',
      '/abs/exports/b.json',
    ]);
  });

  it('triggerNow → enqueue one-off sur la feed queue', async () => {
    const { svc, feedQueue } = makeService();
    const id = await svc.triggerNow();
    expect(id).toBe('feed-1');
    expect(feedQueue.add).toHaveBeenCalledWith(
      'seo-projection-r1-feed',
      { triggeredBy: 'manual' },
      expect.any(Object),
    );
  });
});
