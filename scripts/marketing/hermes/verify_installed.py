"""Bounded installed-profile proof, including one labelled synthetic report write."""
import hashlib
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, sys.argv[1])
import hermes_bootstrap  # noqa: F401
from hermes_cli.plugins import discover_plugins
from tools.registry import registry

discover_plugins()
prefix = "automecanik_marketing_"
def call(name, args):
    return json.loads(registry.dispatch(prefix + name, args))

listed = call("skills_list", {})
assert listed["success"] and len(listed["skills"]) == 4, listed
read_count = 0
for skill in listed["skills"]:
    result = call("skill_view", {"name": skill["name"]})
    assert result["success"], result
    source = Path(result["source_path"])
    assert hashlib.sha256(source.read_bytes()).hexdigest() == result["sha256"]
    for path in (source, *source.parents):
        assert not os.access(path, os.W_OK), str(path)
    try:
        descriptor = os.open(source, os.O_WRONLY | os.O_APPEND)
    except PermissionError:
        pass
    else:
        os.close(descriptor)
        raise AssertionError("hermes can open active skill for writing")
    read_count += 1
for args in ({"action": "write", "path": "../config.yaml", "content": "bad", "expected_sha256": ""},
             {"action": "delete", "path": "reports/qualification-20261003.json"}):
    assert not call("workspace", args)["success"]
before = json.loads(Path('/tmp/amk-marketing-tools-before-20261003.json').read_text())
after = json.loads(Path('/tmp/amk-marketing-tools-after-20261003.json').read_text())
expected = {prefix + name for name in ('skills_list', 'skill_view', 'workspace')}
for surface in before:
    assert set(after[surface]) - set(before[surface]) == expected
    assert set(before[surface]) <= set(after[surface])
    assert not {'skill_manage', 'terminal', 'write_file', 'execute_code'} & set(after[surface])
report = {"fixture": "synthetic-installation-check", "success": True, "native_skills": read_count,
          "active_sources_writable": False, "new_tools_per_surface": 3,
          "surfaces": sorted(before), "model_turns": 0, "application_executions": 0}
path = 'reports/qualification-20261003.json'
previous = call('workspace', {'action': 'read', 'path': path})
written = call('workspace', {'action': 'write', 'path': path, 'content': json.dumps(report, indent=2),
                             'expected_sha256': previous.get('sha256', '')})
assert written['success'] and not written['activated'], written
read = call('workspace', {'action': 'read', 'path': path})
assert json.loads(read['content']) == report
print(json.dumps(report))
