/**
 * Unit tests for Ga4DailyFetcherService — hostName anti-pollution guard.
 *
 * Garantit que les requêtes GA4 filtrent sur le hostname de PROD
 * (SITE_HOSTNAME) pour exclure le trafic localhost (CI headless E2E/Lighthouse).
 * Cf. mémoire ga4_prod_tag_not_env_gated_ci_localhost_pollution + PR #1115.
 */
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SITE_HOSTNAME } from '@config/site.constants';
import { Ga4DailyFetcherService } from './ga4-daily-fetcher.service';
import { GoogleCredentialsService } from './google-credentials.service';
import { SeoMonitoringRunsService } from './seo-monitoring-runs.service';

// Isole le client Supabase externe (le constructeur réel exige une clé valide).
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn() })),
}));

function buildService() {
  const runReport = jest.fn().mockResolvedValue([{ rows: [] }]);

  const credentialsMock = {
    isMonitoringEnabled: jest.fn().mockReturnValue(true),
    getGA4Client: jest.fn().mockReturnValue({ runReport }),
    getGA4PropertyName: jest.fn().mockReturnValue('properties/311870207'),
  } as unknown as GoogleCredentialsService;

  const runsServiceMock = {
    logStarted: jest.fn().mockResolvedValue('test-run-id'),
    logCompleted: jest.fn().mockResolvedValue(undefined),
    logFailed: jest.fn().mockResolvedValue(undefined),
  };

  return Test.createTestingModule({
    providers: [
      Ga4DailyFetcherService,
      { provide: GoogleCredentialsService, useValue: credentialsMock },
      { provide: SeoMonitoringRunsService, useValue: runsServiceMock },
      {
        provide: ConfigService,
        useValue: {
          get: (k: string) =>
            k === 'SUPABASE_URL' ? 'https://mock.supabase.co' : undefined,
        },
      },
    ],
  })
    .compile()
    .then((moduleRef) => {
      const service = moduleRef.get(Ga4DailyFetcherService);
      return { service, runReport };
    });
}

describe('Ga4DailyFetcherService — hostName anti-pollution guard', () => {
  it('SITE_HOSTNAME dérive bien le host nu de PROD', () => {
    expect(SITE_HOSTNAME).toBe('www.automecanik.com');
  });

  it('sans segment pagePath → filtre hostName EXACT seul', async () => {
    const { service, runReport } = await buildService();

    await service.fetchAndPersist({ date: '2026-06-22', dryRun: true });

    expect(runReport).toHaveBeenCalledTimes(1);
    const req = runReport.mock.calls[0][0];
    expect(req.dimensionFilter).toEqual({
      filter: {
        fieldName: 'hostName',
        stringFilter: { matchType: 'EXACT', value: SITE_HOSTNAME },
      },
    });
  });

  it('avec segment pagePath → andGroup [hostName, pagePath]', async () => {
    const { service, runReport } = await buildService();

    await service.fetchAndPersist({
      date: '2026-06-22',
      pagePathPatterns: ['/pieces'],
      dryRun: true,
    });

    expect(runReport).toHaveBeenCalledTimes(1);
    const req = runReport.mock.calls[0][0];
    expect(req.dimensionFilter.andGroup.expressions).toHaveLength(2);
    expect(req.dimensionFilter.andGroup.expressions[0]).toEqual({
      filter: {
        fieldName: 'hostName',
        stringFilter: { matchType: 'EXACT', value: SITE_HOSTNAME },
      },
    });
    expect(req.dimensionFilter.andGroup.expressions[1]).toEqual({
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'CONTAINS', value: '/pieces' },
      },
    });
  });
});
