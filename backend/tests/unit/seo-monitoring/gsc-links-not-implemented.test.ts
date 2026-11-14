/**
 * Collecte des liens GSC — non implémentée, et rapportée comme telle.
 *
 * Le collecteur écrivait chaque jour un run « terminé » à 0 ligne dans le
 * journal d'ingestion : la santé des sources affichait un succès récent pour
 * une collecte qui n'a jamais eu lieu. Ces tests fixent le comportement
 * attendu : aucun run journalisé, source rapportée « ignorée » avec sa raison.
 */

import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import {
  SeoDailyFetchProcessor,
  type SeoDailyFetchJobData,
} from '../../../src/modules/seo-monitoring/processors/seo-daily-fetch.processor';
import { GoogleCredentialsService } from '../../../src/modules/seo-monitoring/services/google-credentials.service';
import {
  GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED,
  GscLinksFetcherService,
  type GscLinksFetchResult,
} from '../../../src/modules/seo-monitoring/services/gsc-links-fetcher.service';

const mockReadOnly = { value: false };
jest.mock('../../../src/config/app.config', () => ({
  getAppConfig: () => ({ supabase: { readOnly: mockReadOnly.value } }),
}));

function makeCredentials(state: { enabled: boolean; auth: unknown }) {
  return {
    isMonitoringEnabled: jest.fn(() => state.enabled),
    getGSCAuth: jest.fn(() => state.auth),
  };
}

function makeFetcher(state: { enabled: boolean; auth: unknown }) {
  const credentials = makeCredentials(state);
  const service = new GscLinksFetcherService(
    credentials as unknown as GoogleCredentialsService,
  );
  return { service, credentials };
}

function linksResult(
  overrides: Partial<GscLinksFetchResult> = {},
): GscLinksFetchResult {
  return {
    snapshotDate: '2026-11-09',
    runId: '',
    rowsFetched: 0,
    rowsInserted: 0,
    durationSeconds: 0,
    warnings: [],
    ...overrides,
  };
}

function makeProcessor(fetchAndPersist: jest.Mock) {
  const jobHealth = {
    recordSuccess: jest.fn().mockResolvedValue(undefined),
    recordFailure: jest.fn().mockResolvedValue(undefined),
  };
  const untouched = () => {
    throw new Error('source hors périmètre du test');
  };
  const processor = new SeoDailyFetchProcessor(
    { fetchAndPersistMultiGrain: jest.fn(untouched) } as never,
    { fetchAndPersistWindow: jest.fn(untouched) } as never,
    { fetchAndPersist } as never,
    { fetchAndPersist: jest.fn(untouched) } as never,
    { runDailyEvaluation: jest.fn(untouched) } as never,
    { fetchAndPersist: jest.fn(untouched) } as never,
    jobHealth as never,
  );
  return { processor, jobHealth };
}

function makeJob(data: SeoDailyFetchJobData): Job<SeoDailyFetchJobData> {
  return {
    id: 'job-1',
    data,
    progress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<SeoDailyFetchJobData>;
}

const LINKS_JOB: SeoDailyFetchJobData = {
  task: 'gsc_links',
  date: '2026-11-09',
  triggeredBy: 'manual',
};

beforeEach(() => {
  mockReadOnly.value = false;
  for (const level of ['log', 'warn', 'error'] as const) {
    jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GscLinksFetcherService', () => {
  it('rend « non implémenté », sans ligne ni identifiant de run', async () => {
    const { service } = makeFetcher({ enabled: true, auth: {} });

    const result = await service.fetchAndPersist({
      snapshotDate: '2026-11-09',
    });

    expect(result).toEqual({
      snapshotDate: '2026-11-09',
      runId: '',
      rowsFetched: 0,
      rowsInserted: 0,
      durationSeconds: 0,
      warnings: [GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED],
    });
  });

  it("n'appelle ni le réseau ni la base", async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('réseau interdit dans ce test'));
    const { service } = makeFetcher({ enabled: true, auth: {} });

    await expect(service.fetchAndPersist()).resolves.toMatchObject({
      warnings: [GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('date de snapshot par défaut : le jour courant en UTC', async () => {
    const { service } = makeFetcher({ enabled: true, auth: {} });

    const result = await service.fetchAndPersist();

    expect(result.snapshotDate).toBe(new Date().toISOString().slice(0, 10));
  });

  it('monitoring désactivé : la raison rendue est la désactivation', async () => {
    const { service, credentials } = makeFetcher({ enabled: false, auth: {} });

    const result = await service.fetchAndPersist();

    expect(result.warnings).toEqual(['monitoring_disabled']);
    expect(credentials.getGSCAuth).not.toHaveBeenCalled();
  });

  it("credentials absents : la raison rendue est l'absence de credentials", async () => {
    const { service } = makeFetcher({ enabled: true, auth: null });

    const result = await service.fetchAndPersist();

    expect(result.warnings).toEqual(['credentials_missing']);
  });
});

describe('SeoDailyFetchProcessor — source gsc_links', () => {
  it('collecte non implémentée : source « ignorée » avec sa raison, pas « ok »', async () => {
    const fetchAndPersist = jest.fn().mockResolvedValue(
      linksResult({
        warnings: [GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED],
      }),
    );
    const { processor, jobHealth } = makeProcessor(fetchAndPersist);

    const result = await processor.handleDailyFetch(makeJob(LINKS_JOB));

    expect(fetchAndPersist).toHaveBeenCalledWith({
      snapshotDate: '2026-11-09',
    });
    expect(result.perSource).toEqual([
      expect.objectContaining({
        source: 'gsc_links',
        status: 'skipped',
        rowsInserted: 0,
        message: GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED,
      }),
    ]);
    // Une source ignorée n'est pas un échec du job.
    expect(jobHealth.recordFailure).not.toHaveBeenCalled();
    expect(jobHealth.recordSuccess).toHaveBeenCalledTimes(1);
  });

  it('bout en bout avec le vrai collecteur : « ignorée », jamais « ok »', async () => {
    const { service } = makeFetcher({ enabled: true, auth: {} });
    const { processor } = makeProcessor(
      jest.fn((options) => service.fetchAndPersist(options)),
    );

    const result = await processor.handleDailyFetch(makeJob(LINKS_JOB));

    expect(result.perSource[0]).toMatchObject({
      source: 'gsc_links',
      status: 'skipped',
      message: GSC_LINKS_COLLECTOR_NOT_IMPLEMENTED,
    });
    expect(result.totalRowsInserted).toBe(0);
  });

  it.each(['monitoring_disabled', 'credentials_missing'])(
    '%s : source « ignorée »',
    async (warning) => {
      const { processor } = makeProcessor(
        jest.fn().mockResolvedValue(linksResult({ warnings: [warning] })),
      );

      const result = await processor.handleDailyFetch(makeJob(LINKS_JOB));

      expect(result.perSource[0]).toMatchObject({
        status: 'skipped',
        message: warning,
      });
    },
  );

  it('un collecteur qui rendrait des lignes sans avertissement reste « ok »', async () => {
    const { processor } = makeProcessor(
      jest
        .fn()
        .mockResolvedValue(linksResult({ rowsFetched: 12, rowsInserted: 12 })),
    );

    const result = await processor.handleDailyFetch(makeJob(LINKS_JOB));

    expect(result.perSource[0]).toMatchObject({
      status: 'ok',
      rowsInserted: 12,
    });
    expect(result.totalRowsInserted).toBe(12);
  });

  it('collecteur en erreur : source « échouée », échec du job enregistré', async () => {
    const { processor, jobHealth } = makeProcessor(
      jest.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    );

    const result = await processor.handleDailyFetch(makeJob(LINKS_JOB));

    expect(result.perSource[0]).toMatchObject({
      source: 'gsc_links',
      status: 'failed',
      message: 'ETIMEDOUT',
    });
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
    expect(jobHealth.recordFailure).toHaveBeenCalledWith(
      'seo-daily-fetch',
      'gsc_links: ETIMEDOUT',
    );
  });

  it('READ_ONLY : le collecteur n’est pas appelé, aucune source rapportée', async () => {
    mockReadOnly.value = true;
    const fetchAndPersist = jest.fn();
    const { processor, jobHealth } = makeProcessor(fetchAndPersist);

    const result = await processor.handleDailyFetch(makeJob(LINKS_JOB));

    expect(fetchAndPersist).not.toHaveBeenCalled();
    expect(result.perSource).toEqual([]);
    expect(jobHealth.recordSuccess).not.toHaveBeenCalled();
  });
});
