#!/usr/bin/env python3
"""
sync-from-wiki.py — Sync wiki exports into the rag knowledge tree (ADR-031 §D20).

Reads `automecanik-wiki/exports/rag/<entity_type>/<slug>.md` and writes the
matching path under `automecanik-rag/knowledge/<entity_type>/<slug>.md`.

Strict garde-fou (D20): the source MUST point at `automecanik-wiki/exports/rag/`.
Any attempt to read from `wiki/wiki/<entity_type>/` directly is rejected so RAG
ingestion never sees notes-internes / draft-fields / non-validated content.

Idempotent: skips files where the target already has matching SHA-256 content.

Usage:
  ./sync-from-wiki.py                                               # dry-run (default)
  ./sync-from-wiki.py --apply                                       # write changes
  ./sync-from-wiki.py --wiki-repo /opt/automecanik-wiki \\           # default
                      --rag-repo  /opt/automecanik/rag              # default

Env override:
  AUTOMECANIK_WIKI_PATH overrides --wiki-repo.
  AUTOMECANIK_RAG_PATH  overrides --rag-repo.

Exit codes: 0 success, 1 input/output failure, 2 garde-fou violation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


WIKI_EXPORTS_RAG_RELATIVE = Path("exports") / "rag"
RAG_KNOWLEDGE_RELATIVE = Path("knowledge")
SUPPORTED_EXTS = {".md", ".json"}


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def assert_source_is_exports_rag(source: Path, wiki_repo: Path) -> None:
    """D20: bind every source to the designated WIKI exports, including symlinks."""
    expected = wiki_repo.resolve() / WIKI_EXPORTS_RAG_RELATIVE
    try:
        relative = source.resolve().relative_to(expected)
    except ValueError:
        raise SystemExit(
            f"D20 garde-fou: source must be under {expected}. Got: {source}"
        )
    if "wiki" in relative.parts:
        raise SystemExit(
            f"D20 garde-fou: detected wiki/ inside exports/rag/: {source}"
        )


def iter_export_files(source: Path, wiki_repo: Path) -> list[Path]:
    # Validate the entire input before copying anything: a late escaping symlink
    # must not leave a partially updated mirror.
    files = sorted(p for p in source.rglob("*") if p.is_file() and p.suffix in SUPPORTED_EXTS)
    for path in files:
        assert_source_is_exports_rag(path, wiki_repo)
    return files


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--wiki-repo",
        default=os.getenv("AUTOMECANIK_WIKI_PATH", "/opt/automecanik-wiki"),
        help="Local clone of automecanik-wiki (default /opt/automecanik-wiki, env AUTOMECANIK_WIKI_PATH)",
    )
    ap.add_argument(
        "--rag-repo",
        default=os.getenv("AUTOMECANIK_RAG_PATH", "/opt/automecanik/rag"),
        help="Local clone of automecanik-rag (default /opt/automecanik/rag, env AUTOMECANIK_RAG_PATH)",
    )
    ap.add_argument("--apply", action="store_true", help="Write changes (default: dry-run)")
    ap.add_argument(
        "--source",
        default=None,
        help="Override source. MUST resolve to the complete <wiki-repo>/exports/rag/ root. "
             "Reading from <wiki-repo>/wiki/<entity_type>/ is forbidden (D20).",
    )
    args = ap.parse_args()

    wiki_repo = Path(args.wiki_repo).resolve()
    rag_repo = Path(args.rag_repo).resolve()
    if args.source:
        source = Path(args.source).resolve()
    else:
        source = wiki_repo / WIKI_EXPORTS_RAG_RELATIVE

    # D20 enforcement: source must be under <wiki>/exports/rag/. Even if the user
    # passes --source pointing at wiki/wiki/<entity_type>/, we abort.
    assert_source_is_exports_rag(source, wiki_repo)

    if not source.exists():
        print(
            f"sync-from-wiki: source unavailable: {source}",
            file=sys.stderr,
        )
        return 1

    target_root = rag_repo / RAG_KNOWLEDGE_RELATIVE
    files = iter_export_files(source, wiki_repo)
    if not files:
        print(f"sync-from-wiki: no export files under {source}; mirror not refreshed", file=sys.stderr)
        return 1

    # A partial export subtree cannot establish freshness for the whole mirror
    # (and would flatten its topic prefix). Require the declared complete scope.
    if source != wiki_repo / WIKI_EXPORTS_RAG_RELATIVE:
        print("sync-from-wiki: partial source cannot refresh the complete mirror", file=sys.stderr)
        return 1

    # Do not certify a mirror that still exposes exports absent upstream. Missing
    # files are NOT authority to delete: preserve evidence and require explicit
    # reconciliation/tombstones through the governed withdrawal path.
    expected_paths = {p.relative_to(source) for p in files}
    try:
        if target_root.is_symlink():
            raise ValueError("knowledge root is a symlink")
        for dst in target_root.rglob('*'):
            if dst.is_symlink():
                raise ValueError(f"mirror symlink: {dst.relative_to(target_root)}")
        actual_paths = {
            p.relative_to(target_root) for p in target_root.rglob('*')
            if p.is_file() and p.suffix in SUPPORTED_EXTS and p.name != '.last-sync.json'
        }
        unreconciled = sorted(actual_paths - expected_paths)
        if unreconciled:
            for relative in unreconciled:
                print(f"UNRECONCILED {relative} (preserved; absent from WIKI exports)", file=sys.stderr)
            return 1
    except (OSError, ValueError) as e:
        print(f"sync-from-wiki: mirror preflight failed: {e}", file=sys.stderr)
        return 1

    written = 0
    skipped = 0
    failed = 0

    for src in files:
        rel = src.relative_to(source)
        dst = target_root / rel
        if dst.exists():
            try:
                if sha256_of(src) == sha256_of(dst):
                    print(f"SKIP  {rel} (sha256 match)")
                    skipped += 1
                    continue
            except OSError as e:
                print(f"FAIL  {rel}: hash compare failed: {e}", file=sys.stderr)
                failed += 1
                continue

        if args.apply:
            try:
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                print(f"WRITE {rel}")
                written += 1
            except OSError as e:
                print(f"FAIL  {rel}: write failed: {e}", file=sys.stderr)
                failed += 1
        else:
            print(f"DRY   {rel} → {dst}")

    summary = f"sync-from-wiki: {len(files)} export files, written={written}, skipped={skipped}, failed={failed}"
    if not args.apply:
        summary += " (dry-run; pass --apply to commit)"
    print(summary, file=sys.stderr)

    # PR-E.2 — produit le manifest `.last-sync.json` lu par le runtime
    # NestJS (RagMirrorFreshnessService) pour fail-fast / health endpoint.
    # Compte les fichiers présents par topic après un sync intégralement réussi.
    # Un échec ne doit jamais avancer la date du dernier succès.
    if args.apply and not failed:
        manifest_path = target_root / ".last-sync.json"
        topic_counts: dict[str, int] = {}
        for topic_dir in sorted(p for p in target_root.iterdir() if p.is_dir()):
            topic_counts[topic_dir.name] = sum(
                1 for f in topic_dir.rglob("*") if f.is_file() and f.suffix in SUPPORTED_EXTS
            )
        manifest = {
            "schema_version": "1.0.0",
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "source": str(source),
            "stats": {
                "exports_total": len(files),
                "written": written,
                "skipped": skipped,
                "failed": failed,
            },
            "topic_counts": topic_counts,
        }
        try:
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
            print(f"manifest written: {manifest_path}", file=sys.stderr)
        except OSError as e:
            print(f"manifest write FAILED: {e}", file=sys.stderr)
            # Freshness is part of the sync contract, not a best-effort signal.
            return 1

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
