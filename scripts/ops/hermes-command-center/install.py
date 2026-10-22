"""Explicit operator installation on DEV or Hermes only; run from reviewed export as root.

Backups retain original ownership/modes. No service restart or application mutation.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
BACKUP = Path('/var/lib/automecanik-command-center-install/20261022')
DEV_RELEASE = Path('/opt/automecanik-command-center/1.0.0')
HERMES_RELEASE = Path('/opt/codex-project-tools/automecanik-command-center-1.0.0')
PLUGIN = Path('/home/hermes/.hermes/profiles/orchestration-automecanik-pilot/plugins/codex-automecanik-control/__init__.py')
ENDPOINT = Path('/home/deploy/.local/lib/hermes-codex/automecanik-transport-0.1.0/endpoint.py')
MARKETING_COMMIT = 'a2c7f773c47372d86b28ced1648cfe731219a0a5'
MARKETING_RELEASE = Path('/opt/codex-project-tools/automecanik-marketing-profile-1.0.3')
DROPIN = Path('/etc/systemd/system/automecanik-supervisor.service.d/70-command-center.conf')


def write(path, data, mode=0o644):
    raw = data.encode() if isinstance(data, str) else data
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_bytes() == raw: return
    owner = (0, 0)
    if path.exists():
        info = path.stat()
        owner = (info.st_uid, info.st_gid)
        mode = info.st_mode & 0o777
        backup = BACKUP / str(path).lstrip('/')
        backup.parent.mkdir(parents=True, exist_ok=True)
        if backup.exists(): raise ValueError('backup_already_exists_for_different_content')
        shutil.copy2(path, backup)
        os.chown(backup, *owner)
    temporary = path.with_name(path.name + '.installing')
    with temporary.open('xb') as handle:
        handle.write(raw)
        handle.flush()
        os.fsync(handle.fileno())
    os.chown(temporary, *owner)
    os.chmod(temporary, mode)
    os.replace(temporary, path)


def main(target):
    if os.getuid() != 0: raise ValueError('root_required_for_install_only')
    source = (HERE/'command_center.py').read_bytes()
    manifest = json.loads((HERE/'source.json').read_text())
    if hashlib.sha256(source).hexdigest() != manifest['command_center_sha256']:
        raise ValueError('source_hash_mismatch')
    if target == 'dev':
        text = ENDPOINT.read_text()
        anchor = '# Fixed read-only aggregate collector, no caller arguments.\n'
        insertion = ("# Fixed Command Center digest GET; no caller URL, key or arguments.\n"
                     "if os.environ.get('SSH_ORIGINAL_COMMAND') == 'automecanik-command-center-v1':\n"
                     "    os.execv('/usr/bin/python3', ['/usr/bin/python3', '-I', '-B', '/opt/automecanik-command-center/1.0.0/command_center.py', '--dev-read'])\n\n")
        if insertion not in text:
            if text.count(anchor) != 1: raise ValueError('endpoint_anchor_changed')
            text = text.replace(anchor, insertion + anchor, 1)
        compile(text, str(ENDPOINT), 'exec')
        write(DEV_RELEASE/'command_center.py', source)
        write(DEV_RELEASE/'source.json', (HERE/'source.json').read_bytes())
        write(ENDPOINT, text)
    elif target == 'hermes':
        text = PLUGIN.read_text()
        old = "sys.path.insert(0, '/opt/codex-project-tools/automecanik-marketing-profile-1.0.2')\nfrom marketing_profile_v1_0_2 import register as register_marketing"
        new = "sys.path.insert(0, '/opt/codex-project-tools/automecanik-marketing-profile-1.0.3')\nfrom marketing_profile_v1_0_3 import register as register_marketing"
        if new not in text:
            if text.count(old) != 1: raise ValueError('marketing_entry_changed')
            text = text.replace(old, new, 1)
        extension = "\n# Existing DEV Command Center digest, collected by the read-only supervisor.\nsys.path.insert(0, '/opt/codex-project-tools/automecanik-command-center-1.0.0')\nfrom command_center_v1 import register as register_command_center\n_register_before_command_center = register\ndef register(ctx):\n    _register_before_command_center(ctx)\n    register_command_center(ctx)\n"
        if extension not in text: text += extension
        compile(text, str(PLUGIN), 'exec')
        marketing = (HERE/'marketing_profile.py').read_bytes()
        if hashlib.sha256(marketing).hexdigest() != manifest['marketing_sha256']:
            raise ValueError('marketing_hash_mismatch')
        write(HERMES_RELEASE/'command_center_v1.py', source)
        write(HERMES_RELEASE/'source.json', (HERE/'source.json').read_bytes())
        write(MARKETING_RELEASE/'marketing_profile_v1_0_3.py', marketing)
        write(MARKETING_RELEASE/'source.json', json.dumps({'commit':MARKETING_COMMIT,'path':'scripts/marketing/hermes/marketing_profile.py','sha256':manifest['marketing_sha256']}))
        write(DROPIN, '[Service]\nExecStartPost=/usr/bin/python3 -I -B /opt/codex-project-tools/automecanik-command-center-1.0.0/command_center_v1.py --collect\n')
        write(PLUGIN, text)
    else: raise ValueError('target_denied')
    print(json.dumps({'target':target,'installed':True,'backup':str(BACKUP),'source':manifest}))


if __name__ == '__main__':
    if len(sys.argv) != 2: raise SystemExit('target_required')
    main(sys.argv[1])
