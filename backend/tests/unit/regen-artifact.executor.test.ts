/**
 * RegenArtifactExecutor (Phase 2b) — exécution réelle via ouverture de PR draft.
 * Prouve : double-garde (flag `COMMAND_CENTER_EXECUTOR=pr` requis), séquence git/gh
 * attendue, reçu réversible (`gh pr close`), échec git/gh → ExecutorUnavailableError.
 * Le runner est INJECTÉ et factice → AUCUNE commande réelle n'est lancée.
 */
import {
  ExecutorDisabledError,
  ExecutorUnavailableError,
  RegenArtifactExecutor,
  type RegenExecTarget,
} from '../../src/modules/admin/services/command-center-orchestrator/regen-artifact.executor';

const env = process.env as Record<string, string | undefined>;
const SAVED = env.COMMAND_CENTER_EXECUTOR;
afterEach(() => {
  env.COMMAND_CENTER_EXECUTOR = SAVED;
});

const target: RegenExecTarget = {
  action_id: 'regen:command-center-snapshot',
  committedRel: 'audit/registry/command-center-snapshot.json',
  generatorRel: 'scripts/governance/build-command-center-snapshot.js',
  prTitle: 'chore(registry): refresh',
  commitMessage: 'chore(registry): refresh (HITL)',
  base: 'main',
  branchPrefix: 'cc-auto/regen-command-center-snapshot',
};

describe('RegenArtifactExecutor', () => {
  it('isEnabled reflète le 2ᵉ flag COMMAND_CENTER_EXECUTOR=pr', () => {
    env.COMMAND_CENTER_EXECUTOR = 'pr';
    expect(RegenArtifactExecutor.isEnabled()).toBe(true);
    env.COMMAND_CENTER_EXECUTOR = '';
    expect(RegenArtifactExecutor.isEnabled()).toBe(false);
    env.COMMAND_CENTER_EXECUTOR = 'shadow'; // valeur autre → off
    expect(RegenArtifactExecutor.isEnabled()).toBe(false);
  });

  it('flag off → ExecutorDisabledError, AUCUNE commande lancée', async () => {
    env.COMMAND_CENTER_EXECUTOR = '';
    const run = jest.fn();
    const ex = new RegenArtifactExecutor(run);
    await expect(ex.execute(target, '/repo', 'hash123')).rejects.toBeInstanceOf(
      ExecutorDisabledError,
    );
    expect(run).not.toHaveBeenCalled();
  });

  it('flag on → séquence git/gh + reçu PR draft réversible', async () => {
    env.COMMAND_CENTER_EXECUTOR = 'pr';
    const run = jest.fn().mockImplementation((cmd: string) => {
      if (cmd === 'gh') {
        return Promise.resolve({ stdout: 'https://github.com/a/b/pull/42\n' });
      }
      return Promise.resolve({ stdout: '' });
    });
    const ex = new RegenArtifactExecutor(run);
    const receipt = await ex.execute(target, '/repo', 'abcdef0123456789');

    expect(receipt.applied).toBe(true);
    expect(receipt.kind).toBe('regen-artifact');
    expect(receipt.plan_hash).toBe('abcdef0123456789');
    expect(receipt.reverted_by).toBe(
      'gh pr close https://github.com/a/b/pull/42',
    );
    expect(receipt.details).toMatchObject({
      pr_url: 'https://github.com/a/b/pull/42',
      base: 'main',
    });

    const calls = run.mock.calls as [string, string[], string?][];
    // worktree isolé sur origin/main + branche dérivée du plan_hash
    const wtAdd = calls.find(
      (c) => c[0] === 'git' && c[1].includes('worktree') && c[1].includes('add'),
    );
    expect(wtAdd?.[1]).toEqual(expect.arrayContaining(['origin/main', '-b']));
    expect(wtAdd?.[1].some((a) => a.includes('abcdef012345'))).toBe(true);
    // PR draft
    const gh = calls.find((c) => c[0] === 'gh');
    expect(gh?.[1]).toEqual(
      expect.arrayContaining(['pr', 'create', '--draft', '--base', 'main']),
    );
    // worktree nettoyé (remove --force)
    const wtRemove = calls.find(
      (c) => c[0] === 'git' && c[1].includes('worktree') && c[1].includes('remove'),
    );
    expect(wtRemove).toBeDefined();
  });

  it('git/gh échoue → ExecutorUnavailableError (pas de succès fictif)', async () => {
    env.COMMAND_CENTER_EXECUTOR = 'pr';
    const run = jest.fn().mockRejectedValue(new Error('git: command not found'));
    const ex = new RegenArtifactExecutor(run);
    await expect(ex.execute(target, '/repo', 'h')).rejects.toBeInstanceOf(
      ExecutorUnavailableError,
    );
  });
});
