"""Run under the installed Hermes runtime against the dedicated A1 snapshot."""
import importlib.util
import concurrent.futures
import json
import sys
import time
import unittest

sys.path.insert(0, '/home/hermes/.hermes/hermes-agent')
import hermes_bootstrap  # noqa: F401


class MarketingDevTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.find_spec('marketing_dev')
        if spec is not None:
            import marketing_dev
            cls.adapter = marketing_dev
        else:
            cls.adapter = None

    def call(self, command, timeout=30):
        self.assertIsNotNone(self.adapter, 'Marketing A1 execution adapter is missing')
        return json.loads(self.adapter.execute({'command': command, 'timeout': timeout}))

    def test_existing_segment_cli(self):
        result = self.call('node node_modules/tsx/dist/cli.mjs --tsconfig scripts/marketing/tsconfig.json scripts/marketing/run-reactivation-pilot.ts --segment')
        self.assertTrue(result['success'], result)
        data = json.loads(result['output'])
        self.assertTrue(data['synthetic'])
        self.assertFalse(data['real_execution'])
        self.assertTrue(data['result'])

    def test_host_and_network_are_unavailable(self):
        result = self.call("""python3 - <<'PY'
import os, pathlib, socket
assert not pathlib.Path('/home/hermes').exists()
assert not pathlib.Path('/etc/passwd').exists()
assert not pathlib.Path('/run/codex-telegram-control/control.sock').exists()
assert not any('TOKEN' in k or 'SECRET' in k or 'API_KEY' in k for k in os.environ)
with socket.socket() as s:
    s.settimeout(1)
    try:
        s.connect(('1.1.1.1', 443))
    except OSError:
        pass
    else:
        raise AssertionError('Network unexpectedly available')
print('isolated')
PY""")
        self.assertTrue(result['success'], result)
        self.assertIn('isolated', result['output'])

    def test_candidate_write_diff_and_restore(self):
        result = self.call(r"""python3 - <<'PY'
from pathlib import Path
import subprocess
for name in ['scripts/marketing/workbench-cli.ts',
             'workspaces/marketing/.claude/skills/amk-reactivation/SKILL.md']:
    p = Path(name)
    original = p.read_bytes()
    before = subprocess.check_output(['git', 'diff', '--', str(p)])
    try:
        p.write_bytes(original + b'\n// synthetic qualification\n')
        diff = subprocess.check_output(['git', 'diff', '--', str(p)], text=True)
        assert 'synthetic qualification' in diff
    finally:
        p.write_bytes(original)
    assert subprocess.check_output(['git', 'diff', '--', str(p)]) == before
print('candidate diff and restoration verified')
PY""")
        self.assertTrue(result['success'], result)

    def test_dependencies_backend_and_git_baseline_are_readonly(self):
        result = self.call("""python3 - <<'PY'
import os
for path in ['SOURCE.json', 'package.json', '.git/config', 'node_modules/zod/package.json', 'backend/src/modules/marketing/services/marketing-preparation.ts']:
    try:
        fd = os.open(path, os.O_WRONLY | os.O_APPEND)
    except PermissionError:
        continue
    else:
        os.close(fd)
        raise AssertionError(path + ' is writable')
print('baseline readonly')
PY""")
        self.assertTrue(result['success'], result)

    def test_timeout_and_invalid_arguments(self):
        result = self.call('sleep 3', timeout=1)
        self.assertFalse(result['success'], result)
        self.assertIsNotNone(self.adapter)
        for args in ({'command': 'true', 'timeout': 181}, {'command': 'true', 'background': True}, {'command': ''}):
            self.assertFalse(json.loads(self.adapter.execute(args))['success'])

    def test_one_writer_and_wrong_profile(self):
        self.assertIsNotNone(self.adapter)
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(self.call, 'touch artifacts/qualification-lock; sleep 2; rm artifacts/qualification-lock')
            marker = self.adapter.WORKSPACE / 'artifacts/qualification-lock'
            deadline = time.monotonic() + 5
            while not marker.exists() and time.monotonic() < deadline:
                time.sleep(0.02)
            self.assertTrue(marker.exists())
            result = self.call('true')
            self.assertFalse(result['success'], result)
            self.assertEqual(result['returncode'], 75)
            self.assertTrue(pending.result()['success'])
        original = self.adapter.PROFILE
        try:
            self.adapter.PROFILE = original / 'wrong-profile'
            self.assertFalse(self.call('true')['success'])
        finally:
            self.adapter.PROFILE = original


if __name__ == '__main__':
    unittest.main()
