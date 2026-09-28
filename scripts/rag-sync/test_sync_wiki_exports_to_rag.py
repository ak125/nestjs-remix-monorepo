"""Offline D20 and freshness regressions; all writes stay in temporary fixtures."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(os.getenv('SYNC_SCRIPT_UNDER_TEST', str(Path(__file__).with_name('sync-wiki-exports-to-rag.py'))))
spec = importlib.util.spec_from_file_location('wiki_sync', SCRIPT)
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncContractTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.wiki = self.root / 'wiki-repo'
        self.exports = self.wiki / 'exports/rag'
        self.exports.mkdir(parents=True)
        self.rag = self.root / 'rag-repo'
        self.mirror = self.rag / 'knowledge'
        self.mirror.mkdir(parents=True)
        self.manifest = self.mirror / '.last-sync.json'
        self.manifest.write_text('{"synced_at":"previous-success"}\n')

    def run_sync(self, source=None, apply=True):
        args = ['sync', '--wiki-repo', str(self.wiki), '--rag-repo', str(self.rag)]
        if source is not None:
            args += ['--source', str(source)]
        if apply:
            args += ['--apply']
        with patch.object(sys, 'argv', args):
            return sync.main()

    def add_export(self, relative='gammes/oil.md'):
        p = self.exports / relative
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('fixture: validated export\n')
        return p

    def assert_rejected(self, source):
        with self.assertRaises(SystemExit):
            self.run_sync(source)
        self.assertEqual(list(self.mirror.iterdir()), [self.manifest])
        self.assertIn('previous-success', self.manifest.read_text())

    def test_rejects_noncontiguous_export_path(self):
        p = self.root / 'exports/unreviewed/rag'
        p.mkdir(parents=True)
        (p / 'unreviewed.md').write_text('raw')
        self.assert_rejected(p)

    def test_rejects_another_wiki_repository(self):
        p = self.root / 'another-wiki/exports/rag'
        p.mkdir(parents=True)
        (p / 'unreviewed.md').write_text('raw')
        self.assert_rejected(p)

    def test_rejects_symlink_escape_before_any_copy(self):
        self.add_export('a-valid.md')
        outside = self.root / 'raw.md'
        outside.write_text('raw')
        (self.exports / 'z-escape.md').symlink_to(outside)
        self.assert_rejected(self.exports)

    def test_rejects_export_root_symlink(self):
        self.exports.rmdir()
        outside = self.root / 'unreviewed'
        outside.mkdir()
        (outside / 'raw.md').write_text('raw')
        self.exports.symlink_to(outside, target_is_directory=True)
        self.assert_rejected(self.exports)

    def test_valid_export_and_unchanged_replay(self):
        src = self.add_export()
        self.assertEqual(self.run_sync(), 0)
        dst = self.mirror / 'gammes/oil.md'
        before = dst.stat().st_mtime_ns
        with patch.object(sync.shutil, 'copy2', side_effect=AssertionError('unchanged file copied')):
            self.assertEqual(self.run_sync(), 0)
        self.assertEqual(dst.read_bytes(), src.read_bytes())
        self.assertEqual(dst.stat().st_mtime_ns, before)
        self.assertEqual(json.loads(self.manifest.read_text())['stats']['skipped'], 1)

    def test_dry_run_writes_nothing(self):
        self.add_export()
        before = self.manifest.read_bytes()
        self.assertEqual(self.run_sync(apply=False), 0)
        self.assertEqual(list(self.mirror.iterdir()), [self.manifest])
        self.assertEqual(self.manifest.read_bytes(), before)

    def test_missing_exports_fail_without_refreshing(self):
        self.exports.rmdir()
        self.assertEqual(self.run_sync(), 1)
        self.assertIn('previous-success', self.manifest.read_text())

    def test_empty_exports_fail_without_refreshing(self):
        self.assertEqual(self.run_sync(), 1)
        self.assertIn('previous-success', self.manifest.read_text())

    def test_failed_copy_cannot_refresh_success_timestamp(self):
        self.add_export()
        with patch.object(sync.shutil, 'copy2', side_effect=OSError('disk unavailable')):
            self.assertEqual(self.run_sync(), 1)
        self.assertIn('previous-success', self.manifest.read_text())

    def test_removed_export_blocks_refresh_and_preserves_evidence(self):
        retained = self.add_export()
        withdrawn = self.add_export('gammes/withdrawn.md')
        self.assertEqual(self.run_sync(), 0)
        before = self.manifest.read_bytes()
        withdrawn.unlink()
        retained.write_text('new version awaiting coherent sync')
        self.assertEqual(self.run_sync(), 1)
        self.assertEqual(self.manifest.read_bytes(), before)
        self.assertTrue((self.mirror / 'gammes/withdrawn.md').exists())
        self.assertEqual((self.mirror / 'gammes/oil.md').read_text(), 'fixture: validated export\n')

    def test_unmanaged_mirror_file_is_reported_without_deletion(self):
        self.add_export()
        old = self.mirror / 'legacy.md'
        old.write_text('historical corpus')
        self.assertEqual(self.run_sync(), 1)
        self.assertEqual(old.read_text(), 'historical corpus')
        self.assertIn('previous-success', self.manifest.read_text())

    def test_partial_source_cannot_claim_global_mirror_freshness(self):
        self.add_export()
        self.assertEqual(self.run_sync(source=self.exports / 'gammes'), 1)
        self.assertIn('previous-success', self.manifest.read_text())
        self.assertFalse((self.mirror / 'oil.md').exists())

    def test_target_symlink_escape_rejected_before_copy(self):
        self.add_export()
        outside = self.root / 'outside'
        outside.mkdir()
        (self.mirror / 'gammes').symlink_to(outside, target_is_directory=True)
        self.assertEqual(self.run_sync(), 1)
        self.assertFalse((outside / 'oil.md').exists())
        self.assertIn('previous-success', self.manifest.read_text())

    def test_failed_manifest_is_observable_failure(self):
        self.add_export()
        with patch.object(Path, 'write_text', side_effect=OSError('manifest unavailable')):
            self.assertEqual(self.run_sync(), 1)
        self.assertIn('previous-success', self.manifest.read_text())


    def test_interrupted_copy_preserves_existing_complete_document(self):
        self.add_export()
        self.assertEqual(self.run_sync(), 0)
        dst = self.mirror / 'gammes/oil.md'
        previous = dst.read_bytes()
        manifest_before = self.manifest.read_bytes()
        (self.exports / 'gammes/oil.md').write_text('next complete approved version')
        observed = []

        def interrupted_copy(src, destination):
            Path(destination).write_text('truncated')
            observed.append(dst.read_bytes())
            raise OSError('simulated interrupted copy')

        with patch.object(sync.shutil, 'copy2', side_effect=interrupted_copy):
            self.assertEqual(self.run_sync(), 1)
        self.assertEqual(observed, [previous])
        self.assertEqual(dst.read_bytes(), previous)
        self.assertEqual(self.manifest.read_bytes(), manifest_before)
        self.assertEqual(sorted(p.relative_to(self.mirror).as_posix() for p in self.mirror.rglob('*')),
                         ['.last-sync.json', 'gammes', 'gammes/oil.md'])

    def test_interrupted_new_document_never_becomes_visible(self):
        self.add_export()
        dst = self.mirror / 'gammes/oil.md'
        manifest_before = self.manifest.read_bytes()
        observed = []

        def interrupted_copy(src, destination):
            Path(destination).write_text('truncated')
            observed.append(dst.exists())
            raise OSError('simulated interrupted copy')

        with patch.object(sync.shutil, 'copy2', side_effect=interrupted_copy):
            self.assertEqual(self.run_sync(), 1)
        self.assertEqual(observed, [False])
        self.assertFalse(dst.exists())
        self.assertEqual(self.manifest.read_bytes(), manifest_before)
        self.assertFalse(any(p.name.startswith('.wiki-sync-') for p in self.mirror.rglob('*')))

    def test_file_replacement_failure_preserves_previous_document(self):
        source = self.add_export()
        self.assertEqual(self.run_sync(), 0)
        dst = self.mirror / 'gammes/oil.md'
        before = dst.read_bytes()
        manifest_before = self.manifest.read_bytes()
        source.write_text('next complete approved version')
        with patch.object(sync.os, 'replace', side_effect=OSError('replacement denied')):
            self.assertEqual(self.run_sync(), 1)
        self.assertEqual(dst.read_bytes(), before)
        self.assertEqual(self.manifest.read_bytes(), manifest_before)
        self.assertFalse(any(p.name.startswith('.wiki-sync-') for p in self.mirror.rglob('*')))

    def test_interrupted_manifest_write_preserves_previous_valid_json(self):
        self.add_export()
        self.assertEqual(self.run_sync(), 0)
        before = self.manifest.read_bytes()
        write_text = Path.write_text
        observed = []

        def interrupted_write(path, content, *args, **kwargs):
            write_text(path, '{"synced_at":', *args, **kwargs)
            observed.append(self.manifest.read_bytes())
            raise OSError('simulated interrupted manifest write')

        with patch.object(Path, 'write_text', new=interrupted_write):
            self.assertEqual(self.run_sync(), 1)
        self.assertEqual(observed, [before])
        self.assertEqual(self.manifest.read_bytes(), before)
        self.assertEqual(json.loads(self.manifest.read_bytes())['stats']['failed'], 0)
        self.assertFalse(any(p.name.startswith('.wiki-sync-') for p in self.mirror.rglob('*')))

    def test_manifest_replacement_failure_preserves_previous_success(self):
        self.add_export()
        self.assertEqual(self.run_sync(), 0)
        before = self.manifest.read_bytes()
        with patch.object(sync.os, 'replace', side_effect=OSError('replacement denied')):
            self.assertEqual(self.run_sync(), 1)
        self.assertEqual(self.manifest.read_bytes(), before)
        self.assertFalse(any(p.name.startswith('.wiki-sync-') for p in self.mirror.rglob('*')))

    def test_successful_replacement_keeps_document_metadata_and_manifest_permissions(self):
        source = self.add_export()
        source.chmod(0o640)
        os.utime(source, ns=(1_700_000_000_000_000_000, 1_700_000_000_000_000_000))
        self.manifest.chmod(0o640)
        self.assertEqual(self.run_sync(), 0)
        dst = self.mirror / 'gammes/oil.md'
        self.assertEqual(dst.read_bytes(), source.read_bytes())
        self.assertEqual(dst.stat().st_mode & 0o777, 0o640)
        self.assertEqual(dst.stat().st_mtime_ns, source.stat().st_mtime_ns)
        self.assertEqual(self.manifest.stat().st_mode & 0o777, 0o640)
        self.assertFalse(any(p.name.startswith('.wiki-sync-') for p in self.mirror.rglob('*')))


if __name__ == '__main__':
    unittest.main()
