/**
 * Planner shadow ② « pr-proposition » (ADR-087 shadow-3). Pendant human-reviewable de
 * regen-artifact : compose un BROUILLON de PR à partir de l'effet would-be du planner
 * regen sous-jacent — 0 appel `gh`, 0 mutation. `would_change` vient du regen (honnête).
 */
import {
  PrPropositionShadowPlanner,
  UnknownPrPropositionError,
} from '../../src/modules/admin/services/command-center-orchestrator/pr-proposition.planner';
import {
  type ExecutionPlan,
} from '../../src/modules/admin/services/command-center-orchestrator/executable-action.contract';
import { type ShadowPlanner } from '../../src/modules/admin/services/command-center-orchestrator/orchestrator.service';

function regenStub(plan: Partial<ExecutionPlan>): ShadowPlanner {
  return {
    kind: 'regen-artifact',
    plan: async () => ({
      action_id: 'regen:command-center-snapshot',
      kind: 'regen-artifact',
      summary: 'regen',
      would_change: false,
      details: {},
      reversible: true,
      ...plan,
    }),
  };
}

const TARGET = 'pr:command-center-snapshot-refresh';

describe('PrPropositionShadowPlanner', () => {
  it('kind = pr-proposition et expose ses gabarits', () => {
    const p = new PrPropositionShadowPlanner(regenStub({}));
    expect(p.kind).toBe('pr-proposition');
    expect(PrPropositionShadowPlanner.knownTemplates()).toContain(TARGET);
    expect(p.listActionIds()).toContain(TARGET);
  });

  it('action_id inconnu → UnknownPrPropositionError', async () => {
    const p = new PrPropositionShadowPlanner(regenStub({}));
    await expect(p.plan('pr:nope')).rejects.toBeInstanceOf(
      UnknownPrPropositionError,
    );
  });

  it('regen would_change=true → brouillon de PR complet + diff intégré', async () => {
    const p = new PrPropositionShadowPlanner(
      regenStub({ would_change: true, details: { diff: { added: 3 } } }),
    );
    const plan = await p.plan(TARGET);
    expect(plan.kind).toBe('pr-proposition');
    expect(plan.would_change).toBe(true);
    expect(plan.reversible).toBe(true);
    const d = plan.details as Record<string, unknown>;
    expect(d.pr_title).toBe('chore(registry): refresh command-center-snapshot.json');
    expect(d.files).toEqual(['audit/registry/command-center-snapshot.json']);
    expect(d.underlying_action).toBe('regen:command-center-snapshot');
    expect(String(d.pr_body)).toContain('OUI');
    expect(String(d.pr_body)).toContain('"added": 3'); // diff sous-jacent intégré
  });

  it('regen would_change=false → no-op honnête (aucune PR nécessaire)', async () => {
    const p = new PrPropositionShadowPlanner(regenStub({ would_change: false }));
    const plan = await p.plan(TARGET);
    expect(plan.would_change).toBe(false);
    expect(plan.summary).toContain('Aucune PR nécessaire');
    expect(String((plan.details as Record<string, unknown>).pr_body)).toContain(
      'NON — déjà à jour',
    );
  });
});
