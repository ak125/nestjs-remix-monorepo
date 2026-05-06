#!/usr/bin/env python3
"""
gamme-skeleton-generator.py — Génère les fiches gamme **skeleton** depuis
DB pieces_gamme vers automecanik-wiki/exports/rag/gammes/<pg_alias>.md.

Suit ADR-042 (vault commit e5b8632f, status `proposed`) — Pattern A
(skeleton from DB, pas import legacy raw). Mirror pattern de
brand-fiche-generator.py (livré PR wiki #22).

Sans body. L'enricher `gamme-from-web-corpus-generator.py` qui suit
mappe les fichiers wiki/exports/rag/gammes/<slug>.md existants vers le
corpus web OEM (automecanik-raw/recycled/rag-knowledge/web/) pour
ajouter `phase5_enrichment`. Sans skeleton, l'enricher skip 237/237
(condition `if not os.path.exists(gamme_path)` ligne 639).

Reads :  pieces_gamme via Supabase REST (G1/G2 actives, pg_alias non-null)
Writes : $AUTOMECANIK_WIKI_PATH/exports/rag/gammes/<pg_alias>.md
        (skeleton frontmatter, body vide — body ajouté par phase5 enricher)

Idempotency : si fichier existant ET frontmatter contient
`last_enriched_by: script:gamme-skeleton-generator`, skip sauf --force.
Préserve le body existant (en case ré-écriture avec --force).

Configurable via env :
  AUTOMECANIK_WIKI_PATH (default /opt/automecanik/automecanik-wiki)
  SUPABASE_URL          (default https://cxpojprgwgubzjyqzmoq.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY (requis)

Usage :
  python3 scripts/wiki-generators/gamme-skeleton-generator.py [--gamme alias] [--limit N] [--dry-run] [--force]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests
    import yaml
except ImportError:
    print("pip install requests pyyaml", file=sys.stderr)
    sys.exit(1)

# ==========================================================================
# CONFIG
# ==========================================================================

# OUTPUT path : wiki/exports/rag/gammes/ (ADR-031 §D20).
WIKI_REPO = Path(os.environ.get("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))
GAMMES_DIR = WIKI_REPO / "exports" / "rag" / "gammes"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

SCHEMA_VERSION = 1
SCRIPT_ID = "script:gamme-skeleton-generator"
TIMEOUT = 15


def _build_headers() -> dict[str, str]:
    if not SERVICE_ROLE_KEY:
        sys.stderr.write("[FATAL] SUPABASE_SERVICE_ROLE_KEY missing in env\n")
        sys.exit(2)
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


# ==========================================================================
# DB FETCH
# ==========================================================================


def fetch_gammes() -> list[dict[str, Any]]:
    """Fetch active G1/G2 gammes from pieces_gamme via Supabase REST.

    Filters : pg_alias non-null. pg_level cast en string en DB ('1', '2', ...).
    Range élargi à G1+G2 pour couvrir les 232 gammes éligibles.
    """
    url = f"{SUPABASE_URL}/rest/v1/pieces_gamme"
    params = {
        "select": "pg_id,pg_alias,pg_name,pg_level,pg_top,pg_display",
        "pg_alias": "not.is.null",
        "pg_level": "in.(1,2)",
        "order": "pg_id.asc",
    }
    r = requests.get(url, params=params, headers=_build_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


# ==========================================================================
# FRONTMATTER COMPOSITION
# ==========================================================================


def compute_content_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def compose_frontmatter(gamme: dict[str, Any]) -> dict[str, Any]:
    """Compose le frontmatter skeleton.

    Cohérent avec brand-fiche-generator.py — keys factuels DB-derived,
    pas d'invention. L'enricher phase5 ajoute `phase5_enrichment` plus
    tard. truth_level=L2 / verification_status=draft per ADR-039 (Zod
    canon wiki frontmatter) et `feedback_no_bricolage_human_vs_auto_content`
    (script-source ⟹ L2 draft, jamais proposals/).
    """
    fm: dict[str, Any] = {
        "slug": gamme["pg_alias"],
        "pg_id": int(gamme["pg_id"]),
        "pg_name": gamme["pg_name"],
        "category": "gamme",
        "lang": "fr",
        "pg_level": str(gamme.get("pg_level") or ""),
        "pg_top": str(gamme.get("pg_top") or "0"),
        "pg_display": str(gamme.get("pg_display") or "0"),
    }

    today = datetime.now(timezone.utc).date().isoformat()
    payload_for_hash = {k: v for k, v in fm.items() if k != "lifecycle"}
    fm["truth_level"] = "L2"
    fm["verification_status"] = "draft"
    fm["lifecycle"] = {
        "last_enriched_at": today,
        "last_enriched_by": SCRIPT_ID,
        "content_hash": compute_content_hash(payload_for_hash),
        "schema_version": SCHEMA_VERSION,
    }
    fm["updated_at"] = today
    return fm


# ==========================================================================
# I/O
# ==========================================================================


def load_existing_body(path: Path) -> str:
    if not path.exists():
        return ""
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n[\s\S]*?\n---\n?([\s\S]*)$", raw)
    return m.group(1).lstrip() if m else raw


def existing_was_skeleton(path: Path) -> bool:
    """Return True iff the existing file already carries the skeleton-generator
    marker (idempotency check — re-running without --force is a no-op)."""
    if not path.exists():
        return False
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n([\s\S]*?)\n---", raw)
    if not m:
        return False
    try:
        fm = yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return False
    return (fm.get("lifecycle") or {}).get("last_enriched_by") == SCRIPT_ID


def write_gamme_md(path: Path, frontmatter: dict[str, Any], body: str) -> None:
    yaml_text = yaml.dump(
        frontmatter,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=120,
    )
    path.write_text(f"---\n{yaml_text}---\n{body}", encoding="utf-8")


# ==========================================================================
# VALIDATION
# ==========================================================================


def validate_frontmatter(fm: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for required in ("slug", "pg_id", "pg_name", "category", "lifecycle", "truth_level"):
        if required not in fm:
            errors.append(f"champ requis manquant : {required}")
    if not isinstance(fm.get("pg_id"), int):
        errors.append("pg_id doit être int")
    if fm.get("category") != "gamme":
        errors.append("category doit être 'gamme'")
    if fm.get("truth_level") != "L2":
        errors.append("truth_level doit être 'L2' (canon skeleton)")
    return errors


# ==========================================================================
# PIPELINE
# ==========================================================================


def build_gamme(gamme: dict[str, Any], dry_run: bool, force: bool) -> tuple[str, dict[str, Any] | None]:
    """status ∈ {'built', 'skipped-already', 'failed-validation'}"""
    alias = gamme["pg_alias"]
    pg_id = gamme["pg_id"]
    print(f"\n📦 {alias} (pg_id={pg_id})")

    md_path = GAMMES_DIR / f"{alias}.md"
    if md_path.exists() and existing_was_skeleton(md_path) and not force:
        print(f"  ⏭️  skeleton existant ({SCRIPT_ID}) — skip (utiliser --force pour ré-écrire)")
        return "skipped-already", None

    fm = compose_frontmatter(gamme)
    errors = validate_frontmatter(fm)
    if errors:
        print(f"  ❌ validation échouée : {errors}")
        return "failed-validation", None

    if dry_run:
        print(f"  [DRY-RUN] frontmatter valide, {len(fm)} champs")
        return "built", fm

    body = load_existing_body(md_path)
    write_gamme_md(md_path, fm, body)
    print(f"  ✅ {md_path.name} écrit ({len(fm)} champs, body={len(body)}c préservé)")
    return "built", fm


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate wiki gamme skeleton frontmatter from DB pieces_gamme")
    ap.add_argument("--gamme", help="Un alias spécifique (ex: cardan)")
    ap.add_argument("--limit", type=int, default=0, help="cap iterations (0=all)")
    ap.add_argument("--dry-run", action="store_true", help="no DB write")
    ap.add_argument("--force", action="store_true", help="re-write skeletons même si déjà présents")
    args = ap.parse_args()

    if not args.dry_run:
        GAMMES_DIR.mkdir(parents=True, exist_ok=True)

    gammes = fetch_gammes()
    if args.gamme:
        gammes = [g for g in gammes if g.get("pg_alias") == args.gamme]
        if not gammes:
            print(f"ERREUR : gamme '{args.gamme}' introuvable dans G1/G2", file=sys.stderr)
            return 2
    if args.limit > 0:
        gammes = gammes[: args.limit]

    print(f"📦 {len(gammes)} gamme(s) à traiter — dry_run={args.dry_run} force={args.force}")
    stats = {"built": 0, "skipped-already": 0, "failed-validation": 0}
    for gamme in gammes:
        status, _ = build_gamme(gamme, args.dry_run, args.force)
        stats[status] += 1

    print(
        f"\n=== Résumé : built={stats['built']} skipped={stats['skipped-already']} failed={stats['failed-validation']} ==="
    )
    return 0 if stats["failed-validation"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
