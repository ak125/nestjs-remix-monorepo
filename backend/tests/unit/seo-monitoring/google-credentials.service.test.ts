/**
 * GoogleCredentialsService unit tests.
 *
 * Verifies that ENV var conventions match the existing codebase
 * (cf. AP-11 — no inventing names ; reuse GSC_CLIENT_EMAIL etc. lus par
 * crawl-budget-audit.service.ts:208-216 et url-audit.service.ts:50-60).
 */
import { GoogleCredentialsService } from '../../../src/modules/seo-monitoring/services/google-credentials.service';

describe('GoogleCredentialsService', () => {
  function makeConfig(overrides: Record<string, string | undefined>) {
    return {
      get: <T = string>(key: string): T | undefined => {
        return overrides[key] as T | undefined;
      },
    } as any;
  }

  describe('checkReadiness', () => {
    it('reports both not ready when no env set', () => {
      const svc = new GoogleCredentialsService(makeConfig({}));
      const r = svc.checkReadiness();
      expect(r.gsc.ready).toBe(false);
      expect(r.gsc.reason).toBe('GSC_CLIENT_EMAIL missing');
      expect(r.ga4.ready).toBe(false);
      expect(r.ga4.reason).toBe('GA4_CLIENT_EMAIL missing');
    });

    it('reports GSC ready with client_email + private_key', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({
          GSC_CLIENT_EMAIL: 'sa@project.iam.gserviceaccount.com',
          GSC_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----\\n',
        }),
      );
      const r = svc.checkReadiness();
      expect(r.gsc.ready).toBe(true);
      expect(r.gsc.reason).toBeUndefined();
    });

    it('reports GA4 ready only when all 3 vars present', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({
          GA4_CLIENT_EMAIL: 'sa@p.iam',
          GA4_PRIVATE_KEY: 'k',
          GA4_PROPERTY_ID: '123456789',
        }),
      );
      expect(svc.checkReadiness().ga4.ready).toBe(true);
    });

    it('reports GA4 not ready when GA4_PROPERTY_ID is missing', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({
          GA4_CLIENT_EMAIL: 'sa@p.iam',
          GA4_PRIVATE_KEY: 'k',
        }),
      );
      const r = svc.checkReadiness();
      expect(r.ga4.ready).toBe(false);
      expect(r.ga4.reason).toBe('GA4_PROPERTY_ID missing');
    });
  });

  describe('isMonitoringEnabled (kill-switch)', () => {
    it('defaults to false when env unset', () => {
      const svc = new GoogleCredentialsService(makeConfig({}));
      expect(svc.isMonitoringEnabled()).toBe(false);
    });

    it('returns true only when SEO_MONITORING_ENABLED is exactly "true"', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({ SEO_MONITORING_ENABLED: 'true' }),
      );
      expect(svc.isMonitoringEnabled()).toBe(true);
    });

    it('returns false for any non-"true" value (defensive)', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({ SEO_MONITORING_ENABLED: '1' }),
      );
      expect(svc.isMonitoringEnabled()).toBe(false);
    });
  });

  describe('getGSCSiteUrl fallback', () => {
    it('uses fallback automecanik.com when GSC_SITE_URL unset', () => {
      const svc = new GoogleCredentialsService(makeConfig({}));
      expect(svc.getGSCSiteUrl()).toBe('https://www.automecanik.com');
    });

    it('uses provided GSC_SITE_URL', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({ GSC_SITE_URL: 'https://staging.example.com' }),
      );
      expect(svc.getGSCSiteUrl()).toBe('https://staging.example.com');
    });
  });

  describe('getGSCAuth / getGA4Client (no creds)', () => {
    it('returns null for GSC when creds missing', () => {
      const svc = new GoogleCredentialsService(makeConfig({}));
      expect(svc.getGSCAuth()).toBeNull();
    });

    it('returns null for GA4 client when creds missing', () => {
      const svc = new GoogleCredentialsService(makeConfig({}));
      expect(svc.getGA4Client()).toBeNull();
    });

    it('returns null for GA4 property name when missing', () => {
      const svc = new GoogleCredentialsService(makeConfig({}));
      expect(svc.getGA4PropertyName()).toBeNull();
    });

    it('returns formatted "properties/<id>" when GA4_PROPERTY_ID set', () => {
      const svc = new GoogleCredentialsService(
        makeConfig({ GA4_PROPERTY_ID: '987654321' }),
      );
      expect(svc.getGA4PropertyName()).toBe('properties/987654321');
    });
  });
});
