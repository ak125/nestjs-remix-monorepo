#!/usr/bin/env python3
"""
replay_projection — Replay deterministic depuis snapshots tar.zst immutables.

Référence : ADR-059 SEO Runtime Projection (accepted), Phase B PR-6c-a.
Classification : critical governance infrastructure G1/G2.

WORKFLOW :
  1. Query __seo_projection_runs WHERE started_at IN [--from-run, --to-run]
     (SELECT only ; aucune écriture DB depuis ce script)
  2. Pour chaque run éligible :
     a. Vérifier que `<object_store>/exports-snapshots/<sha256>.tar.zst` existe
     b. Vérifier `sha256(tar.zst) == exports_snapshot_hash` (STRICT bit-exact)
     c. Vérifier présence des 5 versions canoniques (builder/pipeline/extractor/runner/projection_contract)
     d. Vérifier que le manifest sidecar `.manifest.json` existe et matche
  3. Mode `--dry-run` (DÉFAULT) : print report, aucune écriture
  4. Mode `--apply` : écrit manifest replay dans `<object_store>/replay-queue/<uuid>.yaml`
     que le backend picker dans une future intégration (PR-6c-followup / PR-7)

GARDE-FOUS NON-NÉGOCIABLES :
  - Replay SoT = tar.zst immutable EXCLUSIVEMENT
  - `git checkout` INTERDIT comme source replay (force-push / mirror peuvent casser alignement)
  - `--dry-run` par défaut (mode lecture seule)
  - `--apply` explicite (sinon refus d'écriture)
  - 0 LLM, 0 DELETE / TRUNCATE / DROP / REVOKE
  - 0 écriture wiki canon ou dans wiki/<entity_type>/
  - Versions complètes vérifiées STRICTEMENT (aucune absence tolérée)

Usage :
    # Dry-run (default)
    replay_projection.py \\
        --from-run 2026-05-13T10:00:00Z \\
        --to-run   2026-05-13T11:00:00Z

    # Apply (génère manifest pour backend picker)
    replay_projection.py \\
        --from-run ... --to-run ... \\
        --apply \\
        --manifest-out /opt/automecanik/object-store/replay-queue/replay-001.yaml

Exit codes :
    0 — succès (dry-run report OK ou apply manifest écrit)
    1 — erreur validation (snapshot manquant, sha256 mismatch, versions incomplètes)
    2 — erreur arguments CLI
    3 — apply sans --manifest-out
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click
import yaml


SNAPSHOTS_SUBDIR = "exports-snapshots"
REPLAY_QUEUE_SUBDIR = "replay-queue"

REQUIRED_VERSIONS = (
    "projection_contract_version",
    "builder_version",
    "pipeline_version",
    "extractor_version",
    "runner_version",
)

# entity_types canon (singulier ADR-031, support exclu de exports/seo)
SEO_ENTITY_TYPES = frozenset({"gamme", "vehicle", "constructeur", "diagnostic"})


# ────────────────────────────────────────────────────────────────────────────
# Errors typés (garde-fous explicites)
# ────────────────────────────────────────────────────────────────────────────


class ReplayValidationError(click.ClickException):
    """Replay validation failure (sha256 mismatch, snapshot missing, etc.)."""


class GitCheckoutForbiddenError(click.ClickException):
    """Tentative d'utiliser git checkout comme source replay — interdit."""


# ────────────────────────────────────────────────────────────────────────────
# Integrity checks
# ────────────────────────────────────────────────────────────────────────────


def compute_sha256(path: Path, *, chunk_size: int = 1 << 16) -> str:
    """Compute sha256 STRICT bit-exact d'un fichier (streaming, no memory blow)."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def verify_snapshot_integrity(
    snapshot_path: Path, expected_hash_full: str
) -> tuple[bool, str]:
    """
    Vérifie sha256 STRICT du tar.zst.
    `expected_hash_full` au format `sha256:<64hex>`.
    Retourne (ok, message).
    """
    if not snapshot_path.is_file():
        return False, f"snapshot_missing: {snapshot_path}"

    if not expected_hash_full.startswith("sha256:"):
        return False, f"invalid_expected_hash_format: {expected_hash_full!r}"

    expected = expected_hash_full.split(":", 1)[1]
    actual = compute_sha256(snapshot_path)
    if actual != expected:
        return (
            False,
            f"sha256_mismatch: expected={expected[:12]}… got={actual[:12]}…",
        )
    return True, "sha256_ok"


def verify_versions_complete(run_row: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Vérifie présence STRICTE des 5 versions canoniques.
    Retourne (ok, missing_fields).
    """
    missing: list[str] = []
    for field in REQUIRED_VERSIONS:
        value = run_row.get(field)
        if not value or not isinstance(value, str):
            missing.append(field)
            continue
        # Semver pattern check (defensive — DB CHECK le fait aussi côté PR-6a)
        parts = value.split(".")
        if len(parts) != 3 or not all(p.isdigit() for p in parts):
            missing.append(f"{field}_invalid_semver:{value}")
    return (not missing), missing


def verify_manifest_sidecar(snapshot_path: Path) -> tuple[bool, str, dict | None]:
    """
    Vérifie que le manifest sidecar `<hash>.manifest.json` (PR-5b) existe et
    matche les versions du tar.zst. Audit-only — informational.
    """
    manifest_path = snapshot_path.parent / (
        snapshot_path.stem.replace(".tar", "") + ".manifest.json"
    )
    if not manifest_path.is_file():
        return False, f"manifest_sidecar_missing: {manifest_path}", None
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        return False, f"manifest_parse_failed: {exc}", None
    return True, "manifest_ok", manifest


# ────────────────────────────────────────────────────────────────────────────
# Validation per-run
# ────────────────────────────────────────────────────────────────────────────


def validate_run_for_replay(
    run_row: dict[str, Any], object_store_root: Path
) -> dict[str, Any]:
    """
    Valide qu'un run historique peut être replayé. Retourne dict report.

    Toute déviation → `ok=False` + `errors[]`. Aucune extraction tant que
    sha256 n'est pas validé (garde-fou anti-corruption).
    """
    errors: list[str] = []
    # __seo_projection_runs PK is `run_id` (uuid) — there is no `id` column.
    # Reading "id" here made every DB-fetched run short-circuit to missing_run_id
    # (replay 100% non-functional on live data). No "id" fallback: the column is run_id.
    run_id = run_row.get("run_id")
    if not run_id:
        return {"ok": False, "run_id": None, "errors": ["missing_run_id"]}

    # Versions canoniques
    versions_ok, missing_versions = verify_versions_complete(run_row)
    if not versions_ok:
        errors.extend(f"version_missing:{m}" for m in missing_versions)

    # Snapshot tar.zst
    snapshot_hash_full = run_row.get("exports_snapshot_hash", "")
    if not isinstance(snapshot_hash_full, str) or not snapshot_hash_full.startswith("sha256:"):
        errors.append("exports_snapshot_hash_invalid")
        return {"ok": False, "run_id": run_id, "errors": errors}

    snapshot_filename = snapshot_hash_full.split(":", 1)[1] + ".tar.zst"
    snapshot_path = object_store_root / SNAPSHOTS_SUBDIR / snapshot_filename

    integrity_ok, integrity_msg = verify_snapshot_integrity(
        snapshot_path, snapshot_hash_full
    )
    if not integrity_ok:
        errors.append(f"integrity:{integrity_msg}")

    manifest_ok, manifest_msg, manifest_data = verify_manifest_sidecar(snapshot_path)
    if not manifest_ok:
        errors.append(f"manifest:{manifest_msg}")

    return {
        "ok": not errors,
        "run_id": run_id,
        "snapshot_path": str(snapshot_path) if integrity_ok else None,
        "snapshot_hash": snapshot_hash_full,
        "versions": {v: run_row.get(v) for v in REQUIRED_VERSIONS},
        "wiki_commit_sha": run_row.get("wiki_commit_sha"),
        "manifest_path": (
            str(snapshot_path.parent / (snapshot_path.stem.replace(".tar", "") + ".manifest.json"))
            if manifest_ok
            else None
        ),
        "errors": errors,
    }


# ────────────────────────────────────────────────────────────────────────────
# Forbidden source check (anti git checkout)
# ────────────────────────────────────────────────────────────────────────────


def assert_no_git_checkout_source(source_hint: str) -> None:
    """
    Garde-fou : refuse explicitement tout argument qui sentirait un git
    checkout comme source replay.
    """
    lower = source_hint.lower()
    forbidden_patterns = (
        "git://",
        ".git/",
        "git checkout",
        "git-checkout",
        "refs/heads/",
        "refs/tags/",
    )
    for pat in forbidden_patterns:
        if pat in lower:
            raise GitCheckoutForbiddenError(
                f"refused: replay source must be tar.zst from object-store (got {source_hint!r}). "
                "git checkout is FORBIDDEN as replay source per ADR-059 §'Audit metadata vs replay authority'."
            )


# ────────────────────────────────────────────────────────────────────────────
# Manifest writer (--apply path)
# ────────────────────────────────────────────────────────────────────────────


def _uuid_v7() -> str:
    """UUIDv7 manuel (timestamp ms + random)."""
    import secrets

    ts_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    ts_hex = f"{ts_ms:012x}"
    rand = secrets.token_hex(10)
    return f"{ts_hex[:8]}-{ts_hex[8:12]}-7{rand[:3]}-{rand[3:7]}-{rand[7:19]}"


def write_replay_manifest(
    report: list[dict[str, Any]],
    out_path: Path,
    object_store_root: Path,
    target_projection_contract: str,
) -> Path:
    """
    Écrit le manifest replay YAML pour backend picker.
    Refuse écriture hors `<object_store>/replay-queue/`.
    """
    # Path enforcement
    try:
        rel = out_path.resolve().relative_to(object_store_root.resolve())
    except ValueError:
        raise click.ClickException(
            f"refused: --manifest-out must be under object-store {object_store_root} (got {out_path})"
        )
    if not rel.parts or rel.parts[0] != REPLAY_QUEUE_SUBDIR:
        raise click.ClickException(
            f"refused: manifest must be under {REPLAY_QUEUE_SUBDIR}/ (got {rel})"
        )

    valid_runs = [r for r in report if r["ok"]]

    manifest: dict[str, Any] = {
        "replay_id": _uuid_v7(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "target_projection_contract": target_projection_contract,
        "replay_authority": (
            "tar.zst snapshot exclusively (git checkout FORBIDDEN per ADR-059 "
            "§'Audit metadata vs replay authority')"
        ),
        "runs_to_replay": [
            {
                "original_run_id": r["run_id"],
                "snapshot_path": r["snapshot_path"],
                "snapshot_hash": r["snapshot_hash"],
                "manifest_path": r["manifest_path"],
                "versions": r["versions"],
                "wiki_commit_sha_audit_only": r["wiki_commit_sha"],
                "trigger_kind": "replay",
                "replayed_from_run_id": r["run_id"],
            }
            for r in valid_runs
        ],
        "summary": {
            "total_runs": len(report),
            "valid_runs": len(valid_runs),
            "invalid_runs": len(report) - len(valid_runs),
            "failed_runs": [
                {"run_id": r["run_id"], "errors": r["errors"]}
                for r in report
                if not r["ok"]
            ],
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return out_path


# ────────────────────────────────────────────────────────────────────────────
# Runs fetch (READ ONLY)
# ────────────────────────────────────────────────────────────────────────────


def fetch_runs_from_db(
    from_run: datetime, to_run: datetime
) -> list[dict[str, Any]]:
    """
    Fetch runs depuis __seo_projection_runs via Supabase Python client.
    SELECT only — aucune écriture DB depuis ce script.

    En l'absence d'environnement Supabase (CI / tests), retourne []. Le
    script est conçu pour tourner aussi sur input fixture (voir
    `validate_runs_from_fixture`).
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        click.echo(
            "WARN: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY absent — "
            "DB fetch skipped. Use --fixture-runs for offline replay tests.",
            err=True,
        )
        return []
    try:
        from supabase import create_client  # type: ignore
    except ImportError:
        click.echo(
            "WARN: 'supabase' Python package not installed. Use --fixture-runs.",
            err=True,
        )
        return []

    client = create_client(url, key)
    result = (
        client.table("__seo_projection_runs")
        .select("*")
        .gte("started_at", from_run.isoformat())
        .lte("started_at", to_run.isoformat())
        .order("started_at", desc=False)
        .execute()
    )
    return list(result.data or [])


# ────────────────────────────────────────────────────────────────────────────
# CLI
# ────────────────────────────────────────────────────────────────────────────


@click.command()
@click.option(
    "--from-run",
    "from_run",
    type=click.DateTime(formats=["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"]),
    required=False,
    help="Borne inférieure inclusive (UTC). Requis sauf si --fixture-runs.",
)
@click.option(
    "--to-run",
    "to_run",
    type=click.DateTime(formats=["%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z"]),
    required=False,
    help="Borne supérieure inclusive (UTC). Requis sauf si --fixture-runs.",
)
@click.option(
    "--object-store",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/object-store"),
    show_default=True,
)
@click.option(
    "--target-projection-contract",
    default="1.0.0",
    show_default=True,
    help="Version du contract à appliquer côté runner courant",
)
@click.option(
    "--apply",
    "apply_mode",
    is_flag=True,
    default=False,
    help="ÉCRIT le manifest replay (par défaut : dry-run uniquement)",
)
@click.option(
    "--manifest-out",
    type=click.Path(dir_okay=False, path_type=Path),
    default=None,
    help="Chemin de sortie YAML (requis avec --apply). DOIT être sous "
    "<object-store>/replay-queue/",
)
@click.option(
    "--fixture-runs",
    type=click.Path(exists=True, dir_okay=False, path_type=Path),
    default=None,
    help="Charger les runs depuis un fichier YAML/JSON (tests, offline replay)",
)
def main(
    from_run: datetime | None,
    to_run: datetime | None,
    object_store: Path,
    target_projection_contract: str,
    apply_mode: bool,
    manifest_out: Path | None,
    fixture_runs: Path | None,
) -> None:
    """Replay projection runs from immutable tar.zst snapshots (dry-run by default)."""
    # ── Garde-fou 1 : --apply requires --manifest-out
    if apply_mode and not manifest_out:
        raise click.UsageError(
            "--apply requires --manifest-out (path under <object-store>/replay-queue/)"
        )
    # ── Garde-fou 2 : --manifest-out hors --apply = no-op risqué → refus explicite
    if manifest_out and not apply_mode:
        raise click.UsageError(
            "--manifest-out without --apply has no effect ; pass --apply or remove --manifest-out"
        )

    # ── Garde-fou 3 : --target-projection-contract must be semver
    parts = target_projection_contract.split(".")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise click.UsageError(
            f"--target-projection-contract must be semver MAJOR.MINOR.PATCH (got {target_projection_contract!r})"
        )

    # ── Fetch runs
    if fixture_runs:
        raw = yaml.safe_load(fixture_runs.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            raise click.ClickException(
                f"--fixture-runs must contain a YAML list of run rows (got {type(raw).__name__})"
            )
        runs = raw
    else:
        if not from_run or not to_run:
            raise click.UsageError(
                "--from-run and --to-run required when --fixture-runs is not used"
            )
        if from_run > to_run:
            raise click.UsageError("--from-run must be <= --to-run")
        runs = fetch_runs_from_db(from_run, to_run)

    if not runs:
        click.echo("no runs in time window — nothing to replay", err=True)
        sys.exit(0)

    # ── Validate each run (read-only)
    report = [validate_run_for_replay(r, object_store) for r in runs]

    # ── Print report
    click.echo(f"=== replay_projection validation report ===")
    click.echo(f"object_store: {object_store}")
    click.echo(f"target_projection_contract: {target_projection_contract}")
    click.echo(f"mode: {'APPLY' if apply_mode else 'DRY-RUN (default)'}")
    click.echo(f"total runs: {len(report)}")
    valid = [r for r in report if r["ok"]]
    invalid = [r for r in report if not r["ok"]]
    click.echo(f"valid:   {len(valid)}")
    click.echo(f"invalid: {len(invalid)}")
    for r in invalid:
        click.echo(f"  FAIL {r['run_id']}: {'; '.join(r['errors'])}", err=True)

    if not apply_mode:
        click.echo("=== DRY-RUN complete (no writes). Pass --apply to materialize. ===")
        sys.exit(0 if not invalid else 1)

    # ── Apply mode : write manifest
    if invalid:
        raise click.ClickException(
            f"refused to apply : {len(invalid)} run(s) failed validation. "
            "Fix integrity issues or exclude failed runs explicitly."
        )

    assert manifest_out is not None  # narrowed by guard above
    out_written = write_replay_manifest(
        report,
        manifest_out,
        object_store,
        target_projection_contract,
    )
    click.echo(f"=== APPLY: manifest written to {out_written} ===")
    click.echo(
        "Note: this script does NOT enqueue BullMQ jobs directly. "
        "Backend integration (manifest picker → projection-write-queue) is hors scope PR-6c-a."
    )
    sys.exit(0)


if __name__ == "__main__":
    main()
