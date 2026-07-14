import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { RpcGateService } from './rpc-gate.service';

/**
 * ADR-059 — `get_active_seo_projection` allowlist parity + gate invariant (PR-E2).
 *
 * The projection READ RPC is backend-proxied and `service_role`-only (no anon GRANT).
 * The RpcGate reads its allowlist from `<cwd>/governance/rpc/rpc_allowlist.json`
 * (repo root at DEV runtime; `backend/governance/rpc/...` inside the Docker image
 * where start.sh does `cd backend`). Both copies must list the RPC or DEV/PROD drift.
 *
 * These tests load the REAL shipped root allowlist (the file this PR edits) through
 * the gate in the strictest posture (enforce + production) and prove:
 *   1. the RPC is ALLOWED via the allowlist (not merely tolerated as "unknown");
 *   2. an unknown RPC is still BLOCKED — the gate is not weakened;
 *   3. the two on-disk copies stay in parity;
 *   4. the entry stays documented as service_role-only (no anon grant is introduced).
 */

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const ROOT_GOV_DIR = path.join(REPO_ROOT, 'governance', 'rpc');
const ROOT_ALLOWLIST = path.join(ROOT_GOV_DIR, 'rpc_allowlist.json');
const BACKEND_ALLOWLIST = path.join(
  REPO_ROOT,
  'backend',
  'governance',
  'rpc',
  'rpc_allowlist.json',
);

const RPC = 'get_active_seo_projection';

class FakeConfigService {
  constructor(private readonly env: Record<string, string> = {}) {}
  get<T = string>(key: string): T | undefined {
    return this.env[key] as unknown as T | undefined;
  }
}

/** Gate wired for the strictest posture, reading the real shipped root allowlist. */
async function makeEnforcedGate(): Promise<RpcGateService> {
  const cfg = new FakeConfigService({
    RPC_GATE_MODE: 'enforce',
    RPC_GATE_ENFORCE_LEVEL: 'ALL',
    NODE_ENV: 'production',
    RPC_GATE_GOV_DIR: ROOT_GOV_DIR,
  });
  const gate = new RpcGateService(cfg as unknown as ConfigService);
  await gate.onModuleInit();
  return gate;
}

describe('RpcGate — get_active_seo_projection allowlist (PR-E2)', () => {
  let gate: RpcGateService;

  beforeAll(async () => {
    gate = await makeEnforcedGate();
  });

  afterAll(() => {
    gate?.onModuleDestroy();
  });

  describe('positive — the projection RPC is explicitly allowed', () => {
    it('enforce + production: ALLOW via the allowlist (not "unknown")', () => {
      const res = gate.evaluate(RPC, { source: 'api', role: 'anon' });
      // role:'anon' (non-service-role) proves the ALLOW comes from the allowlist
      // entry, NOT from the UNKNOWN_SERVICE_ROLE branch.
      expect(res.decision).toBe('ALLOW');
      expect(res.reason).toBe('ALLOWLIST_READ_SAFE');
    });
  });

  describe('negative — the gate is not weakened', () => {
    it('enforce + production: an unknown RPC from a public role is BLOCKED', () => {
      const res = gate.evaluate('nonexistent_rpc_pr_e2_probe', {
        source: 'api',
        role: 'anon',
      });
      expect(res.decision).toBe('BLOCK');
      expect(res.reason).toBe('UNKNOWN_BLOCKED_PROD');
    });
  });

  describe('parity — the two on-disk copies do not drift', () => {
    const load = (p: string) =>
      JSON.parse(fs.readFileSync(p, 'utf-8')) as {
        total: number;
        functions: { name: string; reason?: string }[];
      };

    it('root and backend allowlists both list the RPC', () => {
      const root = load(ROOT_ALLOWLIST);
      const backend = load(BACKEND_ALLOWLIST);
      expect(root.functions.some((f) => f.name === RPC)).toBe(true);
      expect(backend.functions.some((f) => f.name === RPC)).toBe(true);
    });

    it('root allowlist `total` matches its own function count', () => {
      const root = load(ROOT_ALLOWLIST);
      expect(root.total).toBe(root.functions.length);
    });

    it('the entry is documented as service_role-only (no anon grant)', () => {
      const root = load(ROOT_ALLOWLIST);
      const entry = root.functions.find((f) => f.name === RPC);
      expect(entry).toBeDefined();
      expect(entry?.reason ?? '').toMatch(/service_role only/i);
      expect(entry?.reason ?? '').toMatch(/no anon GRANT/i);
    });
  });
});
