import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  computePlanHash,
  type ExecutableActionKind,
  type ExecutionPlan,
  type ExecutionReceipt,
} from './executable-action.contract';
import { type ShadowPlanner } from './orchestrator.service';
import {
  ExecutorUnavailableError,
  RegenArtifactExecutor,
  type RegenExecTarget,
} from './regen-artifact.executor';

const execFileAsync = promisify(execFile);

/**
 * Cible de régénération déterministe connue. Phase 1 (shadow-2) n'en déclare qu'UNE :
 * le snapshot Command Center — seul générateur du repo avec (a) un dry-run propre
 * (`--json` écrit sur stdout puis `return` AVANT toute écriture fichier, vérifié) et
 * (b) une garantie de déterminisme byte-identique sur un même checkout.
 */
interface RegenTarget {
  /** action_id stable porté par l'ExecutionPlan (clé de la map). */
  readonly id: string;
  /** chemin (relatif au repo root) du fichier committé à comparer. */
  readonly committedRel: string;
  /** script générateur (relatif au repo root) lançable en dry-run `--json`. */
  readonly generatorRel: string;
  /** résumé humain de l'effet would-be. */
  readonly summary: string;
  /** métadonnées d'exécution réelle (Phase 2 : ouverture de PR). */
  readonly prTitle: string;
  readonly commitMessage: string;
  readonly branchPrefix: string;
}

const REGEN_TARGETS: Readonly<Record<string, RegenTarget>> = {
  'regen:command-center-snapshot': {
    id: 'regen:command-center-snapshot',
    committedRel: 'audit/registry/command-center-snapshot.json',
    generatorRel: 'scripts/governance/build-command-center-snapshot.js',
    summary:
      'Régénérer command-center-snapshot.json depuis agent-operating-map.yaml (projection déterministe).',
    prTitle: 'chore(registry): refresh command-center-snapshot.json',
    commitMessage:
      'chore(registry): refresh command-center-snapshot.json (projection déterministe, HITL ADR-087)',
    branchPrefix: 'cc-auto/regen-command-center-snapshot',
  },
};

/** Levée si l'action_id ne correspond à aucune cible regen connue (jamais de faux plan). */
export class UnknownRegenTargetError extends Error {
  constructor(actionId: string) {
    super(
      `Aucune cible regen connue pour « ${actionId} » (cibles: ${Object.keys(REGEN_TARGETS).join(', ')}).`,
    );
    this.name = 'UnknownRegenTargetError';
  }
}

/** Levée si le dry-run ne peut pas produire de sortie (générateur absent, crash, timeout). */
export class RegenDryRunError extends Error {
  constructor(actionId: string, cause: string) {
    super(`Dry-run regen impossible pour « ${actionId} » : ${cause}`);
    this.name = 'RegenDryRunError';
  }
}

/** Résumé déterministe & borné du diff would-be (pas de dépendance externe). */
export interface RegenDiffSummary {
  lines_committed: number;
  lines_would_be: number;
  first_diff_line: number;
  preview_committed: string[];
  preview_would_be: string[];
}

export function summarizeDiff(
  committed: string,
  wouldBe: string,
): RegenDiffSummary {
  const a = committed.split('\n');
  const b = wouldBe.split('\n');
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix += 1;
  }
  return {
    lines_committed: a.length,
    lines_would_be: b.length,
    first_diff_line: prefix + 1,
    preview_committed: a.slice(prefix, prefix + 5),
    preview_would_be: b.slice(prefix, prefix + 5),
  };
}

/**
 * Planner shadow ① « regen-artifact » (ADR-087, Phase 1 shadow-2).
 *
 * Calcule l'effet *would-be* d'une régénération d'artefact déterministe SANS écrire :
 * il lance le vrai générateur en dry-run (`node <script> --json` → stdout), compare au
 * fichier committé, et renvoie un ExecutionPlan décrivant le diff. `reversible=true` :
 * une régénération de projection déterministe a pour inverse un simple `git checkout`
 * du fichier. AUCUNE mutation de l'artefact, AUCUN accès DB, AUCun réseau.
 */
@Injectable()
export class RegenArtifactShadowPlanner implements ShadowPlanner {
  readonly kind: ExecutableActionKind = 'regen-artifact';
  private readonly logger = new Logger(RegenArtifactShadowPlanner.name);
  /** Borne le dry-run : un générateur qui pend ne doit pas bloquer l'appelant. */
  private static readonly DRY_RUN_TIMEOUT_MS = 30_000;
  /** stdout du snapshot peut être volumineux (déterministe, mais large). */
  private static readonly DRY_RUN_MAX_BUFFER = 32 * 1024 * 1024;

  /**
   * Executor d'exécution réelle (Phase 2b) — OPTIONNEL. Absent (ex. tests shadow) ⇒
   * `apply` indisponible (lève). Présent ⇒ `apply` ouvre une PR (double-gardé par le flag
   * `COMMAND_CENTER_EXECUTOR=pr`, géré DANS l'executor).
   */
  constructor(@Optional() private readonly executor?: RegenArtifactExecutor) {}

  /** Liste des cibles regen connues (introspection / observabilité). */
  static knownTargets(): string[] {
    return Object.keys(REGEN_TARGETS);
  }

  /** Catalogue exposé à l'orchestrateur (ShadowPlanner.listActionIds). */
  listActionIds(): string[] {
    return RegenArtifactShadowPlanner.knownTargets();
  }

  /**
   * Repo root, ancré EXACTEMENT comme `CommandCenterReaderService` (REGISTRY_DIR/../..),
   * pour éviter le piège cwd=backend/ en Docker (start.sh fait `cd backend`).
   */
  private repoRoot(): string {
    const registryDir =
      process.env.REGISTRY_DIR || join(process.cwd(), 'audit', 'registry');
    return join(registryDir, '..', '..');
  }

  async plan(actionId: string): Promise<ExecutionPlan> {
    const target = REGEN_TARGETS[actionId];
    if (!target) throw new UnknownRegenTargetError(actionId);

    const root = this.repoRoot();
    const committedPath = join(root, target.committedRel);
    const generatorPath = join(root, target.generatorRel);

    if (!existsSync(generatorPath)) {
      // Pas de faux plan : si le générateur n'est pas là (image Docker sans scripts/),
      // on échoue franchement plutôt que d'inventer un diff.
      throw new RegenDryRunError(
        actionId,
        `générateur introuvable: ${target.generatorRel}`,
      );
    }

    let wouldBe: string;
    try {
      // execFile (PAS de shell) + args constants → zéro surface d'injection.
      // `--json` = dry-run pur : stdout = contenu would-be, 0 écriture (vérifié L383-385).
      const { stdout } = await execFileAsync(
        'node',
        [generatorPath, '--json'],
        {
          cwd: root,
          timeout: RegenArtifactShadowPlanner.DRY_RUN_TIMEOUT_MS,
          maxBuffer: RegenArtifactShadowPlanner.DRY_RUN_MAX_BUFFER,
        },
      );
      wouldBe = stdout;
    } catch (e) {
      throw new RegenDryRunError(actionId, (e as Error).message);
    }

    const committed = existsSync(committedPath)
      ? readFileSync(committedPath, 'utf-8')
      : null;
    const wouldChange = committed !== wouldBe;

    this.logger.log(
      `shadow regen ${actionId} → would_change=${wouldChange} (committed=${committed?.length ?? 0}b, would_be=${wouldBe.length}b)`,
    );

    return {
      action_id: actionId,
      kind: this.kind,
      summary: target.summary,
      would_change: wouldChange,
      details: {
        artifact: target.committedRel,
        generator: target.generatorRel,
        committed_present: committed !== null,
        bytes_committed: committed?.length ?? 0,
        bytes_would_be: wouldBe.length,
        diff: wouldChange ? summarizeDiff(committed ?? '', wouldBe) : null,
      },
      // Projection déterministe : l'inverse d'un regen est `git checkout <fichier>`.
      reversible: true,
    };
  }

  /**
   * Exécution réelle (Phase 2b, HITL) : régénère + ouvre une PR draft via l'executor.
   * `plan_hash` recalculé ici (déterministe ⇒ identique à celui approuvé) pour la
   * traçabilité du reçu. Lève si l'executor n'est pas câblé (DI) ou si le flag executor
   * n'est pas posé (géré DANS l'executor → `ExecutorDisabledError`). 0 écriture du checkout
   * runtime : l'executor travaille en worktree git temporaire.
   */
  async apply(actionId: string): Promise<ExecutionReceipt> {
    const target = REGEN_TARGETS[actionId];
    if (!target) throw new UnknownRegenTargetError(actionId);
    if (!this.executor) {
      throw new ExecutorUnavailableError('executor regen non câblé (DI)');
    }
    const root = this.repoRoot();
    const plan = await this.plan(actionId); // recalcul → plan_hash déterministe
    const execTarget: RegenExecTarget = {
      action_id: actionId,
      committedRel: target.committedRel,
      generatorRel: target.generatorRel,
      prTitle: target.prTitle,
      commitMessage: target.commitMessage,
      base: 'main',
      branchPrefix: target.branchPrefix,
    };
    return this.executor.execute(execTarget, root, computePlanHash(plan));
  }
}
