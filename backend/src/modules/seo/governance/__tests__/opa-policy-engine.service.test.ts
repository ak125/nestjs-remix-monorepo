/**
 * PR-C — OpaPolicyEngineService integration test
 *
 * Validates the WASM bundle loading + sync evaluation pipeline against the
 * actual Rego policy compiled from PR-V #279.
 *
 * Uses OPA_BUNDLE_MODE=test_fixture which loads the committed
 * `backend/test/fixtures/opa-policies/seo-content/h1-write.wasm` (SHA-matched
 * to the vault artefact).
 */

import { OpaPolicyEngineService } from '../opa-policy-engine.service';

// Helper to wait until the engine has loaded the bundle (async warmer).
async function waitForReady(
  engine: OpaPolicyEngineService,
  timeoutMs = 5000,
): Promise<void> {
  const start = Date.now();
  while (!engine.isReady()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `OpaPolicyEngineService never became ready (mode=${engine.getMode()})`,
      );
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('OpaPolicyEngineService', () => {
  let engine: OpaPolicyEngineService;

  beforeAll(async () => {
    process.env.OPA_BUNDLE_MODE = 'test_fixture';
    engine = new OpaPolicyEngineService();
    engine.onModuleInit();
    await waitForReady(engine);
  });

  it('loads the bundle and exposes a non-empty SHA', () => {
    expect(engine.isReady()).toBe(true);
    expect(engine.getBundleSha()).toMatch(/^[a-f0-9]{64}$/);
    expect(engine.getMode()).toBe('test_fixture');
  });

  it('DENIES llm_generated_direct', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'llm_generated_direct',
      actor: 'agent:ai-content',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: false,
    });
    expect(decision.allow).toBe(false);
    expect(decision.reasons.length).toBeGreaterThan(0);
  });

  it('ALLOWS human_curated with non-empty actor', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'human_curated',
      actor: 'user:fafa',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: false,
    });
    expect(decision.allow).toBe(true);
  });

  it('ALLOWS human_curated even with active lock (human override)', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'human_curated',
      actor: 'user:fafa',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: true,
    });
    expect(decision.allow).toBe(true);
  });

  it('DENIES human_curated with empty actor', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'human_curated',
      actor: '',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: false,
    });
    expect(decision.allow).toBe(false);
  });

  it('ALLOWS deterministic_builder with no lock', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'deterministic_builder',
      actor: 'service:backend.modules.seo.builders.h1-deterministic-builder',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: false,
    });
    expect(decision.allow).toBe(true);
  });

  it('DENIES deterministic_builder when lock is active', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'deterministic_builder',
      actor: 'service:backend.modules.seo.builders.h1-deterministic-builder',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: true,
    });
    expect(decision.allow).toBe(false);
  });

  it('ALLOWS legacy_recovery with exact_match_snapshot + flag enabled + proposed event', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'legacy_recovery',
      actor: 'agent:recovery-worker',
      field_path: 'h1',
      asset_id: 'r1_router:pg:42',
      lock_active: false,
      evidence_tier: 'exact_match_snapshot',
      flag_state: 'enabled',
      proposed_event: { event_id: 'evt-123', parent_event_kind: 'proposed' },
    });
    expect(decision.allow).toBe(true);
  });

  it('DENIES legacy_recovery when flag_state=disabled', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'legacy_recovery',
      actor: 'agent:recovery-worker',
      field_path: 'h1',
      asset_id: 'r1_router:pg:42',
      lock_active: false,
      evidence_tier: 'exact_match_snapshot',
      flag_state: 'disabled',
      proposed_event: { event_id: 'evt-123', parent_event_kind: 'proposed' },
    });
    expect(decision.allow).toBe(false);
  });

  it('DENIES legacy_recovery with heuristic_recent_change tier (must be exact_match_*)', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'legacy_recovery',
      actor: 'agent:recovery-worker',
      field_path: 'h1',
      asset_id: 'r1_router:pg:42',
      lock_active: false,
      evidence_tier: 'heuristic_recent_change',
      flag_state: 'enabled',
      proposed_event: { event_id: 'evt-123', parent_event_kind: 'proposed' },
    });
    expect(decision.allow).toBe(false);
  });

  it('DENIES unknown source_kind (default deny)', () => {
    const decision = engine.evaluateH1Write({
      source_kind: 'made_up_source',
      actor: 'user:fafa',
      field_path: 'h1',
      asset_id: 'mta:test/path',
      lock_active: false,
    });
    expect(decision.allow).toBe(false);
  });

  it('DENIES empty input (fail-closed)', () => {
    const decision = engine.evaluateH1Write({});
    expect(decision.allow).toBe(false);
  });
});

describe('OpaPolicyEngineService — missing_fail_closed mode', () => {
  it('always denies when mode is missing_fail_closed', async () => {
    process.env.OPA_BUNDLE_MODE = 'missing_fail_closed';
    const engine = new OpaPolicyEngineService();
    engine.onModuleInit();
    // No bundle loaded — evaluation is immediate fail-closed.
    expect(engine.isReady()).toBe(false);
    const decision = engine.evaluateH1Write({
      source_kind: 'human_curated',
      actor: 'user:fafa',
      field_path: 'h1',
      asset_id: 'mta:test/path',
    });
    expect(decision.allow).toBe(false);
    expect(decision.policyBundleSha).toBe('<no-bundle>');
  });
});
