#!/usr/bin/env python3
"""
snapshot_exports_seo — tar.zst content-addressed immutable snapshot.

Référence : ADR-059 SEO Runtime Projection (accepted), Phase B PR-5b.

Snapshot canonique de `<wiki>/exports/seo/` vers object-store local :

    <object_store>/exports-snapshots/<sha256>.tar.zst
    <object_store>/exports-snapshots/<sha256>.manifest.json

- **Content-addressed** : filename = sha256(tarball compressé). Idempotent natif.
- **Immutable** : `chattr +i` appliqué post-write (skip silencieux si non-root).
- **Manifest** : versions complètes (builder/pipeline/extractor/runner) +
  `wiki_commit_sha` (informational-only, pas replay-authoritative — replay
  utilise UNIQUEMENT le tar.zst).

Garde-fous :
- 0 LLM (aucun import LLM SDK)
- 0 DB applicative (aucun import Supabase/postgres/asyncpg/sqlalchemy)
- Écriture exclusive sous `<object_store>/exports-snapshots/` (enforcement strict)

Usage:
    snapshot_exports_seo.py --exports-dir /opt/automecanik/automecanik-wiki/exports/seo \\
                            --object-store /opt/automecanik/object-store \\
                            --builder-version 1.0.0 \\
                            --pipeline-version 1.0.0 \\
                            --extractor-version 1.0.0 \\
                            --runner-version 1.0.0
"""
from __future__ import annotations

import hashlib
import io
import json
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click


SNAPSHOTS_SUBDIR = "exports-snapshots"


def _wiki_commit_sha(wiki_root: Path) -> str:
    """Récupère HEAD commit du wiki repo (informational-only metadata)."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=wiki_root,
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout.strip()
    except Exception:
        return "0" * 40


def _enforce_object_store_path(out_path: Path, object_store_root: Path) -> None:
    """
    GARDE-FOU : refuse toute écriture hors `<object_store_root>/exports-snapshots/`.

    Toute tentative ailleurs (e.g. wiki repo, monorepo, /etc, /var) déclenche
    ClickException.
    """
    try:
        rel = out_path.resolve().relative_to(object_store_root.resolve())
    except ValueError:
        raise click.ClickException(
            f"refused: output path {out_path} is outside object_store_root {object_store_root}"
        )
    if not rel.parts or rel.parts[0] != SNAPSHOTS_SUBDIR:
        raise click.ClickException(
            f"refused: snapshot writes only to {SNAPSHOTS_SUBDIR}/, got {rel}"
        )


def _build_tarball(exports_dir: Path) -> bytes:
    """
    Construit un tar déterministe (sorted names, mtime fixe) du contenu de
    exports_dir. Déterminisme = même contenu source → même tarball bytes.
    """
    buf = io.BytesIO()
    files = sorted(p for p in exports_dir.rglob("*") if p.is_file())
    # Use a fixed timestamp for reproducibility (epoch 0)
    fixed_mtime = 0
    with tarfile.open(fileobj=buf, mode="w", format=tarfile.PAX_FORMAT) as tar:
        for f in files:
            arcname = f.relative_to(exports_dir).as_posix()
            info = tar.gettarinfo(name=str(f), arcname=arcname)
            info.mtime = fixed_mtime
            info.uid = 0
            info.gid = 0
            info.uname = ""
            info.gname = ""
            with f.open("rb") as fp:
                tar.addfile(info, fp)
    return buf.getvalue()


def _compress_zstd(data: bytes, level: int = 19) -> bytes:
    """Compress via zstd CLI subprocess (no zstandard Python dep)."""
    proc = subprocess.run(
        ["zstd", f"-{level}", "--no-progress", "-q", "--stdout"],
        input=data,
        capture_output=True,
        check=True,
    )
    return proc.stdout


def _apply_immutable_flag(path: Path) -> tuple[bool, str]:
    """
    Apply `chattr +i` (immutable). Retourne (success, message).
    Silencieux si non-root ou outil indisponible.
    """
    try:
        result = subprocess.run(
            ["chattr", "+i", str(path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            return True, "immutable_applied"
        return False, f"chattr_failed: {result.stderr.strip()[:120]}"
    except FileNotFoundError:
        return False, "chattr_not_found"


def create_snapshot(
    exports_dir: Path,
    object_store_root: Path,
    versions: dict[str, str],
    apply_immutable: bool = True,
) -> tuple[Path, str, dict[str, Any]]:
    """
    Crée le snapshot tar.zst content-addressed + manifest.

    Retourne (snapshot_path, status, manifest_dict) où status ∈
    {'created', 'skipped_exists'}.
    """
    if not exports_dir.is_dir():
        raise click.ClickException(f"exports_dir not a directory: {exports_dir}")

    snapshots_dir = object_store_root / SNAPSHOTS_SUBDIR
    snapshots_dir.mkdir(parents=True, exist_ok=True)

    tarball = _build_tarball(exports_dir)
    compressed = _compress_zstd(tarball)
    content_hash = hashlib.sha256(compressed).hexdigest()

    snapshot_path = snapshots_dir / f"{content_hash}.tar.zst"
    manifest_path = snapshots_dir / f"{content_hash}.manifest.json"

    _enforce_object_store_path(snapshot_path, object_store_root)
    _enforce_object_store_path(manifest_path, object_store_root)

    manifest: dict[str, Any] = {
        "content_hash": f"sha256:{content_hash}",
        "filename": snapshot_path.name,
        "size_bytes": len(compressed),
        "uncompressed_size_bytes": len(tarball),
        "file_count": sum(1 for _ in exports_dir.rglob("*") if _.is_file()),
        "exports_dir": str(exports_dir.resolve()),
        "wiki_commit_sha": versions.get("wiki_commit_sha", "0" * 40),
        "builder_version": versions["builder_version"],
        "pipeline_version": versions["pipeline_version"],
        "extractor_version": versions["extractor_version"],
        "runner_version": versions["runner_version"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "snapshot_tool": "snapshot_exports_seo",
        "snapshot_tool_version": "1.0.0",
        "wiki_commit_authority": "informational-only (replay SoT = tar.zst, never git checkout)",
    }

    if snapshot_path.exists():
        return snapshot_path, "skipped_exists", manifest

    snapshot_path.write_bytes(compressed)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if apply_immutable:
        _apply_immutable_flag(snapshot_path)
        _apply_immutable_flag(manifest_path)

    return snapshot_path, "created", manifest


@click.command()
@click.option(
    "--exports-dir",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    required=True,
    help="Répertoire wiki/exports/seo/ à snapshotter",
)
@click.option(
    "--object-store",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/object-store"),
    show_default=True,
)
@click.option(
    "--wiki-root",
    type=click.Path(file_okay=False, path_type=Path),
    default=Path("/opt/automecanik/automecanik-wiki"),
    show_default=True,
    help="Wiki repo pour récupérer le HEAD commit (informational-only)",
)
@click.option("--builder-version", default="1.0.0", show_default=True)
@click.option("--pipeline-version", default="1.0.0", show_default=True)
@click.option("--extractor-version", default="1.0.0", show_default=True)
@click.option("--runner-version", default="1.0.0", show_default=True)
@click.option(
    "--no-immutable",
    is_flag=True,
    default=False,
    help="Skip chattr +i (utile en dev/CI sans permissions root)",
)
def main(
    exports_dir: Path,
    object_store: Path,
    wiki_root: Path,
    builder_version: str,
    pipeline_version: str,
    extractor_version: str,
    runner_version: str,
    no_immutable: bool,
) -> None:
    """Crée un snapshot tar.zst content-addressed immutable de exports/seo/."""
    versions = {
        "wiki_commit_sha": _wiki_commit_sha(wiki_root),
        "builder_version": builder_version,
        "pipeline_version": pipeline_version,
        "extractor_version": extractor_version,
        "runner_version": runner_version,
    }
    snapshot_path, status, manifest = create_snapshot(
        exports_dir,
        object_store,
        versions,
        apply_immutable=not no_immutable,
    )
    click.echo(f"{status} {snapshot_path}")
    click.echo(f"  size={manifest['size_bytes']} files={manifest['file_count']}")
    sys.exit(0)


if __name__ == "__main__":
    main()
