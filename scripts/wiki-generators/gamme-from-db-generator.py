#!/usr/bin/env python3
"""
gamme-from-db-generator.py — Injecte un bloc DB-MANAGED `db_profile` (faits DB
possédés) dans les fiches RAW gamme déjà présentes, SANS jamais toucher
l'éditorial humain ni écrire en DB.

Famille = `vehicle-from-db-generator.py` / `diagnostic-from-db-generator.py`
(même mécanique DB-MANAGED BLOCK, même flux RAW→WIKI→exports→consumers,
ADR-031). DIFFÉRENCE : les ~241 fiches gamme EXISTENT déjà
(`recycled/rag-knowledge/gammes/*.md`) avec leur frontmatter + éditorial → ce
générateur fonctionne UNIQUEMENT en mode merge additif : il insère/rafraîchit
le bloc `db_profile` délimité et laisse TOUT le reste byte-à-byte. Aucune
création de fiche, aucun écrasement, aucune écriture DB.

⚠️ INVARIANT (owner 2026-06-13) : RAW n'a PAS le droit d'écrire en DB. Ce script
fait des SELECT seuls (`pieces_gamme`, `gamme_aggregates`) — jamais POST/PATCH.
À l'opposé du legacy `gamme-from-db-template-generator.py` qui PATCH
`__rag_knowledge` (couche RAG = chatbot only) : NE PAS confondre / NE PAS étendre.

Faits DB injectés (structurels, zéro invention) : identité gamme (pg_id/alias/
name/level/g_level/universelle/parent) + échelle catalogue (products_total +
breakdown direct/via_vehicles/via_family, vehicles_total) + provenance
(`computed_at`). EXCLUS volontairement : V-Level (`vlevel_counts`/v2..v5 — owner
« pas encore fini »), pricing (`price_*_rag` — provenance RAG suspecte) et
scoring dérivé (`seo_score`/`priority_score`) — ce sont des dérivés, pas des
faits bruts. Le maillage fuel-aware / éditorial vient du scraping (PR-C), jamais
ici.

Config env :
  AUTOMECANIK_RAW_PATH   (default /opt/automecanik/automecanik-raw)
  BACKEND_ENV_FILE       (optionnel) — fichier .env portant SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY

Usage :
  # dry-run : montre le merge dans --out-dir, n'écrit pas dans le RAW
  python3 scripts/wiki-generators/gamme-from-db-generator.py --dry-run --out-dir /tmp/g --limit 3
  # masse : injecte db_profile dans toutes les fiches gamme du RAW
  python3 scripts/wiki-generators/gamme-from-db-generator.py --merge-managed-blocks
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import yaml

SCRIPT_ID = "script:gamme-from-db-generator@v1"
RAW_REPO = Path(os.environ.get("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
GAMMES_SUBDIR = Path("recycled") / "rag-knowledge" / "gammes"
TIMEOUT = 30
PAGE_SIZE = 1000  # cap PostgREST — pagination Range obligatoire au-delà

# Bloc db_profile UNIQUEMENT (les fiches gamme portent leur propre éditorial +
# frontmatter ; on n'injecte QUE des faits DB délimités). validation_notes
# capture les écarts honnêtes (gamme sans ligne gamme_aggregates, etc.).
MANAGED_KEYS = ("db_profile", "validation_notes")


# ==========================================================================
# ENV + ACCÈS DB (SELECT ONLY)
# ==========================================================================


def load_backend_env() -> None:
    """Charge SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY depuis backend/.env si absents."""
    if os.environ.get("SUPABASE_SERVICE_ROLE_KEY"):
        return
    candidates = []
    if os.environ.get("BACKEND_ENV_FILE"):
        candidates.append(Path(os.environ["BACKEND_ENV_FILE"]))
    candidates.append(Path(__file__).resolve().parents[2] / "backend" / ".env")
    for env_file in candidates:
        if not env_file.is_file():
            continue
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r"^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$", line.strip())
            if m and not os.environ.get(m.group(1)):
                os.environ[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        break


load_backend_env()
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def _require_key() -> None:
    if not SERVICE_ROLE_KEY:
        sys.stderr.write("ERREUR : SUPABASE_SERVICE_ROLE_KEY absent (voir backend/.env)\n")
        sys.exit(2)


def sb_select(table: str, params: dict[str, str]) -> list[dict]:
    """SELECT REST paginé (Range headers) — contourne le cap 1000 lignes PostgREST.

    Lecture seule : GET uniquement, jamais de POST/PATCH/DELETE (invariant RAW≠DB-write).
    """
    _require_key()
    rows: list[dict] = []
    offset = 0
    query = urllib.parse.urlencode(params)
    while True:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/{table}?{query}",
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                page = json.load(resp)
        except urllib.error.HTTPError as e:
            sys.stderr.write(f"ERREUR REST {table}: HTTP {e.code} — {e.read()[:300]!r}\n")
            sys.exit(2)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


# ==========================================================================
# HELPERS
# ==========================================================================


def to_int(value) -> int | None:
    """Coercition défensive : plusieurs colonnes pg_* sont TEXT en DB (anti-pattern connu)."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or not re.fullmatch(r"-?\d+", s):
        return None
    return int(s)


def to_bool(value):
    """gamme_universelle est boolean en DB ; défensif si jamais TEXT/None."""
    if isinstance(value, bool):
        return value
    if value is None:
        return None
    return str(value).strip().lower() in ("true", "t", "1", "yes")


def dump_yaml(data) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=110, default_flow_style=False)


def parse_frontmatter(text: str) -> dict | None:
    """Frontmatter YAML d'une fiche (avant les blocs managed / l'éditorial). None si absent."""
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---", 4)
    if end == -1:
        return None
    fm_text = text[4:end]
    # Coupe avant le 1er bloc managed (qui vit DANS le frontmatter, après les clés stables).
    cut = fm_text.find("# >>> DB-MANAGED BLOCK:")
    if cut != -1:
        fm_text = fm_text[:cut]
    try:
        data = yaml.safe_load(fm_text)
        return data if isinstance(data, dict) else None
    except yaml.YAMLError:
        return None


# ==========================================================================
# FAITS DB → db_profile (SELECT ONLY)
# ==========================================================================


def fetch_gamme_facts() -> tuple[dict[int, dict], dict[int, dict]]:
    """Indexe pieces_gamme et gamme_aggregates par pg_id (SELECT only)."""
    pg_rows = sb_select("pieces_gamme", {
        "select": "pg_id,pg_alias,pg_name,pg_level,pg_g_level,pg_top,pg_display,"
                  "pg_parent_gamme_id,gamme_universelle,pg_status",
    })
    ga_rows = sb_select("gamme_aggregates", {
        "select": "ga_pg_id,products_total,products_direct,products_via_vehicles,"
                  "products_via_family,vehicles_total,pg_level,g_level,computed_at",
    })
    pg_by_id = {to_int(r.get("pg_id")): r for r in pg_rows if to_int(r.get("pg_id")) is not None}
    ga_by_id = {to_int(r.get("ga_pg_id")): r for r in ga_rows if to_int(r.get("ga_pg_id")) is not None}
    return pg_by_id, ga_by_id


def build_db_profile(pg_id: int, pg: dict | None, ga: dict | None,
                     generated_at: str, notes: list[str]) -> dict:
    """db_profile = faits DB STRUCTURELS possédés. Zéro V-Level, zéro pricing, zéro scoring."""
    profile: dict = {"pg_id": pg_id}

    if pg is not None:
        profile.update({
            "pg_alias": pg.get("pg_alias"),
            "pg_name": pg.get("pg_name"),
            "pg_level": pg.get("pg_level"),
            "g_level": pg.get("pg_g_level"),
            "gamme_universelle": to_bool(pg.get("gamme_universelle")),
            "parent_gamme_id": to_int(pg.get("pg_parent_gamme_id")),
        })
    else:
        notes.append(
            f"pg_id {pg_id}: aucune ligne pieces_gamme — db_profile sans identité catalogue "
            "(fiche orpheline côté master gamme, à arbitrer)."
        )

    if ga is not None:
        profile["catalog"] = {
            "products_total": ga.get("products_total"),
            "products_direct": ga.get("products_direct"),
            "products_via_vehicles": ga.get("products_via_vehicles"),
            "products_via_family": ga.get("products_via_family"),
            "vehicles_total": ga.get("vehicles_total"),
        }
        profile["db_computed_at"] = ga.get("computed_at")
    else:
        notes.append(
            f"pg_id {pg_id}: aucune ligne gamme_aggregates — échelle catalogue indisponible "
            "(db_profile = identité seule ; gamme hors périmètre agrégé G1/G2 ou non recalculée)."
        )

    profile["source"] = {
        "type": "db",
        "table": "pieces_gamme + gamme_aggregates (SELECT only)",
        "confidence": "high",
    }
    profile["last_db_sync"] = generated_at
    return profile


# ==========================================================================
# RENDU + MERGE DES BLOCS DB-MANAGED (additif, byte-à-byte ailleurs)
# ==========================================================================


def render_managed_block(key: str, value) -> str:
    return (
        f"# >>> DB-MANAGED BLOCK: {key} — {SCRIPT_ID} (ne pas éditer à la main)\n"
        + dump_yaml({key: value})
        + f"# <<< END DB-MANAGED BLOCK: {key}\n"
    )


def merge_managed_blocks(existing: str, managed: dict) -> str:
    """Remplace UNIQUEMENT les blocs managed délimités ; tout le reste byte-à-byte.

    Bloc absent → inséré juste avant le `---` fermant du frontmatter (additif,
    zéro octet modifié ailleurs). Refuse tout fichier sans frontmatter (jamais
    d'écrasement aveugle).
    """
    if not existing.startswith("---\n"):
        raise ValueError("fichier sans frontmatter YAML — merge refusé (pas d'écrasement aveugle)")
    if existing.find("\n---", 4) == -1:
        raise ValueError("frontmatter non fermé — merge refusé")

    content = existing
    for key in MANAGED_KEYS:
        if key not in managed:
            continue
        new_block = render_managed_block(key, managed[key])
        pattern = re.compile(
            rf"^# >>> DB-MANAGED BLOCK: {re.escape(key)} .*?\n.*?^# <<< END DB-MANAGED BLOCK: {re.escape(key)}\n",
            re.DOTALL | re.MULTILINE,
        )
        if pattern.search(content):
            content = pattern.sub(lambda _m: new_block, content, count=1)
        else:
            fm_end = content.find("\n---", 4)
            insert_at = fm_end + 1  # début de la ligne '---' fermante
            content = content[:insert_at] + new_block + content[insert_at:]
    return content


# ==========================================================================
# MAIN
# ==========================================================================


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Injecte le bloc DB-MANAGED db_profile (faits DB) dans les fiches RAW gamme existantes."
    )
    parser.add_argument("--merge-managed-blocks", action="store_true",
                        help="Met à jour UNIQUEMENT les blocs db_profile/validation_notes des fiches existantes")
    parser.add_argument("--dry-run", action="store_true", help="Écrit dans --out-dir au lieu du RAW")
    parser.add_argument("--out-dir", type=str, default=None, help="Répertoire de sortie pour --dry-run")
    parser.add_argument("--gamme", type=str, default=None, help="Filtrer par slug de gamme (fichier <slug>.md)")
    parser.add_argument("--limit", type=int, default=None, help="Limiter au N premières fiches (dry-run/preview)")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.dry_run and not args.out_dir:
        parser.error("--dry-run requiert --out-dir (aucune écriture dans le RAW en dry-run)")
    if not args.dry_run and not args.merge_managed_blocks:
        parser.error("mode requis : --merge-managed-blocks (masse) ou --dry-run --out-dir (preview)")

    gammes_dir = RAW_REPO / GAMMES_SUBDIR
    if not gammes_dir.is_dir():
        sys.stderr.write(f"ERREUR : répertoire gammes introuvable : {gammes_dir}\n")
        return 2

    fiches = sorted(gammes_dir.glob("*.md"))
    if args.gamme:
        fiches = [f for f in fiches if f.stem == args.gamme]
    if args.limit is not None:
        fiches = fiches[: args.limit]
    if not fiches:
        sys.stderr.write("Aucune fiche gamme sélectionnée — abandon.\n")
        return 1

    out_dir = Path(args.out_dir) / "gammes" if args.dry_run else gammes_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    pg_by_id, ga_by_id = fetch_gamme_facts()

    merged, skipped_no_pgid, skipped_no_match = 0, 0, 0
    for fiche_path in fiches:
        existing = fiche_path.read_text(encoding="utf-8")
        fm = parse_frontmatter(existing)
        pg_id = to_int((fm or {}).get("pg_id"))
        if pg_id is None:
            skipped_no_pgid += 1
            print(f"[skip  ] {fiche_path.name} — pas de pg_id dans le frontmatter (non matché, fiche intacte)")
            continue

        pg = pg_by_id.get(pg_id)
        ga = ga_by_id.get(pg_id)
        if pg is None and ga is None:
            skipped_no_match += 1
            print(f"[skip  ] {fiche_path.name} — pg_id {pg_id} absent DB (pieces_gamme + gamme_aggregates), fiche intacte")
            continue

        notes: list[str] = []
        db_profile = build_db_profile(pg_id, pg, ga, generated_at, notes)
        managed = {"db_profile": db_profile}
        if notes:
            managed["validation_notes"] = notes

        merged_content = merge_managed_blocks(existing, managed)
        target = out_dir / fiche_path.name
        target.write_text(merged_content, encoding="utf-8")
        merged += 1
        tag = "dry  " if args.dry_run else "merge"
        prod = (db_profile.get("catalog") or {}).get("products_total")
        veh = (db_profile.get("catalog") or {}).get("vehicles_total")
        print(f"[{tag} ] {target} (pg_id {pg_id} · produits {prod} · véhicules {veh}"
              + (f" · {len(notes)} note(s)" if notes else "") + ")")

    print(
        f"\n=== db_profile : {merged} fiche(s) {'simulée(s)' if args.dry_run else 'mergée(s)'}"
        f" · {skipped_no_pgid} sans pg_id · {skipped_no_match} sans match DB ==="
    )
    if args.dry_run:
        print(f"[dry-run] sortie dans {out_dir} — aucune écriture dans le RAW ni en DB.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
