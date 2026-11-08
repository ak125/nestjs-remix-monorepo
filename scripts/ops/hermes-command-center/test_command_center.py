import datetime as dt
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch, Mock
import urllib.error

import command_center as cc
import install


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
        self.assertEqual(req.get_header('X-command-center-key'), 'test-secret')
        self.assertIsNone(req.get_header('X-internal-key'))
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

    def test_degraded_source_is_recorded_without_failing_the_unit(self):
        with tempfile.TemporaryDirectory() as t:
            config, out = Path(t) / 'config.json', Path(t) / 'snapshot.json'
            config.write_text(json.dumps({'ssh_command': ['/usr/bin/ssh', 'host', 'automecanik-supervision-v1'],
                                          'cadence_minutes': 30}))
            with patch.object(cc, 'CONFIG', config), patch.object(cc.subprocess, 'run', side_effect=OSError('secret')):
                packet = cc.collect_from_config(out)
            self.assertEqual(packet['reason'], 'digest_transport_unavailable')
            self.assertEqual(json.loads(out.read_text())['status'], 'unavailable')

    def test_invalid_configuration_replaces_old_success_and_fails_the_unit(self):
        valid = {'ssh_command': ['/usr/bin/ssh', 'host', 'automecanik-supervision-v1'], 'cadence_minutes': 30}
        for config_text in (None, 'not json', '{}', json.dumps({**valid, 'cadence_minutes': 0}),
                            json.dumps({**valid, 'ssh_command': ['/bin/sh', '-c', 'any']})):
            with self.subTest(config_text=config_text), tempfile.TemporaryDirectory() as t:
                config, out = Path(t) / 'config.json', Path(t) / 'snapshot.json'
                if config_text is not None: config.write_text(config_text)
                out.write_text(json.dumps({'status': 'ok', 'source': cc.SOURCE, 'observed_at': cc.now(),
                    'collected_at': cc.now(), 'cadence_minutes': 30, 'digest': self.digest}))
                with patch.object(cc, 'CONFIG', config), patch.object(cc.subprocess, 'run') as run:
                    with self.assertRaisesRegex(SystemExit, '^collector_config_unavailable$'):
                        cc.collect_from_config(out)
                run.assert_not_called()
                with patch.object(cc, 'SNAPSHOT', out), patch.object(cc, 'current_profile', return_value=cc.PROFILE):
                    seen = json.loads(cc.submit({'action': 'digest'}))
                self.assertEqual((seen['status'], seen['reason'], seen['collection_freshness']),
                                 ('unavailable', 'collector_config_unavailable', 'current'))

    def test_unwritable_snapshot_fails_the_unit(self):
        with tempfile.TemporaryDirectory() as t:
            config = Path(t) / 'config.json'
            config.write_text(json.dumps({'ssh_command': ['/usr/bin/ssh', 'host', 'automecanik-supervision-v1'],
                                          'cadence_minutes': 30}))
            target = Path(t) / 'missing' / 'snapshot.json'
            for current in (config, Path(t) / 'no-config.json'):
                with self.subTest(config=current), patch.object(cc, 'CONFIG', current), \
                        patch.object(cc.subprocess, 'run', side_effect=OSError('secret')):
                    with self.assertRaisesRegex(SystemExit, '^snapshot_write_failed$'):
                        cc.collect_from_config(target)

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


class KeyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.key = Path(self.tmp.name) / 'digest.key'
        self.value = 'ab' * 32
        ctx = patch.object(cc, 'KEY', self.key)
        ctx.start(); self.addCleanup(ctx.stop)

    def write(self, text, mode=0o600):
        self.key.write_text(text)
        self.key.chmod(mode)

    def test_reads_only_the_dedicated_owner_only_file(self):
        self.write(self.value + '\n')
        self.assertEqual(cc.load_key(), self.value)
        source = Path(cc.__file__).read_text()
        self.assertNotIn('INTERNAL_API_KEY=', source)
        self.assertNotIn('backend/.env', source.replace('never backend/.env', ''))

    def test_unsafe_or_malformed_key_fails_closed(self):
        for text, mode in ((self.value, 0o640), (self.value, 0o604), ('', 0o600),
                           (self.value[:-1], 0o600), (self.value.upper(), 0o600), (self.value + 'ab', 0o600),
                           (self.value + '\n\nab', 0o600), (' ' + self.value, 0o600)):
            with self.subTest(mode=oct(mode), size=len(text)):
                self.write(text, mode)
                with self.assertRaises(ValueError): cc.load_key()

    def test_missing_or_linked_key_fails_closed(self):
        with self.assertRaises(OSError): cc.load_key()
        target = Path(self.tmp.name) / 'elsewhere'
        target.write_text(self.value); target.chmod(0o600)
        self.key.symlink_to(target)
        with self.assertRaises(OSError): cc.load_key()

    def test_unreadable_key_is_unavailable_without_request(self):
        with patch.object(cc.urllib.request, 'build_opener') as build:
            packet = cc.fetch_digest()
        build.return_value.open.assert_not_called()
        self.assertEqual((packet['status'], packet['reason']), ('unavailable', 'digest_fetch_failed'))


class InstallTests(unittest.TestCase):
    ANCHOR = '# Fixed read-only aggregate collector, no caller arguments.\n'

    def install_dev(self, root, commit):
        export = root/'export'
        export.mkdir(exist_ok=True)
        source = b'# collector ' + commit.encode() + b'\n'
        (export/'command_center.py').write_bytes(source)
        (export/'source.json').write_text(json.dumps({'commit':commit,'command_center_sha256':install.hashlib.sha256(source).hexdigest()}))
        with patch.object(install, 'HERE', export), patch.object(install, 'BACKUP_ROOT', root/'backup'), \
                patch.object(install, 'DEV_RELEASE', root/'release'), patch.object(install, 'ENDPOINT', root/'endpoint.py'), \
                patch.object(install.os, 'getuid', return_value=0), patch.object(install.os, 'chown'), \
                patch('sys.stdout', io.StringIO()):
            install.main('dev')
        return source

    def test_upgrade_keeps_the_previous_release_under_its_own_backup(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root/'endpoint.py').write_text('import os\n' + self.ANCHOR)
            first = self.install_dev(root, 'a'*40)
            installed_source = (root/'release/source.json').read_bytes()
            second = self.install_dev(root, 'b'*40)
            self.assertEqual((root/'release/command_center.py').read_bytes(), second)
            kept = install.saved(root/'release/command_center.py', root/'backup'/('b'*40))
            self.assertEqual(kept.read_bytes(), first)
            self.assertEqual(install.saved(root/'release/source.json', root/'backup'/('b'*40)).read_bytes(), installed_source)
            self.install_dev(root, 'b'*40)
            self.assertEqual((root/'endpoint.py').read_text().count('automecanik-command-center-v1'), 1)

    def test_conflicting_backup_refuses_before_any_write(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            (root/'endpoint.py').write_text('import os\n' + self.ANCHOR)
            first = self.install_dev(root, 'a'*40)
            stale = install.saved(root/'release/source.json', root/'backup'/('b'*40))
            stale.parent.mkdir(parents=True)
            stale.write_text('older release')
            with self.assertRaisesRegex(ValueError, '^install_refused_before_write:'):
                self.install_dev(root, 'b'*40)
            self.assertEqual((root/'release/command_center.py').read_bytes(), first)
            self.assertFalse(install.saved(root/'release/command_center.py', root/'backup'/('b'*40)).exists())

    def test_source_commit_must_be_a_full_sha(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaisesRegex(ValueError, '^source_commit_invalid$'):
                self.install_dev(Path(t), '../20261022')


if __name__ == '__main__': unittest.main()
