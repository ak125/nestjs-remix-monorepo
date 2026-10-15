"""No DB: reject transaction ownership conflicts before executing any SQL."""
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import Mock

spec = importlib.util.spec_from_file_location("migration_engine", Path(__file__).with_name("apply-supabase-migration.py"))
engine = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = engine
spec.loader.exec_module(engine)


class TransactionTests(unittest.TestCase):
    def test_top_level_controls_rejected_by_existing_linter(self):
        for control in ["BEGIN", "START TRANSACTION", "COMMIT", "END", "ROLLBACK", "ABORT", "PREPARE TRANSACTION 'x'"]:
            with self.subTest(control=control):
                self.assertTrue(engine.reconcile_non_transactional(f"-- test\n{control};"))

    def test_function_blocks_and_quoted_words_are_not_transaction_commands(self):
        sql = """-- COMMIT;
        CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$ BEGIN RAISE NOTICE 'COMMIT;'; END $$;
        DO $body$ BEGIN PERFORM 1; END $body$;
        SELECT 'ROLLBACK;', 'START TRANSACTION;';"""
        self.assertEqual(engine.reconcile_non_transactional(sql), [])

    def test_nested_and_inter_keyword_comments_cannot_hide_control(self):
        for sql in ["/* outer /* inner */ still outer */ COMMIT;",
                    "START /* comment */ TRANSACTION;",
                    "PREPARE /* outer /* inner */ end */ TRANSACTION 'x';"]:
            with self.subTest(sql=sql):
                self.assertTrue(engine.reconcile_non_transactional(sql))

    def test_direct_apply_rejects_before_connection_use(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "20261015_test.sql"
            path.write_text("CREATE TABLE should_not_exist(id int); COMMIT;")
            migration = engine.LocalMigration(path.stem, path, "fixture", False)
            conn = Mock()
            with self.assertRaisesRegex(ValueError, "transaction control"):
                engine.apply_migration(conn, migration, "test", "test")
            conn.cursor.assert_not_called()

    def test_supplied_sql_is_checked_too(self):
        migration = engine.LocalMigration("fixture", Path("unused"), "fixture", False)
        with self.assertRaisesRegex(ValueError, "transaction control"):
            engine.apply_migration(Mock(), migration, "test", "test", sql="COMMIT;")


if __name__ == "__main__":
    unittest.main()
