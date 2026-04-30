import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  parseAgentFrontmatter,
  safeParseAgentFrontmatter,
} from './agent-frontmatter.schema';
import { EXECUTION_REGISTRY } from './execution-registry.constants';
import { OperatingMatrixService } from './operating-matrix.service';
import { ROLE_ID_LIST, RoleId } from './role-ids';

function makeService(env: Record<string, string | undefined> = {}) {
  const config = {
    get: <T = unknown>(key: string): T | undefined => env[key] as T | undefined,
  } as unknown as ConfigService;
  return new OperatingMatrixService(config);
}

/**
 * Build a temp directory with `.claude/agents/` populated by `agentFiles` map
 * (filename → frontmatter+body). Returns a service pointed at this temp dir
 * via `REPO_ROOT` env. Used by ADR-037 frontmatter parsing tests.
 */
function makeServiceWithFixtures(agentFiles: Record<string, string>): {
  svc: OperatingMatrixService;
  cleanup: () => void;
} {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'op-matrix-test-'));
  const agentsDir = path.join(tmp, 'workspaces/seo-batch/.claude/agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const [filename, content] of Object.entries(agentFiles)) {
    fs.writeFileSync(path.join(agentsDir, filename), content, 'utf-8');
  }
  const svc = makeService({ NODE_ENV: 'test', REPO_ROOT: tmp });
  return {
    svc,
    cleanup: () => fs.rmSync(tmp, { recursive: true, force: true }),
  };
}

describe('OperatingMatrixService', () => {
  describe('snapshot()', () => {
    const svc = makeService({ NODE_ENV: 'test' });
    const snap = svc.snapshot();

    it('emits one entry per RoleId in ROLE_ID_LIST (14 entries — incl. AGENTIC_ENGINE + FOUNDATION)', () => {
      expect(snap.roles.map((r) => r.roleId)).toEqual([...ROLE_ID_LIST]);
      expect(snap.roles).toHaveLength(14);
    });

    it('records the registry version + catalog field count', () => {
      expect(snap.registryVersion).toBe('1.0.0');
      expect(snap.catalogFieldCount).toBeGreaterThan(0);
    });

    it('exposes the configured agent scan paths (deterministic, not the found ones)', () => {
      expect(snap.agentScanRootsConfigured).toEqual([
        'workspaces/seo-batch/.claude/agents',
        '.claude/agents',
        'backend/.claude/agents',
      ]);
    });

    it('hashes source files using "sha256:" prefix + 64 hex chars', () => {
      for (const v of Object.values(snap.sourcesHash)) {
        expect(v).toMatch(/^sha256:[a-f0-9]{64}$/);
      }
    });

    it('marks R3_GUIDE and R9_GOVERNANCE as deprecated', () => {
      const r3 = snap.roles.find((r) => r.roleId === RoleId.R3_GUIDE);
      const r9 = snap.roles.find((r) => r.roleId === RoleId.R9_GOVERNANCE);
      expect(r3?.deprecated).toBe(true);
      expect(r9?.deprecated).toBe(true);
    });

    it('flags deprecated_but_in_registry for any deprecated role still in EXECUTION_REGISTRY', () => {
      const expected = ROLE_ID_LIST.filter(
        (r) =>
          EXECUTION_REGISTRY[r] &&
          (r === RoleId.R3_GUIDE || r === RoleId.R9_GOVERNANCE),
      );
      const flagged = snap.anomalies
        .filter((a) => a.reason === 'deprecated_but_in_registry')
        .map((a) => a.roleId)
        .filter((x): x is RoleId => Boolean(x));
      expect(flagged.sort()).toEqual(expected.sort());
    });

    it('OperatingMatrix payload no longer carries unmappableAgents (ADR-037)', () => {
      // The field has been removed — fail-fast at boot prevents any agent from
      // being silently UNKNOWN, so the carrier is no longer needed.
      expect(
        (snap as unknown as Record<string, unknown>).unmappableAgents,
      ).toBeUndefined();
    });

    it('agentsIndex maps every scanned agent to a RoleId (no UNKNOWN possible)', () => {
      for (const role of Object.values(snap.agentsIndex)) {
        expect(ROLE_ID_LIST).toContain(role);
      }
    });
  });

  describe('healthScore', () => {
    const svc = makeService({ NODE_ENV: 'test' });
    const snap = svc.snapshot();
    const byRole = new Map(snap.roles.map((r) => [r.roleId, r]));

    it('R1_ROUTER scores ≥80 (registry + writeScope + non-deprecated; +20 if agents found)', () => {
      const r = byRole.get(RoleId.R1_ROUTER)!;
      expect(r.healthScore).toBeGreaterThanOrEqual(80);
      if (r.agents.length > 0) expect(r.healthScore).toBe(100);
    });

    it('R3_GUIDE — deprecated role removed from registry (closed deprecation)', () => {
      const r = byRole.get(RoleId.R3_GUIDE)!;
      expect(r.registry.present).toBe(false);
      expect(r.deprecated).toBe(true);
      expect(r.writeScope.ownedFieldsCount).toBe(0);
    });

    it('R9_GOVERNANCE scores 0 (no registry, no fields, deprecated)', () => {
      const r = byRole.get(RoleId.R9_GOVERNANCE)!;
      expect(r.registry.present).toBe(false);
      expect(r.writeScope.ownedFieldsCount).toBe(0);
      expect(r.deprecated).toBe(true);
      expect(r.healthScore).toBe(0);
    });

    it('R0_HOME has no registry entry but is excluded from gaps (NON_WRITING_ROLES)', () => {
      const r = byRole.get(RoleId.R0_HOME)!;
      expect(r.registry.present).toBe(false);
      expect(
        snap.gaps.find((g) => g.roleId === RoleId.R0_HOME),
      ).toBeUndefined();
    });

    it('R6_SUPPORT has no registry entry but is excluded from gaps (NON_WRITING_ROLES)', () => {
      const r = byRole.get(RoleId.R6_SUPPORT)!;
      expect(r.registry.present).toBe(false);
      expect(
        snap.gaps.find((g) => g.roleId === RoleId.R6_SUPPORT),
      ).toBeUndefined();
    });

    it('AGENTIC_ENGINE is NON_WRITING — never appears in gaps[] (ADR-037)', () => {
      expect(
        snap.gaps.find((g) => g.roleId === RoleId.AGENTIC_ENGINE),
      ).toBeUndefined();
    });

    it('FOUNDATION is NON_WRITING — never appears in gaps[] (ADR-037)', () => {
      expect(
        snap.gaps.find((g) => g.roleId === RoleId.FOUNDATION),
      ).toBeUndefined();
    });

    it('R7_BRAND has a registry entry (writers found in inventory 2026-04-30)', () => {
      const r = byRole.get(RoleId.R7_BRAND)!;
      expect(r.registry.present).toBe(true);
    });
  });

  describe('agent role classification via frontmatter (ADR-037)', () => {
    it('reads `role` from frontmatter and maps the agent file to that RoleId', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'r1-content-batch.md': `---\nname: r1-content-batch\ndescription: writes\nrole: R1_ROUTER\n---\n# body\n`,
        'agentic-critic.md': `---\nname: agentic-critic\ndescription: orchestrator\nrole: AGENTIC_ENGINE\n---\n# body\n`,
        'r6-content-batch.md': `---\nname: r6-content-batch\ndescription: writes\nrole: R6_GUIDE_ACHAT\n---\n# body\n`,
      });
      try {
        const snap = svc.snapshot();
        expect(snap.agentsIndex).toEqual({
          'agentic-critic': RoleId.AGENTIC_ENGINE,
          'r1-content-batch': RoleId.R1_ROUTER,
          'r6-content-batch': RoleId.R6_GUIDE_ACHAT,
        });
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors).toEqual([]);
      } finally {
        cleanup();
      }
    });

    it('emits boot-log errors when an agent has no frontmatter (fail-fast)', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'r1-content-batch.md': `# body without frontmatter\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/r1-content-batch\.md/);
        // Without a valid role, the agent must NOT appear in agentsIndex.
        expect(svc.snapshot().agentsIndex).toEqual({});
      } finally {
        cleanup();
      }
    });

    it('emits boot-log errors when frontmatter is missing the role key (Zod fail)', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'r1-content-batch.md': `---\nname: r1-content-batch\ndescription: writes\n---\n# body\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/role/i);
      } finally {
        cleanup();
      }
    });

    it('emits boot-log errors when role is not in ROLE_ID_LIST', () => {
      const { svc, cleanup } = makeServiceWithFixtures({
        'r1-content-batch.md': `---\nname: r1-content-batch\ndescription: writes\nrole: R99_INVALID\n---\n# body\n`,
      });
      try {
        const errors = svc.formatBootLog().filter((l) => l.level === 'error');
        expect(errors.length).toBe(1);
        expect(errors[0].message).toMatch(/role/i);
      } finally {
        cleanup();
      }
    });

    it('the real workspaces/seo-batch agents all have a valid role: (post-migration)', () => {
      // Smoke test against the actual repo content. Validates the migration
      // script (`scripts/seo/inject-agent-role.ts`) has been run end-to-end.
      const svc = makeService({ NODE_ENV: 'test' });
      const errors = svc.formatBootLog().filter((l) => l.level === 'error');
      expect(errors).toEqual([]);
    });
  });

  describe('Zod schema (agent-frontmatter)', () => {
    it('parses a valid frontmatter object', () => {
      const result = parseAgentFrontmatter({
        name: 'foo',
        description: 'bar',
        role: RoleId.R1_ROUTER,
      });
      expect(result.role).toBe(RoleId.R1_ROUTER);
    });

    it('throws if role is missing', () => {
      expect(() =>
        parseAgentFrontmatter({ name: 'foo', description: 'bar' }),
      ).toThrow();
    });

    it('throws if role is not in ROLE_ID_LIST', () => {
      expect(() =>
        parseAgentFrontmatter({
          name: 'foo',
          description: 'bar',
          role: 'R99_INVALID',
        }),
      ).toThrow();
    });

    it('safeParse returns success: false for invalid role', () => {
      const result = safeParseAgentFrontmatter({
        name: 'foo',
        description: 'bar',
        role: 'R99_INVALID',
      });
      expect(result.success).toBe(false);
    });

    it('passthrough preserves unknown keys (model, tools, etc.)', () => {
      const result = parseAgentFrontmatter({
        name: 'foo',
        description: 'bar',
        role: RoleId.R1_ROUTER,
        model: 'sonnet',
        tools: ['Read', 'Grep'],
      });
      expect(result.model).toBe('sonnet');
      expect(result.tools).toEqual(['Read', 'Grep']);
    });
  });

  describe('skipAgentScan in production', () => {
    it('defaults to skipped when NODE_ENV=production without override', () => {
      const svc = makeService({ NODE_ENV: 'production' });
      const snap = svc.snapshot();
      expect(snap.agentScanSkipped).toBe(true);
      expect(snap.agentScanSkipReason).toBe('production_default');
      expect(snap.roles.every((r) => r.agents.length === 0)).toBe(true);
    });

    it('opts in via OPERATING_MATRIX_SCAN_AGENTS=1', () => {
      const svc = makeService({
        NODE_ENV: 'production',
        OPERATING_MATRIX_SCAN_AGENTS: '1',
      });
      const snap = svc.snapshot();
      if (snap.agentScanSkipped) {
        expect(snap.agentScanSkipReason).toBe('no_paths_found');
      } else {
        expect(snap.agentScanSkipReason).toBeUndefined();
      }
    });
  });

  describe('JSON determinism (R6)', () => {
    const svc = makeService({ NODE_ENV: 'test' });

    it('emits byte-identical JSON across two consecutive calls', () => {
      const a = svc.formatJsonString();
      const b = svc.formatJsonString();
      expect(a).toBe(b);
    });

    it('does not embed any timestamp field anywhere in the JSON', () => {
      const json = svc.formatJsonString();
      expect(json).not.toMatch(/"generatedAt"/);
      expect(json).not.toMatch(/"timestamp"/);
    });

    it('drops agentScanRootsFound from JSON (filesystem-dependent)', () => {
      const json = svc.formatJsonString();
      expect(json).not.toMatch(/"agentScanRootsFound"/);
    });

    it('does not embed unmappableAgents (removed by ADR-037)', () => {
      const json = svc.formatJsonString();
      expect(json).not.toMatch(/"unmappableAgents"/);
    });
  });

  describe('formatBootLog()', () => {
    const svc = makeService({ NODE_ENV: 'test' });

    it('returns at least one line per registry entry + a final summary', () => {
      const lines = svc.formatBootLog();
      const registrySize = Object.keys(EXECUTION_REGISTRY).length;
      expect(lines.length).toBeGreaterThanOrEqual(registrySize + 1);
      expect(lines[lines.length - 1].message).toMatch(
        /WriteGuard: initialized — \d+ catalog entries/,
      );
    });

    it('emits a "WriteGuard: role X owns N fields" line for each registry entry with fields', () => {
      const lines = svc.formatBootLog();
      const ownsLines = lines
        .filter((l) => /owns \d+ fields/.test(l.message))
        .map((l) => l.message);
      expect(ownsLines.length).toBeGreaterThan(0);
    });
  });
});
