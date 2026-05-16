import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { SitemapSchedulerDiagnosticController } from './sitemap-scheduler-diagnostic.controller';
import { SITEMAP_REGENERATE_JOB_ID } from '../services/sitemap-v10-scheduler.service';
import { AdminOrInternalKeyGuard } from '../../../auth/admin-or-internal-key.guard';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';

const FROZEN_NOW = new Date('2026-05-16T09:00:00.000Z');

function makeQueueMock(opts: {
  repeatable?: any[];
  waiting?: number;
  delayed?: number;
  active?: number;
  failed?: number;
  completed?: number;
  paused?: boolean;
}) {
  return {
    getRepeatableJobs: jest.fn().mockResolvedValue(opts.repeatable ?? []),
    getWaitingCount: jest.fn().mockResolvedValue(opts.waiting ?? 0),
    getDelayedCount: jest.fn().mockResolvedValue(opts.delayed ?? 0),
    getActiveCount: jest.fn().mockResolvedValue(opts.active ?? 0),
    getFailedCount: jest.fn().mockResolvedValue(opts.failed ?? 0),
    getCompletedCount: jest.fn().mockResolvedValue(opts.completed ?? 0),
    isPaused: jest.fn().mockResolvedValue(opts.paused ?? false),
  };
}

async function buildController(opts: {
  envCronEnabled?: string;
  envCron?: string;
  queue: ReturnType<typeof makeQueueMock>;
}) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SitemapSchedulerDiagnosticController],
    providers: [
      { provide: getQueueToken('seo-monitor'), useValue: opts.queue },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, def?: string) => {
            if (key === 'SEO_SITEMAP_CRON_ENABLED') return opts.envCronEnabled;
            if (key === 'SEO_SITEMAP_CRON') return opts.envCron ?? def;
            if (key === 'INTERNAL_API_KEY') return 'test-key';
            return def;
          },
        },
      },
    ],
  })
    .overrideGuard(AdminOrInternalKeyGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(InternalApiKeyGuard)
    .useValue({ canActivate: () => true })
    .compile();
  return moduleRef.get(SitemapSchedulerDiagnosticController);
}

describe('SitemapSchedulerDiagnosticController', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(FROZEN_NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports healthy state when repeatable job is registered', async () => {
    const queue = makeQueueMock({
      repeatable: [
        {
          key: 'seo-monitor:sitemap-regenerate-all:::0 3 * * *',
          name: 'sitemap-regenerate-all',
          id: SITEMAP_REGENERATE_JOB_ID,
          cron: '0 3 * * *',
          tz: 'UTC',
          next: new Date('2026-05-17T03:00:00.000Z').getTime(),
        },
      ],
      delayed: 1,
      completed: 2,
    });
    const ctrl = await buildController({ queue });

    const result = await ctrl.getSchedulerStatus();

    expect(result.schedulerConfigured).toBe(true);
    expect(result.cron).toBe('0 3 * * *');
    expect(result.cronEnvOverride).toBeNull();
    expect(result.ourRepeatableFound).toBe(true);
    expect(result.repeatableJobs).toHaveLength(1);
    expect(result.repeatableJobs[0]).toMatchObject({
      id: SITEMAP_REGENERATE_JOB_ID,
      cron: '0 3 * * *',
      tz: 'UTC',
      next: '2026-05-17T03:00:00.000Z',
    });
    expect(result.counts).toEqual({
      waiting: 0,
      delayed: 1,
      active: 0,
      failed: 0,
      completed: 2,
      paused: false,
    });
    // Frozen now = 2026-05-16T09:00:00Z, last 03:00 UTC tick was today
    expect(result.lastExpectedRunIso).toBe('2026-05-16T03:00:00.000Z');
    expect(result.hoursSinceLastExpectedRun).toBe(6);
  });

  it('reports schedulerConfigured=false when SEO_SITEMAP_CRON_ENABLED=false', async () => {
    const queue = makeQueueMock({});
    const ctrl = await buildController({
      envCronEnabled: 'false',
      queue,
    });

    const result = await ctrl.getSchedulerStatus();

    expect(result.schedulerConfigured).toBe(false);
    expect(result.cronEnvOverride).toBe('false');
    expect(result.ourRepeatableFound).toBe(false);
  });

  it('reports ourRepeatableFound=false when repeatable list lacks our jobId', async () => {
    const queue = makeQueueMock({
      repeatable: [
        {
          key: 'seo-monitor:other-job:::*/30 * * * *',
          name: 'other-job',
          id: 'other-job-id',
          cron: '*/30 * * * *',
          tz: 'UTC',
          next: Date.now() + 60_000,
        },
      ],
    });
    const ctrl = await buildController({ queue });

    const result = await ctrl.getSchedulerStatus();

    expect(result.ourRepeatableFound).toBe(false);
    expect(result.repeatableJobs).toHaveLength(1);
    expect(result.repeatableJobs[0].id).toBe('other-job-id');
  });

  it('falls back to null lastExpectedRunIso for non-daily cron expressions', async () => {
    const queue = makeQueueMock({});
    const ctrl = await buildController({
      envCron: '*/15 * * * *',
      queue,
    });

    const result = await ctrl.getSchedulerStatus();

    expect(result.cron).toBe('*/15 * * * *');
    expect(result.lastExpectedRunIso).toBeNull();
    expect(result.hoursSinceLastExpectedRun).toBeNull();
  });

  it('returns "now" as ISO timestamp', async () => {
    const queue = makeQueueMock({});
    const ctrl = await buildController({ queue });

    const result = await ctrl.getSchedulerStatus();

    expect(result.now).toBe(FROZEN_NOW.toISOString());
  });
});
