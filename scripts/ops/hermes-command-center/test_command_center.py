import datetime as dt
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock
import urllib.error

import command_center as cc


class DigestTests(unittest.TestCase):
    def setUp(self):
        self.digest = {'schema_version':'command-center-digest.v1','generated_at':'2026-10-22T07:46:21Z',
                       'git_sha':None,'mode':'full','degraded':False,'stale_status':'STALE',
                       'global_status':{'status':'WARNING','readiness':'PARTIAL_READY'},
                       'department_reports':[{'id':f'fixture-{i}'} for i in range(24)],
                       'owner_go_actions_total':0,'owner_go_actions':[]}

    def test_existing_digest_is_preserved_without_recomputing(self):
        self.assertEqual(cc.validate_digest(self.digest), self.digest)
        self.assertEqual(self.digest['stale_status'], 'STALE')
        self.assertEqual(len(self.digest['department_reports']), 24)

    def test_light_and_degraded_are_preserved(self):
        for mode in ('light', 'full'):
            d = {**self.digest, 'mode': mode, 'degraded': True, 'department_reports': []}
            self.assertEqual(cc.validate_digest(d), d)

    def test_unrecognized_payloads_fail_closed(self):
        for d in ({}, [], {**self.digest, 'schema_version': 'v-next'},
                  {**self.digest, 'degraded': 'false'}, {**self.digest, 'mode': 'disabled'},
                  {**self.digest, 'generated_at': 'yesterday'}, {**self.digest, 'extra': 'secret'}):
            with self.subTest(d=d):
                with self.assertRaises(ValueError): cc.validate_digest(d)

    def test_fetch_is_fixed_get_without_proxies_or_redirects(self):
        raw = json.dumps(self.digest).encode()
        response = Mock(status=200)
        response.read.return_value = raw
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=None)
        opener = Mock()
        opener.open.return_value = response
        with patch.object(cc, 'load_key', return_value='test-secret'), patch.object(cc.urllib.request, 'build_opener', return_value=opener) as build:
            packet = cc.fetch_digest()
        req = opener.open.call_args.args[0]
        self.assertEqual(req.full_url, 'http://127.0.0.1:3000/api/internal/command-center/digest')
        self.assertEqual(req.method, 'GET')
        self.assertIsNone(req.data)
        self.assertEqual(build.call_args.args[0].proxies, {})
        self.assertIsInstance(build.call_args.args[1], cc.NoRedirect)
        opener.open.assert_called_once()
        self.assertEqual(packet['digest'], self.digest)
        self.assertNotIn('test-secret', json.dumps(packet))

    def test_http_and_size_errors_are_unavailable_without_retry(self):
        for error in (urllib.error.HTTPError('url', 401, 'secret detail', {}, io.BytesIO(b'secret')),
                      TimeoutError('secret detail'), ValueError('secret detail')):
            with patch.object(cc, 'load_key', return_value='test-secret'), patch.object(cc.urllib.request, 'build_opener') as build:
                build.return_value.open.side_effect = error
                result = cc.fetch_digest()
                build.return_value.open.assert_called_once()
                self.assertEqual(result['status'], 'unavailable')
                self.assertNotIn('secret', json.dumps(result))
        with self.assertRaises(ValueError): cc.parse_digest(b'x' * (cc.MAX_BYTES + 1))

    def test_redirect_is_denied(self):
        self.assertIsNone(cc.NoRedirect().redirect_request(None, None, 302, '', {}, 'http://elsewhere'))

    def test_transport_failure_replaces_old_success(self):
        with tempfile.TemporaryDirectory() as t:
            out = Path(t) / 'snapshot.json'
            out.write_text('{"status":"ok"}')
            with patch.object(cc.subprocess, 'run', side_effect=cc.subprocess.TimeoutExpired('ssh', 25)) as run:
                cc.collect(['/usr/bin/ssh', 'host', 'automecanik-supervision-v1'], out, 30)
            run.assert_called_once()
            self.assertEqual(run.call_args.args[0][-1], 'automecanik-command-center-v1')
            self.assertEqual(json.loads(out.read_text())['status'], 'unavailable')

    def test_transport_packet_validation(self):
        packet = {'status':'ok','observed_at':cc.now(), 'source':cc.SOURCE, 'digest':self.digest}
        cc.validate_packet(packet)
        for bad in ({**packet, 'observed_at':'2020-01-01T00:00:00Z'},
                    {**packet, 'source':'PROD'}, {**packet, 'extra':'secret'},
                    {'status':'unavailable','reason':'secret','observed_at':cc.now(),'source':cc.SOURCE}):
            with self.assertRaises(ValueError): cc.validate_packet(bad)

    def test_reader_scopes_actions_and_profile(self):
        with patch.object(cc, 'current_profile', return_value='/other'):
            self.assertEqual(json.loads(cc.submit({'action':'digest'}))['status'], 'rejected')
        with patch.object(cc, 'current_profile', return_value=cc.PROFILE):
            for args in ({'action':'refresh'}, {'action':'digest','url':'any'}, None):
                self.assertEqual(json.loads(cc.submit(args))['status'], 'rejected')

    def test_reader_distinguishes_collection_and_business_freshness(self):
        with tempfile.TemporaryDirectory() as t:
            out = Path(t)/'snapshot.json'
            packet = {'status':'ok','source':cc.SOURCE,'observed_at':cc.now(), 'collected_at':cc.now(), 'cadence_minutes':30, 'digest':self.digest}
            with patch.object(cc, 'SNAPSHOT', out), patch.object(cc, 'current_profile', return_value=cc.PROFILE):
                out.write_text(json.dumps(packet))
                d = json.loads(cc.submit({'action':'digest'}))
                self.assertEqual(d['collection_freshness'], 'current')
                self.assertEqual(d['digest'], self.digest)
                packet['collected_at']='2020-01-01T00:00:00Z'
                out.write_text(json.dumps(packet))
                self.assertEqual(json.loads(cc.submit({'action':'digest'}))['collection_freshness'],'stale')
                out.unlink()
                out.symlink_to(Path(t)/'outside')
                self.assertEqual(json.loads(cc.submit({'action':'digest'}))['status'],'unavailable')


if __name__ == '__main__': unittest.main()
