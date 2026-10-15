import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPT = Path(__file__).with_name('inventory-marketing-tables.py')


class InventoryTests(unittest.TestCase):
    def cli(self, *args):
        return subprocess.run([sys.executable, '-S', str(SCRIPT), *map(str, args)],
                              env={k:v for k,v in os.environ.items() if 'SUPABASE' not in k},
                              capture_output=True, text=True)

    def test_help_needs_no_driver_secret_or_network(self):
        result = self.cli('--help')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('--prepare-phase1', result.stdout)

    def test_offline_preparation_is_readonly_and_preserves_existing_file(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder)/'preflight.sql'
            result = self.cli('--prepare-phase1', target)
            self.assertEqual(result.returncode, 0, result.stderr)
            content = target.read_text(encoding='utf-8')
            self.assertIn('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY', content)
            self.assertIn('pg_policies', content)
            self.assertIn('cst_marketing_consent_at', content)
            self.assertTrue(content.rstrip().endswith('ROLLBACK;'))
            again = self.cli('--prepare-phase1', target)
            self.assertNotEqual(again.returncode, 0)
            self.assertEqual(target.read_text(encoding='utf-8'), content)

    def test_legacy_connection_is_readonly_and_lazy(self):
        driver, dotenv = Mock(), Mock()
        with patch.dict(sys.modules, {'psycopg2':driver,'dotenv':dotenv}), \
             patch.dict(os.environ, {'SUPABASE_DB_PASSWORD':"fixture ' spaces"},clear=True):
            spec=importlib.util.spec_from_file_location('inventory',SCRIPT)
            module=importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            driver.connect.assert_not_called()
            dotenv.load_dotenv.assert_not_called()
            module.connect()
            self.assertEqual(driver.connect.call_args.kwargs['password'], "fixture ' spaces")
            driver.connect.return_value.set_session.assert_called_once_with(
                readonly=True, autocommit=False, isolation_level='REPEATABLE READ')


if __name__=='__main__':unittest.main()
