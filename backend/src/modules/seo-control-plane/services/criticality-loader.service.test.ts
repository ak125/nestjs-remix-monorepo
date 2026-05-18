import { CriticalityLoaderService } from './criticality-loader.service';
import type { SeoCriticality } from '@repo/registry';

const VALID_CONFIG: SeoCriticality = {
  schemaVersion: '1.0.0',
  slo_window_minutes: 60,
  tiers: {
    tier0: {
      slo: 0.997,
      sampling_weight: 0.6,
      alerting: {
        breach_threshold_minutes: 5,
        channel: 'pagerduty',
        auto_issue: true,
      },
      routes: ['pieces/*', 'constructeurs/*'],
    },
    tier1: {
      slo: 0.99,
      sampling_weight: 0.3,
      alerting: {
        breach_threshold_minutes: 15,
        channel: 'slack',
        auto_issue: false,
      },
      routes: ['blog/*'],
    },
    tier2: {
      slo: 0.98,
      sampling_weight: 0.1,
      alerting: {
        breach_threshold_minutes: 60,
        channel: 'log',
        auto_issue: false,
      },
      routes: ['support/*'],
    },
  },
  excluded: { routes: ['admin/*', 'api/*', 'sitemap*.xml'] },
  metadata: {
    adr_reference: 'ADR-064',
    introduced_in_pr: 'TBD',
    last_review: '2026-05-14',
    next_review_due: '2026-08-14',
  },
};

describe('CriticalityLoaderService', () => {
  let svc: CriticalityLoaderService;

  beforeEach(() => {
    svc = new CriticalityLoaderService();
    process.env.NODE_ENV = 'test';
  });

  describe('boot via onModuleInit (real YAML on disk)', () => {
    it('loads the canon file from .spec/00-canon/repository-registry/', () => {
      svc.onModuleInit();
      const cfg = svc.getConfig();
      expect(cfg.metadata.adr_reference).toBe('ADR-064');
      expect(cfg.tiers.tier0.routes).toContain('pieces/*');
    });

    it('classify integrates classifyRoute correctly', () => {
      svc.onModuleInit();
      expect(svc.classify('/pieces/filtre-7.html')).toBe('tier0');
      expect(svc.classify('/admin/dashboard')).toBe('excluded');
      expect(svc.classify('/totally-unknown')).toBeNull();
    });
  });

  describe('getConfig() fail-loud semantics', () => {
    it('throws when called before onModuleInit', () => {
      expect(() => svc.getConfig()).toThrow(/not initialized/i);
    });
  });

  describe('setConfigForTest() injection seam', () => {
    it('replaces the config and survives a subsequent classify call', () => {
      svc.setConfigForTest(VALID_CONFIG);
      expect(svc.classify('/pieces/foo-1.html')).toBe('tier0');
      expect(svc.classify('/blog/post')).toBe('tier1');
    });

    it('refuses injection when NODE_ENV=production', () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      expect(() => svc.setConfigForTest(VALID_CONFIG)).toThrow(/forbidden/i);
      process.env.NODE_ENV = prev;
    });
  });
});
