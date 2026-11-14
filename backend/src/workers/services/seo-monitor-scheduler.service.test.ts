/**
 * SeoMonitorSchedulerService — nettoyage des tâches répétables au démarrage.
 *
 * La queue `seo-monitor` est partagée. Ce test fixe deux invariants :
 * - au démarrage, ce service ne retire que ses propres tâches répétables ; il
 *   retirait toutes celles de la queue, quel qu'en soit le propriétaire ;
 * - la régénération du sitemap n'est planifiée par aucune instance de
 *   l'application (producteur unique : le workflow GitHub quotidien) ; une
 *   tâche répétable laissée par une version antérieure est retirée, quel que
 *   soit l'ordre de démarrage des deux services.
 */

import { Logger } from '@nestjs/common';
import { Queue } from 'bull';
import {
  SITEMAP_REGENERATE_JOB_NAME,
  SitemapV10SchedulerService,
} from '../../modules/seo/services/sitemap-v10-scheduler.service';
import {
  SEO_MONITOR_OWNED_JOB_NAMES,
  SeoMonitorSchedulerService,
} from './seo-monitor-scheduler.service';

interface Repeatable {
  name: string;
  key: string;
  id?: string;
  cron?: string;
  tz?: string;
  next: number;
}

interface AddOptions {
  jobId?: string;
  repeat?: { cron?: string; tz?: string };
}

/**
 * Faux Bull minimal : garde les tâches répétables comme Redis le fait, d'un
 * `add` à l'autre, avec une clé qui dépend du nom, de l'identifiant, du fuseau
 * et du cron.
 */
function makeSharedQueue(persisted: Repeatable[] = []) {
  const store = new Map<string, Repeatable>(persisted.map((r) => [r.key, r]));
  const queue = {
    add: jest.fn(async (name: string, _data: unknown, opts?: AddOptions) => {
      if (opts?.repeat) {
        const key = `${name}:${opts.jobId ?? ''}::${opts.repeat.tz ?? ''}:${opts.repeat.cron ?? ''}`;
        store.set(key, {
          name,
          key,
          id: opts.jobId,
          cron: opts.repeat.cron,
          tz: opts.repeat.tz,
          next: Date.now(),
        });
      }
      return { id: opts?.jobId ?? '1' };
    }),
    getRepeatableJobs: jest.fn(async () => [...store.values()]),
    removeRepeatableByKey: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    client: { set: jest.fn(async () => 'OK'), del: jest.fn(async () => 1) },
  };
  return { queue: queue as unknown as Queue, mock: queue, store };
}

const flush = async (): Promise<void> => {
  // onModuleInit est non bloquant (`void …`) : on laisse la chaîne d'attentes
  // se dérouler avant de lire l'état de la queue.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

const names = (store: Map<string, Repeatable>): string[] =>
  [...store.values()].map((r) => r.name).sort();

/** Tâche répétable d'un autre service de la queue. */
const FOREIGN: Repeatable = {
  name: 'tache-d-un-autre-service',
  key: 'tache-d-un-autre-service:x:::* * * * *',
  next: 0,
};

/** Régénération nocturne armée par une version antérieure de l'application. */
const SITEMAP_RETIRED: Repeatable = {
  name: SITEMAP_REGENERATE_JOB_NAME,
  key: `${SITEMAP_REGENERATE_JOB_NAME}:sitemap-v10-nightly-regeneration::UTC:0 3 * * *`,
  next: 0,
};

const MONITOR_JOBS = ['check-pages', 'check-pages', 'daily-fetch'];

describe('SeoMonitorSchedulerService — tâches répétables au démarrage', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ne déclare que les noms de tâches traités pour ce service', () => {
    expect([...SEO_MONITOR_OWNED_JOB_NAMES].sort()).toEqual([
      'check-pages',
      'daily-fetch',
    ]);
    expect(SEO_MONITOR_OWNED_JOB_NAMES).not.toContain(
      SITEMAP_REGENERATE_JOB_NAME,
    );
  });

  it('onModuleInit est synchrone et planifie ses trois tâches', async () => {
    const { queue, mock, store } = makeSharedQueue();
    const service = new SeoMonitorSchedulerService(queue);

    expect(service.onModuleInit()).toBeUndefined();
    await flush();

    expect(mock.add).toHaveBeenCalledTimes(3);
    expect(names(store)).toEqual(MONITOR_JOBS);
    expect(mock.removeRepeatableByKey).not.toHaveBeenCalled();
  });

  it("laisse en place la tâche répétable d'un autre service de la queue", async () => {
    const { queue, mock, store } = makeSharedQueue([FOREIGN]);

    new SeoMonitorSchedulerService(queue).onModuleInit();
    await flush();

    expect(mock.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(store.has(FOREIGN.key)).toBe(true);
    expect(names(store)).toEqual([...MONITOR_JOBS, FOREIGN.name].sort());
  });

  it('retire ses propres tâches périmées avant de les réinscrire', async () => {
    const staleFetch: Repeatable = {
      name: 'daily-fetch',
      // Ancienne planification : sans fuseau explicite.
      key: 'daily-fetch:seo-daily-fetch:::0 4 * * *',
      next: 0,
    };
    const staleCheck: Repeatable = {
      name: 'check-pages',
      key: 'check-pages:critical-urls-monitoring:::*/15 * * * *',
      next: 0,
    };
    const { queue, mock, store } = makeSharedQueue([
      staleFetch,
      staleCheck,
      FOREIGN,
    ]);

    new SeoMonitorSchedulerService(queue).onModuleInit();
    await flush();

    expect(mock.removeRepeatableByKey).toHaveBeenCalledTimes(2);
    expect(mock.removeRepeatableByKey).toHaveBeenCalledWith(staleFetch.key);
    expect(mock.removeRepeatableByKey).toHaveBeenCalledWith(staleCheck.key);
    expect(store.has(staleFetch.key)).toBe(false);
    expect(store.has(staleCheck.key)).toBe(false);
    // Les retraits précèdent les inscriptions.
    expect(
      Math.max(...mock.removeRepeatableByKey.mock.invocationCallOrder),
    ).toBeLessThan(Math.min(...mock.add.mock.invocationCallOrder));
    expect(names(store)).toEqual([...MONITOR_JOBS, FOREIGN.name].sort());
  });

  it("planifie l'ingestion quotidienne à 04:00 en UTC explicite", async () => {
    const { queue, mock } = makeSharedQueue();

    new SeoMonitorSchedulerService(queue).onModuleInit();
    await flush();

    const dailyFetch = mock.add.mock.calls.find(
      ([name]) => name === 'daily-fetch',
    );
    expect(dailyFetch?.[2]).toMatchObject({
      jobId: 'seo-daily-fetch',
      repeat: { cron: '0 4 * * *', tz: 'UTC' },
    });
  });

  it('Redis injoignable à la lecture : ne lève pas, ne retire ni ne planifie rien', async () => {
    const { queue, mock } = makeSharedQueue([FOREIGN]);
    mock.getRepeatableJobs.mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new SeoMonitorSchedulerService(queue);

    expect(() => service.onModuleInit()).not.toThrow();
    await flush();

    expect(mock.removeRepeatableByKey).not.toHaveBeenCalled();
    expect(mock.add).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("échec d'un retrait : ne lève pas et ne touche pas aux tâches des autres", async () => {
    const stale: Repeatable = {
      name: 'daily-fetch',
      key: 'daily-fetch:seo-daily-fetch:::0 4 * * *',
      next: 0,
    };
    const { queue, mock, store } = makeSharedQueue([stale, FOREIGN]);
    mock.removeRepeatableByKey.mockRejectedValue(new Error('READONLY'));
    const service = new SeoMonitorSchedulerService(queue);

    expect(() => service.onModuleInit()).not.toThrow();
    await flush();

    expect(mock.removeRepeatableByKey).toHaveBeenCalledTimes(1);
    expect(mock.removeRepeatableByKey).toHaveBeenCalledWith(stale.key);
    expect(store.has(FOREIGN.key)).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  describe('avec le service du sitemap sur la même queue', () => {
    const ORDERS = ['sitemap-puis-moniteur', 'moniteur-puis-sitemap'] as const;

    const boot = async (
      order: (typeof ORDERS)[number],
      queue: Queue,
    ): Promise<SitemapV10SchedulerService> => {
      const sitemap = new SitemapV10SchedulerService(queue);
      const monitor = new SeoMonitorSchedulerService(queue);
      if (order === 'sitemap-puis-moniteur') {
        sitemap.onModuleInit();
        await flush();
        monitor.onModuleInit();
      } else {
        monitor.onModuleInit();
        await flush();
        sitemap.onModuleInit();
      }
      await flush();
      return sitemap;
    };

    it.each(ORDERS)(
      "aucune régénération du sitemap n'est planifiée, ordre : %s",
      async (order) => {
        const { queue, mock, store } = makeSharedQueue();

        await (await boot(order, queue)).onModuleDestroy();

        expect(names(store)).toEqual(MONITOR_JOBS);
        expect(
          mock.add.mock.calls.some(
            ([name]) => name === SITEMAP_REGENERATE_JOB_NAME,
          ),
        ).toBe(false);
      },
    );

    it.each(ORDERS)(
      "la régénération armée par une version antérieure est retirée, les tâches d'un autre service restent, ordre : %s",
      async (order) => {
        const { queue, store } = makeSharedQueue([SITEMAP_RETIRED, FOREIGN]);

        await (await boot(order, queue)).onModuleDestroy();

        expect(store.has(SITEMAP_RETIRED.key)).toBe(false);
        expect(store.has(FOREIGN.key)).toBe(true);
        expect(names(store)).toEqual([...MONITOR_JOBS, FOREIGN.name].sort());
      },
    );

    it.each(ORDERS)(
      'un second démarrage ne duplique aucune tâche, ordre : %s',
      async (order) => {
        const { queue, store } = makeSharedQueue();

        await (await boot(order, queue)).onModuleDestroy();
        await (await boot(order, queue)).onModuleDestroy();

        expect(store.size).toBe(3);
      },
    );
  });
});
