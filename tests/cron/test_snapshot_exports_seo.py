"""Tests snapshot_exports_seo — content-addressed, déterministe, idempotent."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import click
import pytest

from scripts.cron.snapshot_exports_seo import (
    _build_tarball,
    _compress_zstd,
    _enforce_object_store_path,
    create_snapshot,
)


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "cron" / "snapshot_exports_seo.py"


def _versions() -> dict[str, str]:
    return {
        "wiki_commit_sha": "0" * 40,
        "builder_version": "1.0.0",
        "pipeline_version": "1.0.0",
        "extractor_version": "1.0.0",
        "runner_version": "1.0.0",
    }


def _seed_exports(exports_dir: Path) -> None:
    """Génère 2 fichiers d'export factices."""
    exports_dir.mkdir(parents=True, exist_ok=True)
    (exports_dir / "gamme").mkdir()
    (exports_dir / "gamme" / "filtre-a-huile.json").write_text(
        json.dumps({"entity_id": "gamme:filtre-a-huile", "content_hash": "sha256:abc"}),
    )
    (exports_dir / "vehicle").mkdir()
    (exports_dir / "vehicle" / "renault-clio-3.json").write_text(
        json.dumps({"entity_id": "vehicle:renault-clio-3"}),
    )


# ---------- Determinism ----------

def test_tarball_deterministic_same_input(tmp_path: Path) -> None:
    """Même contenu source → même tarball bytes."""
    d1 = tmp_path / "exp1"
    d2 = tmp_path / "exp2"
    _seed_exports(d1)
    _seed_exports(d2)
    t1 = _build_tarball(d1)
    t2 = _build_tarball(d2)
    assert t1 == t2, "tarballs must be byte-identical for same content"


def test_compress_zstd_roundtrip(tmp_path: Path) -> None:
    """zstd compress/decompress retourne bytes identiques."""
    import subprocess

    data = b"hello world " * 1000
    compressed = _compress_zstd(data)
    decompressed = subprocess.run(
        ["zstd", "-d", "--stdout"], input=compressed, capture_output=True, check=True
    ).stdout
    assert decompressed == data


def test_content_addressed_filename(tmp_path: Path) -> None:
    """sha256(compressed) = filename."""
    exports_dir = tmp_path / "exports" / "seo"
    object_store = tmp_path / "store"
    _seed_exports(exports_dir)

    snapshot_path, status, manifest = create_snapshot(
        exports_dir, object_store, _versions(), apply_immutable=False
    )
    raw = snapshot_path.read_bytes()
    expected_hash = hashlib.sha256(raw).hexdigest()
    assert snapshot_path.name == f"{expected_hash}.tar.zst"
    assert manifest["content_hash"] == f"sha256:{expected_hash}"


# ---------- Idempotence ----------

def test_idempotent_skips_existing(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports" / "seo"
    object_store = tmp_path / "store"
    _seed_exports(exports_dir)

    p1, s1, _ = create_snapshot(exports_dir, object_store, _versions(), apply_immutable=False)
    assert s1 == "created"
    p2, s2, _ = create_snapshot(exports_dir, object_store, _versions(), apply_immutable=False)
    assert s2 == "skipped_exists"
    assert p1 == p2


def test_content_change_yields_new_hash(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports" / "seo"
    object_store = tmp_path / "store"
    _seed_exports(exports_dir)
    p1, _, _ = create_snapshot(exports_dir, object_store, _versions(), apply_immutable=False)

    # Modify content
    (exports_dir / "gamme" / "new.json").write_text('{"foo": "bar"}')

    p2, status2, _ = create_snapshot(exports_dir, object_store, _versions(), apply_immutable=False)
    assert status2 == "created"
    assert p1 != p2


# ---------- Manifest format ----------

def test_manifest_has_all_versions(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports" / "seo"
    object_store = tmp_path / "store"
    _seed_exports(exports_dir)

    _, _, manifest = create_snapshot(
        exports_dir, object_store, _versions(), apply_immutable=False
    )
    required = {
        "content_hash", "filename", "size_bytes", "uncompressed_size_bytes",
        "file_count", "exports_dir", "wiki_commit_sha",
        "builder_version", "pipeline_version", "extractor_version", "runner_version",
        "generated_at", "snapshot_tool", "snapshot_tool_version",
        "wiki_commit_authority",
    }
    missing = required - manifest.keys()
    assert not missing, f"manifest missing fields: {missing}"


def test_manifest_marks_wiki_commit_as_informational_only(tmp_path: Path) -> None:
    """Anti-replay-bug : wiki_commit_sha n'est PAS replay-authoritative."""
    exports_dir = tmp_path / "exports" / "seo"
    object_store = tmp_path / "store"
    _seed_exports(exports_dir)

    _, _, manifest = create_snapshot(
        exports_dir, object_store, _versions(), apply_immutable=False
    )
    assert "informational-only" in manifest["wiki_commit_authority"]
    assert "tar.zst" in manifest["wiki_commit_authority"]


def test_manifest_written_to_disk(tmp_path: Path) -> None:
    exports_dir = tmp_path / "exports" / "seo"
    object_store = tmp_path / "store"
    _seed_exports(exports_dir)

    snapshot_path, _, _ = create_snapshot(
        exports_dir, object_store, _versions(), apply_immutable=False
    )
    manifest_path = snapshot_path.with_suffix(".json")
    # The manifest file is at <hash>.manifest.json, not <hash>.tar.json
    expected_manifest = snapshot_path.parent / (snapshot_path.stem.replace(".tar", "") + ".manifest.json")
    assert expected_manifest.exists(), f"manifest file missing: {expected_manifest}"
    parsed = json.loads(expected_manifest.read_text())
    assert "content_hash" in parsed


# ---------- Path enforcement ----------

def test_path_refuses_outside_object_store(tmp_path: Path) -> None:
    object_store = tmp_path / "store"
    object_store.mkdir()
    bad = tmp_path / "elsewhere" / "x.tar.zst"
    bad.parent.mkdir()
    with pytest.raises(click.ClickException, match="outside object_store_root"):
        _enforce_object_store_path(bad, object_store)


def test_path_refuses_object_store_root_directly(tmp_path: Path) -> None:
    """Refuse écriture directement à la racine object_store (doit être sous exports-snapshots/)."""
    object_store = tmp_path / "store"
    object_store.mkdir()
    bad = object_store / "x.tar.zst"
    with pytest.raises(click.ClickException, match="exports-snapshots"):
        _enforce_object_store_path(bad, object_store)


def test_path_allows_exports_snapshots_subdir(tmp_path: Path) -> None:
    object_store = tmp_path / "store"
    object_store.mkdir()
    ok = object_store / "exports-snapshots" / "abc.tar.zst"
    ok.parent.mkdir()
    _enforce_object_store_path(ok, object_store)  # no exception


# ---------- Static guards ----------

def test_no_llm_inference_imports() -> None:
    """Scan import statements only (docstrings explaining the ban are allowed)."""
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
        assert needle not in text, f"LLM import '{needle}' must not appear in snapshot"


def test_no_db_application_imports() -> None:
    """Scan import statements only (docstrings explaining the ban are allowed)."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    import_patterns = [
        "import psycopg", "from psycopg",
        "import asyncpg", "from asyncpg",
        "import supabase", "from supabase",
        "import sqlalchemy", "from sqlalchemy",
        "import django", "from django",
    ]
    for needle in import_patterns:
        assert needle not in text, f"DB import '{needle}' must not appear in snapshot"


def test_no_projection_table_writes() -> None:
    """Garde-fou : aucune mention écriture des tables __seo_projection_* / __seo_entity_*."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    forbidden_tables = [
        "INSERT INTO __seo_projection",
        "INSERT INTO __seo_entity",
        "UPDATE __seo_projection",
        "UPDATE __seo_entity",
    ]
    for needle in forbidden_tables:
        assert needle not in text, (
            f"projection DB write '{needle}' must not appear in PR-5b "
            "(PR-5b prepares flux only, never DB writes — that's PR-6)"
        )
