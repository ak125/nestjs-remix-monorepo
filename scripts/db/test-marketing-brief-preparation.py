"""Offline regression checks; never connect to a database or read an env file."""
import hashlib
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPT = Path(__file__).with_name("apply-migration-marketing-phase1.py")
ROOT = SCRIPT.resolve().parents[2]
SOURCE = ROOT / "backend/supabase/migrations/20260430_marketing_layer_phase1.sql"


class PreparationTests(unittest.TestCase):
    def run_cli(self, *args):
        env = {k: v for k, v in os.environ.items() if "SUPABASE" not in k and k != "DATABASE_URL"}
        return subprocess.run([sys.executable, "-S", str(SCRIPT), *map(str, args)],
                              env=env, capture_output=True, text=True)

    def test_prepare_without_dependencies_secrets_or_connection(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "prerequisite.sql"
            result = self.run_cli("--prepare-brief-social", target)
            self.assertEqual(result.returncode, 0, result.stderr)
            sql = target.read_text(encoding="utf-8")
            source = SOURCE.read_text(encoding="utf-8")
            block = source[source.index("CREATE TABLE IF NOT EXISTS public.__marketing_brief"):
                           source.index("-- ── 2.")]
            self.assertIn(block, sql)
            self.assertIn(hashlib.sha256(source.encode()).hexdigest(), sql)
            self.assertNotIn("__retention_trigger_rules", sql)
            self.assertNotIn("___xtr_customer", sql)
            self.assertNotIn("INSERT INTO infra.schema_migrations", sql)
            self.assertTrue(sql.rstrip().endswith("COMMIT;"))

    def test_existing_artifact_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "prerequisite.sql"
            target.write_text("reviewed artifact", encoding="utf-8")
            result = self.run_cli("--prepare-brief-social", target)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("already exists", result.stderr)
            self.assertEqual(target.read_text(), "reviewed artifact")

    def test_registered_form_uses_runner_transaction_and_preserves_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'corrective.sql'
            result = self.run_cli('--prepare-brief-social-migration', target)
            self.assertEqual(result.returncode, 0, result.stderr)
            sql = target.read_text(encoding='utf-8')
            self.assertIn('baseline-2026-05-16', sql)
            self.assertIn('infra.schema_migrations', sql)
            self.assertNotIn('\nBEGIN;\n', sql)
            self.assertNotIn('\nCOMMIT;', sql)
            self.assertNotIn('INSERT INTO infra.schema_migrations', sql)
            self.assertNotIn('UPDATE infra.schema_migrations', sql)
            self.assertNotIn('__retention_trigger_rules', sql)
            self.assertNotIn('___xtr_customer', sql)
            # Business SQL remains the exact reviewed source section.
            source = SOURCE.read_text(encoding='utf-8')
            self.assertIn(source[source.index('CREATE TABLE IF NOT EXISTS public.__marketing_brief'):
                                 source.index('-- ── 2.')], sql)
            again = self.run_cli('--prepare-brief-social-migration', target)
            self.assertNotEqual(again.returncode, 0)
            self.assertEqual(target.read_text(encoding='utf-8'), sql)

    def test_checked_in_corrective_is_the_same_generated_contract(self):
        matches = list((ROOT / 'backend/supabase/migrations').glob('*_marketing_brief_prerequisite_reconciliation.sql'))
        self.assertEqual(len(matches), 1, 'one traceable corrective migration is required')
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)/'corrective.sql'
            result = self.run_cli('--prepare-brief-social-migration', target)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(matches[0].read_text(encoding='utf-8'), target.read_text(encoding='utf-8'))

    def test_help_is_offline(self):
        result = self.run_cli("--help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--prepare-brief-social", result.stdout)

    def test_modes_remain_exclusive(self):
        result = self.run_cli("--prepare-brief-social", "unused.sql", "--apply")
        self.assertEqual(result.returncode, 2)
        self.assertIn("not allowed", result.stderr)

    def test_source_drift_is_rejected(self):
        spec = importlib.util.spec_from_file_location("marketing_phase1", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with self.assertRaisesRegex(ValueError, "source changed"):
            module.brief_social_sql(SOURCE.read_text(encoding="utf-8") + "\n-- drift")

    def test_legacy_connection_keeps_target_and_loads_env_only_on_connect(self):
        spec = importlib.util.spec_from_file_location("marketing_phase1", SCRIPT)
        module = importlib.util.module_from_spec(spec)
        driver, dotenv = Mock(), Mock()
        with patch.dict(sys.modules, {"psycopg2": driver, "dotenv": dotenv}), \
             patch.dict(os.environ, {"SUPABASE_DB_PASSWORD": "fixture ' spaces"}, clear=True):
            spec.loader.exec_module(module)
            dotenv.load_dotenv.assert_not_called()
            driver.connect.assert_not_called()
            module.connect()
            dotenv.load_dotenv.assert_called_once_with(ROOT / "backend/.env")
            driver.connect.assert_called_once_with(
                host="db.cxpojprgwgubzjyqzmoq.supabase.co", port=5432,
                dbname="postgres", user="postgres", password="fixture ' spaces",
                sslmode="require", application_name="adr036-phase1-migration",
                connect_timeout=10,
            )


if __name__ == "__main__":
    unittest.main()
