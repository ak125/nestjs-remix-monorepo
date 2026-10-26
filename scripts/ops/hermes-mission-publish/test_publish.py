import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import uuid

import publish as hp

GITLEAKS = shutil.which('gitleaks')
OPTIONS = ['--binary', '--no-ext-diff', '--no-textconv', '--no-color', '--src-prefix=a/',
           '--dst-prefix=b/', '--no-relative', '--full-index']


def sh(cwd, *argv):
    return subprocess.run(argv, cwd=cwd, check=True, capture_output=True).stdout.decode()


class Fixture:
    """Synthetic controller layout: source repo, detached mission worktree, state, local 'GitHub'."""

    def __init__(self, root, changes, paths=('backend/',), **state):
        self.root = root
        self.remote = root / 'remote.git'
        self.source = root / 'source'
        sh(root, 'git', 'init', '-q', '--bare', str(self.remote))
        sh(root, 'git', 'init', '-q', '-b', 'main', str(self.source))
        for k, v in (('user.name', 'Fixture'), ('user.email', 'fixture@example.invalid'),
                     (f'url.{self.remote}.insteadOf', 'https://github.com/fixture/demo.git')):
            sh(self.source, 'git', 'config', k, v)
        sh(self.source, 'git', 'remote', 'add', 'origin', 'https://github.com/fixture/demo.git')
        (self.source / 'backend').mkdir()
        (self.source / 'backend' / 'a.txt').write_text('one\n')
        (self.source / 'docs').mkdir()
        (self.source / 'docs' / 'b.txt').write_text('two\n')
        sh(self.source, 'git', 'add', '.')
        sh(self.source, 'git', 'commit', '-q', '-m', 'base')
        self.revision = sh(self.source, 'git', 'rev-parse', 'HEAD').strip()
        self.id = str(uuid.uuid4())
        self.worktrees = root / 'worktrees'
        work = self.worktrees / self.id
        sh(self.source, 'git', 'worktree', 'add', '-q', '--detach', str(work), self.revision)
        for name, content in changes.items():
            (work / name).parent.mkdir(parents=True, exist_ok=True)
            (work / name).write_bytes(content)
        # Same patch construction as the controller's tree_patch.
        untracked = [n for n in sh(work, 'git', 'ls-files', '--others', '--exclude-standard', '-z').split('\0') if n]
        files = sorted(set([n for n in sh(work, 'git', 'diff', '--name-only', '-z', 'HEAD').split('\0') if n] + untracked))
        patch = subprocess.run(['git', 'diff', *OPTIONS, 'HEAD', '--', *paths], cwd=work, capture_output=True).stdout
        for name in untracked:
            patch += subprocess.run(['git', 'diff', *OPTIONS, '--no-index', '--', '/dev/null', name],
                                    cwd=work, capture_output=True).stdout
        digest = hashlib.sha256(patch).hexdigest()
        self.directory = root / 'state' / self.id
        self.directory.mkdir(parents=True)
        (self.directory / f'changes-{digest}.patch').write_bytes(patch)
        self.state = {'mission_id': self.id, 'status': 'completed', 'revision': self.revision,
                      'contract': {'action': 'create', 'objective': 'Corriger le fixture', 'paths': list(paths)},
                      'task_assessment': {'outcome': 'achieved', 'summary': 'Fait.'}, 'scope_ok': True,
                      'changed_files': files, 'diff_sha256': digest, 'diff_artifact': f'changes-{digest}.patch',
                      'diff_bytes': len(patch), 'workspace': str(work), 'executor': 'claude',
                      'model_observed': 'claude-opus-5-5', 'created_at': 1792900000.5, **state}
        self.write()
        self.config = root / 'backend-config.json'
        self.config.write_text(json.dumps({'state': str(root / 'state'), 'source': str(self.source),
                                           'worktrees': str(self.worktrees),
                                           'execution_targets': {'wiki': {'source': str(root / 'wiki')}}}))

    def write(self):
        (self.directory / 'state.json').write_text(json.dumps(self.state))

    def proof(self):
        return hp.verify(*hp.load(self.id, self.config))

    def remote_branch(self):
        return sh(self.root, 'git', '--git-dir', str(self.remote), 'for-each-ref', '--format=%(refname) %(objectname)',
                  'refs/heads/hermes/').split()


class PublishTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root, True)
        # Fake gh records its arguments and stdin; gitleaks is faked unless a test needs the real one.
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        (self.bin / 'gh').write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$GH_LOG"\ncat > "$GH_LOG.body"\n'
                                     'echo https://github.com/fixture/demo/pull/7\n')
        (self.bin / 'gitleaks').write_text('#!/bin/sh\ncat >/dev/null\nexit 0\n')
        for f in ('gh', 'gitleaks'): os.chmod(self.bin / f, 0o755)
        self.path = os.environ['PATH']
        os.environ['PATH'] = f'{self.bin}:{self.path}'
        os.environ['GH_LOG'] = str(self.root / 'gh.log')
        self.addCleanup(os.environ.__setitem__, 'PATH', self.path)
        self.addCleanup(os.environ.pop, 'GH_LOG', None)

    def fixture(self, changes=None, **kw):
        return Fixture(self.root, changes or {'backend/a.txt': b'one\nfixed\n', 'backend/new.bin': b'\x00\x01\xff'}, **kw)

    def test_commit_is_rebuilt_at_the_fixed_revision(self):
        fx = self.fixture()
        proof = fx.proof()
        self.assertEqual(proof['workspace_head'], 'verified')
        self.assertEqual(proof['changed_files'], ['backend/a.txt', 'backend/new.bin'])
        commits = []
        for i in range(2):
            work = self.root / f'tree{i}'
            commits.append(hp.build(proof, work))
            self.assertEqual(sh(work, 'git', 'rev-parse', 'HEAD^').strip(), fx.revision)
            self.assertEqual((work / 'backend' / 'new.bin').read_bytes(), b'\x00\x01\xff')
            self.assertEqual(sh(work, 'git', 'log', '-1', '--format=%an %ae').strip(),
                             f'{hp.BOT_NAME} {hp.BOT_EMAIL}')
            self.assertIn(f'Hermes-Revision: {fx.revision}', sh(work, 'git', 'log', '-1', '--format=%B'))
        self.assertEqual(commits[0], commits[1])

    def test_no_repository_hook_runs(self):
        fx = self.fixture()
        hooks = self.root / 'hooks'
        hooks.mkdir()
        for name in ('post-checkout', 'pre-commit', 'commit-msg', 'post-commit', 'pre-push'):
            (hooks / name).write_text(f'#!/bin/sh\ntouch "{self.root}/hook-ran"\nexit 1\n')
            os.chmod(hooks / name, 0o755)
        sh(fx.source, 'git', 'config', 'core.hooksPath', str(hooks))
        hp.main(['publish', fx.id], fx.config, self.root / 'receipts')
        self.assertFalse((self.root / 'hook-ran').exists())

    def test_released_workspace_still_needs_the_patch_to_apply_at_revision(self):
        fx = self.fixture()
        sh(fx.source, 'git', 'worktree', 'remove', '--force', fx.state['workspace'])
        self.assertEqual(fx.proof()['workspace_head'], 'released')

    def test_unproven_missions_are_refused(self):
        fx = self.fixture()
        good = dict(fx.state)
        cases = {'mission_not_completed': {'status': 'running'},
                 'mission_not_achieved': {'task_assessment': {'outcome': 'partial'}},
                 'mission_not_bounded_write': {'contract': {**good['contract'], 'mode': 'diagnostic-read-only'}},
                 'scope_not_proven': {'scope_ok': False},
                 'exact_revision_required': {'revision': fx.revision[:12]},
                 'outside_contract_paths': {'changed_files': ['docs/b.txt']},
                 'owner_reserved_path': {'contract': {**good['contract'], 'paths': ['.github/']},
                                         'changed_files': ['.github/workflows/ci.yml']},
                 'patch_size': {'diff_bytes': good['diff_bytes'] + 1},
                 'patch_artifact_name': {'diff_sha256': '0' * 64},
                 'execution_target_unknown': {'contract': {**good['contract'], 'target': 'wiki'}},
                 'workspace_path': {'workspace': str(self.root / 'elsewhere')}}
        for reason, change in cases.items():
            with self.subTest(reason=reason):
                fx.state = {**good, **change}; fx.write()
                with self.assertRaisesRegex(ValueError, reason): fx.proof()
        fx.state = good; fx.write()
        patch = fx.directory / good['diff_artifact']
        patch.write_bytes(patch.read_bytes().replace(b'fixed', b'fixeD'))
        with self.assertRaisesRegex(ValueError, 'patch_drift'): fx.proof()

    def test_workspace_on_another_revision_is_refused(self):
        fx = self.fixture()
        work = Path(fx.state['workspace'])
        sh(work, 'git', 'commit', '-q', '-am', 'moved', '--allow-empty')
        with self.assertRaisesRegex(ValueError, 'workspace_revision_mismatch'): fx.proof()

    def test_publish_pushes_one_draft_and_keeps_a_receipt(self):
        fx = self.fixture()
        receipts = self.root / 'receipts'
        result = hp.main(['publish', fx.id], fx.config, receipts)
        self.assertEqual(result['pr'], 'https://github.com/fixture/demo/pull/7')
        self.assertEqual(fx.remote_branch(), [f'refs/heads/hermes/{fx.id}', result['commit']])
        args = (self.root / 'gh.log').read_text().split('\n')
        for flag in ('--draft', '--repo', 'fixture/demo', '--base', 'main', f'hermes/{fx.id}'):
            self.assertIn(flag, args)
        self.assertIn(fx.revision, (self.root / 'gh.log.body').read_text())
        self.assertEqual(json.loads((receipts / f'{fx.id}.json').read_text())['commit'], result['commit'])
        with self.assertRaisesRegex(ValueError, 'already_published'):
            hp.main(['publish', fx.id], fx.config, receipts)
        # PR creation failed after the push: the same deterministic commit is reused.
        (receipts / f'{fx.id}.json').unlink()
        self.assertEqual(hp.main(['publish', fx.id], fx.config, receipts)['commit'], result['commit'])
        self.assertNotIn('hermes-publish', sh(fx.source, 'git', 'worktree', 'list'))

    def test_check_never_pushes(self):
        fx = self.fixture()
        self.assertNotIn('pr', hp.main(['check', fx.id], fx.config, self.root / 'receipts'))
        self.assertEqual(fx.remote_branch(), [])
        self.assertFalse((self.root / 'gh.log').exists())

    @unittest.skipUnless(GITLEAKS, 'gitleaks absent')
    def test_secret_in_the_patch_blocks_the_push(self):
        (self.bin / 'gitleaks').unlink()
        # Built at runtime so this file holds no secret-shaped literal.
        token = 'ghp' + '_' + hashlib.sha256(b'fixture').hexdigest()[:36]
        fx = self.fixture({'backend/a.txt': f'token = "{token}"\n'.encode()})
        with self.assertRaisesRegex(ValueError, 'gitleaks_failed'):
            hp.main(['publish', fx.id], fx.config, self.root / 'receipts')
        self.assertEqual(fx.remote_branch(), [])
        self.assertNotIn('hermes-publish', sh(fx.source, 'git', 'worktree', 'list'))

    @unittest.skipUnless(GITLEAKS, 'gitleaks absent')
    def test_patched_scanner_rules_are_ignored(self):
        (self.bin / 'gitleaks').unlink()
        token = 'ghp' + '_' + hashlib.sha256(b'fixture').hexdigest()[:36]
        fx = self.fixture({'backend/a.txt': f'token = "{token}"\n'.encode(),
                           '.gitleaks.toml': b"[allowlist]\npaths = ['''.*''']\n", '.gitleaksignore': b'*\n'},
                          paths=('backend/', '.gitleaks.toml', '.gitleaksignore'))
        with self.assertRaisesRegex(ValueError, 'gitleaks_failed'):
            hp.main(['check', fx.id], fx.config, self.root / 'receipts')


if __name__ == '__main__':
    unittest.main()
