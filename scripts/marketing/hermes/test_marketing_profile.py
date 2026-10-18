"""Linux filesystem boundary tests; no model, credentials or application runtime."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from marketing_profile import Workspace


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "workspace"
        self.root.mkdir()
        for name in ("drafts", "reports", "candidates"):
            (self.root / name).mkdir()
        self.store = Workspace(self.root)

    def tearDown(self):
        self.tmp.cleanup()

    def call(self, **args):
        return json.loads(self.store.handle(args))

    def test_create_read_revise_and_list(self):
        first = self.call(action="write", path="drafts/newsletter.md", content="Bonjour", expected_sha256="")
        self.assertTrue(first["success"])
        self.assertEqual(self.call(action="read", path="drafts/newsletter.md")["content"], "Bonjour")
        revised = self.call(action="write", path="drafts/newsletter.md", content="Version 2", expected_sha256=first["sha256"])
        self.assertTrue(revised["success"])
        self.assertEqual(self.call(action="list")["files"], ["drafts/newsletter.md"])

    def test_scope_and_size_denials(self):
        for path in ("../config.yaml", "/tmp/out.md", "candidates/../../skills/a.md", "skills/a.md", "drafts/nested/a.md", "drafts/x.py", "drafts/a\\b.md"):
            with self.subTest(path=path):
                self.assertFalse(self.call(action="write", path=path, content="x", expected_sha256="")["success"])
        self.assertFalse(self.call(action="write", path="drafts/big.md", content="x" * 131073, expected_sha256="")["success"])
        self.assertFalse(self.call(action="delete", path="drafts/a.md")["success"])
        self.assertFalse(self.call(action="write", path="drafts/a.md", content="x")["success"])

    def test_candidates_stay_outside_active_sources(self):
        result = self.call(action="write", path="candidates/amk-reactivation.md", content="Proposition", expected_sha256="")
        self.assertTrue(result["success"])
        self.assertFalse(result["activated"])
        self.assertEqual(list(self.root.rglob("SKILL.md")), [])

    def test_symlink_file_and_directory_denied(self):
        outside = Path(self.tmp.name) / "outside.md"
        outside.write_text("preserve")
        (self.root / "drafts" / "link.md").symlink_to(outside)
        for action in ("read", "write"):
            self.assertFalse(self.call(action=action, path="drafts/link.md", content="bad", expected_sha256="")["success"])
        (self.root / "reports").rmdir()
        (self.root / "reports").symlink_to(outside.parent, target_is_directory=True)
        self.assertFalse(self.call(action="write", path="reports/outside.md", content="bad", expected_sha256="")["success"])
        self.assertEqual(outside.read_text(), "preserve")

    def test_concurrent_revisions_have_exactly_one_winner(self):
        initial = self.call(action="write", path="reports/result.json", content="{}", expected_sha256="")
        def write(i):
            return self.call(action="write", path="reports/result.json", content=str(i), expected_sha256=initial["sha256"])
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results = list(pool.map(write, range(5)))
        self.assertEqual(sum(result["success"] for result in results), 1)

    def test_hard_link_denied(self):
        outside = Path(self.tmp.name) / "outside.md"
        outside.write_text("preserve")
        (self.root / "drafts" / "link.md").hardlink_to(outside)
        self.assertFalse(self.call(action="read", path="drafts/link.md")["success"])
        self.assertEqual(hashlib.sha256(outside.read_bytes()).hexdigest(), hashlib.sha256(b"preserve").hexdigest())


if __name__ == "__main__":
    unittest.main()
