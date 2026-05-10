import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  parseMarketingAgentFrontmatter,
  safeParseMarketingAgentFrontmatter,
} from './marketing-agent-frontmatter.schema';
import { MarketingMatrixService } from './marketing-matrix.service';
import {
  MarketingBusinessUnit,
  MarketingChannel,
  MarketingConversionGoal,
  MarketingGateLevel,
  MarketingRoleId,
} from './marketing-matrix.types';

function makeService(env: Record<string, string | undefined> = {}) {
  const config = {
    get: <T = unknown>(key: string): T | undefined => env[key] as T | undefined,
  } as unknown as ConfigService;
  return new MarketingMatrixService(config);
}

/**
 * Build a temp repo root with `workspaces/marketing/.claude/agents/`
 * populated by `agentFiles` (filename → content) — used by ADR-038
 * frontmatter parsing tests. The service is pointed at this temp root via
 * a special env var (we override `__dirname`-based resolution by symlinking
 * the marketing rules path).
 */
function makeServiceWithFixtures(agentFiles: Record<string, string>): {
  svc: MarketingMatrixService;
  cleanup: () => void;
} {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-matrix-'));
  const agentsDir = path.join(tmp, 'workspaces/marketing/.claude/agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const [filename, content] of Object.entries(agentFiles)) {
    fs.writeFileSync(path.join(agentsDir, filename), content, 'utf-8');
  }
  // Service computes repoRoot from __dirname (3 levels up). Override is not
  // exposed via config — instead we monkey-patch process.cwd briefly.
  // The MarketingMatrixService constructor uses path.resolve(__dirname, '..', '..', '..')
  // which gives the repo root at runtime. To redirect, we leverage the fact
  // that scanAgents() uses path.join(this.repoRoot, rel). Since we cannot
  // override repoRoot via env, we instead provide MARKETING_MATRIX_SCAN_AGENTS=true
  // and rely on the directory scan path being `workspaces/marketing/.claude/agents`
  // resolved from the original repoRoot. For deterministic fixture tests, we
  // bypass via a subclass that exposes repoRoot setter.
  const svc = new (class extends MarketingMatrixService {
    constructor() {
      const cfg = {
        get: <T = unknown>(k: string): T | undefined =>
          (k === 'NODE_ENV'
            ? 'test'
            : k === 'MARKETING_MATRIX_SCAN_AGENTS'
              ? 'true'
              : undefined) as T | undefined,
      } as unknown as ConfigService;
      super(cfg);
      // Override the private repoRoot — accessed via reflection.
      (this as unknown as { repoRoot: string }).repoRoot = tmp;
    }
  })();
  return {
    svc,
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
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

    it('shows expected canonical role per agent (ADR-038)', () => {
      expect(md).toContain(MarketingRoleId.LOCAL_BUSINESS);
      expect(md).toContain(MarketingRoleId.MARKETING_LEAD);
      expect(md).toContain(MarketingRoleId.CUSTOMER_RETENTION);
    });
  });

  describe('Zod schema (marketing-agent-frontmatter, ADR-038)', () => {
    it('parses a valid frontmatter object', () => {
      const result = parseMarketingAgentFrontmatter({
        name: 'local-business-agent',
        description: 'Agent local',
        role: MarketingRoleId.LOCAL_BUSINESS,
        business_unit: [MarketingBusinessUnit.LOCAL],
      });
      expect(result.role).toBe(MarketingRoleId.LOCAL_BUSINESS);
      expect(result.business_unit).toEqual([MarketingBusinessUnit.LOCAL]);
    });

    it('throws if role is missing', () => {
      expect(() =>
        parseMarketingAgentFrontmatter({
          name: 'foo',
          description: 'bar',
          business_unit: [MarketingBusinessUnit.ECOMMERCE],
        }),
      ).toThrow();
    });

    it('throws if role is not a MarketingRoleId', () => {
      expect(() =>
        parseMarketingAgentFrontmatter({
          name: 'foo',
          description: 'bar',
          role: 'R1_ROUTER',
          business_unit: [MarketingBusinessUnit.ECOMMERCE],
        }),
      ).toThrow();
    });

    it('throws if business_unit is empty', () => {
      expect(() =>
        parseMarketingAgentFrontmatter({
          name: 'foo',
          description: 'bar',
          role: MarketingRoleId.LOCAL_BUSINESS,
          business_unit: [],
        }),
      ).toThrow();
    });

    it('throws if business_unit contains an invalid value', () => {
      expect(() =>
        parseMarketingAgentFrontmatter({
          name: 'foo',
          description: 'bar',
          role: MarketingRoleId.LOCAL_BUSINESS,
          business_unit: ['INVALID_UNIT'],
        }),
      ).toThrow();
    });

    it('safeParse returns success: false for invalid role', () => {
      const result = safeParseMarketingAgentFrontmatter({
        name: 'foo',
        description: 'bar',
        role: 'R99_INVALID',
        business_unit: [MarketingBusinessUnit.ECOMMERCE],
      });
      expect(result.success).toBe(false);
    });

    it('passthrough preserves model + tools (Claude Code native fields)', () => {
      const result = parseMarketingAgentFrontmatter({
        name: 'foo',
        description: 'bar',
        role: MarketingRoleId.MARKETING_LEAD,
        business_unit: [
          MarketingBusinessUnit.ECOMMERCE,
          MarketingBusinessUnit.LOCAL,
        ],
        model: 'sonnet',
        tools: ['Read', 'Grep'],
      });
      expect(result.model).toBe('sonnet');
      expect(result.tools).toEqual(['Read', 'Grep']);
    });
  });

  describe('agent classification via frontmatter (ADR-038)', () => {
    it('maps each expected agent to its declared role + scope from frontmatter', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'local-business-agent.md': `---\nname: local-business-agent\ndescription: local agent\nrole: LOCAL_BUSINESS\nbusiness_unit: [LOCAL]\n---\n# body\n`,
        'marketing-lead-agent.md': `---\nname: marketing-lead-agent\ndescription: lead agent\nrole: MARKETING_LEAD\nbusiness_unit: [ECOMMERCE, LOCAL]\n---\n# body\n`,
        'customer-retention-agent.md': `---\nname: customer-retention-agent\ndescription: retention agent\nrole: CUSTOMER_RETENTION\nbusiness_unit: [ECOMMERCE, HYBRID]\n---\n# body\n`,
      });
      try {
        const snap = svc.snapshot();
        const byName = new Map(snap.agents.map((a) => [a.name, a]));
        expect(byName.get('local-business-agent')).toMatchObject({
          present: true,
          role: MarketingRoleId.LOCAL_BUSINESS,
          scope: [MarketingBusinessUnit.LOCAL],
        });
        expect(byName.get('marketing-lead-agent')).toMatchObject({
          present: true,
          role: MarketingRoleId.MARKETING_LEAD,
        });
        expect(byName.get('customer-retention-agent')).toMatchObject({
          present: true,
          role: MarketingRoleId.CUSTOMER_RETENTION,
        });
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors).toEqual([]);
      } finally {
        cleanup();
      }
    });

    it('emits boot-log error if frontmatter is missing role:', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'local-business-agent.md': `---\nname: local-business-agent\ndescription: local agent\nbusiness_unit: [LOCAL]\n---\n# body\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/local-business-agent\.md/);
      } finally {
        cleanup();
      }
    });

    it('emits boot-log error if role is not in MarketingRoleId enum', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'local-business-agent.md': `---\nname: local-business-agent\ndescription: local agent\nrole: R1_ROUTER\nbusiness_unit: [LOCAL]\n---\n# body\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/role/i);
      } finally {
        cleanup();
      }
    });

    it('cross-validates: error if filename ↔ role mismatch', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        // filename = local-business-agent but role declared as MARKETING_LEAD
        'local-business-agent.md': `---\nname: local-business-agent\ndescription: oops\nrole: MARKETING_LEAD\nbusiness_unit: [LOCAL]\n---\n# body\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/role mismatch/);
      } finally {
        cleanup();
      }
    });

    it('emits boot-log error if business_unit is empty', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'local-business-agent.md': `---\nname: local-business-agent\ndescription: local agent\nrole: LOCAL_BUSINESS\nbusiness_unit: []\n---\n# body\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/business_unit/);
      } finally {
        cleanup();
      }
    });

    it('the real workspaces/marketing agents all have a valid role: (post-creation)', () => {
      // Smoke against real repo content. Validates that the 3 agent stubs
      // created by ADR-038 PR pass the boot fail-fast.
      const svc = makeService({
        NODE_ENV: 'test',
        MARKETING_MATRIX_SCAN_AGENTS: 'true',
      });
      const errors = svc.formatBootLog().filter((l) => l.level === 'error');
      expect(errors).toEqual([]);
    });
  });
});
