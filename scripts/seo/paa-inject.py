#!/usr/bin/env python3
"""
Injecteur de PAA (People Also Ask) dans __seo_research_brief.

Lit un fichier texte de PAA collectees manuellement et les injecte
dans la table __seo_research_brief via Supabase.

Usage:
    python scripts/seo/paa-inject.py balais-d-essuie-glace
    python scripts/seo/paa-inject.py balais-d-essuie-glace --file data/paa/balais-d-essuie-glace.txt
    python scripts/seo/paa-inject.py balais-d-essuie-glace --dry-run

Format du fichier PAA (1 question par ligne, lignes vides = separateur) :
    Comment savoir quel balai d'essuie-glace pour ma voiture ?
    Quelle est la duree de vie d'un balai d'essuie-glace ?
    ...

Ou mode interactif : saisir les PAA une par une, ligne vide pour terminer.
"""
from __future__ import annotations
import sys
import os
import json
from pathlib import Path
from collections import Counter

# Ajouter le path du client Supabase
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend" / "scripts" / "seo" / "lib"))

from dotenv import load_dotenv

# Charger .env
env_path = Path(__file__).parent.parent.parent / "backend" / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

PAA_DIR = Path(__file__).parent.parent.parent / "data" / "paa"


def get_supabase_client():
    """Cree le client Supabase."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env")
        sys.exit(1)
    return create_client(url, key)


def read_paa_from_file(filepath: str) -> list[str]:
    """Lit les PAA depuis un fichier texte (1 par ligne)."""
    questions = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Ignorer lignes vides et commentaires
            if not line or line.startswith("#") or line.startswith("—"):
                continue
            # Nettoyer les prefixes courants
            line = line.lstrip("- ").lstrip("→ ").lstrip("• ")
            if line and len(line) > 10:
                questions.append(line)
    return questions


def read_paa_interactive() -> list[str]:
    """Lit les PAA en mode interactif."""
    print("Saisissez les PAA (1 par ligne, ligne vide pour terminer) :")
    questions = []
    while True:
        try:
            line = input("  > ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not line:
            break
        if len(line) > 10:
            questions.append(line)
    return questions


def deduplicate_paa(questions: list[str]) -> list[str]:
    """Deduplique les PAA par similarite simple (lowercase + strip ponctuation)."""
    seen = set()
    unique = []
    for q in questions:
        normalized = q.lower().strip().rstrip("?").strip()
        if normalized not in seen:
            seen.add(normalized)
            unique.append(q)
    return unique


def get_existing_brief(supabase, pg_id: str) -> dict | None:
    """Recupere le brief existant pour une gamme."""
    result = supabase.table("__seo_research_brief").select("*").eq("pg_id", pg_id).execute()
    if result.data and len(result.data) > 0:
        return result.data[0]
    return None


def get_pg_id(supabase, slug: str) -> str | None:
    """Recupere le pg_id depuis le slug."""
    result = supabase.table("pieces_gamme").select("pg_id").eq("pg_alias", slug).execute()
    if result.data and len(result.data) > 0:
        return str(result.data[0]["pg_id"])
    return None


def upsert_paa(supabase, pg_id: str, pg_alias: str, questions: list[str], dry_run: bool = False):
    """UPSERT les PAA dans __seo_research_brief."""
    # Formater comme array de questions structurees
    faqs = [{"question": q, "source": "google_paa"} for q in questions]

    existing = get_existing_brief(supabase, pg_id)

    if existing:
        # Merge avec les FAQ existantes
        existing_faqs = existing.get("real_faqs") or []
        if isinstance(existing_faqs, str):
            try:
                existing_faqs = json.loads(existing_faqs)
            except json.JSONDecodeError:
                existing_faqs = []

        # Dedup par question
        existing_questions = {f.get("question", "").lower().strip() for f in existing_faqs if isinstance(f, dict)}
        new_faqs = [f for f in faqs if f["question"].lower().strip() not in existing_questions]
        merged = existing_faqs + new_faqs

        print(f"  Existantes: {len(existing_faqs)} | Nouvelles: {len(new_faqs)} | Total: {len(merged)}")

        if dry_run:
            print(f"\n  [DRY RUN] Pas d'ecriture")
            return

        supabase.table("__seo_research_brief").update({
            "real_faqs": merged,
            "researched_at": "now()",
        }).eq("pg_id", pg_id).execute()
    else:
        print(f"  Nouveau brief: {len(faqs)} PAA")

        if dry_run:
            print(f"\n  [DRY RUN] Pas d'ecriture")
            return

        supabase.table("__seo_research_brief").insert({
            "pg_id": int(pg_id),
            "pg_alias": pg_alias,
            "real_faqs": faqs,
            "researched_at": "now()",
            "researched_by": "paa-inject/manual",
        }).execute()

    print(f"  Ecrit dans __seo_research_brief (pg_id={pg_id})")


def main():
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python paa-inject.py <slug>                    Mode interactif")
        print("  python paa-inject.py <slug> --file <path>      Depuis fichier")
        print("  python paa-inject.py <slug> --dry-run           Simulation")
        print()
        print("Format fichier : 1 question PAA par ligne")
        sys.exit(1)

    slug = sys.argv[1]
    dry_run = "--dry-run" in sys.argv
    file_arg = None

    if "--file" in sys.argv:
        idx = sys.argv.index("--file")
        if idx + 1 < len(sys.argv):
            file_arg = sys.argv[idx + 1]

    # Auto-detecter fichier PAA
    if not file_arg:
        auto_path = PAA_DIR / f"{slug}.txt"
        if auto_path.exists():
            file_arg = str(auto_path)
            print(f"  Fichier PAA auto-detecte: {file_arg}")

    print(f"{'=' * 60}")
    print(f"  PAA INJECT — {slug}")
    print(f"{'=' * 60}")

    # Lire les PAA
    if file_arg:
        if not os.path.exists(file_arg):
            print(f"ERROR: Fichier non trouve: {file_arg}")
            sys.exit(1)
        questions = read_paa_from_file(file_arg)
    else:
        questions = read_paa_interactive()

    if not questions:
        print("Aucune PAA saisie. Abandon.")
        sys.exit(0)

    # Dedup
    questions = deduplicate_paa(questions)
    print(f"\n  PAA uniques: {len(questions)}")
    for i, q in enumerate(questions, 1):
        print(f"    {i:2d}. {q}")

    # Connexion Supabase
    supabase = get_supabase_client()

    # Trouver pg_id
    pg_id = get_pg_id(supabase, slug)
    if not pg_id:
        print(f"\nERROR: Gamme '{slug}' non trouvee dans pieces_gamme")
        sys.exit(1)

    print(f"\n  pg_id: {pg_id}")

    # Injecter
    upsert_paa(supabase, pg_id, slug, questions, dry_run=dry_run)

    print(f"\n{'=' * 60}")
    print(f"  {'[DRY RUN] ' if dry_run else ''}Done")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
