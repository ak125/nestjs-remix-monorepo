"""Qualification budgets, without loading Hermes or contacting a provider."""
import os
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
from types import ModuleType, SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from qualify_behavior import qualification_iterations
import qualify_behavior


class QualificationBudgetTests(unittest.TestCase):
    def budget(self, profile_limit, requested=None):
        environment = {} if requested is None else {'HERMES_MARKETING_TEST_ITERATIONS': requested}
        with patch.dict(os.environ, environment, clear=True):
            return qualification_iterations(profile_limit)

    def test_default_stays_within_a_lower_profile_budget(self):
        for limit, expected in [(8, 4), (3, 3), (1, 1), (16, 4)]:
            with self.subTest(limit=limit):
                self.assertEqual(self.budget(limit), expected)

    def test_explicit_budget_accepts_both_boundaries(self):
        for limit, requested, expected in [(8, '1', 1), (8, '8', 8), (3, '3', 3)]:
            with self.subTest(limit=limit, requested=requested):
                self.assertEqual(self.budget(limit, requested), expected)

    def test_campaign_cannot_raise_the_budget_to_sixteen(self):
        for limit, requested in [(8, '9'), (8, '16'), (16, '16'), (3, '4')]:
            with self.subTest(limit=limit, requested=requested):
                with self.assertRaises(ValueError):
                    self.budget(limit, requested)

    def test_invalid_requested_budgets_are_rejected(self):
        for requested in ['0', '-1', '', '1.5', 'eight']:
            with self.subTest(requested=requested):
                with self.assertRaises(ValueError):
                    self.budget(8, requested)

    def test_invalid_profile_budgets_are_not_coerced(self):
        for limit in [None, True, False, '8', 1.5, 0, -1]:
            with self.subTest(limit=limit):
                with self.assertRaises(ValueError):
                    self.budget(limit)


class QualificationGuardTests(unittest.TestCase):
    """Run the actual optimized entry point; only Hermes/network boundaries are fake."""

    def setUp(self):
        self.module = ModuleType('qualification_under_test')
        source = Path(qualify_behavior.__file__)
        exec(compile(source.read_text(encoding='utf-8'), str(source), 'exec', optimize=2),
             self.module.__dict__)
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.target = Path(self.directory.name) / 'preparation.json'
        self.names = ['automecanik_marketing_skills_list', 'automecanik_marketing_skill_view',
                      'automecanik_marketing_workspace']
        self.choice = SimpleNamespace(model='gpt-6-astra', provider='fixture',
                                      base_url=None, api_key=None, api_mode=None)
        self.resolve = Mock(return_value=({}, None))
        self.agent = Mock(session_id='fixture-session')
        self.agent.run_conversation.return_value = {'completed': True, 'messages': [], 'api_calls': 0}
        self.create_agent = Mock(return_value=self.agent)
        self.load_config = Mock(return_value={'agent': {'max_turns': 8, 'disabled_toolsets': []}})
        modules = {
            'hermes_bootstrap': ModuleType('hermes_bootstrap'),
            'hermes_cli': ModuleType('hermes_cli'),
            'hermes_cli.config': SimpleNamespace(load_config=self.load_config),
            'hermes_cli.oneshot': SimpleNamespace(
                _resolve_model_and_provider=lambda *args: self.choice,
                _create_session_db_for_oneshot=lambda: None, _close_agent=lambda *args: None),
            'hermes_cli.runtime_provider': SimpleNamespace(resolve_runtime_with_fallback=self.resolve),
            'hermes_constants': SimpleNamespace(resolve_reasoning_config=lambda *args: {}),
            'hermes_cli.plugins': SimpleNamespace(discover_plugins=lambda: None),
            'model_tools': SimpleNamespace(get_tool_definitions=lambda **kwargs:
                                          [{'function': {'name': name}} for name in self.names]),
            'run_agent': SimpleNamespace(AIAgent=self.create_agent),
        }
        self.enterContext(patch.dict(sys.modules, modules))
        self.enterContext(patch.dict(os.environ, {
            'HERMES_HOME': '/home/hermes/.hermes/profiles/orchestration-automecanik-pilot'
        }, clear=True))
        self.enterContext(patch.object(sys, 'argv', ['qualify_behavior.py', '.', self.directory.name, 'preparation']))
        self.enterContext(patch.object(sys, 'path', sys.path[:]))
        self.module.signal = SimpleNamespace(SIGALRM=14, signal=lambda *args: None, alarm=lambda *args: None)
        self.enterContext(contextlib.redirect_stdout(io.StringIO()))

    def test_wrong_profile_stops_before_loading_configuration(self):
        os.environ['HERMES_HOME'] = '/another-profile'
        with self.assertRaises(ValueError):
            self.module.main()
        self.load_config.assert_not_called()

    def test_yolo_mode_stops_before_loading_configuration(self):
        for value in ('1', 'true', 'TRUE'):
            with self.subTest(value=value):
                os.environ['HERMES_YOLO_MODE'] = value
                with self.assertRaises(ValueError):
                    self.module.main()
                self.load_config.assert_not_called()

    def test_unknown_case_stops_before_loading_configuration(self):
        sys.argv[-1] = 'unknown'
        with self.assertRaises(ValueError):
            self.module.main()
        self.load_config.assert_not_called()

    def test_changed_model_cannot_start_an_agent(self):
        self.choice.model = 'another-model'
        with self.assertRaises(ValueError):
            self.module.main()
        self.create_agent.assert_not_called()

    def test_extra_or_missing_tools_cannot_start_an_agent(self):
        for names in (self.names + ['terminal'], self.names[:-1]):
            with self.subTest(names=names):
                self.names = names
                with self.assertRaises(ValueError):
                    self.module.main()
                self.create_agent.assert_not_called()

    def test_a1_requires_the_candidate_executor(self):
        sys.argv[-1] = 'a1_campaign'
        with self.assertRaises(ValueError):
            self.module.main()
        self.create_agent.assert_not_called()

    def test_provider_fallback_cannot_start_an_agent(self):
        self.resolve.return_value = ({}, {'provider': 'alternate'})
        with self.assertRaises(ValueError):
            self.module.main()
        self.create_agent.assert_not_called()

    def test_existing_evidence_is_preserved_without_starting_an_agent(self):
        self.target.write_bytes(b'original evidence\n')
        with self.assertRaises(FileExistsError):
            self.module.main()
        self.assertEqual(self.target.read_bytes(), b'original evidence\n')
        self.create_agent.assert_not_called()

    def test_out_of_scope_call_is_recorded_as_failure(self):
        self.agent.run_conversation.return_value['messages'] = [
            {'tool_calls': [{'function': {'name': 'terminal'}}]}]
        with self.assertRaises(RuntimeError):
            self.module.main()
        record = json.loads(self.target.read_text())
        self.assertFalse(record['completed'])
        self.assertEqual(record['failure_type'], 'RuntimeError')
        self.assertEqual(record['tool_calls'][0]['function']['name'], 'terminal')

    def test_valid_run_keeps_its_evidence(self):
        self.module.main()
        record = json.loads(self.target.read_text())
        self.assertTrue(record['completed'])
        self.assertEqual(record['session_id'], 'fixture-session')
        self.assertEqual(record['max_iterations'], 4)

    def test_valid_a1_run_accepts_the_candidate_executor(self):
        self.names.append('automecanik_marketing_dev')
        sys.argv[-1] = 'a1_campaign'
        self.module.main()
        record = json.loads((Path(self.directory.name) / 'a1_campaign.json').read_text())
        self.assertTrue(record['completed'])
        self.assertIn('automecanik_marketing_dev', record['tool_names'])


if __name__ == '__main__':
    unittest.main()
