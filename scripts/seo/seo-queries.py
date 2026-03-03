#!/usr/bin/env python3
"""
Generateur de requetes keyword SEO pour une gamme.

Lit le fichier RAG, extrait les donnees structurees, et genere
les requetes a chercher sur Google groupees par intention.

Usage:
    python scripts/seo/seo-queries.py balais-d-essuie-glace
    python scripts/seo/seo-queries.py --batch 10
    python scripts/seo/seo-queries.py --all
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


def parse_rag_frontmatter(filepath: str) -> Optional[dict]:
    """Parse le frontmatter YAML d'un fichier RAG gamme."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        return None

    # Extraire frontmatter entre ---
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        # Certains fichiers V1 n'ont pas de fermeture ---
        # Tenter de parser tout le contenu comme YAML
        try:
            return yaml.safe_load(content)
        except yaml.YAMLError:
            return None

    try:
        return yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None


def detect_schema(data: dict) -> str:
    """Detecte si le RAG est schema V4 ou V1."""
    if "domain" in data and "selection" in data:
        return "V4"
    if "mechanical_rules" in data or "page_contract" in data:
        return "V1"
    return "unknown"


def get_gamme_name(data: dict) -> str:
    """Extrait le nom lisible de la gamme."""
    if "title" in data:
        return data["title"]
    if "slug" in data:
        return data["slug"].replace("-", " ").title()
    return "Gamme inconnue"


def get_confusion_terms(data: dict) -> list[str]:
    """Extrait les termes de confusion depuis le RAG."""
    terms = []
    # V4
    if "domain" in data and "confusion_with" in (data.get("domain") or {}):
        for item in data["domain"]["confusion_with"]:
            if isinstance(item, dict) and "term" in item:
                terms.append(item["term"])
            elif isinstance(item, str):
                terms.append(item)
    # V1
    if "mechanical_rules" in data and "confusion_with" in (data.get("mechanical_rules") or {}):
        cw = data["mechanical_rules"]["confusion_with"]
        if isinstance(cw, dict):
            terms.extend(cw.keys())
    return terms


def get_symptoms(data: dict) -> list[str]:
    """Extrait les symptomes depuis le RAG."""
    symptoms = []
    if "diagnostic" in data and "symptoms" in (data.get("diagnostic") or {}):
        for s in data["diagnostic"]["symptoms"]:
            if isinstance(s, dict) and "label" in s:
                symptoms.append(s["label"])
            elif isinstance(s, str):
                symptoms.append(s)
    return symptoms


def get_criteria(data: dict) -> list[str]:
    """Extrait les criteres de selection depuis le RAG."""
    if "selection" in data and "criteria" in (data.get("selection") or {}):
        return data["selection"]["criteria"] or []
    return []


def get_seo_cluster(data: dict) -> dict:
    """Extrait le seo_cluster depuis le RAG."""
    return data.get("seo_cluster", {}) or {}


def generate_queries(slug: str, data: dict) -> str:
    """Genere les requetes formatees pour une gamme."""
    name = get_gamme_name(data)
    schema = detect_schema(data)
    confusion = get_confusion_terms(data)
    symptoms = get_symptoms(data)
    criteria = get_criteria(data)
    seo = get_seo_cluster(data)
    priority = data.get("business_priority", "n/a")
    searches = (data.get("priority_signals") or {}).get("monthly_searches", "n/a")

    lines = []
    lines.append(f"{'=' * 70}")
    lines.append(f"  REQUETES KEYWORD — {name}")
    lines.append(f"  slug: {slug} | schema: {schema} | priority: {priority} | searches: {searches}/mois")
    lines.append(f"{'=' * 70}")

    # 1. Transactionnelles (R1)
    lines.append(f"\n{'─' * 50}")
    lines.append("  1. TRANSACTIONNELLES (R1 — reference)")
    lines.append(f"{'─' * 50}")
    lines.append(f'  → "{name} pas cher"')
    lines.append(f'  → "prix {name}"')
    lines.append(f'  → "acheter {name} en ligne"')
    lines.append(f'  → "commander {name}"')

    # 2. Informationnelles (R3 conseil)
    lines.append(f"\n{'─' * 50}")
    lines.append("  2. INFORMATIONNELLES (R3 conseil)")
    lines.append(f"{'─' * 50}")
    lines.append(f'  → "quand changer {name}"')
    lines.append(f'  → "comment changer {name}"')
    lines.append(f'  → "symptome {name} use"')
    lines.append(f'  → "{name} duree de vie"')
    if symptoms:
        lines.append(f"\n  Depuis symptomes RAG ({len(symptoms)} detectes) :")
        for s in symptoms[:4]:
            # Extraire un keyword court du symptome
            short = s.split("(")[0].strip().lower()[:60]
            lines.append(f'  → "{short}"')

    # 3. Guide-achat (R3 selection)
    lines.append(f"\n{'─' * 50}")
    lines.append("  3. GUIDE-ACHAT (R3 selection — cible S3)")
    lines.append(f"{'─' * 50}")
    lines.append(f'  → "comment choisir {name}"')
    lines.append(f'  → "meilleur {name}"')
    lines.append(f'  → "{name} comparatif"')
    if criteria:
        lines.append(f"\n  Depuis criteres RAG ({len(criteria)} detectes) :")
        for c in criteria[:4]:
            # Extraire le premier mot-cle du critere
            keyword = c.split("(")[0].split(":")[0].strip().lower()[:50]
            lines.append(f'  → "{name} {keyword}"')

    # 4. Diagnostic (R5)
    lines.append(f"\n{'─' * 50}")
    lines.append("  4. DIAGNOSTIC (R5)")
    lines.append(f"{'─' * 50}")
    lines.append(f'  → "bruit {name}"')
    lines.append(f'  → "voyant {name}"')
    lines.append(f'  → "panne {name} symptome"')
    if symptoms:
        for s in symptoms[:3]:
            short = s.split("(")[0].strip().lower()[:50]
            lines.append(f'  → "{short} voiture"')

    # 5. Confusion / Differenciation
    if confusion:
        lines.append(f"\n{'─' * 50}")
        lines.append("  5. CONFUSION / DIFFERENCIATION")
        lines.append(f"{'─' * 50}")
        for term in confusion:
            lines.append(f'  → "difference {name} et {term}"')
            lines.append(f'  → "{name} ou {term}"')

    # 6. Depuis seo_cluster (si present)
    if seo:
        pk = seo.get("primary_keyword")
        variants = seo.get("keyword_variants", [])
        lines.append(f"\n{'─' * 50}")
        lines.append("  6. DEPUIS SEO CLUSTER")
        lines.append(f"{'─' * 50}")
        if pk:
            lines.append(f'  → "{pk}" (primary)')
        for v in (variants or [])[:5]:
            lines.append(f'  → "{v}"')

    # 7. PAA a capturer
    lines.append(f"\n{'─' * 50}")
    lines.append("  7. PAA A CAPTURER SUR GOOGLE")
    lines.append(f"{'─' * 50}")
    lines.append(f'  Chercher "{name}" → noter 4-8 PAA')
    lines.append(f'  Chercher "quand changer {name}" → noter PAA')
    lines.append(f'  Chercher "comment choisir {name}" → noter PAA')
    if confusion:
        lines.append(f'  Chercher "{name} ou {confusion[0]}" → noter PAA')

    lines.append(f"\n{'=' * 70}")
    return "\n".join(lines)


def list_all_rag_slugs() -> list[str]:
    """Liste tous les slugs de gammes RAG disponibles."""
    files = glob_mod.glob(os.path.join(RAG_DIR, "*.md"))
    return sorted([Path(f).stem for f in files])


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python seo-queries.py <slug>           Requetes pour 1 gamme")
        print("  python seo-queries.py --batch <N>      Requetes pour N gammes (ordre alpha)")
        print("  python seo-queries.py --all             Requetes pour toutes les gammes")
        print()
        print("Exemples:")
        print("  python seo-queries.py balais-d-essuie-glace")
        print("  python seo-queries.py --batch 5")
        sys.exit(1)

    if sys.argv[1] == "--all":
        slugs = list_all_rag_slugs()
    elif sys.argv[1] == "--batch":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        slugs = list_all_rag_slugs()[:n]
    else:
        slugs = [sys.argv[1]]

    for slug in slugs:
        filepath = os.path.join(RAG_DIR, f"{slug}.md")
        data = parse_rag_frontmatter(filepath)

        if data is None:
            print(f"\n⚠️  RAG non trouve : {filepath}")
            continue

        output = generate_queries(slug, data)
        print(output)
        print()


if __name__ == "__main__":
    main()
