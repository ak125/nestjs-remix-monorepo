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
import os
import shutil
import sys
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


def assert_source_is_exports_rag(source: Path) -> None:
    """D20 garde-fou. Source path must end at `<wiki>/exports/rag/`. Reading from
    `<wiki>/wiki/<entity_type>/` directly is forbidden — that tree may contain
    draft fields, notes-internes, or sections that are not yet validated for
    consumption by Weaviate."""
    parts = source.resolve().parts
    if "exports" not in parts or "rag" not in parts:
        raise SystemExit(
            f"D20 garde-fou: --source must be under <wiki>/exports/rag/. Got: {source}"
        )
    # Reject explicit wiki/<entity_type>/ paths even nested under exports.
    if "wiki" in parts:
        # exports/rag/wiki/... would mean someone tried to nest the canonical wiki
        # tree inside the export tree to bypass — fail loudly.
        wiki_index = parts.index("wiki")
        rag_index = parts.index("rag")
        if wiki_index > rag_index:
            raise SystemExit(
                f"D20 garde-fou: detected `wiki/` inside `exports/rag/` — "
                f"this would let unvalidated wiki/<entity_type>/ leak into RAG. {source}"
            )


def iter_export_files(source: Path) -> list[Path]:
    if not source.exists():
        return []
    return sorted(p for p in source.rglob("*") if p.is_file() and p.suffix in SUPPORTED_EXTS)


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
        help="Override source. MUST resolve under <wiki-repo>/exports/rag/. "
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
    assert_source_is_exports_rag(source)

    if not source.exists():
        print(
            f"sync-from-wiki: nothing to do — source {source} does not exist yet "
            f"(ADR-031 Phase F.x will populate it)",
            file=sys.stderr,
        )
        return 0

    target_root = rag_repo / RAG_KNOWLEDGE_RELATIVE
    files = iter_export_files(source)
    if not files:
        print(f"sync-from-wiki: 0 export files under {source}", file=sys.stderr)
        return 0

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

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
