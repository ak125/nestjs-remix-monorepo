"""Offline safety tests; never require Docker or contact a server."""
import importlib.util
import io
import json
import pathlib
import tarfile
import tempfile
import unittest

SCRIPT = pathlib.Path(__file__).with_name('isolated_image.py')


class IsolatedImageTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(SCRIPT.exists(), 'Isolated build recipe is missing')
        spec = importlib.util.spec_from_file_location('isolated_image', SCRIPT)
        self.recipe = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.recipe)

    def environment(self):
        return {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted',
                'GITHUB_REPOSITORY': 'ak125/nestjs-remix-monorepo',
                'GITHUB_REF': 'refs/heads/codex/marketing-image-isolated',
                'GITHUB_SHA': 'a' * 40}

    def test_accepts_only_dedicated_hosted_target(self):
        self.recipe.validate_target(self.environment(), 'a' * 40)
        for key, value in [('RUNNER_ENVIRONMENT', 'self-hosted'),
                           ('GITHUB_REPOSITORY', 'other/repo'),
                           ('GITHUB_REF', 'refs/heads/main'),
                           ('GITHUB_SHA', 'b' * 40), ('DOCKER_HOST', 'ssh://remote')]:
            env = {**self.environment(), key: value}
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                self.recipe.validate_target(env, 'a' * 40)

    def test_refuses_low_capacity_on_either_filesystem(self):
        gib = 1024 ** 3
        self.recipe.validate_capacity({'source': 8 * gib, 'docker': 8 * gib}, 7 * gib)
        for path in ['source', 'docker']:
            with self.subTest(path=path), self.assertRaises(RuntimeError):
                self.recipe.validate_capacity({'source': 8 * gib, 'docker': 8 * gib, path: 6 * gib}, 7 * gib)

    def test_existing_attempt_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            attempt = root / 'attempt'
            attempt.mkdir()
            sentinel = attempt / 'keep.txt'
            sentinel.write_text('existing evidence')
            with self.assertRaises(RuntimeError):
                self.recipe.validate_destination(attempt, root)
            self.assertEqual(sentinel.read_text(), 'existing evidence')

    def test_output_cannot_escape_runner_temp(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            with self.assertRaises(RuntimeError):
                self.recipe.validate_destination(root.parent / 'outside', root)

    def archive(self, path, revision='a' * 40, entrypoint=None):
        config = {'architecture': 'amd64', 'os': 'linux', 'config': {
            'User': 'remix-api', 'Entrypoint': entrypoint or ['/bin/sh', './backend/start.sh'],
            'Labels': {'org.opencontainers.image.revision': revision}}}
        manifest = [{'Config': 'config.json', 'RepoTags': ['automecanik-marketing:isolated-' + 'a' * 40],
                     'Layers': ['layer.tar']}]
        with tarfile.open(path, 'w') as archive:
            for name, data in [('config.json', json.dumps(config).encode()),
                               ('manifest.json', json.dumps(manifest).encode()), ('layer.tar', b'fixture')]:
                member = tarfile.TarInfo(name)
                member.size = len(data)
                archive.addfile(member, io.BytesIO(data))

    def test_export_is_bound_to_revision_and_normal_entrypoint(self):
        with tempfile.TemporaryDirectory() as tmp:
            archive = pathlib.Path(tmp) / 'image.tar'
            self.archive(archive)
            result = self.recipe.inspect_archive(archive, 'a' * 40)
            self.assertTrue(result['image_id'].startswith('sha256:'))
            for kwargs in [{'revision': 'b' * 40}, {'entrypoint': ['/bin/sh', 'fake.sh']}]:
                self.archive(archive, **kwargs)
                with self.assertRaises(RuntimeError):
                    self.recipe.inspect_archive(archive, 'a' * 40)

    def test_monitor_stops_own_build_before_disk_exhaustion(self):
        from unittest.mock import Mock, patch
        process = Mock(pid=123, returncode=-15)
        process.poll.return_value = None
        with patch.object(self.recipe, 'disk_free', return_value={'docker': 1024}), \
                patch.object(self.recipe.os, 'killpg', create=True) as kill:
            result = self.recipe.monitor(process, ['docker'], 0)
        self.assertEqual(result, 'disk_floor')
        kill.assert_called_once_with(123, self.recipe.signal.SIGTERM)
        process.wait.assert_called_once_with(timeout=30)

    def test_monitor_stops_when_time_budget_is_exhausted(self):
        from unittest.mock import Mock, patch
        process = Mock(pid=123, returncode=-15)
        process.poll.return_value = None
        with patch.object(self.recipe, 'disk_free', return_value={'docker': 8 * 1024 ** 3}), \
                patch.object(self.recipe.time, 'monotonic', return_value=2401), \
                patch.object(self.recipe.os, 'killpg', create=True) as kill:
            self.assertEqual(self.recipe.monitor(process, ['docker'], 0), 'timeout')
        kill.assert_called_once_with(123, self.recipe.signal.SIGTERM)

    def test_main_refuses_low_disk_without_creating_resources(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            output = root / 'attempt'
            env = {**self.environment(), 'RUNNER_TEMP': str(root), 'ISOLATED_IMAGE_OUTPUT': str(output)}
            with patch.dict(self.recipe.os.environ, env, clear=True), \
                    patch.object(self.recipe, 'command', side_effect=['a' * 40, 'unix:///var/run/docker.sock', str(root)]), \
                    patch.object(self.recipe, 'disk_free', return_value={'docker': 4 * 1024 ** 3}), \
                    patch.object(self.recipe.subprocess, 'run') as run, \
                    patch.object(self.recipe.subprocess, 'Popen') as popen:
                with self.assertRaisesRegex(RuntimeError, 'Insufficient free space'):
                    self.recipe.main()
            self.assertFalse(output.exists())
            run.assert_not_called()
            popen.assert_not_called()

    def test_main_preserves_existing_builder_without_creating_output(self):
        from unittest.mock import Mock, patch
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            output = root / 'attempt'
            env = {**self.environment(), 'RUNNER_TEMP': str(root), 'ISOLATED_IMAGE_OUTPUT': str(output),
                   'GITHUB_RUN_ID': '42', 'GITHUB_RUN_ATTEMPT': '1'}
            with patch.dict(self.recipe.os.environ, env, clear=True), \
                    patch.object(self.recipe, 'command', side_effect=[
                        'a' * 40, 'unix:///var/run/docker.sock', str(root), 'b' * 40, 'b' * 40]), \
                    patch.object(self.recipe, 'disk_free', return_value={'docker': 8 * 1024 ** 3}), \
                    patch.object(self.recipe.subprocess, 'run', return_value=Mock(returncode=0)) as run, \
                    patch.object(self.recipe.subprocess, 'Popen') as popen:
                with self.assertRaisesRegex(RuntimeError, 'Existing builder'):
                    self.recipe.main()
            self.assertFalse(output.exists())
            self.assertEqual(run.call_args.args[0], ['docker', '--context', 'default', 'buildx',
                                                    'inspect', 'marketing-image-42-1'])
            popen.assert_not_called()


if __name__ == '__main__':
    unittest.main()
