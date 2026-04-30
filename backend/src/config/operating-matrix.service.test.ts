import { ConfigService } from '@nestjs/config';
import { OperatingMatrixService } from './operating-matrix.service';
import { ROLE_ID_LIST, RoleId } from './role-ids';
import { EXECUTION_REGISTRY } from './execution-registry.constants';

function makeService(env: Record<string, string | undefined> = {}) {
  const config = {
    get: <T = unknown>(key: string): T | undefined => env[key] as T | undefined,
  } as unknown as ConfigService;
  return new OperatingMatrixService(config);
}

describe('OperatingMatrixService', () => {
  describe('snapshot()', () => {
    const svc = makeService({ NODE_ENV: 'test' });
    const snap = svc.snapshot();

    it('emits one entry per RoleId in ROLE_ID_LIST (12 entries)', () => {
      expect(snap.roles.map((r) => r.roleId)).toEqual([...ROLE_ID_LIST]);
      expect(snap.roles).toHaveLength(12);
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

    it('R3_GUIDE — deprecated role still in registry, no FIELD_CATALOG ownership', () => {
      const r = byRole.get(RoleId.R3_GUIDE)!;
      expect(r.registry.present).toBe(true);
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

    it('R0_HOME has no registry entry (gap candidate)', () => {
      const r = byRole.get(RoleId.R0_HOME)!;
      expect(r.registry.present).toBe(false);
    });
  });

  describe('agent role extraction', () => {
    const svc = makeService({ NODE_ENV: 'test' });
    const extract = (
      svc as unknown as { extractRoleId: (f: string) => RoleId | 'UNKNOWN' }
    ).extractRoleId.bind(svc);

    it('returns UNKNOWN for non-prefixed agent files', () => {
      expect(extract('research-agent.md')).toBe('UNKNOWN');
      expect(extract('keyword-planner.md')).toBe('UNKNOWN');
      expect(extract('brief-enricher.md')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for ambiguous R3 prefix', () => {
      expect(extract('r3-keyword-planner.md')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for ambiguous R6 prefix', () => {
      expect(extract('r6-keyword-planner.md')).toBe('UNKNOWN');
    });

    it('returns the unique RoleId for unambiguous prefix', () => {
      expect(extract('r1-keyword-planner.md')).toBe(RoleId.R1_ROUTER);
      expect(extract('r2-product-validator.md')).toBe(RoleId.R2_PRODUCT);
      expect(extract('r4-content-batch.md')).toBe(RoleId.R4_REFERENCE);
      expect(extract('r5-diagnostic-validator.md')).toBe(RoleId.R5_DIAGNOSTIC);
      expect(extract('r7-brand-execution.md')).toBe(RoleId.R7_BRAND);
      expect(extract('r8-vehicle-execution.md')).toBe(RoleId.R8_VEHICLE);
      expect(extract('r0-home-validator.md')).toBe(RoleId.R0_HOME);
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
