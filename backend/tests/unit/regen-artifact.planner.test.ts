/**
 * Planner shadow ① « regen-artifact » (ADR-087 shadow-2a).
 * Prouve : zéro faux plan (unknown id throw), échec franc si générateur absent
 * (RegenDryRunError, pas de diff inventé), et résumé de diff déterministe & borné.
 * Le chemin nominal (spawn du vrai générateur) est volontairement hors du unit test
 * hermétique — couvert par le calcul `summarizeDiff` testé directement.
 */
import { join } from 'node:path';
import {
  RegenArtifactShadowPlanner,
  RegenDryRunError,
  UnknownRegenTargetError,
  summarizeDiff,
} from '../../src/modules/admin/services/command-center-orchestrator/regen-artifact.planner';
import { ExecutorUnavailableError } from '../../src/modules/admin/services/command-center-orchestrator/regen-artifact.executor';
import { type ExecutionPlan } from '../../src/modules/admin/services/command-center-orchestrator/executable-action.contract';

const env = process.env as Record<string, string | undefined>;
const REGISTRY = env.REGISTRY_DIR;
afterEach(() => {
  env.REGISTRY_DIR = REGISTRY;
});

describe('RegenArtifactShadowPlanner', () => {
  it('kind = regen-artifact et expose ses cibles connues', () => {
    const p = new RegenArtifactShadowPlanner();
    expect(p.kind).toBe('regen-artifact');
    expect(RegenArtifactShadowPlanner.knownTargets()).toContain(
      'regen:command-center-snapshot',
    );
    // listActionIds (catalogue orchestrateur) = mêmes cibles
    expect(p.listActionIds()).toContain('regen:command-center-snapshot');
  });

  it('action_id inconnu → UnknownRegenTargetError (jamais de faux plan)', async () => {
    const p = new RegenArtifactShadowPlanner();
    await expect(p.plan('regen:does-not-exist')).rejects.toBeInstanceOf(
      UnknownRegenTargetError,
    );
  });

  it('générateur absent → RegenDryRunError (échec franc, pas de diff inventé)', async () => {
    // REGISTRY_DIR bidon → repoRoot = /tmp/.../no-scripts → script introuvable.
    env.REGISTRY_DIR = join('/tmp', 'cc-regen-test-absent', 'audit', 'registry');
    const p = new RegenArtifactShadowPlanner();
    await expect(p.plan('regen:command-center-snapshot')).rejects.toBeInstanceOf(
      RegenDryRunError,
    );
  });
});

describe('RegenArtifactShadowPlanner.apply (Phase 2b)', () => {
  const fakePlan: ExecutionPlan = {
    action_id: 'regen:command-center-snapshot',
    kind: 'regen-artifact',
    summary: 's',
    would_change: true,
    details: { a: 1 },
    reversible: true,
  };

  it('apply délègue à l’executor (cible + plan_hash recalculé)', async () => {
    const receipt = {
      action_id: 'regen:command-center-snapshot',
      kind: 'regen-artifact' as const,
      applied: true,
      plan_hash: 'h',
      reverted_by: 'gh pr close X',
      details: {},
    };
    const execute = jest.fn().mockResolvedValue(receipt);
    const p = new RegenArtifactShadowPlanner({ execute } as never);
    jest.spyOn(p, 'plan').mockResolvedValue(fakePlan); // évite le spawn générateur
    const out = await p.apply('regen:command-center-snapshot');
    expect(out).toEqual(receipt);
    const [execTarget, , hash] = execute.mock.calls[0];
    expect(execTarget.action_id).toBe('regen:command-center-snapshot');
    expect(execTarget.base).toBe('main');
    expect(typeof hash).toBe('string');
  });

  it('apply action_id inconnu → UnknownRegenTargetError', async () => {
    const p = new RegenArtifactShadowPlanner({ execute: jest.fn() } as never);
    await expect(p.apply('regen:nope')).rejects.toBeInstanceOf(
      UnknownRegenTargetError,
    );
  });

  it('apply sans executor câblé → ExecutorUnavailableError', async () => {
    const p = new RegenArtifactShadowPlanner(); // pas d'executor injecté
    await expect(
      p.apply('regen:command-center-snapshot'),
    ).rejects.toBeInstanceOf(ExecutorUnavailableError);
  });
});

describe('summarizeDiff — déterministe et borné', () => {
  it('identiques → first_diff_line au-delà de la fin, previews vides', () => {
    const s = summarizeDiff('a\nb\nc', 'a\nb\nc');
    expect(s.lines_committed).toBe(3);
    expect(s.lines_would_be).toBe(3);
    expect(s.first_diff_line).toBe(4); // prefix=3 → 3+1
    expect(s.preview_committed).toEqual([]);
    expect(s.preview_would_be).toEqual([]);
  });

  it('1re ligne divergente repérée + previews bornés à 5', () => {
    const committed = ['l1', 'l2', 'x', 'l4', 'l5', 'l6', 'l7'].join('\n');
    const wouldBe = ['l1', 'l2', 'y', 'l4', 'l5', 'l6', 'l7'].join('\n');
    const s = summarizeDiff(committed, wouldBe);
    expect(s.first_diff_line).toBe(3);
    expect(s.preview_committed).toHaveLength(5);
    expect(s.preview_committed[0]).toBe('x');
    expect(s.preview_would_be[0]).toBe('y');
  });
});
