#!/usr/bin/env python3
"""
Verificateur de suffisance RAG pour les sections SEO.

Lit le fichier RAG d'une gamme et verifie si les blocs requis
sont presents et suffisants pour generer chaque section conseil.

Supporte les schemas V1 (mechanical_rules/page_contract) et V4
(domain/selection/diagnostic/maintenance/rendering) avec fallback
automatique V1 quand le fichier n'est pas encore migre.

Usage:
    python scripts/seo/rag-check.py balais-d-essuie-glace
    python scripts/seo/rag-check.py --all
    python scripts/seo/rag-check.py --missing-only
    python scripts/seo/rag-check.py --summary
"""
from __future__ import annotations
import sys
import os
import re
import yaml
import glob as glob_mod
from pathlib import Path
from typing import Optional

RAG_DIR = "/opt/automecanik/rag/knowledge/gammes"

# Mapping section → blocs RAG requis + minimum items
SECTION_REQUIREMENTS = {
    "S1": {
        "label": "Role de la piece",
        "checks": [
            {"path": "domain.role", "min": 1, "type": "non_empty"},
        ],
    },
    "S2": {
        "label": "Quand remplacer",
        "checks": [
            {"path": "maintenance.interval", "min": 1, "type": "non_empty"},
            {"path": "maintenance.wear_signs", "min": 1, "type": "list"},
        ],
    },
    "S2_DIAG": {
        "label": "Diagnostic symptomes",
        "checks": [
            {"path": "diagnostic.symptoms", "min": 2, "type": "list"},
            {"path": "diagnostic.quick_checks", "min": 1, "type": "list"},
        ],
    },
    "S3": {
        "label": "Guide de selection",
        "checks": [
            {"path": "selection.criteria", "min": 3, "type": "list"},
        ],
    },
    "S4_DEPOSE": {
        "label": "Etapes de depose",
        "checks": [
            {"path": "diagnostic.causes", "min": 3, "type": "list"},
        ],
    },
    "S5": {
        "label": "Erreurs a eviter",
        "checks": [
            {"path": "selection.anti_mistakes", "min": 3, "type": "list"},
        ],
    },
    "S6": {
        "label": "Bonnes pratiques entretien",
        "checks": [
            {"path": "maintenance.good_practices", "min": 2, "type": "list"},
        ],
    },
    "S8": {
        "label": "FAQ",
        "checks": [
            {"path": "rendering.faq", "min": 3, "type": "list"},
        ],
    },
}

# V1 fallback paths for each V4 path.
# None = no V1 equivalent exists (expected missing, not a real failure).
V1_FALLBACK_MAP: dict[str, list[str] | None] = {
    "domain.role": ["mechanical_rules.role_summary", "page_contract.intro.role"],
    "maintenance.interval": ["page_contract.timing"],
    "maintenance.wear_signs": None,
    "diagnostic.symptoms": ["symptoms", "page_contract.symptoms"],
    "diagnostic.quick_checks": None,
    "selection.criteria": ["page_contract.howToChoose"],
    "diagnostic.causes": ["diagnostic_tree"],
    "selection.anti_mistakes": ["page_contract.antiMistakes"],
    "maintenance.good_practices": None,
    "rendering.faq": ["page_contract.faq"],
}

# Status severity order (lower = better)
_STATUS_ORDER = {"PASS": 0, "PASS_V1": 1, "NO_V1_EQUIV": 2, "FAIL": 3}


def _worst(current: str, new: str) -> str:
    """Return the worst (highest severity) status."""
    return new if _STATUS_ORDER.get(new, 0) > _STATUS_ORDER.get(current, 0) else current


def parse_rag_frontmatter(filepath: str) -> Optional[dict]:
    """Parse le frontmatter YAML d'un fichier RAG gamme."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        return None

    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        try:
            return yaml.safe_load(content)
        except yaml.YAMLError:
            return None

    try:
        return yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None


def resolve_path(data: dict, path: str):
    """Resout un chemin YAML en pointille (ex: 'domain.role')."""
    parts = path.split(".")
    current = data
    for part in parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
        if current is None:
            return None
    return current


def detect_schema(data: dict) -> str:
    """Detecte le schema du RAG."""
    if "domain" in data and "selection" in data:
        return "V4"
    if "mechanical_rules" in data or "page_contract" in data:
        return "V1"
    return "unknown"


def resolve_v1_path(data: dict, v4_path: str):
    """
    Try to resolve a V4 path from V1 data using fallback map.
    Returns (value, source_path) or (None, None).
    Returns (None, "NO_V1_EQUIV") when no V1 equivalent exists.
    """
    fallbacks = V1_FALLBACK_MAP.get(v4_path)
    if fallbacks is None:
        return None, "NO_V1_EQUIV"

    for fb_path in fallbacks:
        value = resolve_path(data, fb_path)
        if value is None:
            continue

        # Transform V1 data to match V4 expectations

        # page_contract.howToChoose is a single string → wrap as list
        if v4_path == "selection.criteria" and isinstance(value, str):
            value = [value]

        # diagnostic_tree is [{if, then}] → extract "then" values as causes
        if v4_path == "diagnostic.causes" and isinstance(value, list):
            causes = []
            for item in value:
                if isinstance(item, dict) and "then" in item:
                    causes.append(str(item["then"]))
                elif isinstance(item, str):
                    causes.append(item)
            if causes:
                value = causes

        # symptoms: root structured [{id, label, ...}] → extract labels
        # page_contract.symptoms is already flat string[]
        if v4_path == "diagnostic.symptoms" and isinstance(value, list):
            labels = []
            for item in value:
                if isinstance(item, dict) and "label" in item:
                    labels.append(item["label"])
                elif isinstance(item, str):
                    labels.append(item)
            if labels:
                value = labels

        return value, fb_path

    return None, None


def check_gamme(slug: str, data: dict) -> dict:
    """Verifie la suffisance RAG pour toutes les sections."""
    schema = detect_schema(data)
    title = data.get("title", slug.replace("-", " ").title())
    results = {}

    for section, req in SECTION_REQUIREMENTS.items():
        section_result = {
            "label": req["label"],
            "status": "PASS",
            "details": [],
        }

        for check in req["checks"]:
            path = check["path"]
            value = resolve_path(data, path)
            resolved_via = "v4"

            # V1 fallback: if V4 path not found and file is V1/unknown
            if value is None and schema != "V4":
                v1_value, v1_source = resolve_v1_path(data, path)
                if v1_source == "NO_V1_EQUIV":
                    resolved_via = "no_v1_equiv"
                elif v1_value is not None:
                    value = v1_value
                    resolved_via = f"v1:{v1_source}"

            if check["type"] == "non_empty":
                if not value or (isinstance(value, str) and len(value.strip()) == 0):
                    if resolved_via == "no_v1_equiv":
                        section_result["status"] = _worst(section_result["status"], "NO_V1_EQUIV")
                        section_result["details"].append(
                            f"{path} : NO_V1_EQUIV (pas de V1 equivalent)"
                        )
                    else:
                        section_result["status"] = _worst(section_result["status"], "FAIL")
                        section_result["details"].append(
                            f"{path} : ABSENT ou vide"
                        )
                else:
                    if resolved_via.startswith("v1:"):
                        section_result["status"] = _worst(section_result["status"], "PASS_V1")
                    section_result["details"].append(
                        f"{path} : OK ({resolved_via})"
                    )

            elif check["type"] == "list":
                if not value or not isinstance(value, list):
                    if resolved_via == "no_v1_equiv":
                        section_result["status"] = _worst(section_result["status"], "NO_V1_EQUIV")
                        section_result["details"].append(
                            f"{path} : NO_V1_EQUIV (pas de V1 equivalent)"
                        )
                    else:
                        section_result["status"] = _worst(section_result["status"], "FAIL")
                        section_result["details"].append(
                            f'{path} : ABSENT (besoin {check["min"]}+)'
                        )
                elif len(value) < check["min"]:
                    section_result["status"] = _worst(section_result["status"], "FAIL")
                    section_result["details"].append(
                        f'{path} : {len(value)} items (besoin {check["min"]}+) ({resolved_via})'
                    )
                else:
                    if resolved_via.startswith("v1:"):
                        section_result["status"] = _worst(section_result["status"], "PASS_V1")
                    section_result["details"].append(
                        f"{path} : OK ({len(value)} items) ({resolved_via})"
                    )

        results[section] = section_result

    # Sources E-E-A-T
    sources = data.get("_sources", {})
    has_sources = bool(sources) and len(sources) > 0

    pass_count = sum(1 for r in results.values() if r["status"] in ("PASS", "PASS_V1"))
    v1_count = sum(1 for r in results.values() if r["status"] == "PASS_V1")
    no_equiv_count = sum(1 for r in results.values() if r["status"] == "NO_V1_EQUIV")
    fail_count = sum(1 for r in results.values() if r["status"] == "FAIL")

    return {
        "slug": slug,
        "title": title,
        "schema": schema,
        "sections": results,
        "has_sources": has_sources,
        "source_count": len(sources) if sources else 0,
        "pass_count": pass_count,
        "v1_count": v1_count,
        "no_equiv_count": no_equiv_count,
        "fail_count": fail_count,
        "total": len(results),
    }


def print_gamme_report(result: dict, verbose: bool = True):
    """Affiche le rapport pour une gamme."""
    slug = result["slug"]
    title = result["title"]
    schema = result["schema"]
    passed = result["pass_count"]
    total = result["total"]
    fail_count = result["fail_count"]
    pct = int(100 * passed / total) if total else 0

    status_icon = "✅" if fail_count == 0 else "⚠️" if passed >= total // 2 else "❌"

    print(f"\n{status_icon} {title} ({slug})")
    print(f"   Schema: {schema} | Couverture: {passed}/{total} ({pct}%) | Sources: {result['source_count']}")

    if verbose:
        print(f"   {'─' * 55}")
        for section, res in result["sections"].items():
            status = res["status"]
            if status == "PASS":
                icon = "✅"
            elif status == "PASS_V1":
                icon = "🔄"
            elif status == "NO_V1_EQUIV":
                icon = "➖"
            else:
                icon = "❌"

            print(f"   {icon} {section:12s} {res['label']:30s}", end="")
            if status == "FAIL":
                fails = [d for d in res["details"] if "ABSENT" in d or "items" in d]
                if fails:
                    print(f" <- {fails[0]}", end="")
            elif status == "PASS_V1":
                v1_details = [d for d in res["details"] if "v1:" in d]
                if v1_details:
                    print(f" (via V1)", end="")
            print()

        if not result["has_sources"]:
            print(f"   ⚠️  AUCUNE source E-E-A-T dans _sources")


def print_summary(results: list[dict]):
    """Affiche le resume global."""
    total_gammes = len(results)
    full_pass = sum(1 for r in results if r["fail_count"] == 0 and r["no_equiv_count"] == 0)
    full_pass_with_v1 = sum(1 for r in results if r["fail_count"] == 0)
    v4_count = sum(1 for r in results if r["schema"] == "V4")
    v1_count = sum(1 for r in results if r["schema"] == "V1")
    no_sources = sum(1 for r in results if not r["has_sources"])

    # Section breakdown
    section_stats: dict[str, dict[str, int]] = {}
    for r in results:
        for section, res in r["sections"].items():
            if section not in section_stats:
                section_stats[section] = {"PASS": 0, "PASS_V1": 0, "NO_V1_EQUIV": 0, "FAIL": 0}
            section_stats[section][res["status"]] = section_stats[section].get(res["status"], 0) + 1

    print(f"\n{'=' * 70}")
    print(f"  RESUME RAG — {total_gammes} gammes analysees")
    print(f"{'=' * 70}")
    print(f"  Schema V4 : {v4_count} | Schema V1 : {v1_count} | Autre : {total_gammes - v4_count - v1_count}")
    print(f"  Completes (natif V4) : {full_pass} | Completes (avec V1 fallback) : {full_pass_with_v1} | Avec FAIL : {total_gammes - full_pass_with_v1}")
    print(f"  Sans sources : {no_sources}/{total_gammes}")

    print(f"\n  Ventilation par section :")
    print(f"    {'Section':12s} {'Label':30s} {'PASS':>5s} {'V1':>5s} {'NoEq':>5s} {'FAIL':>5s}")
    print(f"    {'─' * 62}")
    for section in SECTION_REQUIREMENTS:
        stats = section_stats.get(section, {})
        label = SECTION_REQUIREMENTS[section]["label"]
        print(
            f"    {section:12s} {label:30s} "
            f"{stats.get('PASS', 0):>5d} "
            f"{stats.get('PASS_V1', 0):>5d} "
            f"{stats.get('NO_V1_EQUIV', 0):>5d} "
            f"{stats.get('FAIL', 0):>5d}"
        )


def list_all_rag_slugs() -> list[str]:
    """Liste tous les slugs de gammes RAG disponibles."""
    files = glob_mod.glob(os.path.join(RAG_DIR, "*.md"))
    return sorted([Path(f).stem for f in files])


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python rag-check.py <slug>           Verifie 1 gamme")
        print("  python rag-check.py --all             Verifie toutes les gammes RAG")
        print("  python rag-check.py --missing-only    Affiche seulement les gammes incompletes")
        print("  python rag-check.py --summary         Resume global uniquement")
        sys.exit(1)

    missing_only = "--missing-only" in sys.argv
    summary_only = "--summary" in sys.argv
    show_all = "--all" in sys.argv or missing_only or summary_only

    if show_all:
        slugs = list_all_rag_slugs()
    else:
        slugs = [a for a in sys.argv[1:] if not a.startswith("--")]

    results = []
    for slug in slugs:
        filepath = os.path.join(RAG_DIR, f"{slug}.md")
        data = parse_rag_frontmatter(filepath)

        if data is None:
            print(f"⚠️  RAG non trouve : {filepath}")
            continue

        result = check_gamme(slug, data)
        results.append(result)

        if not summary_only:
            if missing_only and result["fail_count"] == 0:
                continue
            print_gamme_report(result, verbose=not show_all)

    if len(results) > 1 or summary_only:
        print_summary(results)


if __name__ == "__main__":
    main()
