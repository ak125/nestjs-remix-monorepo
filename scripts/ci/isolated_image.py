"""Build the existing Dockerfile on a fresh GitHub VM; export, never deploy.

Promotes the safeguards of output/marketing-image-rebuild/build.py into CI.
No Docker load, registry push, SSH, prune, or shared database access.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import tarfile
import time

GIB = 1024 ** 3
REPOSITORY = 'ak125/nestjs-remix-monorepo'
REF = 'refs/heads/codex/marketing-image-isolated'
WIKI = 'backend/content/automecanik-wiki'


def validate_target(env, revision):
    required = {'GITHUB_ACTIONS': 'true', 'RUNNER_ENVIRONMENT': 'github-hosted',
                'GITHUB_REPOSITORY': REPOSITORY, 'GITHUB_REF': REF, 'GITHUB_SHA': revision}
    if not re.fullmatch(r'[0-9a-f]{40}', revision) or any(env.get(k) != v for k, v in required.items()):
        raise RuntimeError('Only the dedicated branch on a GitHub-hosted runner is allowed')
    if any(env.get(k) for k in ['DOCKER_HOST', 'DOCKER_CONTEXT', 'BUILDX_BUILDER']):
        raise RuntimeError('Remote or overridden Docker destinations are forbidden')


def validate_destination(output, runner_temp):
    if output.exists() or output.resolve().parent != runner_temp.resolve():
        raise RuntimeError('Use a new attempt directory directly inside RUNNER_TEMP')


def disk_free(paths):
    return {str(path): shutil.disk_usage(path).free for path in paths}


def validate_capacity(capacity, minimum):
    if not capacity or min(capacity.values()) < minimum:
        raise RuntimeError('Insufficient free space; no cleanup is permitted: ' + json.dumps(capacity))


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def command(args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def git_archive(repo, revision, archive_path, destination, paths=()):
    with archive_path.open('xb') as stream:
        subprocess.run(['git', 'archive', '--format=tar', revision, *paths],
                       cwd=repo, stdout=stream, check=True)
    with tarfile.open(archive_path) as archive:
        archive.extractall(destination, filter='data')


def stop(process):
    # Only the process group started below belongs to this invocation.
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        process.wait()
        return
    try:
        process.wait(timeout=30)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait()


def monitor(process, paths, started):
    while process.poll() is None:
        reason = ('disk_floor' if min(disk_free(paths).values()) < 2 * GIB else
                  'timeout' if time.monotonic() - started > 2400 else None)
        if reason:
            stop(process)
            return reason
        time.sleep(5)
    return None


def inspect_archive(path, revision):
    # Inspect configuration without importing layers into the Docker store.
    with tarfile.open(path) as archive:
        manifest = json.load(archive.extractfile('manifest.json'))
        if len(manifest) != 1 or manifest[0].get('RepoTags') != ['automecanik-marketing:isolated-' + revision]:
            raise RuntimeError('Unexpected image manifest or tag')
        for layer in manifest[0]['Layers']:
            if not archive.getmember(layer).isfile() or archive.getmember(layer).size == 0:
                raise RuntimeError('Missing or empty image layer')
        if not manifest[0]['Layers']:
            raise RuntimeError('Image has no layers')
        raw = archive.extractfile(manifest[0]['Config']).read()
    config = json.loads(raw)
    runtime = config['config']
    if (config['architecture'] != 'amd64' or config['os'] != 'linux'
            or runtime['Labels']['org.opencontainers.image.revision'] != revision
            or runtime['Entrypoint'] != ['/bin/sh', './backend/start.sh']
            or runtime['User'] != 'remix-api'):
        raise RuntimeError('Export does not match the expected revision or runtime configuration')
    return {'image_id': 'sha256:' + hashlib.sha256(raw).hexdigest(), 'config': config}


def main():
    repo = Path.cwd()
    revision = command(['git', 'rev-parse', 'HEAD'])
    validate_target(os.environ, revision)
    runner_temp = Path(os.environ['RUNNER_TEMP'])
    output = Path(os.environ['ISOLATED_IMAGE_OUTPUT'])
    validate_destination(output, runner_temp)
    endpoint = command(['docker', 'context', 'inspect', 'default', '--format', '{{.Endpoints.docker.Host}}'])
    if endpoint != 'unix:///var/run/docker.sock':
        raise RuntimeError('Only the local hosted-runner Docker socket is allowed')
    docker_root = command(['docker', '--context', 'default', 'info', '--format', '{{.DockerRootDir}}'])
    paths = [runner_temp, Path(docker_root)]
    capacity = disk_free(paths)
    validate_capacity(capacity, 7 * GIB)
    wiki_pin = command(['git', 'rev-parse', 'HEAD:' + WIKI])
    if command(['git', 'rev-parse', 'HEAD'], repo / WIKI) != wiki_pin:
        raise RuntimeError('Wiki checkout does not match the source gitlink')
    run_id, attempt = os.environ['GITHUB_RUN_ID'], os.environ['GITHUB_RUN_ATTEMPT']
    if not run_id.isdecimal() or not attempt.isdecimal():
        raise RuntimeError('Invalid run identity')
    builder = 'marketing-image-' + run_id + '-' + attempt
    if subprocess.run(['docker', '--context', 'default', 'buildx', 'inspect', builder],
                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
        raise RuntimeError('Existing builder must be preserved; choose a new attempt')
    output.mkdir()
    evidence = output / 'evidence'
    evidence.mkdir()
    result = {'revision': revision, 'wiki_revision': wiki_pin, 'preflight_free_bytes': capacity,
              'build_exit_code': None, 'validated_export': False, 'runtime_started': False,
              'resources_deleted': False, 'builder': builder}
    started = time.monotonic()
    try:
        source = output / 'source'
        source.mkdir()
        git_archive(repo, revision, output / 'source.tar', source)
        wiki = source / WIKI
        wiki.mkdir(parents=True, exist_ok=True)
        git_archive(repo / WIKI, wiki_pin, output / 'wiki.tar', wiki,
                    ('exports', 'wiki/diagnostic', 'wiki/support'))
        result['input_sha256'] = {name: digest(output / name) for name in ['source.tar', 'wiki.tar']}
        result['dockerfile_sha256'] = digest(source / 'Dockerfile')
        validate_capacity(disk_free(paths), 7 * GIB)
        # Native Buildx docker-container driver supports tar export. Do not
        # change the selected builder and do not remove any builder/cache.
        subprocess.run(['docker', '--context', 'default', 'buildx', 'create',
                        '--name', builder, '--driver', 'docker-container', 'default'], check=True)
        image = evidence / 'image.tar'
        args = ['docker', '--context', 'default', 'buildx', 'build', '--builder', builder,
                '--platform', 'linux/amd64', '--progress=plain', '--provenance=false',
                '--build-arg', 'CACHEBUST=' + revision,
                '--label', 'org.opencontainers.image.revision=' + revision,
                '--label', 'org.opencontainers.image.source=https://github.com/' + REPOSITORY,
                '--metadata-file', str(evidence / 'build-metadata.json'),
                '--output', 'type=docker,dest=' + str(image),
                '--tag', 'automecanik-marketing:isolated-' + revision, '.']
        result['command'] = args
        with (evidence / 'build.log').open('x') as log:
            process = subprocess.Popen(args, cwd=source, stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True)
            try:
                result['stop_reason'] = monitor(process, paths, started)
            finally:
                if process.poll() is None:
                    stop(process)
            result['build_exit_code'] = process.returncode
        if result['stop_reason'] or process.returncode != 0:
            return 1
        result['inspection'] = inspect_archive(image, revision)
        result['image_sha256'] = digest(image)
        result['image_bytes'] = image.stat().st_size
        (evidence / 'image.tar.sha256').write_text(result['image_sha256'] + '  image.tar\n')
        result['validated_export'] = True
        return 0
    except Exception as error:
        result['error'] = str(error)
        raise
    finally:
        result['elapsed_seconds'] = round(time.monotonic() - started)
        (evidence / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    raise SystemExit(main())
