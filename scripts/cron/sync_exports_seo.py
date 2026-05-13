#!/usr/bin/env python3
"""
sync_exports_seo — Scheduler systemd (Type=notify) du flux exports/seo.

Référence : ADR-059 SEO Runtime Projection (accepted), Phase B PR-5b.

Orchestration périodique (cron horaire via .timer) :
  1. Fast-forward pull du wiki repo (read-only sur le canon humain)
  2. Run builder `_scripts/build_exports_seo.py` sur le wiki canon courant
     (re-génère <wiki>/exports/seo/<entity_type>/<slug>.json en place)
  3. Snapshot immutable tar.zst content-addressed via `snapshot_exports_seo.py`
  4. sd_notify READY=1 + journald structured logs

**Garde-fous stricts** :
- 0 LLM (le scheduler ne fait que orchestrer, builder gère extraction)
- 0 DB applicative (aucune écriture Supabase/Postgres dans ce script)
- 0 écriture projection DB (Phase B PR-5b ne touche jamais __seo_projection_*)
- READ_ONLY gate au processor : si `READ_ONLY=true`, skip builder + snapshot
- Écriture exclusive : wiki/exports/seo (via builder) + object-store snapshot

Usage:
    sync_exports_seo.py --wiki-root /opt/automecanik/automecanik-wiki \\
                        --object-store /opt/automecanik/object-store
    sync_exports_seo.py --skip-pull        # sauter git pull
    sync_exports_seo.py --skip-snapshot    # builder only, pas de snapshot
    READ_ONLY=true sync_exports_seo.py     # observation pure, aucune écriture
"""
from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import click

from ._sd_notify import notify_ready, notify_status, notify_stopping


def _is_read_only() -> bool:
    """Lit READ_ONLY env var (per feedback_readonly_gate_at_processor)."""
    return os.environ.get("READ_ONLY", "").lower() in {"1", "true", "yes", "on"}


def _git_fast_forward_pull(wiki_root: Path) -> tuple[bool, str]:
    """
    Tente un git pull --ff-only origin main. Retourne (success, message).
    Refuse si working tree contient des modifs (refus de merge).
    """
    try:
        result = subprocess.run(
            ["git", "-C", str(wiki_root), "pull", "--ff-only", "origin", "main"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return True, result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "up-to-date"
        return False, f"git_pull_failed: {result.stderr.strip()[:200]}"
    except Exception as exc:
        return False, f"git_pull_exception: {exc}"


def _run_builder(wiki_root: Path) -> tuple[bool, str]:
    """Subprocess invocation du builder PR-5a."""
    builder_path = wiki_root / "_scripts" / "build_exports_seo.py"
    if not builder_path.exists():
        return False, f"builder_not_found: {builder_path}"
    try:
        result = subprocess.run(
            [sys.executable, str(builder_path), "--wiki-root", str(wiki_root)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            tail = result.stdout.strip().splitlines()[-1] if result.stdout.strip() else "ok"
            return True, tail
        return False, f"builder_failed_rc={result.returncode}: {result.stderr.strip()[:200]}"
    except Exception as exc:
        return False, f"builder_exception: {exc}"


def _run_snapshot(
    exports_dir: Path,
    object_store: Path,
    wiki_root: Path,
    no_immutable: bool,
) -> tuple[bool, str]:
    """Subprocess invocation du snapshot tool."""
    script = Path(__file__).parent / "snapshot_exports_seo.py"
    cmd = [
        sys.executable,
        str(script),
        "--exports-dir", str(exports_dir),
        "--object-store", str(object_store),
        "--wiki-root", str(wiki_root),
    ]
    if no_immutable:
        cmd.append("--no-immutable")
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode == 0:
            tail = result.stdout.strip().splitlines()[0] if result.stdout.strip() else "snapshot_ok"
            return True, tail
        return False, f"snapshot_failed_rc={result.returncode}: {result.stderr.strip()[:200]}"
    except Exception as exc:
        return False, f"snapshot_exception: {exc}"


def _log_structured(level: str, event: str, **fields: object) -> None:
    """
    Émet une ligne JSON sur stdout (journald `StandardOutput=journal` la
    capture). Format compatible parseurs structurés courants.
    """
    payload: dict[str, object] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "event": event,
        "component": "sync_exports_seo",
    }
    payload.update(fields)
    import json as _json

    click.echo(_json.dumps(payload, ensure_ascii=False))


@click.command()
@click.option(
    "--wiki-root",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/automecanik-wiki"),
    show_default=True,
)
@click.option(
    "--object-store",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/object-store"),
    show_default=True,
)
@click.option("--skip-pull", is_flag=True, default=False)
@click.option("--skip-builder", is_flag=True, default=False)
@click.option("--skip-snapshot", is_flag=True, default=False)
@click.option(
    "--no-immutable",
    is_flag=True,
    default=False,
    help="Forward au snapshot tool : skip chattr +i (dev/CI sans root)",
)
def main(
    wiki_root: Path,
    object_store: Path,
    skip_pull: bool,
    skip_builder: bool,
    skip_snapshot: bool,
    no_immutable: bool,
) -> None:
    """Orchestrateur systemd : pull wiki → run builder → snapshot tar.zst."""
    read_only = _is_read_only()

    notify_status("starting sync_exports_seo")
    _log_structured(
        "info",
        "sync_start",
        wiki_root=str(wiki_root),
        object_store=str(object_store),
        read_only=read_only,
    )
    notify_ready()  # Type=notify : signal au superviseur que le processus est en main loop

    errors: list[str] = []

    # Step 1: git pull
    if read_only or skip_pull:
        _log_structured("info", "git_pull_skipped", reason="READ_ONLY" if read_only else "--skip-pull")
    else:
        ok, msg = _git_fast_forward_pull(wiki_root)
        _log_structured("info" if ok else "error", "git_pull", success=ok, message=msg)
        if not ok:
            errors.append(f"git_pull: {msg}")

    # Step 2: builder (writes wiki/exports/seo/)
    if read_only or skip_builder:
        _log_structured(
            "info",
            "builder_skipped",
            reason="READ_ONLY" if read_only else "--skip-builder",
        )
    else:
        ok, msg = _run_builder(wiki_root)
        _log_structured("info" if ok else "error", "builder", success=ok, message=msg)
        if not ok:
            errors.append(f"builder: {msg}")

    # Step 3: snapshot (writes object-store, never DB)
    exports_dir = wiki_root / "exports" / "seo"
    if skip_snapshot:
        _log_structured("info", "snapshot_skipped", reason="--skip-snapshot")
    elif not exports_dir.is_dir():
        _log_structured("warn", "snapshot_skipped", reason="exports_dir_absent", path=str(exports_dir))
    else:
        ok, msg = _run_snapshot(exports_dir, object_store, wiki_root, no_immutable)
        _log_structured("info" if ok else "error", "snapshot", success=ok, message=msg)
        if not ok:
            errors.append(f"snapshot: {msg}")

    notify_stopping()
    if errors:
        _log_structured("error", "sync_done_with_errors", errors=errors)
        sys.exit(1)
    _log_structured("info", "sync_done", status="ok")
    sys.exit(0)


if __name__ == "__main__":
    main()
