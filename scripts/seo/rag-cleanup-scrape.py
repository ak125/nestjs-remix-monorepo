#!/usr/bin/env python3
"""
RAG Cleanup — Remove 'materialized-from-db' sections from polluted gamme .md files.

These sections contain raw web-scraped content (WIX Filters, MANN-FILTER, PURFLUX, etc.)
with HTML fragments, JSON-LD metadata, mixed FR/English, and out-of-scope content
(industrial, agricultural, heavy-duty). They pollute the RAG without adding value.

The useful content is already in the YAML frontmatter (domain, variants, selection, etc.).

Usage:
    python3 scripts/seo/rag-cleanup-scrape.py --dry-run            # Preview
    python3 scripts/seo/rag-cleanup-scrape.py                      # Apply
    python3 scripts/seo/rag-cleanup-scrape.py --gamme filtre-a-air # Single file
"""
from __future__ import annotations
import argparse
from pathlib import Path
from typing import Optional

RAG_DIR = Path('/opt/automecanik/rag/knowledge/gammes')

# Section markers that indicate the start of materialized-from-db pollution
SCRAPE_SECTION_HEADERS = [
    '## Conseils supplementaires',
    '## References supplementaires',
    '## Conseils supplémentaires',
    '## References supplémentaires',
    '## Références supplémentaires',
]

# Additional markers that indicate raw scrape (backup detection)
SCRAPE_MARKERS = [
    '<!-- materialized-from-db',
]


def find_cleanup_cut(lines: list[str]) -> Optional[int]:
    """Find the line index where the scrape section starts.

    Returns None if no scrape section found.
    """
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Exact header match
        if stripped in SCRAPE_SECTION_HEADERS:
            return i
        # Comment marker (fallback)
        for marker in SCRAPE_MARKERS:
            if marker in line:
                # Find the nearest '##' header above
                for j in range(i, -1, -1):
                    if lines[j].strip().startswith('## '):
                        return j
                return i
    return None


def clean_file(filepath: Path, dry_run: bool = False) -> dict:
    """Remove the scrape section from a single .md file.

    Returns dict with stats: {'file', 'before_lines', 'after_lines', 'removed', 'action'}
    """
    content = filepath.read_text(encoding='utf-8')
    lines = content.split('\n')
    before_lines = len(lines)

    cut_idx = find_cleanup_cut(lines)
    if cut_idx is None:
        return {
            'file': filepath.name,
            'before_lines': before_lines,
            'after_lines': before_lines,
            'removed': 0,
            'action': 'skip (no scrape section)',
        }

    # Trim trailing blank lines before the cut
    while cut_idx > 0 and lines[cut_idx - 1].strip() == '':
        cut_idx -= 1

    new_content = '\n'.join(lines[:cut_idx]) + '\n'

    if not dry_run:
        filepath.write_text(new_content, encoding='utf-8')

    return {
        'file': filepath.name,
        'before_lines': before_lines,
        'after_lines': cut_idx,
        'removed': before_lines - cut_idx,
        'action': 'cleaned' if not dry_run else 'preview',
    }


def main():
    parser = argparse.ArgumentParser(description='Remove materialized-from-db sections from RAG .md files')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--gamme', type=str, help='Clean single gamme slug (e.g. filtre-a-air)')
    parser.add_argument('--min-removed', type=int, default=1, help='Only show files with at least N lines removed')
    args = parser.parse_args()

    if not RAG_DIR.exists():
        print(f"ERROR: {RAG_DIR} not found")
        return 1

    # Collect files to process
    if args.gamme:
        files = [RAG_DIR / f'{args.gamme}.md']
        if not files[0].exists():
            print(f"ERROR: {files[0]} not found")
            return 1
    else:
        files = sorted(RAG_DIR.glob('*.md'))

    print(f"{'DRY RUN' if args.dry_run else 'LIVE'} — {len(files)} file(s) to scan\n")

    results = []
    for filepath in files:
        r = clean_file(filepath, dry_run=args.dry_run)
        results.append(r)

    # Report
    cleaned = [r for r in results if r['removed'] >= args.min_removed]
    skipped = [r for r in results if r['removed'] == 0]

    print(f"{'=' * 60}")
    print(f"  RESULTS")
    print(f"{'=' * 60}")
    print(f"  Files scanned   : {len(results)}")
    print(f"  Files cleaned   : {len(cleaned)}")
    print(f"  Files skipped   : {len(skipped)}")
    print(f"  Total lines removed: {sum(r['removed'] for r in cleaned)}")

    if cleaned:
        print(f"\n  Top 20 cleaned files:")
        for r in sorted(cleaned, key=lambda x: -x['removed'])[:20]:
            print(f"    {r['file']:<55} -{r['removed']:>4} lines")

    if args.dry_run:
        print(f"\n  [DRY RUN] No changes written. Use without --dry-run to apply.")

    return 0


if __name__ == '__main__':
    exit(main())
