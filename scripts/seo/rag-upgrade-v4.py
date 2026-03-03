#!/usr/bin/env python3
"""
Migration automatique V1 → V4 des fichiers RAG gamme.

Restructure les donnees V1 (mechanical_rules/page_contract) en format
V4 (5 blocs: domain/selection/diagnostic/maintenance/rendering).

Ne genere PAS de nouvelles donnees — restructure uniquement l'existant.
Les champs V4 sans equivalent V1 sont omis (a enrichir plus tard).

Usage:
    python scripts/seo/rag-upgrade-v4.py amortisseur          # 1 fichier
    python scripts/seo/rag-upgrade-v4.py --all                 # tous les V1
    python scripts/seo/rag-upgrade-v4.py --all --dry-run       # preview
    python scripts/seo/rag-upgrade-v4.py --all --stats         # stats uniquement
"""
from __future__ import annotations
import sys
import os
import re
import shutil
import yaml
import glob as glob_mod
import argparse
from datetime import date
from pathlib import Path
from typing import Optional

RAG_DIR = "/opt/automecanik/rag/knowledge/gammes"
BACKUP_DIR = os.path.join(RAG_DIR, ".backup-v1")


def today_iso() -> str:
    return date.today().isoformat()


def parse_file(filepath: str) -> tuple[Optional[dict], str]:
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
            body = match.group(2)
            return fm, body
        except yaml.YAMLError:
            return None, ""

    # No frontmatter delimiters — try parsing entire file as YAML
    try:
        fm = yaml.safe_load(content)
        return fm, ""
    except yaml.YAMLError:
        return None, ""


def is_already_v4(fm: dict) -> bool:
    """Check if file is already V4."""
    for path in [
        ("rendering", "quality", "version"),
        ("page_contract", "quality", "version"),
        ("quality", "version"),
    ]:
        current = fm
        for key in path:
            if not isinstance(current, dict):
                break
            current = current.get(key)
            if current is None:
                break
        else:
            if current == "GammeContentContract.v4":
                return True
    return False


def _safe_dict(val) -> dict:
    """Return val if dict, else empty dict."""
    return val if isinstance(val, dict) else {}


def _safe_list(val) -> list:
    """Return val if list, else empty list."""
    return val if isinstance(val, list) else []


def _map_risk_level(risk: str) -> str:
    """Map V1 risk_level to V4 severity."""
    mapping = {"securite": "securite", "confort": "confort", "immobilisation": "immobilisation"}
    return mapping.get(risk, "confort")


def v1_to_v4(slug: str, fm: dict) -> dict:
    """Convert a V1 frontmatter dict to V4 structure."""
    pc = _safe_dict(fm.get("page_contract"))
    mr = _safe_dict(fm.get("mechanical_rules"))
    dt = _safe_list(fm.get("diagnostic_tree"))
    root_symptoms = _safe_list(fm.get("symptoms"))
    intro = _safe_dict(pc.get("intro")) if isinstance(pc.get("intro"), dict) else {}
    pc_quality = _safe_dict(pc.get("quality"))

    # ── Meta ──
    v4: dict = {}
    v4["category"] = fm.get("category", "")
    v4["slug"] = fm.get("slug", slug)
    v4["title"] = fm.get("title", slug.replace("-", " ").title())
    if fm.get("pg_id") is not None:
        v4["pg_id"] = fm["pg_id"]
    v4["source_type"] = "gamme"
    v4["doc_family"] = "catalog"
    v4["truth_level"] = fm.get("truth_level", "L2")
    v4["updated_at"] = today_iso()
    v4["verification_status"] = "draft"

    intent_targets = _safe_list(fm.get("intent_targets"))
    if intent_targets:
        v4["intent_targets"] = intent_targets
    else:
        v4["intent_targets"] = ["achat", "diagnostic", "compatibilite"]

    v4["business_priority"] = "medium"

    v4["lifecycle"] = {
        "stage": "v4_converted",
        "last_enriched_by": "script:rag-upgrade-v4",
        "last_enriched_at": today_iso(),
    }

    # ── Bloc A: domain ──
    domain: dict = {}

    # role
    role = mr.get("role_summary") or intro.get("role") or ""
    if role:
        domain["role"] = str(role)

    # must_be_true
    mbt = _safe_list(mr.get("must_be_true"))
    if mbt:
        domain["must_be_true"] = mbt

    # must_not_contain
    mnc = _safe_list(mr.get("must_not_contain_concepts"))
    if mnc:
        domain["must_not_contain"] = mnc

    # confusion_with: V1 is dict {piece_type: {key_difference: str}} → V4 list of {term, difference}
    cw_raw = mr.get("confusion_with")
    if isinstance(cw_raw, dict) and cw_raw:
        cw_list = []
        for term, val in cw_raw.items():
            if isinstance(val, dict) and val.get("key_difference"):
                cw_list.append({"term": term, "difference": val["key_difference"]})
            elif isinstance(val, str) and val:
                cw_list.append({"term": term, "difference": val})
        if cw_list:
            domain["confusion_with"] = cw_list

    # related_parts from intro.syncParts
    sync_parts = _safe_list(intro.get("syncParts"))
    if sync_parts:
        domain["related_parts"] = sync_parts

    if domain:
        v4["domain"] = domain

    # ── Bloc B: selection ──
    selection: dict = {}

    # criteria from howToChoose (string → list)
    htc = pc.get("howToChoose")
    if htc:
        if isinstance(htc, str):
            selection["criteria"] = [htc]
        elif isinstance(htc, list):
            selection["criteria"] = htc

    # anti_mistakes
    am = _safe_list(pc.get("antiMistakes"))
    if am:
        selection["anti_mistakes"] = am

    # cost_range from page_contract.risk.costRange
    risk = _safe_dict(pc.get("risk"))
    cost_range_str = risk.get("costRange")
    if cost_range_str and isinstance(cost_range_str, str):
        # Try to parse "120 a 1200 EUR" format
        match = re.match(r"(\d+)\s*[aà]\s*(\d+)\s*EUR", cost_range_str)
        if match:
            selection["cost_range"] = {
                "min": int(match.group(1)),
                "max": int(match.group(2)),
                "currency": "EUR",
                "unit": "l'unite",
                "source": None,
            }

    if selection:
        v4["selection"] = selection

    # ── Bloc C: diagnostic ──
    diagnostic: dict = {}

    # symptoms: prefer root structured symptoms[], fallback to page_contract.symptoms (flat)
    if root_symptoms:
        diag_symptoms = []
        for s in root_symptoms:
            if isinstance(s, dict):
                diag_symptoms.append({
                    "id": s.get("id", ""),
                    "label": s.get("label") or s.get("description", ""),
                    "severity": _map_risk_level(s.get("risk_level", "confort")),
                })
            elif isinstance(s, str):
                diag_symptoms.append({"id": "", "label": s, "severity": "confort"})
        if diag_symptoms:
            diagnostic["symptoms"] = diag_symptoms
    else:
        pc_symp = _safe_list(pc.get("symptoms"))
        if pc_symp:
            diagnostic["symptoms"] = [
                {"id": f"S{i + 1}", "label": str(s), "severity": "confort"}
                for i, s in enumerate(pc_symp)
                if isinstance(s, str)
            ]

    # causes from diagnostic_tree[].then
    if dt:
        causes = []
        for item in dt:
            if isinstance(item, dict) and "then" in item:
                then_val = str(item["then"]).replace("_", " ")
                causes.append(then_val)
        if causes:
            diagnostic["causes"] = causes

    if diagnostic:
        v4["diagnostic"] = diagnostic

    # ── Bloc D: maintenance ──
    maintenance: dict = {}

    timing = _safe_dict(pc.get("timing"))
    if timing:
        km_val = timing.get("km", "")
        years_val = timing.get("years", "")
        note_val = timing.get("note", "")

        interval: dict = {}
        if km_val and km_val != "Controle a chaque revision constructeur":
            interval["value"] = str(km_val)
            interval["unit"] = "km"
        elif years_val and years_val != "Controle annuel recommande":
            interval["value"] = str(years_val)
            interval["unit"] = "mois"
        else:
            interval["value"] = "selon constructeur"
            interval["unit"] = "condition"
        if note_val:
            interval["note"] = str(note_val)
        interval["source"] = None
        maintenance["interval"] = interval

    if maintenance:
        v4["maintenance"] = maintenance

    # ── Rendering ──
    rendering: dict = {}

    rendering["pgId"] = str(fm.get("pg_id", pc.get("pgId", "")))
    rendering["intro_title"] = intro.get("title", f"A quoi sert {v4['title']} ?")

    # risk
    if risk:
        rendering["risk_title"] = risk.get("title", f"Pourquoi remplacer {v4['title']} a temps ?")
        risk_explanation = risk.get("explanation", "")
        if risk_explanation:
            rendering["risk_explanation"] = str(risk_explanation)
        risk_consequences = _safe_list(risk.get("consequences"))
        if risk_consequences:
            rendering["risk_consequences"] = risk_consequences
        risk_conclusion = risk.get("conclusion", "")
        if risk_conclusion:
            rendering["risk_conclusion"] = str(risk_conclusion)

    # arguments
    arguments = _safe_list(pc.get("arguments"))
    if arguments:
        rendering["arguments"] = arguments

    # faq
    faq = _safe_list(pc.get("faq"))
    if faq:
        rendering["faq"] = [
            {
                "question": f.get("question", f.get("q", "")),
                "answer": f.get("answer", f.get("a", "")),
            }
            for f in faq
            if isinstance(f, dict)
        ]

    # quality
    rendering["quality"] = {
        "score": pc_quality.get("score", 50),
        "source": "script:rag-upgrade-v4",
        "version": "GammeContentContract.v4",
    }

    v4["rendering"] = rendering

    # ── Preserve extra fields ──
    if fm.get("seo_cluster"):
        v4["seo_cluster"] = fm["seo_cluster"]

    if fm.get("purchase_guardrails"):
        v4["purchase_guardrails"] = fm["purchase_guardrails"]

    return v4


def write_v4_file(
    slug: str, v4_data: dict, markdown_body: str,
    backup: bool = True, dry_run: bool = False
) -> str:
    """Write the V4 file, return status message."""
    filepath = os.path.join(RAG_DIR, f"{slug}.md")
    backup_path = os.path.join(BACKUP_DIR, f"{slug}.md")

    yaml_str = yaml.dump(
        v4_data,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=120,
    )

    output = f"---\n{yaml_str}---\n"
    if markdown_body.strip():
        output += f"\n{markdown_body.strip()}\n"

    if dry_run:
        return f"DRY-RUN: {len(output)} chars"

    if backup:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        shutil.copy2(filepath, backup_path)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(output)

    return "OK"


def list_all_slugs() -> list[str]:
    """List all gamme slugs in RAG dir."""
    files = glob_mod.glob(os.path.join(RAG_DIR, "*.md"))
    return sorted([Path(f).stem for f in files])


def main():
    parser = argparse.ArgumentParser(description="Migrate RAG gamme files from V1 to V4")
    parser.add_argument("slug", nargs="?", help="Slug of a single gamme to migrate")
    parser.add_argument("--all", action="store_true", help="Migrate all V1 files")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--stats", action="store_true", help="Show stats only")
    parser.add_argument("--no-backup", action="store_true", help="Skip backup")
    args = parser.parse_args()

    if not args.slug and not args.all and not args.stats:
        parser.print_help()
        sys.exit(1)

    slugs = list_all_slugs() if (args.all or args.stats) else [args.slug]

    stats = {"converted": 0, "skipped_v4": 0, "failed": 0, "total": len(slugs)}

    for slug in slugs:
        filepath = os.path.join(RAG_DIR, f"{slug}.md")
        fm, markdown_body = parse_file(filepath)

        if fm is None:
            stats["failed"] += 1
            if not args.stats:
                print(f"  FAIL: {slug} (parse error)")
            continue

        if is_already_v4(fm):
            stats["skipped_v4"] += 1
            if not args.stats and not args.all:
                print(f"  SKIP: {slug} (already V4)")
            continue

        if args.stats:
            stats["converted"] += 1
            continue

        try:
            v4_data = v1_to_v4(slug, fm)
            result = write_v4_file(
                slug, v4_data, markdown_body,
                backup=not args.no_backup,
                dry_run=args.dry_run,
            )
            stats["converted"] += 1
            print(f"  {result}: {slug}")
        except Exception as e:
            stats["failed"] += 1
            print(f"  FAIL: {slug} -- {e}")

    print(
        f"\nDone: {stats['converted']} converted, "
        f"{stats['skipped_v4']} skipped (V4), "
        f"{stats['failed']} failed, "
        f"{stats['total']} total"
    )


if __name__ == "__main__":
    main()
