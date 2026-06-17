import { Injectable, Logger } from '@nestjs/common';
import {
  type ExecutableActionKind,
  type ExecutionPlan,
} from './executable-action.contract';
import { type ShadowPlanner } from './orchestrator.service';

/**
 * Gabarit de proposition de PR. shadow-3 n'en déclare qu'UN, adossé à une action
 * mécanique & gouvernée : rafraîchir le snapshot Command Center. La proposition
 * RÉUTILISE le planner regen-artifact comme source de l'effet would-be (composition,
 * pas duplication) → `would_change` reflète l'état RÉEL de l'artefact (on ne propose un
 * PR que s'il y a vraiment un diff — jamais de filler).
 */
interface PrTemplate {
  readonly id: string;
  /** action_id regen sous-jacent qui décide du would_change + porte le diff. */
  readonly regenActionId: string;
  readonly prTitle: string;
  readonly commitMessage: string;
  readonly base: string;
  readonly files: readonly string[];
  readonly rationale: string;
}

const PR_TEMPLATES: Readonly<Record<string, PrTemplate>> = {
  'pr:command-center-snapshot-refresh': {
    id: 'pr:command-center-snapshot-refresh',
    regenActionId: 'regen:command-center-snapshot',
    prTitle: 'chore(registry): refresh command-center-snapshot.json',
    commitMessage:
      'chore(registry): refresh command-center-snapshot.json (projection déterministe)',
    base: 'main',
    files: ['audit/registry/command-center-snapshot.json'],
    rationale:
      'Le snapshot est une projection déterministe de agent-operating-map.yaml ; le régénérer réaligne la projection committée sur la source.',
  },
};

/** Levée si l'action_id ne correspond à aucun gabarit de PR connu (jamais de faux PR). */
export class UnknownPrPropositionError extends Error {
  constructor(actionId: string) {
    super(
      `Aucun gabarit de PR pour « ${actionId} » (gabarits: ${Object.keys(PR_TEMPLATES).join(', ')}).`,
    );
    this.name = 'UnknownPrPropositionError';
  }
}

/** Compose un corps de PR markdown déterministe (aucune I/O, aucun appel gh). */
function composePrBody(
  tpl: PrTemplate,
  wouldChange: boolean,
  diff: unknown,
): string {
  const lines = [
    `## Proposition (shadow — non créée)`,
    ``,
    tpl.rationale,
    ``,
    `- **Base** : \`${tpl.base}\``,
    `- **Fichiers** : ${tpl.files.map((f) => `\`${f}\``).join(', ')}`,
    `- **Commit** : \`${tpl.commitMessage}\``,
    `- **Changement réel ?** : ${wouldChange ? 'OUI — diff ci-dessous' : 'NON — déjà à jour (aucun PR nécessaire)'}`,
  ];
  if (wouldChange && diff) {
    lines.push('', '```json', JSON.stringify(diff, null, 2), '```');
  }
  return lines.join('\n');
}

/**
 * Planner shadow ② « pr-proposition » (ADR-087, Phase 1 shadow-3).
 *
 * Pendant *human-reviewable* de `regen-artifact` : compose le BROUILLON de PR (titre,
 * body, commit, fichiers) qu'un opérateur ouvrirait pour appliquer le changement — SANS
 * créer de branche ni de PR (0 appel `gh`, 0 mutation, 0 réseau). `would_change` et le
 * diff proviennent du planner regen sous-jacent (composition) → honnête par construction.
 * `reversible=true` : une PR est revue + revert-able.
 */
@Injectable()
export class PrPropositionShadowPlanner implements ShadowPlanner {
  readonly kind: ExecutableActionKind = 'pr-proposition';
  private readonly logger = new Logger(PrPropositionShadowPlanner.name);

  /** Réutilise le planner regen comme source du would-be (injecté par DI). */
  constructor(private readonly regen: ShadowPlanner) {}

  static knownTemplates(): string[] {
    return Object.keys(PR_TEMPLATES);
  }

  async plan(actionId: string): Promise<ExecutionPlan> {
    const tpl = PR_TEMPLATES[actionId];
    if (!tpl) throw new UnknownPrPropositionError(actionId);

    // Source de vérité du changement : le planner regen sous-jacent (0 mutation).
    const regenPlan = await this.regen.plan(tpl.regenActionId);
    const wouldChange = regenPlan.would_change;
    const diff = (regenPlan.details as { diff?: unknown }).diff ?? null;

    this.logger.log(
      `shadow pr-proposition ${actionId} → would_change=${wouldChange}`,
    );

    return {
      action_id: actionId,
      kind: this.kind,
      summary: wouldChange
        ? `Proposer une PR : ${tpl.prTitle}`
        : `Aucune PR nécessaire (${tpl.files.join(', ')} déjà à jour)`,
      would_change: wouldChange,
      details: {
        pr_title: tpl.prTitle,
        commit_message: tpl.commitMessage,
        base: tpl.base,
        files: [...tpl.files],
        pr_body: composePrBody(tpl, wouldChange, diff),
        underlying_action: tpl.regenActionId,
      },
      // Une PR est revue par un humain puis revert-able → réversible.
      reversible: true,
    };
  }
}
