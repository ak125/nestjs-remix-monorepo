"""Legacy capture retirement: observable refusal, no network and no vault writes."""
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

SCRIPT = (pathlib.Path(sys.argv.pop(1)).resolve() if len(sys.argv) > 1 and sys.argv[1].endswith('.sh')
          else pathlib.Path(__file__).with_name('governance') / 'capture-verification.sh')


class LegacyCaptureTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = pathlib.Path(self.tmp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        # Transport/process boundaries are substituted, never the script under test.
        # Any accidental network, git action or old report calculation leaves a trace.
        for name in ('curl', 'gh', 'git', 'bc'):
            command = self.bin / name
            command.write_text(
                '#!' + sys.executable + '\n'
                'import json, os, pathlib, sys\n'
                'with pathlib.Path(os.environ["LEGACY_TEST_CALLS"]).open("a") as log:\n'
                '    log.write(json.dumps(sys.argv) + "\\n")\n'
                'if pathlib.Path(sys.argv[0]).name == "curl":\n'
                '    if os.environ.get("LEGACY_TEST_TRANSPORT") == "failure":\n'
                '        sys.exit(22)\n'
                '    print(\'{"status":"ok","mode":"enforce","enforceLevel":"P2",'
                '"totalBlocks":0,"allowlistSize":154,"denylistP2Size":40}\')\n'
                'elif pathlib.Path(sys.argv[0]).name == "bc":\n'
                '    print("50.0")\n'
            )
            command.chmod(0o755)

    def assert_retired_without_effects(self, name, args=(), *, seeded=False, transport='success'):
        old = self.root / '.local/governance-vault/04-audit-trail'
        if seeded:
            old.mkdir(parents=True)
            for folder in ('health-checks', 'ci-gates', 'reports'):
                (old / folder).mkdir()
            (old / 'ci-gates/2026-02-01-existing.md').write_text('---\nstatus: passed\n---\n')
            (old / 'health-checks/2026-02-01_health-001.md').write_text('original health proof\n')
            (old / 'reports/2026-02_monthly-audit.md').write_text('original monthly proof\n')
        before = {str(p.relative_to(old)): p.read_bytes() for p in old.rglob('*') if p.is_file()}
        calls = self.root / 'external-calls.jsonl'
        result = subprocess.run(
            ['bash', str(SCRIPT.with_name(name)), *args], cwd=self.root,
            env={**os.environ, 'PATH': str(self.bin) + os.pathsep + os.environ['PATH'],
                 'LEGACY_TEST_CALLS': str(calls), 'LEGACY_TEST_TRANSPORT': transport},
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(2, result.returncode, result.stdout + result.stderr)
        self.assertIn('disabled', result.stderr)
        self.assertEqual('', result.stdout)
        self.assertFalse(calls.exists(), 'Retired command still invoked an external tool')
        after = {str(p.relative_to(old)): p.read_bytes() for p in old.rglob('*') if p.is_file()}
        self.assertEqual(before, after, 'Existing evidence was modified or new evidence was fabricated')
        self.assertEqual(seeded, old.exists(), 'Retired command created the legacy vault')

    def test_health_default_refuses_before_any_production_probe(self):
        self.assert_retired_without_effects('capture-health-check.sh')

    def test_health_explicit_preprod_cannot_write_legacy_evidence(self):
        self.assert_retired_without_effects('capture-health-check.sh', ['--env', 'preprod'], seeded=True)

    def test_health_collection_failure_cannot_be_a_successful_capture(self):
        self.assert_retired_without_effects('capture-health-check.sh', transport='failure')

    def test_monthly_without_arguments_cannot_create_a_report(self):
        self.assert_retired_without_effects('generate-monthly-report.sh')

    def test_monthly_rerun_cannot_overwrite_existing_evidence(self):
        self.assert_retired_without_effects('generate-monthly-report.sh', ['2026-02'], seeded=True)

    def test_invalid_month_cannot_escape_the_reports_directory(self):
        sentinel = self.root / 'escape_monthly-audit.md'
        sentinel.write_text('preserve me')
        self.assert_retired_without_effects('generate-monthly-report.sh', ['../../../../escape'])
        self.assertEqual('preserve me', sentinel.read_text())

    def test_declarative_capture_refuses_without_external_calls(self):
        self.assert_retired_without_effects('capture-verification.sh',
                                          ['--type', 'ci-gate', '--status', 'passed'], seeded=True)

    def test_declared_success_is_not_evidence_and_cannot_write_a_vault(self):
        with tempfile.TemporaryDirectory() as root:
            old = pathlib.Path(root) / '.local/governance-vault/04-audit-trail'
            old.mkdir(parents=True)
            (old / 'ci-gates').mkdir()
            result = subprocess.run(
                ['bash', str(SCRIPT), '--type', 'ci-gate', '--status', 'passed',
                 '--commit', 'a' * 40], cwd=root, capture_output=True, text=True,
                timeout=10,
            )
            self.assertNotEqual(0, result.returncode, result.stdout)
            self.assertEqual([], list(old.rglob('*.md')))


if __name__ == '__main__':
    unittest.main()
