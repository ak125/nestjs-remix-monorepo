"""AutoMecanik profile adapter: native skill reads and inert preparation files.

Linux only. No model, subprocess, network, promotion or application execution.
The active release and this module are installed root-owned. Profile loading is
checked per call because Hermes can multiplex several profiles in one process.
"""
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import uuid

COMMIT = "a221cf164b198978f2abf83788cf47212124c272"
PROFILE = Path("/home/hermes/.hermes/profiles/orchestration-automecanik-pilot")
RELEASE = Path("/opt/codex-project-tools/automecanik-marketing-skills-" + COMMIT)
SKILLS = RELEASE / "workspaces/marketing/.claude/skills"
AREAS = ("drafts", "reports", "candidates")
MAX_BYTES = 131072


def encode(value):
    return json.dumps(value, ensure_ascii=False)


def digest(data):
    return hashlib.sha256(data).hexdigest()


@contextmanager
def directory(path, parent=None):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
    try:
        yield fd
    finally:
        os.close(fd)


def read_file(parent, name):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > MAX_BYTES:
            raise ValueError("Only bounded regular files with one link are allowed")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            data = stream.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            raise ValueError("File exceeds size limit")
        return data
    finally:
        os.close(fd)


class Workspace:
    def __init__(self, root):
        self.root = Path(root)

    def handle(self, args, **kwargs):
        try:
            return encode(self.execute(args))
        except (OSError, ValueError, TypeError, KeyError) as error:
            return encode({"success": False, "error": str(error)})

    def execute(self, args):
        action = args.get("action")
        with directory(self.root) as root:
            if action == "list":
                files = []
                for area in AREAS:
                    with directory(area, root) as parent:
                        for name in sorted(os.listdir(parent)):
                            info = os.stat(name, dir_fd=parent, follow_symlinks=False)
                            if stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not name.startswith("."):
                                files.append(area + "/" + name)
                                if len(files) >= 200:
                                    return {"success": True, "files": files, "truncated": True}
                return {"success": True, "files": files, "truncated": False}
            if action not in ("read", "write"):
                raise ValueError("Allowed actions: list, read, write")
            path = args.get("path", "")
            if not isinstance(path, str) or not re.fullmatch(
                r"(drafts|reports|candidates)/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.(md|txt|json|csv|html)", path
            ):
                raise ValueError("Use one filename in drafts, reports or candidates")
            area, name = path.split("/")
            with directory(area, root) as parent:
                if action == "read":
                    data = read_file(parent, name)
                    return {"success": True, "path": path, "content": data.decode("utf-8"), "sha256": digest(data), "activated": False}
                content = args.get("content")
                expected = args.get("expected_sha256")
                if not isinstance(content, str) or len(content.encode("utf-8")) > MAX_BYTES:
                    raise ValueError("UTF-8 text limited to 128 KiB")
                if not isinstance(expected, str) or (expected and not re.fullmatch(r"[a-f0-9]{64}", expected)):
                    raise ValueError("expected_sha256 required; empty only for a new file")
                lock = os.open(".write.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600, dir_fd=root)
                try:
                    if os.fstat(lock).st_nlink != 1 or not stat.S_ISREG(os.fstat(lock).st_mode):
                        raise ValueError("Invalid workspace lock")
                    fcntl.flock(lock, fcntl.LOCK_EX)
                    try:
                        previous = digest(read_file(parent, name))
                    except FileNotFoundError:
                        previous = ""
                    if previous != expected:
                        raise ValueError("Revision conflict; read the current file before writing")
                    temp = ".pending-" + uuid.uuid4().hex
                    data = content.encode("utf-8")
                    fd = os.open(temp, os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW, 0o600, dir_fd=parent)
                    try:
                        with os.fdopen(fd, "wb") as stream:
                            stream.write(data)
                            stream.flush()
                            os.fsync(stream.fileno())
                        os.replace(temp, name, src_dir_fd=parent, dst_dir_fd=parent)
                        os.fsync(parent)
                    finally:
                        try:
                            os.unlink(temp, dir_fd=parent)
                        except FileNotFoundError:
                            pass
                finally:
                    os.close(lock)
                return {"success": True, "path": path, "sha256": digest(data), "activated": False}


def active_profile():
    from hermes_constants import get_hermes_home
    if get_hermes_home().resolve() != PROFILE:
        raise ValueError("This tool belongs to the AutoMecanik pilot profile")


def skill_view(args, **kwargs):
    try:
        active_profile()
        import hermes_yaml as yaml
        from tools import skills_tool as native
        manifest = json.loads((RELEASE / "manifest.json").read_text())
        records = {item["path"].removeprefix("workspaces/marketing/.claude/skills/"): item for item in manifest["files"]}
        name = args.get("name")
        relative = args.get("file_path", "SKILL.md")
        key = str(name) + "/" + str(relative)
        if key not in records or str(name) + "/SKILL.md" not in records:
            raise ValueError("Unknown marketing skill or reference")
        project, all_dirs, _ = native._skill_search_dirs()
        error, _, selected = native._locate_skill(name, None, project, all_dirs)
        expected = SKILLS / name / "SKILL.md"
        if error is not None or selected is None or selected.resolve() != expected:
            raise ValueError("Active skill source is missing or shadowed")
        for checked in (str(name) + "/SKILL.md", key):
            target = SKILLS / checked
            if target.resolve() != target or digest(target.read_bytes()) != records[checked]["sha256"]:
                raise ValueError("Active skill provenance mismatch")
        source = expected.read_text(encoding="utf-8")
        frontmatter = yaml.safe_load(source.split("---", 2)[1])
        if frontmatter.get("deps"):
            raise ValueError("Automatic dependency installation is not allowed")
        result = json.loads(native.skill_view(name, file_path=None if relative == "SKILL.md" else relative, preprocess=False))
        if not result.get("success"):
            raise ValueError("Native skill read failed")
        return encode({"success": True, "name": name, "file_path": relative, "content": result["content"],
                       "description": result.get("description", ""), "source_commit": COMMIT,
                       "sha256": records[key]["sha256"], "source_path": str(SKILLS / key)})
    except (OSError, ValueError, TypeError, KeyError, IndexError) as error:
        return encode({"success": False, "error": str(error)})


def skills_list(args, **kwargs):
    try:
        active_profile()
        from tools.skills_tool import skills_list as native_list
        native = json.loads(native_list())
        if not native.get("success"):
            raise ValueError("Native discovery failed")
        manifest = json.loads((RELEASE / "manifest.json").read_text())
        names = sorted(Path(item["path"]).parent.name for item in manifest["files"] if item["path"].endswith("/SKILL.md"))
        found = {item["name"] for item in native["skills"]}
        result = []
        for name in names:
            view = json.loads(skill_view({"name": name}))
            if name not in found or not view.get("success"):
                raise ValueError("Marketing discovery or provenance failed: " + name)
            result.append({key: view[key] for key in ("name", "description", "sha256", "source_path")})
        return encode({"success": True, "skills": result, "source_commit": COMMIT})
    except (OSError, ValueError, TypeError, KeyError) as error:
        return encode({"success": False, "error": str(error)})


def workspace(args, **kwargs):
    try:
        active_profile()
        return Workspace(PROFILE / "workspace/marketing").handle(args)
    except ValueError as error:
        return encode({"success": False, "error": str(error)})


def register(ctx):
    active_profile()
    specs = [
        ("automecanik_marketing_skills_list", "List the four verified AutoMecanik marketing skills. No execution.", {}, [], skills_list),
        ("automecanik_marketing_skill_view", "Read a verified marketing skill or its versioned reference, without preprocessing or execution.",
         {"name": {"type": "string"}, "file_path": {"type": "string", "default": "SKILL.md"}}, ["name"], skill_view),
        ("automecanik_marketing_workspace", "Prepare inert marketing drafts, reports and skill proposals. Never activates a skill or sends content. Read before revising; supply its SHA-256, or empty expected_sha256 for a new file.",
         {"action": {"type": "string", "enum": ["list", "read", "write"]}, "path": {"type": "string"},
          "content": {"type": "string"}, "expected_sha256": {"type": "string"}}, ["action"], workspace),
    ]
    for name, description, properties, required, handler in specs:
        schema = {"name": name, "description": description, "parameters": {"type": "object", "properties": properties, "required": required, "additionalProperties": False}}
        ctx.register_tool(name=name, toolset="automecanik_marketing", schema=schema, handler=handler, description=description)
