#!/usr/bin/env python3
"""
Enrichissement automatique des fichiers RAG V4 depuis les donnees DB.

Lit un export JSON de __seo_gamme_purchase_guide et enrichit les fichiers
V4 .md avec les donnees disponibles :
- selection.criteria  <-- sgpg_selection_criteria (185 gammes)
- rendering.faq       <-- sgpg_faq (221 gammes, 5-6 items vs 3)
- diagnostic.causes   <-- sgpg_decision_tree (186 gammes)

Ne touche PAS aux fichiers manuellement enrichis (stage != v4_converted).

Usage:
    python3 scripts/seo/rag-enrich-from-db.py /tmp/rag-enrich-data.json --all --dry-run
    python3 scripts/seo/rag-enrich-from-db.py /tmp/rag-enrich-data.json --all --apply
    python3 scripts/seo/rag-enrich-from-db.py /tmp/rag-enrich-data.json amortisseur --apply
"""
from __future__ import annotations
import sys
import os
import re
import json
import shutil
import yaml
import argparse
from datetime import date
from pathlib import Path

RAG_DIR = "/opt/automecanik/rag/knowledge/gammes"
BACKUP_DIR = os.path.join(RAG_DIR, ".backup-pre-enrich")


def today_iso() -> str:
    return date.today().isoformat()


def parse_file(filepath: str):
    """Parse frontmatter YAML and return (frontmatter, markdown_body)."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        return None, ""

    match = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)", content, re.DOTALL)
    if match:
        try:
            fm = yaml.safe_load(match.group(1))
            return fm, match.group(2)
        except yaml.YAMLError:
            return None, ""
    try:
        fm = yaml.safe_load(content)
        return fm, ""
    except yaml.YAMLError:
        return None, ""


def write_file(filepath: str, fm: dict, markdown_body: str):
    """Write YAML frontmatter + markdown body."""
    yaml_str = yaml.dump(
        fm, default_flow_style=False, allow_unicode=True,
        sort_keys=False, width=120,
    )
    output = f"---\n{yaml_str}---\n"
    if markdown_body.strip():
        output += f"\n{markdown_body.strip()}\n"
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(output)


def is_manually_enriched(fm: dict) -> bool:
    """Check if file was manually enriched (don't overwrite)."""
    stage = fm.get("lifecycle", {}).get("stage", "")
    return stage in ("skill_enriched", "expert_reviewed", "published")


# ── Extraction helpers ──

def extract_criteria_from_db(db_row: dict) -> list[str]:
    """Extract selection criteria from sgpg_selection_criteria."""
    sc = db_row.get("sgpg_selection_criteria")
    if not sc:
        return []

    # Format 1: object with "criteria" key (3 gammes, rich content)
    if isinstance(sc, dict) and "criteria" in sc:
        criteria = sc["criteria"]
        if isinstance(criteria, list):
            return [str(c) for c in criteria if c]
        return []

    # Format 2: array of {key, label, guidance, priority} or {label, value}
    if isinstance(sc, list):
        criteria = []
        for item in sc:
            if not isinstance(item, dict):
                continue
            # Skip generic "Pour commander le bon X" header items
            label = item.get("label", "")
            if "pour commander" in label.lower():
                continue
            # {label, value} format — combine into useful criterion
            if "value" in item:
                val = item["value"]
                criteria.append(f"{label} : {val}" if label else str(val))
            # {key, label, guidance} format — use guidance or label
            elif "guidance" in item:
                guidance = item["guidance"]
                if guidance and "pour commander" not in guidance.lower():
                    criteria.append(str(guidance))
                elif label:
                    criteria.append(str(label))
            elif label:
                criteria.append(str(label))
        # Filter out very short or generic items
        criteria = [c for c in criteria if len(c) > 10]
        # Remove markdown bold markers
        criteria = [c.replace("**", "") for c in criteria]
        return criteria

    return []


def extract_criteria_from_how_to_choose(db_row: dict) -> list[str]:
    """Fallback: extract criteria from sgpg_how_to_choose text."""
    htc = db_row.get("sgpg_how_to_choose")
    if not htc or not isinstance(htc, str):
        return []

    lines = []
    for line in htc.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Remove bullet markers
        line = re.sub(r"^[•\-\d]+[.)]\s*", "", line)
        if len(line) > 15:
            lines.append(line)

    return lines


def extract_faq_from_db(db_row: dict) -> list[dict]:
    """Extract FAQ from sgpg_faq."""
    faq = db_row.get("sgpg_faq")
    if not faq or not isinstance(faq, list):
        return []

    result = []
    for item in faq:
        if not isinstance(item, dict):
            continue
        q = item.get("question", "")
        a = item.get("answer", "")
        if q and a:
            result.append({"question": str(q), "answer": str(a)})
    return result


def extract_causes_from_decision_tree(db_row: dict) -> list[str]:
    """Extract diagnostic causes from sgpg_decision_tree."""
    dt = db_row.get("sgpg_decision_tree")
    if not dt or not isinstance(dt, list):
        return []

    causes = []
    for step in dt:
        if not isinstance(step, dict):
            continue
        # The question itself is a diagnostic condition
        question = step.get("question", "")
        options = step.get("options", [])
        if isinstance(options, list):
            for opt in options:
                if not isinstance(opt, dict):
                    continue
                label = opt.get("label", "")
                note = opt.get("note", "")
                if note and len(note) > 30:
                    # Rich note — use as a cause description
                    causes.append(str(note)[:200])
                elif label and question:
                    causes.append(f"{question} : {label}".replace("_", " "))
                elif label:
                    causes.append(str(label).replace("_", " "))
    return causes


def deduplicate(items: list[str], existing: list) -> list[str]:
    """Remove items that are too similar to existing ones."""
    if not existing:
        return items

    existing_lower = set()
    for e in existing:
        if isinstance(e, str):
            existing_lower.add(e.lower().strip())
        elif isinstance(e, dict) and "label" in e:
            existing_lower.add(e["label"].lower().strip())

    result = []
    for item in items:
        if item.lower().strip() not in existing_lower:
            result.append(item)
    return result


def enrich_gamme(slug: str, fm: dict, db_row: dict) -> dict[str, str]:
    """Enrich a V4 frontmatter with DB data. Returns dict of changes made."""
    changes = {}

    # ── selection.criteria ──
    if "selection" not in fm:
        fm["selection"] = {}

    current_criteria = fm.get("selection", {}).get("criteria", [])
    if not isinstance(current_criteria, list):
        current_criteria = [current_criteria] if current_criteria else []

    if len(current_criteria) < 3:
        # Try DB selection_criteria first
        db_criteria = extract_criteria_from_db(db_row)
        if not db_criteria:
            # Fallback to how_to_choose
            db_criteria = extract_criteria_from_how_to_choose(db_row)

        if db_criteria and len(db_criteria) >= 3:
            fm["selection"]["criteria"] = db_criteria
            changes["selection.criteria"] = f"{len(current_criteria)}->{len(db_criteria)} items"
        elif db_criteria and len(db_criteria) > len(current_criteria):
            fm["selection"]["criteria"] = db_criteria
            changes["selection.criteria"] = f"{len(current_criteria)}->{len(db_criteria)} items (still <3)"

    # ── rendering.faq ──
    current_faq = fm.get("rendering", {}).get("faq", [])
    if not isinstance(current_faq, list):
        current_faq = []

    db_faq = extract_faq_from_db(db_row)
    if db_faq and len(db_faq) > len(current_faq):
        if "rendering" not in fm:
            fm["rendering"] = {}
        fm["rendering"]["faq"] = db_faq
        changes["rendering.faq"] = f"{len(current_faq)}->{len(db_faq)} items"

    # ── diagnostic.causes ──
    current_causes = fm.get("diagnostic", {}).get("causes", [])
    if not isinstance(current_causes, list):
        current_causes = []

    if len(current_causes) < 3:
        db_causes = extract_causes_from_decision_tree(db_row)
        new_causes = deduplicate(db_causes, current_causes)
        if new_causes:
            merged = current_causes + new_causes
            if "diagnostic" not in fm:
                fm["diagnostic"] = {}
            fm["diagnostic"]["causes"] = merged
            changes["diagnostic.causes"] = f"{len(current_causes)}->{len(merged)} items"

    # ── Update lifecycle ──
    if changes:
        if "lifecycle" not in fm:
            fm["lifecycle"] = {}
        fm["lifecycle"]["last_enriched_by"] = "script:rag-enrich-from-db"
        fm["lifecycle"]["last_enriched_at"] = today_iso()

    return changes


def main():
    parser = argparse.ArgumentParser(description="Enrich V4 RAG files from DB export")
    parser.add_argument("json_file", help="Path to exported JSON data")
    parser.add_argument("slug", nargs="?", help="Slug of a single gamme")
    parser.add_argument("--all", action="store_true", help="Enrich all gammes")
    parser.add_argument("--apply", action="store_true", help="Write changes (default is dry-run)")
    parser.add_argument("--no-backup", action="store_true", help="Skip backup")
    args = parser.parse_args()

    if not args.slug and not args.all:
        parser.print_help()
        sys.exit(1)

    # Load DB export
    with open(args.json_file, "r", encoding="utf-8") as f:
        db_data = json.load(f)

    # Index by pg_alias
    db_index: dict[str, dict] = {}
    for row in db_data:
        alias = row.get("pg_alias")
        if alias:
            db_index[alias] = row

    print(f"Loaded {len(db_index)} gammes from DB export")

    # Determine slugs to process
    if args.all:
        slugs = sorted(db_index.keys())
    else:
        slugs = [args.slug]

    stats = {"enriched": 0, "skipped_manual": 0, "skipped_no_change": 0,
             "skipped_no_db": 0, "failed": 0}
    field_stats: dict[str, int] = {}

    for slug in slugs:
        filepath = os.path.join(RAG_DIR, f"{slug}.md")
        if not os.path.exists(filepath):
            stats["skipped_no_db"] += 1
            continue

        fm, markdown_body = parse_file(filepath)
        if fm is None:
            stats["failed"] += 1
            print(f"  FAIL: {slug} (parse error)")
            continue

        if is_manually_enriched(fm):
            stats["skipped_manual"] += 1
            continue

        db_row = db_index.get(slug)
        if not db_row:
            stats["skipped_no_db"] += 1
            continue

        changes = enrich_gamme(slug, fm, db_row)

        if not changes:
            stats["skipped_no_change"] += 1
            continue

        # Track field stats
        for field in changes:
            field_stats[field] = field_stats.get(field, 0) + 1

        mode = "APPLY" if args.apply else "DRY-RUN"
        change_summary = ", ".join(f"{k}: {v}" for k, v in changes.items())
        print(f"  {mode}: {slug} [{change_summary}]")

        if args.apply:
            if not args.no_backup:
                os.makedirs(BACKUP_DIR, exist_ok=True)
                backup_path = os.path.join(BACKUP_DIR, f"{slug}.md")
                shutil.copy2(filepath, backup_path)
            write_file(filepath, fm, markdown_body)

        stats["enriched"] += 1

    print(f"\nDone: {stats['enriched']} enriched, "
          f"{stats['skipped_manual']} skipped (manual), "
          f"{stats['skipped_no_change']} skipped (no change), "
          f"{stats['skipped_no_db']} skipped (no DB data), "
          f"{stats['failed']} failed")

    if field_stats:
        print(f"\nEnrichment by field:")
        for field, count in sorted(field_stats.items()):
            print(f"  {field}: {count} gammes")


if __name__ == "__main__":
    main()
