#!/usr/bin/env python3
"""Tests sans base de check-plpgsql-compile.py (extraction des blocs DO).
La compilation elle-même est prouvée en CI par le témoin négatif du step."""
import importlib.util
import pathlib
import unittest

_spec = importlib.util.spec_from_file_location(
    "chk", pathlib.Path(__file__).with_name("check-plpgsql-compile.py")
)
chk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(chk)


class ExtractDoBlocks(unittest.TestCase):
    def test_tagged_and_anonymous_blocks_with_lines(self):
        sql = "SET x = 1;\nDO $precheck$\nBEGIN\n  NULL;\nEND\n$precheck$;\nDO $$ BEGIN NULL; END $$;\n"
        blocks = chk.extract_do_blocks(sql)
        self.assertEqual([(t, l) for t, l, _ in blocks], [("$precheck$", 2), ("$$", 7)])
        self.assertIn("NULL;", blocks[0][2])

    def test_do_quoted_in_comment_line_is_ignored(self):
        sql = "-- crée via `DO $$ BEGIN IF NOT EXISTS … END $$;`\nDO $guard$ BEGIN NULL; END $guard$;\n"
        self.assertEqual([t for t, _, _ in chk.extract_do_blocks(sql)], ["$guard$"])

    def test_language_before_body(self):
        sql = "DO LANGUAGE plpgsql $$ BEGIN NULL; END $$;"
        self.assertEqual(len(chk.extract_do_blocks(sql)), 1)

    def test_unclosed_block_is_an_error(self):
        with self.assertRaises(ValueError):
            chk.extract_do_blocks("DO $x$ BEGIN NULL; END;")

    def test_script_is_rolled_back(self):
        script, n = "", 0
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as fh:
            fh.write("DO $$ BEGIN NULL; END $$;")
        try:
            script, n = chk.build_script([fh.name])
        finally:
            os.unlink(fh.name)
        self.assertEqual(n, 1)
        self.assertTrue(script.startswith("BEGIN;"))
        self.assertTrue(script.rstrip().endswith("ROLLBACK;"))


if __name__ == "__main__":
    unittest.main()
