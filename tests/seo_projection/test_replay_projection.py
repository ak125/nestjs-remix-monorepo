"""Tests replay_projection — Hypothesis property-based + garde-fous statiques."""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest
import yaml
from hypothesis import given, settings, strategies as st

from conftest import replay


SCRIPT_PATH = (
    Path(__file__).resolve().parents[2] / "scripts" / "seo-projection" / "replay_projection.py"
)


# ────────────────────────────────────────────────────────────────────────────
# Helpers fixtures
# ────────────────────────────────────────────────────────────────────────────


def _default_manifest(full_hash: str, *, versions=None, entries=None) -> dict:
    """Manifest sidecar conforme (P2-R3-B) : snapshot_hash + 5 versions + inventaire d'entrées."""
    return {
        "schema": "seo-projection-snapshot/1",
        "snapshot_hash": full_hash,
        "tar_zst_size": 123,
        "created_from_run_id": "00000000-0000-7000-8000-000000000001",
        "wiki_commit_sha": "abcd1234" * 5,
        "versions": versions
        if versions is not None
        else {v: "1.0.0" for v in replay.REQUIRED_VERSIONS},
        "entry_count": len(entries) if entries is not None else 1,
        "entries": entries
        if entries is not None
        else [{"name": "a.json", "sha256": "a" * 64, "size": 12}],
    }


def _make_snapshot(
    tmp_path: Path, content: bytes, *, manifest: dict | None = None
) -> tuple[Path, str]:
    """Crée un fichier <hash>.tar.zst + manifest sidecar. Retourne (path, hash_full)."""
    snapshots_dir = tmp_path / "exports-snapshots"
    snapshots_dir.mkdir(parents=True, exist_ok=True)
    hex_hash = hashlib.sha256(content).hexdigest()
    full_hash = f"sha256:{hex_hash}"
    snapshot = snapshots_dir / f"{hex_hash}.tar.zst"
    snapshot.write_bytes(content)
    manifest_path = snapshots_dir / f"{hex_hash}.manifest.json"
    manifest_path.write_text(
        json.dumps(manifest if manifest is not None else _default_manifest(full_hash))
    )
    return snapshot, full_hash


def _valid_run_row(snapshot_hash: str) -> dict:
    return {
        "run_id": "00000000-0000-7000-8000-000000000001",
        "started_at": "2026-05-13T10:00:00+00:00",
        "exports_snapshot_hash": snapshot_hash,
        "exports_snapshot_uri": f"/opt/automecanik/object-store/exports-snapshots/{snapshot_hash.split(':')[1]}.tar.zst",
        "wiki_commit_sha": "abcd1234" * 5,
        "projection_contract_version": "1.0.0",
        "builder_version": "1.0.0",
        "pipeline_version": "1.0.0",
        "extractor_version": "1.0.0",
        "runner_version": "1.0.0",
        "trigger_kind": "cron",
    }


# ────────────────────────────────────────────────────────────────────────────
# Integrity checks
# ────────────────────────────────────────────────────────────────────────────


def test_sha256_strict_match(tmp_path: Path) -> None:
    snapshot, full_hash = _make_snapshot(tmp_path, b"hello world")
    ok, msg = replay.verify_snapshot_integrity(snapshot, full_hash)
    assert ok, msg


def test_sha256_mismatch_rejected(tmp_path: Path) -> None:
    snapshot, _ = _make_snapshot(tmp_path, b"hello world")
    wrong_hash = "sha256:" + "0" * 64
    ok, msg = replay.verify_snapshot_integrity(snapshot, wrong_hash)
    assert not ok
    assert "sha256_mismatch" in msg


def test_missing_snapshot_rejected(tmp_path: Path) -> None:
    ok, msg = replay.verify_snapshot_integrity(
        tmp_path / "nope.tar.zst", "sha256:" + "0" * 64
    )
    assert not ok
    assert "snapshot_missing" in msg


def test_malformed_hash_format_rejected(tmp_path: Path) -> None:
    snapshot, _ = _make_snapshot(tmp_path, b"x")
    ok, msg = replay.verify_snapshot_integrity(snapshot, "md5:deadbeef")
    assert not ok
    assert "invalid_expected_hash_format" in msg


# ────────────────────────────────────────────────────────────────────────────
# Versions check (5 required)
# ────────────────────────────────────────────────────────────────────────────


def test_versions_complete_passes() -> None:
    run = _valid_run_row("sha256:" + "a" * 64)
    ok, missing = replay.verify_versions_complete(run)
    assert ok
    assert missing == []


@pytest.mark.parametrize("field", replay.REQUIRED_VERSIONS)
def test_missing_any_version_rejects(field: str) -> None:
    run = _valid_run_row("sha256:" + "a" * 64)
    del run[field]
    ok, missing = replay.verify_versions_complete(run)
    assert not ok
    assert field in missing


@pytest.mark.parametrize("bad_version", ["", "1.0", "1.0.0-beta", "abc", "1"])
def test_invalid_semver_rejected(bad_version: str) -> None:
    run = _valid_run_row("sha256:" + "a" * 64)
    run["builder_version"] = bad_version
    ok, missing = replay.verify_versions_complete(run)
    assert not ok
    assert any("builder_version" in m for m in missing)


# ────────────────────────────────────────────────────────────────────────────
# validate_run_for_replay (integration)
# ────────────────────────────────────────────────────────────────────────────


def test_validate_run_full_success(tmp_path: Path) -> None:
    snapshot, full_hash = _make_snapshot(tmp_path, b"valid snapshot")
    run = _valid_run_row(full_hash)
    report = replay.validate_run_for_replay(run, tmp_path)
    assert report["ok"], report["errors"]
    assert report["snapshot_path"] == str(snapshot)
    assert report["snapshot_hash"] == full_hash


def test_validate_run_sha256_mismatch_marks_invalid(tmp_path: Path) -> None:
    snapshot, _ = _make_snapshot(tmp_path, b"valid snapshot")
    wrong_hash = "sha256:" + "1" * 64
    # Override snapshot file: keep wrong filename pointing at the existing path
    correct_hash_hex = snapshot.stem.replace(".tar", "")
    fake = snapshot.parent / (wrong_hash.split(":")[1] + ".tar.zst")
    fake.write_bytes(b"DIFFERENT BYTES, BIT-EXACT MISMATCH")
    run = _valid_run_row(wrong_hash)
    report = replay.validate_run_for_replay(run, tmp_path)
    assert not report["ok"]
    assert any("integrity" in e and "sha256_mismatch" in e for e in report["errors"])


# ────────────────────────────────────────────────────────────────────────────
# Manifest sidecar validation (P2-R3-B : hash + versions + entry inventory MATCH)
# ────────────────────────────────────────────────────────────────────────────


def test_manifest_valid_passes(tmp_path: Path) -> None:
    _make_snapshot(tmp_path, b"snap-ok")
    run = _valid_run_row(f"sha256:{hashlib.sha256(b'snap-ok').hexdigest()}")
    report = replay.validate_run_for_replay(run, tmp_path)
    assert report["ok"], report["errors"]


def test_manifest_missing_rejected(tmp_path: Path) -> None:
    content = b"snap-nomani"
    hex_hash = hashlib.sha256(content).hexdigest()
    snapshots_dir = tmp_path / "exports-snapshots"
    snapshots_dir.mkdir(parents=True)
    (snapshots_dir / f"{hex_hash}.tar.zst").write_bytes(content)  # no sidecar
    run = _valid_run_row(f"sha256:{hex_hash}")
    report = replay.validate_run_for_replay(run, tmp_path)
    assert not report["ok"]
    assert any("manifest_sidecar_missing" in e for e in report["errors"])


def test_manifest_hash_mismatch_rejected(tmp_path: Path) -> None:
    content = b"snap-hash"
    full_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
    bad = _default_manifest(full_hash)
    bad["snapshot_hash"] = "sha256:" + "9" * 64  # ne matche pas le run
    _make_snapshot(tmp_path, content, manifest=bad)
    report = replay.validate_run_for_replay(_valid_run_row(full_hash), tmp_path)
    assert not report["ok"]
    assert any("manifest_hash_mismatch" in e for e in report["errors"])


def test_manifest_versions_mismatch_rejected(tmp_path: Path) -> None:
    content = b"snap-ver"
    full_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
    versions = {v: "1.0.0" for v in replay.REQUIRED_VERSIONS}
    versions["builder_version"] = "9.9.9"  # diverge du run (1.0.0)
    _make_snapshot(tmp_path, content, manifest=_default_manifest(full_hash, versions=versions))
    report = replay.validate_run_for_replay(_valid_run_row(full_hash), tmp_path)
    assert not report["ok"]
    assert any("manifest_version_mismatch:builder_version" in e for e in report["errors"])


def test_manifest_entries_missing_rejected(tmp_path: Path) -> None:
    content = b"snap-noentries"
    full_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
    m = _default_manifest(full_hash)
    m["entries"] = []
    m["entry_count"] = 0
    _make_snapshot(tmp_path, content, manifest=m)
    report = replay.validate_run_for_replay(_valid_run_row(full_hash), tmp_path)
    assert not report["ok"]
    assert any("manifest_entries_missing_or_empty" in e for e in report["errors"])


def test_manifest_entry_malformed_rejected(tmp_path: Path) -> None:
    content = b"snap-badentry"
    full_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
    m = _default_manifest(
        full_hash, entries=[{"name": "a.json", "sha256": "short", "size": 1}]
    )
    _make_snapshot(tmp_path, content, manifest=m)
    report = replay.validate_run_for_replay(_valid_run_row(full_hash), tmp_path)
    assert not report["ok"]
    assert any("manifest_entry_malformed" in e for e in report["errors"])


def test_manifest_entry_count_mismatch_rejected(tmp_path: Path) -> None:
    content = b"snap-count"
    full_hash = f"sha256:{hashlib.sha256(content).hexdigest()}"
    m = _default_manifest(full_hash)
    m["entry_count"] = 5  # ≠ len(entries)=1
    _make_snapshot(tmp_path, content, manifest=m)
    report = replay.validate_run_for_replay(_valid_run_row(full_hash), tmp_path)
    assert not report["ok"]
    assert any("manifest_entry_count_mismatch" in e for e in report["errors"])


# ────────────────────────────────────────────────────────────────────────────
# Hypothesis property : sha256 determinism
# ────────────────────────────────────────────────────────────────────────────


@settings(max_examples=30, deadline=None)
@given(payload=st.binary(min_size=1, max_size=4096))
def test_sha256_property_same_content_same_hash(payload: bytes, tmp_path_factory) -> None:
    """Property : 2 snapshots avec contenu identique → même hash → tous deux validables."""
    tmp1 = tmp_path_factory.mktemp("a")
    tmp2 = tmp_path_factory.mktemp("b")
    s1, h1 = _make_snapshot(tmp1, payload)
    s2, h2 = _make_snapshot(tmp2, payload)
    assert h1 == h2
    ok1, _ = replay.verify_snapshot_integrity(s1, h1)
    ok2, _ = replay.verify_snapshot_integrity(s2, h2)
    assert ok1 and ok2


@settings(max_examples=30, deadline=None)
@given(
    payload=st.binary(min_size=1, max_size=2048),
    perturbation=st.binary(min_size=1, max_size=64),
)
def test_sha256_property_any_tamper_rejected(
    payload: bytes, perturbation: bytes, tmp_path_factory
) -> None:
    """Property : tout octet modifié → sha256 différent → REFUS."""
    if payload == perturbation:
        return  # trivial case
    tmp = tmp_path_factory.mktemp("c")
    snapshot, h = _make_snapshot(tmp, payload)
    # Tamper post-write
    snapshot.write_bytes(payload + perturbation)
    ok, msg = replay.verify_snapshot_integrity(snapshot, h)
    assert not ok
    assert "sha256_mismatch" in msg


# ────────────────────────────────────────────────────────────────────────────
# Forbidden source (anti git checkout)
# ────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "source",
    [
        "git://github.com/ak125/automecanik-wiki.git",
        "git checkout abc123",
        "git-checkout-source",
        "refs/heads/main",
        "refs/tags/v1.0.0",
        "/repo/.git/objects/...",
    ],
)
def test_git_checkout_forbidden(source: str) -> None:
    with pytest.raises(replay.GitCheckoutForbiddenError):
        replay.assert_no_git_checkout_source(source)


def test_tar_zst_path_allowed() -> None:
    # Doesn't raise
    replay.assert_no_git_checkout_source("/opt/object-store/exports-snapshots/abc.tar.zst")


# ────────────────────────────────────────────────────────────────────────────
# Manifest writer (--apply path)
# ────────────────────────────────────────────────────────────────────────────


def test_manifest_writer_refuses_outside_object_store(tmp_path: Path) -> None:
    import click

    object_store = tmp_path / "store"
    object_store.mkdir()
    bad = tmp_path / "elsewhere" / "x.yaml"
    bad.parent.mkdir()
    with pytest.raises(click.ClickException, match="under object-store"):
        replay.write_replay_manifest([], bad, object_store, "1.0.0")


def test_manifest_writer_refuses_object_store_root_directly(tmp_path: Path) -> None:
    import click

    object_store = tmp_path / "store"
    object_store.mkdir()
    bad = object_store / "x.yaml"
    with pytest.raises(click.ClickException, match="replay-queue"):
        replay.write_replay_manifest([], bad, object_store, "1.0.0")


def test_manifest_writer_writes_into_replay_queue(tmp_path: Path) -> None:
    object_store = tmp_path / "store"
    snapshot, full_hash = _make_snapshot(object_store, b"content")
    out = object_store / "replay-queue" / "replay-001.yaml"
    run = _valid_run_row(full_hash)
    report = [replay.validate_run_for_replay(run, object_store)]
    written = replay.write_replay_manifest(report, out, object_store, "1.0.0")
    assert written.exists()
    parsed = yaml.safe_load(written.read_text())
    assert parsed["target_projection_contract"] == "1.0.0"
    assert "tar.zst" in parsed["replay_authority"]
    assert "git checkout" in parsed["replay_authority"].lower()  # FORBIDDEN mention
    assert len(parsed["runs_to_replay"]) == 1
    assert parsed["runs_to_replay"][0]["trigger_kind"] == "replay"
    assert parsed["runs_to_replay"][0]["replayed_from_run_id"] == run["run_id"]


# ────────────────────────────────────────────────────────────────────────────
# Garde-fous statiques (source scan)
# ────────────────────────────────────────────────────────────────────────────


def _code_only(src: str) -> str:
    """
    Strip Python comments AND triple-quoted docstrings/string literals.

    Une mention d'un mot interdit dans une docstring/commentaire (e.g.
    "AUCUN DELETE/TRUNCATE/DROP") est légitime. Le test doit vérifier les
    appels effectifs, pas les explications textuelles.
    """
    # 1. Strip triple-quoted strings (docstrings + multi-line string consts)
    src_no_triple = re.sub(r'""".*?"""', "", src, flags=re.DOTALL)
    src_no_triple = re.sub(r"'''.*?'''", "", src_no_triple, flags=re.DOTALL)
    # 2. Strip line comments
    return "\n".join(
        line for line in src_no_triple.splitlines() if not line.strip().startswith("#")
    )


def test_no_llm_inference_imports() -> None:
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    import_patterns = [
        "import anthropic", "from anthropic",
        "import openai", "from openai",
        "import groq", "from groq",
        "import cohere", "from cohere",
        "import mistralai", "from mistralai",
        "from google.generativeai", "import google.generativeai",
    ]
    for needle in import_patterns:
        assert needle not in text, f"LLM import '{needle}' must not appear"


def test_no_destructive_sql_in_replay() -> None:
    """Replay must NEVER DELETE/TRUNCATE/DROP/REVOKE — read-only by design."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    code_only = _code_only(text)
    for needle in ("DELETE FROM", "TRUNCATE ", "DROP TABLE", "REVOKE "):
        assert needle not in code_only, f"destructive SQL '{needle}' must not appear in code"


def test_no_wiki_canon_write() -> None:
    """Refuse tout write vers wiki/<entity_type>/."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    code_only = _code_only(text)
    # No file write into wiki/<entity_type>/
    forbidden = [
        '"wiki/gamme"', '"wiki/vehicle"', '"wiki/constructeur"',
        '"wiki/support"', '"wiki/diagnostic"',
        "/automecanik-wiki/wiki/",
    ]
    for needle in forbidden:
        assert needle not in code_only, f"wiki canon write '{needle}' must not appear"


def test_no_git_checkout_invocation() -> None:
    """
    Garde-fou statique : aucun *appel* à git checkout dans le code.

    Le module DÉFINIT explicitement git checkout comme INTERDIT (listed in
    `forbidden_patterns` data list pour validation user input) — cette
    mention de données est légitime. Le test vérifie l'absence d'appel
    *effectif* via subprocess/os.system/Popen.
    """
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    code_only = _code_only(text)
    # Patterns d'invocation effective (call expressions)
    invocation_patterns = [
        r'subprocess\.run\([^)]*["\']git["\']',
        r'subprocess\.call\([^)]*["\']git["\']',
        r'subprocess\.Popen\([^)]*["\']git["\']',
        r'os\.system\([^)]*git',
    ]
    for pat in invocation_patterns:
        assert not re.search(pat, code_only), (
            f"invocation matching '{pat}' must not appear in code "
            "(replay must never call git from this script)"
        )


def test_dry_run_default_in_cli_option() -> None:
    """--dry-run is implicit (no --apply). --apply default=False."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    # The flag must default to False
    assert re.search(r'"--apply"[^)]*default=False', text), \
        "--apply must default to False (dry-run is the default behaviour)"


def test_apply_requires_manifest_out() -> None:
    """--apply without --manifest-out must raise UsageError."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "--apply requires --manifest-out" in text


def test_replay_authority_mentioned_in_module_docstring() -> None:
    """Le module documente explicitement que replay SoT = tar.zst, jamais git."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "tar.zst" in text
    assert "git checkout" in text.lower()
    # Lower-case search for the canonical phrase
    assert "forbidden" in text.lower() or "interdit" in text.lower()
