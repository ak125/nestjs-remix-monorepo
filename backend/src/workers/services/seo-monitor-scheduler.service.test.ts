/**
 * Anti-régression : `cleanOldRepeatableJobs()` ne doit supprimer QUE les jobs
 * possédés par SeoMonitorSchedulerService sur la queue mutualisée `seo-monitor`.
 *
 * Incident 2026-05-30 : le prune total (sans allowlist) effaçait les repeatables
 * `cwv-aggregation-*` enregistrés par CwvAggregationSchedulerService sur la même
 * queue → `__seo_cwv_hourly` jamais peuplé (effacement non-déterministe au boot).
 */
import { SeoMonitorSchedulerService } from './seo-monitor-scheduler.service';

type RepeatableJob = { name: string; key: string };

/**
 * Fabrique une fausse Bull `Queue` exposant uniquement la surface utilisée par
 * `cleanOldRepeatableJobs()` : getRepeatableJobs + removeRepeatableByKey.
 * Les `add` (setup*) sont mockés no-op pour pouvoir appeler le configurateur si besoin.
 */
function makeQueueMock(existing: RepeatableJob[]) {
  const remaining = [...existing];
  const removedKeys: string[] = [];
  return {
    removedKeys,
    queue: {
      // Renvoie une COPIE — comme Bull, qui ne retourne pas le tableau interne
      // que le code itère (sinon le splice ci-dessous muterait l'itération).
      getRepeatableJobs: jest.fn(async () => [...remaining]),
      removeRepeatableByKey: jest.fn(async (key: string) => {
        removedKeys.push(key);
        const i = remaining.findIndex((j) => j.key === key);
        if (i >= 0) remaining.splice(i, 1);
      }),
      add: jest.fn(async () => ({ id: 'mock' })),
    },
  };
}

/** Accède à la méthode privée sans `any` étalé partout. */
function cleanOldRepeatableJobs(
  svc: SeoMonitorSchedulerService,
): Promise<void> {
  return (
    svc as unknown as { cleanOldRepeatableJobs: () => Promise<void> }
  ).cleanOldRepeatableJobs();
}

describe('SeoMonitorSchedulerService.cleanOldRepeatableJobs (allowlist prune)', () => {
  const OWNED: RepeatableJob[] = [
    {
      name: 'check-pages',
      key: 'check-pages:critical-urls-monitoring:::*/30 * * * *',
    },
    {
      name: 'check-pages',
      key: 'check-pages:random-sample-monitoring:::0 */6 * * *',
    },
    { name: 'daily-fetch', key: 'daily-fetch:seo-daily-fetch:::0 4 * * *' },
  ];
  const FOREIGN_CWV: RepeatableJob[] = [
    {
      name: 'cwv-aggregation-hourly',
      key: 'cwv-aggregation-hourly:cwv-agg-hourly-repeat::UTC:5 * * * *',
    },
    {
      name: 'cwv-aggregation-daily',
      key: 'cwv-aggregation-daily:cwv-agg-daily-repeat::UTC:15 3 * * *',
    },
  ];

  it('supprime les jobs possédés (check-pages, daily-fetch)', async () => {
    const { queue, removedKeys } = makeQueueMock([...OWNED]);
    const svc = new SeoMonitorSchedulerService(queue as never);

    await cleanOldRepeatableJobs(svc);

    expect(removedKeys.sort()).toEqual(OWNED.map((j) => j.key).sort());
    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(OWNED.length);
  });

  it("NE supprime PAS les jobs d'un autre scheduler (cwv-aggregation-*)", async () => {
    const { queue, removedKeys } = makeQueueMock([...OWNED, ...FOREIGN_CWV]);
    const svc = new SeoMonitorSchedulerService(queue as never);

    await cleanOldRepeatableJobs(svc);

    // Les jobs CWV ne doivent jamais être passés à removeRepeatableByKey.
    for (const cwv of FOREIGN_CWV) {
      expect(removedKeys).not.toContain(cwv.key);
    }
    // Seuls les jobs possédés sont supprimés.
    expect(removedKeys.sort()).toEqual(OWNED.map((j) => j.key).sort());
  });

  it('ne fait jamais de prune total de la queue partagée', async () => {
    const { queue, removedKeys } = makeQueueMock([...OWNED, ...FOREIGN_CWV]);
    const svc = new SeoMonitorSchedulerService(queue as never);

    await cleanOldRepeatableJobs(svc);

    // Régression historique : tout supprimer (5) au lieu des seuls possédés (3).
    expect(removedKeys.length).toBe(OWNED.length);
    expect(removedKeys.length).toBeLessThan(OWNED.length + FOREIGN_CWV.length);
  });

  it('no-op quand seuls des jobs étrangers existent', async () => {
    const { queue, removedKeys } = makeQueueMock([...FOREIGN_CWV]);
    const svc = new SeoMonitorSchedulerService(queue as never);

    await cleanOldRepeatableJobs(svc);

    expect(removedKeys).toHaveLength(0);
    expect(queue.removeRepeatableByKey).not.toHaveBeenCalled();
  });
});
