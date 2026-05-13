"""Tests sync_exports_seo — orchestrator, READ_ONLY gate, garde-fous statiques."""
from __future__ import annotations

import os
from pathlib import Path
from unittest.mock import patch

import pytest
from click.testing import CliRunner

from scripts.cron.sync_exports_seo import _is_read_only, main


SCRIPT_PATH = Path(__file__).resolve().parents[2] / "scripts" / "cron" / "sync_exports_seo.py"


# ---------- READ_ONLY gate at processor ----------

def test_read_only_default_false() -> None:
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("READ_ONLY", None)
        assert _is_read_only() is False


def test_read_only_true_values() -> None:
    for val in ["true", "TRUE", "1", "yes", "on", "True"]:
        with patch.dict(os.environ, {"READ_ONLY": val}):
            assert _is_read_only() is True, f"value {val!r} should be truthy"


def test_read_only_false_values() -> None:
    for val in ["false", "0", "no", "", "off"]:
        with patch.dict(os.environ, {"READ_ONLY": val}):
            assert _is_read_only() is False, f"value {val!r} should be falsy"


# ---------- Static guards ----------

def test_no_llm_inference_imports_in_sync() -> None:
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
        assert needle not in text, f"LLM import '{needle}' must not appear in sync"


def test_no_db_application_imports_in_sync() -> None:
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
        assert needle not in text, f"DB import '{needle}' must not appear in sync"


def test_no_projection_table_writes_in_sync() -> None:
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    forbidden_tables = [
        "INSERT INTO __seo_projection",
        "INSERT INTO __seo_entity",
        "UPDATE __seo_projection",
        "UPDATE __seo_entity",
        "REFRESH MATERIALIZED VIEW",
    ]
    for needle in forbidden_tables:
        assert needle not in text, (
            f"projection DB write '{needle}' must not appear in PR-5b sync "
            "(scope: flux only, no DB)"
        )


def test_sync_imports_sd_notify_native_not_python_systemd() -> None:
    """Garde-fou : on utilise notre sd_notify natif, pas la dep `python-systemd`."""
    text = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "from ._sd_notify" in text, "sync must import native _sd_notify"
    assert "import systemd" not in text, "must NOT depend on python-systemd package"
    assert "from systemd" not in text, "must NOT depend on python-systemd package"


# ---------- READ_ONLY end-to-end behavior ----------

def test_read_only_skips_pull_and_builder(tmp_path: Path) -> None:
    """READ_ONLY=true doit skip git pull et builder (et garder snapshot non lancé si exports_dir absent)."""
    wiki_root = tmp_path / "wiki"
    wiki_root.mkdir()
    object_store = tmp_path / "store"
    object_store.mkdir()

    runner = CliRunner()
    with patch.dict(os.environ, {"READ_ONLY": "true"}):
        result = runner.invoke(
            main,
            [
                "--wiki-root", str(wiki_root),
                "--object-store", str(object_store),
                "--no-immutable",
            ],
            catch_exceptions=False,
        )
    # exports_dir absent → snapshot_skipped event, mais pas d'erreur
    assert "git_pull_skipped" in result.output
    assert "builder_skipped" in result.output
    # Reason must be READ_ONLY
    assert '"reason": "READ_ONLY"' in result.output


def test_skip_flags_independent(tmp_path: Path) -> None:
    """--skip-pull / --skip-builder / --skip-snapshot doivent fonctionner indépendamment."""
    wiki_root = tmp_path / "wiki"
    wiki_root.mkdir()
    object_store = tmp_path / "store"
    object_store.mkdir()

    runner = CliRunner()
    with patch.dict(os.environ, {}, clear=False):
        os.environ.pop("READ_ONLY", None)
        result = runner.invoke(
            main,
            [
                "--wiki-root", str(wiki_root),
                "--object-store", str(object_store),
                "--skip-pull",
                "--skip-builder",
                "--skip-snapshot",
                "--no-immutable",
            ],
            catch_exceptions=False,
        )
    assert '"reason": "--skip-pull"' in result.output
    assert '"reason": "--skip-builder"' in result.output
    assert '"reason": "--skip-snapshot"' in result.output
    assert result.exit_code == 0


# ---------- systemd unit files presence ----------

def test_systemd_service_file_exists() -> None:
    unit = SCRIPT_PATH.parent / "sync-exports-seo.service"
    assert unit.exists(), "systemd .service unit missing"
    text = unit.read_text(encoding="utf-8")
    assert "Type=notify" in text, "Type=notify required for sd_notify integration"
    assert "WatchdogSec=" in text
    assert "ReadWritePaths=" in text, "hardening: limit writable paths"


def test_systemd_timer_file_exists() -> None:
    unit = SCRIPT_PATH.parent / "sync-exports-seo.timer"
    assert unit.exists(), "systemd .timer unit missing"
    text = unit.read_text(encoding="utf-8")
    assert "OnCalendar=hourly" in text
    assert "RandomizedDelaySec=" in text, "spread load across instances"
    assert "Persistent=true" in text, "catch up missed runs after downtime"
