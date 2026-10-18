"""Run with installed Hermes Python and source path, against a private temp profile.

Usage: python qualify_native.py HERMES_SOURCE STAGING_DIRECTORY
No model, mission, live profile modification or dependency installation.
"""
import hashlib
import json
import os
from pathlib import Path
import sys
import tarfile
import tempfile

sys.path.insert(0, sys.argv[1])
# Activate the installed dependency generation before switching to a temporary
# profile. This matches Hermes' native entry point without installing packages.
import hermes_bootstrap  # noqa: F401
stage = Path(sys.argv[2])
with tempfile.TemporaryDirectory(prefix="amk-native-") as temporary:
    root = Path(temporary)
    profile = root / "profile"
    release = root / "release"
    profile.mkdir()
    release.mkdir()
    (profile / "skills").mkdir()
    (profile / ".no-bundled-skills").touch()
    manifest = json.loads((stage / "manifest.json").read_text())
    assert hashlib.sha256((stage / "marketing-skills.tar").read_bytes()).hexdigest() == manifest["archive_sha256"]
    with tarfile.open(stage / "marketing-skills.tar") as archive:
        archive.extractall(release, filter="data")
    (release / "manifest.json").write_text(json.dumps(manifest))
    skills = release / "workspaces/marketing/.claude/skills"
    for item in manifest["files"]:
        assert hashlib.sha256((release / item["path"]).read_bytes()).hexdigest() == item["sha256"]
    (profile / "config.yaml").write_text("skills:\n  external_dirs:\n    - " + str(skills) + "\nplugins:\n  enabled: []\n")
    os.environ["HERMES_HOME"] = str(profile)
    import marketing_profile as adapter
    adapter.PROFILE, adapter.RELEASE, adapter.SKILLS = profile, release, skills
    from tools import skills_tool as native
    listed = json.loads(adapter.skills_list({}))
    assert listed["success"], listed
    assert len(listed["skills"]) == 4, listed
    reads = 0
    for item in manifest["files"]:
        relative = item["path"].split("/.claude/skills/", 1)[1]
        name, file_path = relative.split("/", 1)
        result = json.loads(adapter.skill_view({"name": name, "file_path": file_path}))
        assert result["success"], result
        assert result["sha256"] == item["sha256"]
        reads += 1
    for args in ({"name": "fafa-persona-canon"}, {"name": "alliance"}, {"name": "../config.yaml"},
                 {"name": "amk-reactivation", "file_path": "../../config.yaml"}):
        assert not json.loads(adapter.skill_view(args))["success"]
    shadow = profile / "skills/amk-reactivation"
    shadow.mkdir()
    (shadow / "SKILL.md").write_bytes((skills / "amk-reactivation/SKILL.md").read_bytes())
    assert not json.loads(adapter.skill_view({"name": "amk-reactivation"}))["success"]
    (shadow / "SKILL.md").unlink()
    shadow.rmdir()
    workspace = profile / "workspace/marketing"
    for area in adapter.AREAS:
        (workspace / area).mkdir(parents=True)
    result = json.loads(adapter.workspace({"action": "write", "path": "candidates/amk-reactivation.md", "content": "candidate", "expected_sha256": ""}))
    assert result["success"] and not result["activated"]
    result = json.loads(native.skills_list())
    assert not any("workspace/marketing/candidates" in str(skill) for skill in result["skills"])
    adapter.PROFILE = root / "wrong-profile"
    assert not json.loads(adapter.workspace({"action": "list"}))["success"]
    assert not json.loads(adapter.skills_list({}))["success"]
    print(json.dumps({"success": True, "native_skills": 4, "native_file_reads": reads,
                      "out_of_scope_denied": 4, "shadow_denied": True, "profile_denied": True,
                      "candidate_inert": True, "model_turns": 0}))
