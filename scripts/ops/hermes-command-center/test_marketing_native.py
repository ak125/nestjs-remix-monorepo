"""Run with the actual pinned Hermes runtime, no model or business writes."""
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

PROFILE='/home/hermes/.hermes/profiles/orchestration-automecanik-pilot'
os.environ['HERMES_HOME']=PROFILE
sys.path.insert(0,'/home/hermes/.hermes/hermes-agent')
import hermes_bootstrap
from tools import skills_tool as native

spec=importlib.util.spec_from_file_location('marketing_under_test',os.environ['MARKETING_MODULE'])
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class MarketingNativeTests(unittest.TestCase):
    def test_real_discovery_and_reads(self):
        listing=json.loads(m.skills_list({}))
        self.assertTrue(listing.get('success'), listing)
        self.assertEqual(len(listing['skills']),4)
        for skill in listing['skills']:
            result=json.loads(m.skill_view({'name':skill['name']}))
            self.assertTrue(result.get('success'),result)
            self.assertEqual(result['sha256'],skill['sha256'])
            self.assertTrue(result['content'])

    def test_wrong_profile_refused(self):
        with patch('hermes_constants.get_hermes_home',return_value=Path('/tmp/other')):
            self.assertFalse(json.loads(m.skills_list({}))['success'])

    def test_shadowed_source_refused(self):
        with patch.object(native,'locate_skill',return_value=(None,None,Path('/tmp/shadow/SKILL.md'))):
            self.assertFalse(json.loads(m.skill_view({'name':'amk-marketing-operations'}))['success'])

    def test_unlisted_reference_refused(self):
        self.assertFalse(json.loads(m.skill_view({'name':'amk-marketing-operations','file_path':'../../config.yaml'}))['success'])

    def test_native_failure_refused(self):
        with patch.object(native,'skill_view',return_value='{"success":false}'):
            self.assertFalse(json.loads(m.skill_view({'name':'amk-marketing-operations'}))['success'])

    def test_hash_mismatch_refused(self):
        with patch.object(m,'digest',return_value='changed'):
            self.assertFalse(json.loads(m.skill_view({'name':'amk-marketing-operations'}))['success'])


if __name__=='__main__': unittest.main()
