"""Publish one completed Hermes DEV mission as a draft PR, after a distinct human approval.

The controller fixed the full revision and proved the patch; this tool re-verifies
that proof, rebuilds the commit at that exact revision, scans it for secrets and
pushes it with the deploy account's GitHub App identity. The executor never sees
that identity. No merge, deployment or Hermes state write.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid

CONFIG = Path('/home/deploy/.local/lib/hermes-codex/telegram-control-1.0.0/backend-config.json')
RECEIPTS = Path('/home/deploy/.local/state/hermes-mission-publish')
BOT_NAME = 'automecanik-agents[bot]'
BOT_EMAIL = '348019600+automecanik-agents[bot]@users.noreply.github.com'
BASE = 'main'
MAX_PATCH = 8 * 1024 * 1024
REMOTE = re.compile(r'(?:https://github\.com/|git@github\.com:)([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?')


def run(argv, cwd=None, data=None, env=None):
    result = subprocess.run(argv, cwd=cwd, input=data, capture_output=True, timeout=300,
                            env={**os.environ, 'GIT_TERMINAL_PROMPT': '0', **(env or {})})
    if result.returncode:
        raise ValueError(argv[0] + '_failed: ' + result.stderr.decode(errors='replace').strip()[-300:])
    return result.stdout.decode()


def git(cwd, *args, **kw):
    # No hook runs: the repository's relative core.hooksPath would resolve inside the patched tree,
    # with the publishing identity. The Node hook could not run here anyway; the PR's CI is the gate.
    return run(['git', '-c', 'core.hooksPath=/dev/null', *args], cwd=cwd, **kw)


def in_scope(name, paths):
    # Same rule as the controller: exact file, or a subtree granted with a trailing slash.
    return any(name.startswith(p) if p.endswith('/') else name == p for p in paths)


def load(mission_id, config=CONFIG):
    if not isinstance(mission_id, str) or str(uuid.UUID(mission_id)) != mission_id:
        raise ValueError('mission_id')
    cfg = json.loads(config.read_text())
    directory = Path(cfg['state']) / mission_id
    if directory.is_symlink() or (directory / 'state.json').is_symlink():
        raise ValueError('state_alias')
    return cfg, directory, json.loads((directory / 'state.json').read_text())


def verify(cfg, directory, state):
    """Re-check the controller's proof. Every refusal leaves nothing behind."""
    contract = state.get('contract') or {}
    revision = state.get('revision')
    files = state.get('changed_files')
    if state.get('mission_id') != directory.name: raise ValueError('state_mission_mismatch')
    if state.get('status') != 'completed': raise ValueError('mission_not_completed')
    if contract.get('mode', 'bounded-write') != 'bounded-write': raise ValueError('mission_not_bounded_write')
    if (state.get('task_assessment') or {}).get('outcome') != 'achieved': raise ValueError('mission_not_achieved')
    if state.get('scope_ok') is not True: raise ValueError('scope_not_proven')
    if not isinstance(revision, str) or not re.fullmatch('[0-9a-f]{40}', revision):
        raise ValueError('exact_revision_required')
    if not isinstance(files, list) or not files or not all(isinstance(f, str) and f for f in files):
        raise ValueError('no_changes')
    if not all(in_scope(f, contract.get('paths') or []) for f in files): raise ValueError('outside_contract_paths')
    # .github/ is owner-reserved; the App has no Workflows permission either.
    if any(f.startswith('.github/') for f in files): raise ValueError('owner_reserved_path')
    digest = state.get('diff_sha256')
    if state.get('diff_artifact') != f'changes-{digest}.patch': raise ValueError('patch_artifact_name')
    patch = directory / state['diff_artifact']
    if patch.is_symlink() or not patch.is_file(): raise ValueError('patch_missing')
    raw = patch.read_bytes()
    if len(raw) > MAX_PATCH or len(raw) != state.get('diff_bytes'): raise ValueError('patch_size')
    if hashlib.sha256(raw).hexdigest() != digest: raise ValueError('patch_drift')
    # Same selection as the controller's execution_targets.py, including its recorded WIKI binding.
    target = contract.get('target', 'app')
    if target == 'app':
        source = Path(cfg['source'])
    elif target == 'wiki' and state.get('execution_target') == 'wiki':
        source = Path(state.get('source', ''))
        if str(source) != cfg['execution_targets']['wiki']['source']: raise ValueError('recorded_execution_target_changed')
    else:
        raise ValueError('execution_target_unknown')
    git(source, 'cat-file', '-e', revision + '^{commit}')
    # The executor worked in this detached worktree; while retained, its HEAD is the base.
    workspace = Path(state.get('workspace', ''))
    if workspace != Path(cfg['worktrees']) / directory.name: raise ValueError('workspace_path')
    if workspace.is_dir():
        if git(workspace, 'rev-parse', 'HEAD').strip() != revision: raise ValueError('workspace_revision_mismatch')
        workspace_head = 'verified'
    else:
        workspace_head = 'released'
    return {'mission_id': directory.name, 'revision': revision, 'patch': str(patch), 'patch_sha256': digest,
            'changed_files': sorted(files), 'source': str(source), 'workspace_head': workspace_head,
            'executor': state.get('executor', 'codex'), 'model': state.get('model_observed'),
            'created_at': state.get('created_at'), 'objective': contract.get('objective', ''),
            'summary': (state.get('task_assessment') or {}).get('summary', '')}


def title(proof):
    # Conventional type as commitlint.config.js; the mission content may be anything.
    line = ' '.join(proof['objective'].split())[:60].rstrip()
    return f"chore(hermes): {line} ({proof['mission_id'][:8]})"


def body(proof):
    files = '\n'.join(f'- `{f}`' for f in proof['changed_files'][:50])
    more = f"\n- … {len(proof['changed_files']) - 50} autres" if len(proof['changed_files']) > 50 else ''
    return (f"Mission Hermes DEV publiée après accord humain distinct.\n\n"
            f"| Preuve | Valeur |\n|---|---|\n"
            f"| Mission | `{proof['mission_id']}` |\n"
            f"| Révision fixée par le contrôleur | `{proof['revision']}` |\n"
            f"| HEAD de l'espace isolé | {proof['workspace_head']} |\n"
            f"| Patch (SHA-256) | `{proof['patch_sha256']}` |\n"
            f"| Exécutant | {proof['executor']} ({proof['model'] or 'modèle non relevé'}) |\n\n"
            f"## Objectif\n\n{proof['objective'][:1500]}\n\n"
            f"## Résultat déclaré par l'exécutant\n\n{proof['summary'][:1500]}\n\n"
            f"## Fichiers ({len(proof['changed_files'])})\n\n{files}{more}\n\n"
            "Contrôles avant publication : patch identique à l'empreinte du contrôleur, fichiers dans "
            "le périmètre du contrat, commit reconstruit sur la révision exacte, gitleaks sur le commit "
            "et sur ce texte. Le hook local pre-commit (Node) ne tourne pas ; la CI de cette PR fait foi. "
            "Brouillon : aucune fusion ni déploiement.\n")


def build(proof, work):
    """Detached worktree at the fixed revision, patch applied, deterministic bot commit."""
    git(proof['source'], 'worktree', 'add', '--detach', str(work), proof['revision'])
    git(work, 'apply', '--index', '--whitespace=nowarn', proof['patch'])
    staged = sorted(n for n in git(work, 'diff', '--cached', '--name-only', '-z').split('\0') if n)
    if staged != proof['changed_files']: raise ValueError('patch_files_mismatch')
    when = f"{int(proof['created_at'])} +0000"
    message = (title(proof) + '\n\n' + f"Hermes-Mission: {proof['mission_id']}\n"
               f"Hermes-Revision: {proof['revision']}\nHermes-Patch-SHA256: {proof['patch_sha256']}\n"
               f"Hermes-Executor: {proof['executor']}\n")
    git(work, 'commit', '--quiet', '-F', '-', data=message.encode(),
        env={'GIT_AUTHOR_NAME': BOT_NAME, 'GIT_AUTHOR_EMAIL': BOT_EMAIL,
             'GIT_COMMITTER_NAME': BOT_NAME, 'GIT_COMMITTER_EMAIL': BOT_EMAIL,
             'GIT_AUTHOR_DATE': when, 'GIT_COMMITTER_DATE': when})
    commit = git(work, 'rev-parse', 'HEAD').strip()
    changed = sorted(n for n in git(work, 'diff', '--name-only', '-z', proof['revision'], commit).split('\0') if n)
    if changed != proof['changed_files']: raise ValueError('commit_files_mismatch')
    # Public repository: the push itself publishes. Same gitleaks as CI, with the rules of the fixed
    # revision: the patch cannot weaken its own scan.
    rules = []
    for name, flag, fallback in (('.gitleaks.toml', '--config', '[extend]\nuseDefault = true\n'),
                                 ('.gitleaksignore', '--gitleaks-ignore-path', '')):
        tracked = git(proof['source'], 'ls-tree', '--name-only', proof['revision'], name).strip()
        (work.parent / name).write_text(git(proof['source'], 'show', f"{proof['revision']}:{name}") if tracked else fallback)
        rules += [flag, str(work.parent / name)]
    run(['gitleaks', 'git', *rules, '--log-opts', f"{proof['revision']}..{commit}", '--redact', '--no-banner',
         '--exit-code', '1', str(work)], cwd=work)
    run(['gitleaks', 'stdin', *rules, '--redact', '--no-banner', '--exit-code', '1'], cwd=work, data=body(proof).encode())
    return commit


def publish(proof, work, commit, receipts=RECEIPTS):
    receipt = receipts / (proof['mission_id'] + '.json')
    if receipt.exists(): raise ValueError('already_published: ' + json.loads(receipt.read_text())['pr'])
    # Configured URL, before any insteadOf rewrite: it names the GitHub repository for gh.
    match = REMOTE.fullmatch(git(proof['source'], 'config', '--get', 'remote.origin.url').strip())
    if not match: raise ValueError('remote_not_github')
    repo, branch = match.group(1), 'hermes/' + proof['mission_id']
    remote = git(work, 'ls-remote', '--heads', 'origin', 'refs/heads/' + branch).split()
    # The commit is deterministic: a rerun after a failed PR creation reuses the same branch.
    if remote and remote[0] != commit: raise ValueError('branch_exists_with_other_commit')
    if not remote: git(work, 'push', '--quiet', 'origin', f'{commit}:refs/heads/{branch}')
    pr = run(['gh', 'pr', 'create', '--repo', repo, '--draft', '--base', BASE, '--head', branch,
              '--title', title(proof), '--body-file', '-'], cwd=work, data=body(proof).encode()).strip().splitlines()[-1]
    receipts.mkdir(mode=0o700, parents=True, exist_ok=True)
    receipt.write_text(json.dumps({'pr': pr, 'branch': branch, 'commit': commit, 'repo': repo,
                                   'revision': proof['revision'], 'patch_sha256': proof['patch_sha256'],
                                   'published_at': time.time()}, indent=1) + '\n')
    return {'pr': pr, 'branch': branch, 'commit': commit}


def main(argv, config=CONFIG, receipts=RECEIPTS):
    if len(argv) != 2 or argv[0] not in ('check', 'publish'): raise SystemExit('usage: publish.py check|publish <mission_id>')
    cfg, directory, state = load(argv[1], config)
    proof = verify(cfg, directory, state)
    work = Path(tempfile.mkdtemp(prefix='hermes-publish-')) / 'tree'
    try:
        commit = build(proof, work)
        result = {'mission_id': proof['mission_id'], 'revision': proof['revision'], 'commit': commit,
                  'workspace_head': proof['workspace_head'], 'files': len(proof['changed_files']),
                  'title': title(proof)}
        if argv[0] == 'publish': result.update(publish(proof, work, commit, receipts))
        return result
    finally:
        if work.exists(): git(proof['source'], 'worktree', 'remove', '--force', str(work))
        shutil.rmtree(work.parent, ignore_errors=True)


if __name__ == '__main__':
    try:
        print(json.dumps(main(sys.argv[1:]), ensure_ascii=False, indent=1))
    except (ValueError, OSError, KeyError, subprocess.TimeoutExpired) as exc:
        raise SystemExit('refused: ' + str(exc)[:500])
