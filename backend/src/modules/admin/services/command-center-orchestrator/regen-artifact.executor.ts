import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { type ExecutionReceipt } from './executable-action.contract';

const execFileAsync = promisify(execFile);

/**
 * Exécute git/gh sans shell (pas d'injection) avec timeout borné. Injectable pour les
 * tests (qui passent un runner factice — aucune commande réelle lancée).
 */
export type CommandRunner = (
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string }>;

const defaultRunner: CommandRunner = async (cmd, args, opts) => {
  const { stdout } = await execFileAsync(cmd, args, {
    cwd: opts?.cwd,
    // env absent ⇒ execFile hérite de process.env (git/gh conservent leur auth).
    // Fourni ⇒ REMPLACE process.env : l'appelant doit passer un env complet mergé.
    env: opts?.env,
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return { stdout };
};

/**
 * Levée si l'executor réel n'est pas activé par le 2ᵉ flag explicite. Le mode `approved`
 * (flag 1) ouvre le flux HITL ; OUVRIR une PR (flag 2 `COMMAND_CENTER_EXECUTOR=pr`) est une
 * activation séparée — merger ce code ne change donc RIEN par défaut.
 */
export class ExecutorDisabledError extends Error {
  constructor() {
    super(
      "Executor d'exécution non activé — poser COMMAND_CENTER_EXECUTOR=pr (DEV/PREPROD) pour autoriser l'ouverture de PR.",
    );
    this.name = 'ExecutorDisabledError';
  }
}

/** Levée si git/gh est indisponible ou échoue (pas de succès fictif, pas d'état laissé). */
export class ExecutorUnavailableError extends Error {
  constructor(cause: string) {
    super(`Exécution PR impossible (git/gh) : ${cause}`);
    this.name = 'ExecutorUnavailableError';
  }
}

/** Cible exécutable d'un regen-artifact (artefact + générateur + métadonnées PR). */
export interface RegenExecTarget {
  readonly action_id: string;
  readonly committedRel: string;
  readonly generatorRel: string;
  readonly prTitle: string;
  readonly commitMessage: string;
  readonly base: string;
  readonly branchPrefix: string;
}

/**
 * Executor « regen-artifact » (Phase 2b) — exécute RÉELLEMENT une régénération approuvée
 * en **ouvrant une PR draft**, le mécanisme le plus sûr (réversible = close PR ; gouverné
 * = review + CI + **merge humain** ; rien n'atterrit sur `main` automatiquement).
 *
 * Double garde : (1) mode `approved` (géré par l'orchestrateur) + (2) flag explicite
 * `COMMAND_CENTER_EXECUTOR=pr`. Isolation : travaille dans un **worktree git temporaire**
 * (jamais le checkout runtime → 0 working tree sali). `execFile` (pas de shell). Échec
 * git/gh → throw franc, worktree nettoyé en `finally`. PROD : l'orchestrateur force `off`.
 */
@Injectable()
export class RegenArtifactExecutor {
  private readonly logger = new Logger(RegenArtifactExecutor.name);
  /** Identité de commit dédiée (pas l'opérateur ; traçable). */
  private static readonly GIT_NAME = 'command-center-orchestrator';
  private static readonly GIT_EMAIL = 'orchestrator@automecanik.local';

  private readonly run: CommandRunner;

  // `@Optional()` : aucun provider `CommandRunner` (c'est un type) → NestJS passe
  // undefined ⇒ fallback `defaultRunner`. Les tests injectent un runner factice.
  constructor(@Optional() run?: CommandRunner) {
    this.run = run ?? defaultRunner;
  }

  /** 2ᵉ garde explicite : ouvrir des PR exige `COMMAND_CENTER_EXECUTOR=pr`. */
  static isEnabled(): boolean {
    return (
      (process.env.COMMAND_CENTER_EXECUTOR || '').trim().toLowerCase() === 'pr'
    );
  }

  /**
   * Régénère l'artefact dans un worktree isolé, pousse une branche, ouvre une PR draft.
   * `planHash` est porté dans le reçu (traçabilité de ce qui a été approuvé).
   */
  async execute(
    target: RegenExecTarget,
    repoRoot: string,
    planHash: string,
  ): Promise<ExecutionReceipt> {
    if (!RegenArtifactExecutor.isEnabled()) throw new ExecutorDisabledError();

    const branch = `${target.branchPrefix}-${planHash.slice(0, 12)}`;
    const wt = mkdtempSync(join(tmpdir(), 'cc-regen-'));
    try {
      // worktree isolé sur origin/main (jamais le checkout runtime).
      await this.run('git', [
        '-C',
        repoRoot,
        'worktree',
        'add',
        '-b',
        branch,
        wt,
        'origin/main',
      ]);
      // Régénère l'artefact (le générateur écrit DANS le worktree temporaire).
      // Le worktree (sous os.tmpdir()) n'a PAS de node_modules (gitignoré) → le
      // générateur `require('js-yaml')` échouerait (MODULE_NOT_FOUND) sur toute
      // machine propre (CI/PROD/fresh dev). NODE_PATH pointe la résolution des
      // modules bare vers les deps du checkout runtime — sans jamais salir ce dernier.
      await this.run('node', [join(wt, target.generatorRel)], {
        cwd: wt,
        env: { ...process.env, NODE_PATH: join(repoRoot, 'node_modules') },
      });
      await this.run('git', ['-C', wt, 'add', target.committedRel], {
        cwd: wt,
      });
      await this.run(
        'git',
        [
          '-C',
          wt,
          '-c',
          `user.name=${RegenArtifactExecutor.GIT_NAME}`,
          '-c',
          `user.email=${RegenArtifactExecutor.GIT_EMAIL}`,
          'commit',
          '-m',
          target.commitMessage,
        ],
        { cwd: wt },
      );
      await this.run('git', ['-C', wt, 'push', '-u', 'origin', branch], {
        cwd: wt,
      });
      const { stdout } = await this.run(
        'gh',
        [
          'pr',
          'create',
          '--draft',
          '--base',
          target.base,
          '--head',
          branch,
          '--title',
          target.prTitle,
          '--body',
          `Régénération approuvée (HITL, ADR-087 Phase 2). plan_hash=${planHash}. À relire + merger humainement.`,
        ],
        { cwd: wt },
      );
      const prUrl = stdout.trim();
      this.logger.warn(`PR d'exécution ouverte (draft) : ${prUrl} [${branch}]`);
      return {
        action_id: target.action_id,
        kind: 'regen-artifact',
        applied: true,
        plan_hash: planHash,
        // Réversibilité de premier ordre : fermer la PR (rien n'a été mergé).
        reverted_by: `gh pr close ${prUrl}`,
        details: { pr_url: prUrl, branch, base: target.base },
      };
    } catch (e) {
      throw new ExecutorUnavailableError((e as Error).message);
    } finally {
      // Nettoyage best-effort du worktree temporaire (jamais d'état laissé).
      try {
        await this.run('git', [
          '-C',
          repoRoot,
          'worktree',
          'remove',
          '--force',
          wt,
        ]);
      } catch {
        /* worktree déjà absent / non créé */
      }
      // Supprime la branche LOCALE créée par `worktree add -b` (après remove, elle
      // n'est plus checked-out). Sinon un re-run du même plan (planHash → même nom)
      // collisionnerait « branch already exists ». La branche distante + la PR (si
      // push a réussi) subsistent : `git branch -D` ne touche que le ref local.
      try {
        await this.run('git', ['-C', repoRoot, 'branch', '-D', branch]);
      } catch {
        /* branche jamais créée / déjà supprimée */
      }
      try {
        rmSync(wt, { recursive: true, force: true });
      } catch {
        /* déjà nettoyé */
      }
    }
  }
}
