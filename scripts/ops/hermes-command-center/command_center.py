"""Read the existing DEV digest through the supervision transport. No business rules.

DEV: fixed GET and local credential. Hermes collector: one fixed SSH request.
Hermes plugin: bounded local snapshot only. No retries or external messages.
"""
import datetime as dt
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

MAX_BYTES = 131072
SOURCE = 'DEV localhost:3000 /api/internal/command-center/digest'
PROFILE = '/home/hermes/.hermes/profiles/orchestration-automecanik-pilot'
SNAPSHOT = Path('/var/lib/automecanik-supervisor/command-center.json')
CONFIG = Path('/etc/automecanik-supervisor/config.json')
# Digest-only key (the backend keeps its SHA-256): never INTERNAL_API_KEY, never backend/.env.
KEY = Path('/home/deploy/.config/automecanik-command-center/digest.key')
COMMAND = 'automecanik-command-center-v1'
CADENCE = 30
REASONS = {'digest_http_unavailable', 'digest_fetch_failed', 'digest_transport_unavailable',
           'collector_config_unavailable'}
KEYS = {'schema_version', 'generated_at', 'git_sha', 'mode', 'degraded',
        'stale_status', 'global_status', 'department_reports', 'owner_go_actions_total', 'owner_go_actions'}


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def age(value):
    if not isinstance(value, str):
        raise ValueError('timestamp')
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('timestamp_timezone')
    return (dt.datetime.now(dt.timezone.utc) - parsed).total_seconds()


def validate_digest(data):
    # Validate the transport envelope, without duplicating the registry's business schema.
    if not isinstance(data, dict) or set(data) != KEYS:
        raise ValueError('digest_envelope')
    if (data['schema_version'] != 'command-center-digest.v1'
            or data['mode'] not in ('full', 'light') or type(data['degraded']) is not bool
            or not isinstance(data['stale_status'], str)
            or not isinstance(data['global_status'], dict)
            or not isinstance(data['department_reports'], list)
            or not all(isinstance(x, dict) for x in data['department_reports'])
            or not isinstance(data['owner_go_actions'], list)
            or type(data['owner_go_actions_total']) is not int
            or data['owner_go_actions_total'] < 0
            or data['git_sha'] is not None and not isinstance(data['git_sha'], str)):
        raise ValueError('digest_contract')
    age(data['generated_at'])
    return data


def parse_digest(raw):
    if len(raw) > MAX_BYTES:
        raise ValueError('digest_size')
    return validate_digest(json.loads(raw))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def load_key():
    # Owner-only regular file holding 64 hex characters; anything else fails closed.
    fd = os.open(KEY, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError('credential_unavailable')
        raw = handle.read(66)
    if not re.fullmatch(rb'[0-9a-f]{64}\n?', raw):
        raise ValueError('credential_unavailable')
    return raw[:64].decode('ascii')


def unavailable(reason):
    return {'status': 'unavailable', 'reason': reason, 'observed_at': now(), 'source': SOURCE}


def fetch_digest():
    try:
        request = urllib.request.Request('http://127.0.0.1:3000/api/internal/command-center/digest',
                                         headers={'X-Command-Center-Key': load_key(), 'Accept': 'application/json'}, method='GET')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
        with opener.open(request, timeout=15) as response:
            if response.status != 200:
                raise ValueError('http_status')
            data = parse_digest(response.read(MAX_BYTES + 1))
        return {'status': 'ok', 'observed_at': now(), 'source': SOURCE, 'digest': data}
    except urllib.error.HTTPError as error:
        # Status code is safe; no response body, header or exception message is exported.
        return {**unavailable('digest_http_unavailable'), 'http_status': error.code}
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        return unavailable('digest_fetch_failed')


def validate_packet(packet, fresh=True):
    if not isinstance(packet, dict) or packet.get('source') != SOURCE:
        raise ValueError('packet_source')
    elapsed = age(packet.get('observed_at'))
    if fresh and not -60 <= elapsed <= 120:
        raise ValueError('transport_freshness')
    if packet.get('status') == 'ok':
        if set(packet) != {'status', 'observed_at', 'source', 'digest'}:
            raise ValueError('packet_envelope')
        validate_digest(packet['digest'])
    elif packet.get('status') == 'unavailable':
        if (not {'status', 'reason', 'observed_at', 'source'} <= set(packet)
                or set(packet) - {'status', 'reason', 'observed_at', 'source', 'http_status'}
                or packet.get('reason') not in REASONS):
            raise ValueError('packet_error')
        if 'http_status' in packet and (type(packet['http_status']) is not int or not 100 <= packet['http_status'] <= 599):
            raise ValueError('http_status')
    else:
        raise ValueError('packet_status')
    return packet


def atomic(path, data):
    fd, temporary = tempfile.mkstemp(prefix='.command-center-', dir=path.parent)
    try:
        os.fchmod(fd, 0o640)
        with os.fdopen(fd, 'w') as handle:
            json.dump(data, handle, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


def supervision_contract(command, cadence):
    if (not isinstance(command, list) or not all(isinstance(x, str) for x in command)
            or not command or command[0] != '/usr/bin/ssh' or command[-1] != 'automecanik-supervision-v1'
            or type(cadence) is not int or not 1 <= cadence <= 1440):
        raise ValueError('supervision_contract')


def record(destination, packet, cadence):
    packet.update(collected_at=now(), cadence_minutes=cadence)
    atomic(destination, packet)
    return packet


def collect(command, destination=SNAPSHOT, cadence=CADENCE):
    try:
        supervision_contract(command, cadence)
        # The forced endpoint and HTTP reader cap output. No shell or caller arguments.
        result = subprocess.run([*command[:-1], COMMAND], input=b'', capture_output=True, timeout=25, check=True)
        if len(result.stdout) > MAX_BYTES + 2048:
            raise ValueError('packet_size')
        packet = validate_packet(json.loads(result.stdout))
    except (OSError, ValueError, KeyError, TypeError, RecursionError, subprocess.SubprocessError):
        packet = unavailable('digest_transport_unavailable')
    return record(destination, packet, cadence)


def collect_from_config(destination=SNAPSHOT):
    # ExecStartPost of the supervisor. A degraded DEV source or transport is
    # recorded for Hermes and exits 0. A collector defect exits 1 so the unit
    # shows it: invalid configuration (also recorded) or unwritable snapshot.
    try:
        config = json.loads(CONFIG.read_text())
        command, cadence = config['ssh_command'], config['cadence_minutes']
        supervision_contract(command, cadence)
    except (OSError, ValueError, KeyError, TypeError, RecursionError):
        command = None
    try:
        if command is None:
            record(destination, unavailable('collector_config_unavailable'), CADENCE)
            raise SystemExit('collector_config_unavailable')
        return collect(command, destination, cadence)
    except OSError:
        raise SystemExit('snapshot_write_failed')


def current_profile():
    from hermes_constants import get_hermes_home
    return str(get_hermes_home().resolve())


def submit(arguments, **_):
    if arguments != {'action': 'digest'} or current_profile() != PROFILE:
        return json.dumps({'status': 'rejected', 'reason': 'profile_or_action_denied'})
    try:
        fd = os.open(SNAPSHOT, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, 'rb') as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
                raise ValueError('snapshot_file')
            raw = handle.read(MAX_BYTES + 4097)
        if len(raw) > MAX_BYTES + 4096:
            raise ValueError('snapshot_size')
        data = json.loads(raw)
        collected = data.pop('collected_at')
        cadence = data.pop('cadence_minutes')
        if type(cadence) is not int or not 1 <= cadence <= 1440:
            raise ValueError('snapshot_cadence')
        validate_packet(data, fresh=False)
        elapsed = age(collected)
        data.update(collected_at=collected, cadence_minutes=cadence,
                    collection_age_seconds=max(0, int(elapsed)),
                    collection_freshness='current' if -60 <= elapsed <= 2 * cadence * 60 + 180 else 'stale')
        return json.dumps(data, ensure_ascii=False)
    except (OSError, ValueError, TypeError, KeyError, RecursionError):
        return json.dumps({'status': 'unavailable', 'reason': 'digest_snapshot_unavailable'})


SCHEMA = {
    'name': 'automecanik_command_center',
    'description': 'Lire le digest existant du Command Center AutoMecanik sur DEV. Snapshot collecte par le superviseur toutes les 30 minutes. Conserver collection_freshness ET digest.stale_status, mode, degraded, dates et git_sha. Les rapports des 24 roles ne certifient pas leur fonctionnement metier. Aucun rafraichissement, calcul, decision, mission ou ecriture.',
    'parameters': {'type': 'object', 'properties': {'action': {'type': 'string', 'enum': ['digest']}}, 'required': ['action'], 'additionalProperties': False},
}


def register(ctx):
    if current_profile() != PROFILE:
        raise ValueError('profile_denied')
    ctx.register_tool(name=SCHEMA['name'], toolset='codex_diagnostics', schema=SCHEMA, handler=submit, description=SCHEMA['description'])


if __name__ == '__main__':
    if sys.argv[1:] == ['--dev-read']:
        print(json.dumps(fetch_digest(), ensure_ascii=False))
    elif sys.argv[1:] == ['--collect']:
        result = collect_from_config()
        print(json.dumps({k: result[k] for k in ('status', 'observed_at', 'collected_at')}))
    else:
        raise SystemExit('arguments_denied')
