/**
 * Regression test : SitemapV10SchedulerService
 *
 * Pin l'invariant racine de l'incident traffic-drop 2026-04-22 → 2026-05-13 :
 * un job repeatable BullMQ DOIT être enregistré au boot pour régénérer les
 * sitemaps (lastmod sinon figé sur la dernière génération manuelle).
 *
 * Couvre :
 *   - `onModuleInit` enregistre exactement un repeatable job
 *   - `SEO_SITEMAP_CRON_ENABLED=false` désactive l'enregistrement
 *   - Anciens jobs avec même nom sont supprimés avant ré-enregistrement
 *   - Cron par défaut = '0 3 * * *' UTC
 *   - Override via `SEO_SITEMAP_CRON` env var
 */

import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import {
  SITEMAP_REGENERATE_JOB_ID,
  SITEMAP_REGENERATE_JOB_NAME,
  SitemapV10SchedulerService,
} from '../../src/modules/seo/services/sitemap-v10-scheduler.service';

function makeQueueMock(): jest.Mocked<Queue> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Queue>;
}

function makeConfig(env: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string, defaultValue?: string) => {
      const v = env[key];
      return v !== undefined ? v : defaultValue;
    }),
  } as unknown as ConfigService;
}

async function flushFireAndForget(): Promise<void> {
  // Le service appelle `void this.configureRepeatableJob()` depuis
  // onModuleInit (pattern non-bloquant canonique). On laisse la microtask
  // se résoudre avant d'inspecter les mocks.
  await new Promise((resolve) => setImmediate(resolve));
}

describe('SitemapV10SchedulerService', () => {
  it('registers exactly one repeatable job with default cron at 03:00 UTC', async () => {
    const queue = makeQueueMock();
    const config = makeConfig({});
    const service = new SitemapV10SchedulerService(queue, config);

    service.onModuleInit();
    await flushFireAndForget();

    expect(queue.getRepeatableJobs).toHaveBeenCalledTimes(1);
    expect(queue.add).toHaveBeenCalledTimes(1);

    const [jobName, jobData, jobOpts] = queue.add.mock.calls[0];
    expect(jobName).toBe(SITEMAP_REGENERATE_JOB_NAME);
    expect(jobData).toEqual({ triggeredBy: 'scheduler' });
    expect(jobOpts).toMatchObject({
      jobId: SITEMAP_REGENERATE_JOB_ID,
      repeat: { cron: '0 3 * * *', tz: 'UTC' },
    });
  });

  it('honors SEO_SITEMAP_CRON env override', async () => {
    const queue = makeQueueMock();
    const config = makeConfig({ SEO_SITEMAP_CRON: '15 2 * * *' });
    const service = new SitemapV10SchedulerService(queue, config);

    service.onModuleInit();
    await flushFireAndForget();

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [, , jobOpts] = queue.add.mock.calls[0];
    expect(jobOpts).toMatchObject({
      repeat: { cron: '15 2 * * *', tz: 'UTC' },
    });
  });

  it('skips registration when SEO_SITEMAP_CRON_ENABLED=false', async () => {
    const queue = makeQueueMock();
    const config = makeConfig({ SEO_SITEMAP_CRON_ENABLED: 'false' });
    const service = new SitemapV10SchedulerService(queue, config);

    service.onModuleInit();
    await flushFireAndForget();

    expect(queue.getRepeatableJobs).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('removes stale sitemap repeatable jobs before re-registering', async () => {
    const queue = makeQueueMock();
    queue.getRepeatableJobs.mockResolvedValue([
      // Stale entry from previous deploy
      { name: SITEMAP_REGENERATE_JOB_NAME, key: 'stale::key::1' },
      // Foreign entry — must NOT be removed
      { name: 'daily-fetch', key: 'foreign::key::2' },
    ] as Awaited<ReturnType<Queue['getRepeatableJobs']>>);

    const service = new SitemapV10SchedulerService(queue, makeConfig({}));
    service.onModuleInit();
    await flushFireAndForget();

    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('stale::key::1');
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('does not throw when stale job enumeration fails (defensive)', async () => {
    const queue = makeQueueMock();
    queue.getRepeatableJobs.mockRejectedValue(new Error('redis down'));

    const service = new SitemapV10SchedulerService(queue, makeConfig({}));
    expect(() => service.onModuleInit()).not.toThrow();
    await flushFireAndForget();

    // Erreur d'enumeration ne doit pas bloquer l'enregistrement du nouveau job
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
