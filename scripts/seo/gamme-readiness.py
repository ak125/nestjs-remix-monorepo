#!/usr/bin/env python3
"""
Vue unifiee de readiness par gamme.

Combine 4 dimensions :
  1. RAG V4 completeness (fichiers .md sur disque)
  2. Conseil coverage (sections ecrites en DB)
  3. DB data availability (matiere premiere pour generation)
  4. Priority / SEO score (from gamme_aggregates)

Usage:
    python3 scripts/seo/gamme-readiness.py --summary
    python3 scripts/seo/gamme-readiness.py amortisseur
    python3 scripts/seo/gamme-readiness.py --filter BLOCKED
    python3 scripts/seo/gamme-readiness.py --filter READY
    python3 scripts/seo/gamme-readiness.py --top 20

Prerequis:
    Exporter la vue v_gamme_readiness en JSON :
    (via MCP execute_sql → copier dans /tmp/gamme-readiness.json)
    OU utiliser --db-json <path> pour pointer vers l'export.
"""
from __future__ import annotations
import sys
import os
import json
import argparse

# Add parent for rag-check imports
sys.path.insert(0, os.path.dirname(__file__))
from importlib import import_module

# Import rag-check functions without running main()
_rag_check_path = os.path.join(os.path.dirname(__file__), "rag-check.py")

# Manual import since filename has a hyphen
import importlib.util
_spec = importlib.util.spec_from_file_location("rag_check", _rag_check_path)
_rag_check = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_rag_check)

parse_rag_frontmatter = _rag_check.parse_rag_frontmatter
check_gamme = _rag_check.check_gamme
SECTION_REQUIREMENTS = _rag_check.SECTION_REQUIREMENTS

RAG_DIR = "/opt/automecanik/rag/knowledge/gammes"
DEFAULT_DB_JSON = "/tmp/gamme-readiness.json"

# Priority sort order
PRIORITY_ORDER = {"P1": 0, "P1-PENDING": 1, "P2": 2, "P3": 3, "SOFT-INDEX": 4}
READINESS_ORDER = {"READY": 0, "PARTIAL": 1, "STARTED": 2, "BLOCKED": 3}


def load_db_data(json_path: str) -> dict[str, dict]:
    """Load v_gamme_readiness export, indexed by pg_alias."""
    if not os.path.exists(json_path):
        print(f"DB export not found: {json_path}")
        print(f"Export it first via MCP:")
        print(f"  SELECT * FROM v_gamme_readiness;")
        print(f"  → save to {json_path}")
        return {}

    with open(json_path, "r", encoding="utf-8") as f:
        rows = json.load(f)

    return {row["pg_alias"]: row for row in rows if row.get("pg_alias")}


def get_rag_status(slug: str) -> dict | None:
    """Check RAG file readiness for a gamme."""
    filepath = os.path.join(RAG_DIR, f"{slug}.md")
    data = parse_rag_frontmatter(filepath)
    if data is None:
        return None
    return check_gamme(slug, data)


def format_bool(val) -> str:
    """Format a boolean/None as check/cross."""
    if val is True:
        return "\u2713"
    if val is False:
        return "\u2717"
    return "-"


def print_gamme_detail(slug: str, db_row: dict | None, rag: dict | None):
    """Print detailed readiness report for one gamme."""
    name = slug.replace("-", " ").title()
    pg_id = db_row.get("pg_id", "?") if db_row else "?"
    priority = db_row.get("final_priority", "?") if db_row else "?"
    seo = db_row.get("seo_score", "?") if db_row else "?"
    readiness = db_row.get("readiness_level", "?") if db_row else "?"
    next_act = db_row.get("next_action", "?") if db_row else "?"

    print(f"\n{'=' * 70}")
    print(f"  {name} (pg_id={pg_id})")
    print(f"  Priority: {priority} | SEO: {seo} | Readiness: {readiness}")
    print(f"{'=' * 70}")

    # RAG dimension
    if rag:
        schema = rag.get("schema", "?")
        passed = rag.get("pass_count", 0)
        total = rag.get("total", 0)
        fails = rag.get("fail_count", 0)
        rag_icon = "\u2713" if fails == 0 else f"{fails} FAIL"
        print(f"  RAG V4:     {passed}/{total} sections ({schema}) [{rag_icon}]")

        # Show per-section RAG status
        for section, res in rag.get("sections", {}).items():
            status = res["status"]
            if status == "PASS":
                icon = "\u2713"
            elif status == "PASS_V1":
                icon = "\u223c"
            elif status == "NO_V1_EQUIV":
                icon = "-"
            else:
                icon = "\u2717"
            # Show failing details
            detail = ""
            if status == "FAIL":
                fail_details = [d for d in res.get("details", []) if "ABSENT" in d or "items" in d]
                if fail_details:
                    detail = f"  <- {fail_details[0]}"
            print(f"    {icon} {section:12s} {res['label']}{detail}")
    else:
        print(f"  RAG V4:     NO FILE")

    # Conseil dimension
    if db_row:
        sections = db_row.get("conseil_sections") or 0
        coverage = db_row.get("standard_coverage") or "0"
        quality = db_row.get("conseil_avg_quality") or "0"
        complete = db_row.get("standard_complete", False)
        complete_icon = "\u2713" if complete else "\u2717"
        print(f"  Conseils:   {sections} sections | coverage {float(coverage)*100:.0f}% | quality {float(quality):.0f} [{complete_icon}]")

        # Per-section presence
        section_flags = []
        for s in ["s1", "s2", "s3", "s4_depose", "s5", "s6", "s8"]:
            key = f"has_{s}"
            val = db_row.get(key)
            label = s.upper().replace("_", " ")
            icon = "\u2713" if val else "\u2717"
            section_flags.append(f"{label}:{icon}")
        print(f"    {' | '.join(section_flags)}")

        # DB data availability
        criteria = format_bool(db_row.get("db_has_criteria"))
        faq = format_bool(db_row.get("db_has_faq"))
        tree = format_bool(db_row.get("db_has_tree"))
        htc = format_bool(db_row.get("db_has_htc"))
        print(f"  DB Data:    criteria {criteria} | faq {faq} | tree {tree} | htc {htc}")

        # Keyword plan
        kw_status = db_row.get("kw_plan_status")
        kw_quality = db_row.get("kw_plan_quality")
        kw_phase = db_row.get("kw_plan_phase")
        if kw_status:
            print(f"  KW Plan:    {kw_status} (score {kw_quality}, phase {kw_phase})")
        else:
            print(f"  KW Plan:    -")

        print(f"  Action:     {next_act}")
    else:
        print(f"  DB Data:    NOT IN v_gamme_readiness")

    print()


def print_summary(db_data: dict[str, dict]):
    """Print global readiness summary."""
    total = len(db_data)

    # Readiness distribution
    readiness_counts: dict[str, int] = {}
    priority_readiness: dict[str, dict[str, int]] = {}
    next_action_counts: dict[str, int] = {}

    for slug, row in db_data.items():
        rl = row.get("readiness_level", "BLOCKED")
        fp = row.get("final_priority", "?")
        na = row.get("next_action", "?")

        readiness_counts[rl] = readiness_counts.get(rl, 0) + 1
        next_action_counts[na] = next_action_counts.get(na, 0) + 1

        if fp not in priority_readiness:
            priority_readiness[fp] = {}
        priority_readiness[fp][rl] = priority_readiness[fp].get(rl, 0) + 1

    print(f"\n{'=' * 70}")
    print(f"  GAMME READINESS - {total} gammes")
    print(f"{'=' * 70}")

    # Readiness levels
    readiness_labels = {
        "READY": "pretes a publier",
        "PARTIAL": "sections manquantes",
        "STARTED": "debut de contenu",
        "BLOCKED": "sans contenu",
    }
    for level in ["READY", "PARTIAL", "STARTED", "BLOCKED"]:
        count = readiness_counts.get(level, 0)
        pct = int(100 * count / total) if total else 0
        label = readiness_labels.get(level, "")
        print(f"  {level:10s} : {count:>4d} ({pct:>2d}%) - {label}")

    # Priority breakdown
    print(f"\n  {'Priority':<15s}", end="")
    for level in ["READY", "PARTIAL", "STARTED", "BLOCKED"]:
        print(f" {level:>8s}", end="")
    print(f" {'Total':>8s}")
    print(f"  {'-' * 55}")

    for fp in sorted(priority_readiness.keys(), key=lambda x: PRIORITY_ORDER.get(x, 99)):
        rd = priority_readiness[fp]
        row_total = sum(rd.values())
        print(f"  {fp:<15s}", end="")
        for level in ["READY", "PARTIAL", "STARTED", "BLOCKED"]:
            print(f" {rd.get(level, 0):>8d}", end="")
        print(f" {row_total:>8d}")

    # Next actions
    print(f"\n  Actions suggerees :")
    for action, count in sorted(next_action_counts.items(), key=lambda x: -x[1]):
        print(f"    {action:30s} : {count} gammes")

    # Section coverage
    section_counts: dict[str, int] = {}
    for slug, row in db_data.items():
        for s in ["s1", "s2", "s3", "s4_depose", "s5", "s6", "s8"]:
            key = f"has_{s}"
            if row.get(key):
                section_counts[s] = section_counts.get(s, 0) + 1

    print(f"\n  Couverture sections conseil :")
    for s in ["s1", "s2", "s3", "s4_depose", "s5", "s6", "s8"]:
        count = section_counts.get(s, 0)
        pct = int(100 * count / total) if total else 0
        label = s.upper().replace("_", " ")
        bar = "#" * (pct // 5) + "." * (20 - pct // 5)
        print(f"    {label:12s} {count:>4d}/{total} ({pct:>2d}%) [{bar}]")


def print_top(db_data: dict[str, dict], n: int, filter_level: str | None = None):
    """Print top N gammes sorted by priority then SEO score."""
    items = list(db_data.values())

    if filter_level:
        items = [r for r in items if r.get("readiness_level") == filter_level]

    # Sort: priority ASC, seo_score DESC
    items.sort(key=lambda r: (
        PRIORITY_ORDER.get(r.get("final_priority", "P3"), 99),
        -(r.get("seo_score") or 0),
    ))

    items = items[:n]

    print(f"\n  {'#':>3s}  {'Alias':30s} {'Pri':>5s} {'SEO':>4s} {'Sect':>5s} {'Cov':>5s} {'Qual':>5s} {'Ready':>8s} {'Action':20s}")
    print(f"  {'-' * 95}")

    for i, row in enumerate(items, 1):
        alias = row.get("pg_alias", "?")
        pri = row.get("final_priority", "?")
        seo = row.get("seo_score") or 0
        sect = row.get("conseil_sections") or 0
        cov = row.get("standard_coverage")
        cov_str = f"{float(cov)*100:.0f}%" if cov else "0%"
        qual = row.get("conseil_avg_quality")
        qual_str = f"{float(qual):.0f}" if qual else "0"
        ready = row.get("readiness_level", "?")
        action = row.get("next_action", "?")

        print(f"  {i:>3d}  {alias:30s} {pri:>5s} {seo:>4d} {sect:>5d} {cov_str:>5s} {qual_str:>5s} {ready:>8s} {action:20s}")


def main():
    parser = argparse.ArgumentParser(description="Unified gamme readiness report")
    parser.add_argument("slug", nargs="?", help="Slug of a single gamme")
    parser.add_argument("--summary", action="store_true", help="Global readiness summary")
    parser.add_argument("--filter", metavar="LEVEL", help="Filter by readiness level (READY/PARTIAL/STARTED/BLOCKED)")
    parser.add_argument("--top", type=int, metavar="N", help="Show top N gammes by priority")
    parser.add_argument("--db-json", default=DEFAULT_DB_JSON, help=f"Path to v_gamme_readiness JSON export (default: {DEFAULT_DB_JSON})")
    parser.add_argument("--with-rag", action="store_true", help="Include RAG file checks (slower)")
    args = parser.parse_args()

    if not args.slug and not args.summary and not args.filter and not args.top:
        parser.print_help()
        sys.exit(1)

    # Load DB data
    db_data = load_db_data(args.db_json)
    if not db_data:
        sys.exit(1)

    # Single gamme detail
    if args.slug:
        slug = args.slug
        db_row = db_data.get(slug)
        rag = get_rag_status(slug)
        print_gamme_detail(slug, db_row, rag)
        return

    # Summary
    if args.summary:
        print_summary(db_data)

        # If --with-rag, add RAG stats
        if args.with_rag:
            print(f"\n  RAG V4 check (reading {len(db_data)} files)...")
            rag_pass_all = 0
            rag_has_file = 0
            for slug in sorted(db_data.keys()):
                rag = get_rag_status(slug)
                if rag:
                    rag_has_file += 1
                    if rag.get("fail_count", 0) == 0:
                        rag_pass_all += 1
            print(f"  RAG files found: {rag_has_file}/{len(db_data)}")
            print(f"  RAG full PASS:   {rag_pass_all}/{rag_has_file}")
        return

    # Filter
    if args.filter:
        level = args.filter.upper()
        filtered = {k: v for k, v in db_data.items() if v.get("readiness_level") == level}
        count = len(filtered)
        print(f"\n  {level}: {count} gammes")
        print_top(filtered, count)

        if args.with_rag and count <= 30:
            print(f"\n  RAG detail for {level} gammes:")
            for slug in sorted(filtered.keys()):
                rag = get_rag_status(slug)
                if rag and rag.get("fail_count", 0) > 0:
                    fails = []
                    for section, res in rag.get("sections", {}).items():
                        if res["status"] == "FAIL":
                            fails.append(section)
                    print(f"    {slug:35s} RAG FAIL: {', '.join(fails)}")
        return

    # Top N
    if args.top:
        print_top(db_data, args.top, filter_level=args.filter)
        return


if __name__ == "__main__":
    main()
