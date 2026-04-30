import { ConfigService } from '@nestjs/config';
import { MarketingMatrixService } from './marketing-matrix.service';
import {
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
  MarketingGateLevel,
} from './marketing-matrix.types';

function makeService(env: Record<string, string | undefined> = {}) {
  const config = {
    get: <T = unknown>(key: string): T | undefined => env[key] as T | undefined,
  } as unknown as ConfigService;
  return new MarketingMatrixService(config);
}

describe('MarketingMatrixService', () => {
  describe('snapshot()', () => {
    const svc = makeService({ NODE_ENV: 'test' });
    const snap = svc.snapshot();

    it('emits version 1.0.0 + module MARKETING', () => {
      expect(snap.version).toBe('1.0.0');
      expect(snap.module).toBe('MARKETING');
    });

    it('exposes 4 invariant.requires alpha-sorted (ADR-036 §"OperatingMatrixService étendu")', () => {
      expect(snap.invariant.requires).toEqual([
        'aec_manifest',
        'brand_compliance_gate',
        'business_unit_defined',
        'conversion_goal_defined',
      ]);
    });

    it('exposes 2 subdomains (ECOMMERCE + LOCAL — HYBRID est exceptionnel)', () => {
      expect(snap.invariant.subdomains).toEqual([
        MarketingBusinessUnit.ECOMMERCE,
        MarketingBusinessUnit.LOCAL,
      ]);
    });

    it('lists all 8 channels alpha-sorted', () => {
      expect(snap.channels).toEqual([
        MarketingChannel.EMAIL,
        MarketingChannel.GBP,
        MarketingChannel.LOCAL_LANDING,
        MarketingChannel.SMS,
        MarketingChannel.SOCIAL_FACEBOOK,
        MarketingChannel.SOCIAL_INSTAGRAM,
        MarketingChannel.SOCIAL_YOUTUBE,
        MarketingChannel.WEBSITE_SEO,
      ]);
    });

    it('lists all 4 conversion goals alpha-sorted', () => {
      expect(snap.conversionGoals).toEqual([
        MarketingConversionGoal.CALL,
        MarketingConversionGoal.ORDER,
        MarketingConversionGoal.QUOTE,
        MarketingConversionGoal.VISIT,
      ]);
    });

    it('lists all 3 gate levels alpha-sorted (PASS/WARN/FAIL — cohérent __marketing_social_posts)', () => {
      expect(snap.gateLevels).toEqual([
        MarketingGateLevel.FAIL,
        MarketingGateLevel.PASS,
        MarketingGateLevel.WARN,
      ]);
    });

    it('expects 3 agents (LEAD + LOCAL + RETENTION) alpha-sorted', () => {
      expect(snap.agentsExpected).toEqual([
        'customer-retention-agent',
        'local-business-agent',
        'marketing-lead-agent',
      ]);
    });

    it('hashes source files using "sha256:" prefix + 64 hex chars (cohérent OperatingMatrixService)', () => {
      for (const v of Object.values(snap.sourcesHash)) {
        expect(v).toMatch(/^sha256:[a-f0-9]{64}$/);
      }
    });
  });

  describe('formatJson()', () => {
    it('strips agentScanRootsFound (filesystem-dependent, R6 determinism)', () => {
      const svc = makeService({ NODE_ENV: 'test' });
      const json = svc.formatJson();
      expect(json).not.toHaveProperty('agentScanRootsFound');
    });

    it('produces stable output across calls (canonicalized keys + alpha-sort)', () => {
      const svc = makeService({ NODE_ENV: 'test' });
      const a = svc.formatJsonString();
      const b = svc.formatJsonString();
      expect(a).toBe(b);
    });

    it('top-level keys are alpha-sorted', () => {
      const svc = makeService({ NODE_ENV: 'test' });
      const json = svc.formatJson();
      const keys = Object.keys(json);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });
  });

  describe('agent scan', () => {
    it('NODE_ENV=production with no override → skips scan, returns empty agents list', () => {
      const svc = makeService({ NODE_ENV: 'production' });
      const snap = svc.snapshot();
      expect(snap.agentScanSkipped).toBe(true);
      expect(snap.agentScanSkipReason).toBe('production_default');
      expect(snap.agents).toHaveLength(0);
    });

    it('NODE_ENV=production + MARKETING_MATRIX_SCAN_AGENTS=true → does scan', () => {
      const svc = makeService({
        NODE_ENV: 'production',
        MARKETING_MATRIX_SCAN_AGENTS: 'true',
      });
      const snap = svc.snapshot();
      // agentScanSkipped peut être true ou false selon que workspaces/marketing/.claude/agents/
      // existe ou non au moment du test. Mais skipReason ne doit pas être 'production_default'.
      expect(snap.agentScanSkipReason).not.toBe('production_default');
    });
  });

  describe('formatMarkdown()', () => {
    const svc = makeService({ NODE_ENV: 'test' });
    const md = svc.formatMarkdown();

    it('renders all 4 invariants', () => {
      expect(md).toContain('aec_manifest');
      expect(md).toContain('brand_compliance_gate');
      expect(md).toContain('business_unit_defined');
      expect(md).toContain('conversion_goal_defined');
    });

    it('lists 3 expected agents', () => {
      expect(md).toContain('local-business-agent');
      expect(md).toContain('marketing-lead-agent');
      expect(md).toContain('customer-retention-agent');
    });

    it('shows ECOMMERCE and LOCAL subdomains', () => {
      expect(md).toContain('ECOMMERCE');
      expect(md).toContain('LOCAL');
    });
  });
});
