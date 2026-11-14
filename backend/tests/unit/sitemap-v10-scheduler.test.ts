/**
 * Regression test : SitemapV10SchedulerService
 *
 * La régénération quotidienne des sitemaps a un seul producteur : le workflow
 * GitHub `sitemap-daily-regen.yml`, qui appelle `POST /api/sitemap/v10/
 * generate-all` en PROD. L'application ne la planifie plus (décision de
 * l'owner du 2026-11-12) : toute instance qui démarre, DEV et PREPROD compris,
 * armait sinon une seconde régénération sur une base partagée.
 *
 * Couvre :
 *   - `onModuleInit` est synchrone et n'inscrit aucune tâche dans la queue
 *   - une régénération répétable laissée dans Redis par une version antérieure
 *     est retirée ; les tâches répétables des autres services restent
 *   - une erreur Redis ne fait pas échouer le démarrage
 */

import { Logger } from '@nestjs/common';
import { Queue } from 'bull';
import {
  SITEMAP_REGENERATE_JOB_NAME,
  SitemapV10SchedulerService,
} from '../../src/modules/seo/services/sitemap-v10-scheduler.service';

type RepeatableJobs = Awaited<ReturnType<Queue['getRepeatableJobs']>>;

function makeQueueMock(): jest.Mocked<Queue> {
  return {
    add: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    client: {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    },
  } as unknown as jest.Mocked<Queue>;
}

async function flushFireAndForget(): Promise<void> {
  // onModuleInit lance ses tâches sans les attendre (pattern non bloquant
  // canonique) : on laisse les microtâches se résoudre avant d'inspecter.
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('SitemapV10SchedulerService', () => {
  let service: SitemapV10SchedulerService | undefined;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await service?.onModuleDestroy();
    service = undefined;
    jest.restoreAllMocks();
  });

  it("onModuleInit est synchrone et n'inscrit aucune tâche dans la queue", async () => {
    const queue = makeQueueMock();
    service = new SitemapV10SchedulerService(queue);

    expect(service.onModuleInit()).toBeUndefined();
    await flushFireAndForget();

    expect(queue.add).not.toHaveBeenCalled();
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it('retire la régénération répétable laissée par une version antérieure', async () => {
    const queue = makeQueueMock();
    queue.getRepeatableJobs.mockResolvedValue([
      // Armée par la planification interne supprimée
      {
        name: SITEMAP_REGENERATE_JOB_NAME,
        key: 'sitemap-regenerate-all:sitemap-v10-nightly-regeneration::UTC:0 3 * * *',
      },
      // Même nom, autre cron : une ancienne planification
      {
        name: SITEMAP_REGENERATE_JOB_NAME,
        key: 'sitemap-regenerate-all:sitemap-v10-nightly-regeneration:::15 2 * * *',
      },
      // Tâche d'un autre service de la queue — ne doit PAS être retirée
      {
        name: 'daily-fetch',
        key: 'daily-fetch:seo-daily-fetch::UTC:0 4 * * *',
      },
    ] as RepeatableJobs);

    service = new SitemapV10SchedulerService(queue);
    service.onModuleInit();
    await flushFireAndForget();

    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'sitemap-regenerate-all:sitemap-v10-nightly-regeneration::UTC:0 3 * * *',
    );
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith(
      'sitemap-regenerate-all:sitemap-v10-nightly-regeneration:::15 2 * * *',
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('une lecture Redis en échec ne fait pas échouer le démarrage', async () => {
    const queue = makeQueueMock();
    queue.getRepeatableJobs.mockRejectedValue(new Error('redis down'));

    service = new SitemapV10SchedulerService(queue);
    expect(() => service?.onModuleInit()).not.toThrow();
    await flushFireAndForget();

    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });

  it('un retrait en échec ne fait pas échouer le démarrage', async () => {
    const queue = makeQueueMock();
    queue.getRepeatableJobs.mockResolvedValue([
      { name: SITEMAP_REGENERATE_JOB_NAME, key: 'stale::key::1' },
    ] as RepeatableJobs);
    queue.removeRepeatableByKey.mockRejectedValue(new Error('READONLY'));

    service = new SitemapV10SchedulerService(queue);
    expect(() => service?.onModuleInit()).not.toThrow();
    await flushFireAndForget();

    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('stale::key::1');
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});
