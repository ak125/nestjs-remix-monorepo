#!/usr/bin/env python3
"""
build-brand-rag.py — Build canonical R7 brand RAG frontmatter.

Sources de vérité (une par champ, pas de scraping) :
  - Wikidata SPARQL                → country, founded_year, group, headquarters, logo_uri, wikidata_qid
  - Supabase RPC get_brand_bestsellers → top_models, top_engines
  - Wikipedia REST /page/summary   → history (prose propre, pas de regex HTML)

NOTE : faq / common_issues / maintenance_tips ne sont PAS dans ce frontmatter.
L'enricher R7 les charge directement depuis la table __seo_brand_editorial
au runtime, pour permettre la curation admin sans rebuild du .md.

Écrit : automecanik-wiki/exports/rag/constructeurs/{slug}.md (artefact auto, ADR-031 §D20)
Body préservé (seul le frontmatter est régénéré).

Configurable via env :
  AUTOMECANIK_WIKI_PATH (default /opt/automecanik/automecanik-wiki)

Usage :
  python3 scripts/wiki-generators/brand-fiche-generator.py [--brand alias] [--limit N] [--dry-run]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import requests
    import yaml
except ImportError:
    print("pip install requests pyyaml", file=sys.stderr)
    sys.exit(1)

# === CONFIG ===
# OUTPUT path : wiki/exports/rag/constructeurs/ (ADR-031 §D20).
# Cohérent avec pipeline canon : générateur produit l'auto-gen direct dans
# wiki/exports/rag/, qui est ensuite mirroré vers automecanik-rag/knowledge/
# via CI workflow sync-from-wiki (Étape 7 plan v3 pending).
WIKI_REPO = Path(os.environ.get("AUTOMECANIK_WIKI_PATH", "/opt/automecanik/automecanik-wiki"))
BRANDS_DIR = WIKI_REPO / "exports" / "rag" / "constructeurs"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
WIKIPEDIA_REST = "https://fr.wikipedia.org/api/rest_v1/page/summary"
REQUEST_DELAY = 0.8
TIMEOUT = 15
SCHEMA_VERSION = 1
SCRIPT_ID = "build-brand-rag"

HEADERS = {
    "User-Agent": "AutoMecanik-R7Builder/1.0 (https://www.automecanik.com)",
    "Accept": "application/json",
}

# === WIKIDATA QID : overrides manuels quand wbsearchentities renvoie la mauvaise
# entité (groupes vs marques, homonymies). Format : alias → QID vérifié.
BRAND_QID_OVERRIDES: dict[str, str] = {
    # Forcer la marque plutôt que le groupe quand l'ambiguïté existe
    "volkswagen": "Q246",  # marque, pas Q156578 (Volkswagen Group)
    "toyota": "Q53268",  # Toyota Motor Corporation, pas Q201117 (ville)
}


def resolve_qid(brand_name: str, alias: str) -> str | None:
    """Résout le QID Wikidata via wbsearchentities.

    Priorité : override manuel > 1er hit avec description 'automobile/car/constructeur'.
    """
    if alias in BRAND_QID_OVERRIDES:
        return BRAND_QID_OVERRIDES[alias]
    try:
        r = requests.get(
            "https://www.wikidata.org/w/api.php",
            headers=HEADERS,
            params={
                "action": "wbsearchentities",
                "search": brand_name,
                "language": "fr",
                "type": "item",
                "limit": 5,
                "format": "json",
            },
            timeout=TIMEOUT,
        )
        r.raise_for_status()
        hits = r.json().get("search") or []
        # Préférer un hit avec description liée à l'automobile
        KEYWORDS = (
            "constructeur",
            "automobile",
            "marque",
            "carmaker",
            "car brand",
            "car manufacturer",
            "auto",
        )
        for hit in hits:
            desc = (hit.get("description") or "").lower()
            if any(k in desc for k in KEYWORDS):
                return hit["id"]
        # Fallback : premier hit
        return hits[0]["id"] if hits else None
    except requests.RequestException:
        return None


# ==========================================================================
# SUPABASE HELPERS
# ==========================================================================


def _sb_headers() -> dict[str, str]:
    if not SERVICE_ROLE_KEY:
        print(
            "ERREUR : SUPABASE_SERVICE_ROLE_KEY absent (voir backend/.env)",
            file=sys.stderr,
        )
        sys.exit(2)
    return {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def fetch_brands() -> list[dict]:
    """Récupère la liste des 36 marques affichées depuis auto_marque."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/auto_marque",
        headers=_sb_headers(),
        params={
            "select": "marque_id,marque_alias,marque_name",
            "marque_display": "eq.1",
            "order": "marque_alias.asc",
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json()


def fetch_bestsellers(marque_id: int) -> dict:
    """Appelle la RPC pour récupérer vehicles/parts populaires."""
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/get_brand_bestsellers_optimized",
        headers=_sb_headers(),
        json={
            "p_marque_id": marque_id,
            "p_limit_vehicles": 40,
            "p_limit_parts": 0,
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    return r.json() or {"vehicles": [], "parts": []}


# ==========================================================================
# WIKIDATA SPARQL
# ==========================================================================

SPARQL_QUERY = """
SELECT ?country ?countryLabel ?founded ?parent ?parentLabel
       ?hq ?hqLabel ?hqCountry ?hqCountryLabel ?logo WHERE {{
  BIND(wd:{qid} AS ?entity)
  OPTIONAL {{ ?entity wdt:P17  ?country . }}
  OPTIONAL {{ ?entity wdt:P571 ?founded . }}
  # P749 = parent organization (strict, pas d'actionnariat via P127).
  # Exclure si le parent est identique à l'entité elle-même (self-reference).
  OPTIONAL {{ ?entity wdt:P749 ?parent .
             FILTER(?parent != ?entity) }}
  OPTIONAL {{ ?entity wdt:P159 ?hq .
             OPTIONAL {{ ?hq wdt:P17 ?hqCountry . }} }}
  OPTIONAL {{ ?entity wdt:P154 ?logo . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}
LIMIT 1
"""


def fetch_wikidata(qid: str) -> dict[str, Any]:
    """Interroge Wikidata SPARQL pour les faits structurés de la marque."""
    query = SPARQL_QUERY.format(qid=qid)
    r = requests.get(
        WIKIDATA_SPARQL,
        headers={**HEADERS, "Accept": "application/sparql-results+json"},
        params={"query": query, "format": "json"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    bindings = (r.json().get("results") or {}).get("bindings") or []
    if not bindings:
        return {}
    b = bindings[0]

    def val(key: str) -> str | None:
        v = b.get(key)
        return v.get("value") if v else None

    founded_raw = val("founded")
    founded_year: int | None = None
    if founded_raw:
        m = re.search(r"\b(1[89]\d{2}|20\d{2})\b", founded_raw)
        if m:
            founded_year = int(m.group(1))

    out: dict[str, Any] = {"wikidata_qid": qid}
    if val("countryLabel"):
        out["country"] = val("countryLabel")
    if founded_year:
        out["founded_year"] = founded_year
    # group : seulement P749 (parent organization). Jamais P127 (owned by) qui remonte
    # les actionnaires institutionnels (BlackRock...) pour les sociétés cotées.
    group_label = val("parentLabel")
    if group_label and not re.match(r"^Q\d+$", group_label):
        out["group"] = group_label
    if val("hqLabel"):
        hq: dict[str, str] = {"city": val("hqLabel")}
        if val("hqCountryLabel"):
            hq["country"] = val("hqCountryLabel")
        out["headquarters"] = hq
    if val("logo"):
        out["logo_uri"] = val("logo")
    return out


# ==========================================================================
# WIKIPEDIA REST SUMMARY
# ==========================================================================


def fetch_wikipedia_history(brand_name: str, qid: str) -> str | None:
    """Récupère le résumé prose via l'endpoint REST summary (pas de HTML scraping)."""
    # Étape 1 : résoudre le titre Wikipedia depuis QID via Wikidata sitelinks
    r = requests.get(
        "https://www.wikidata.org/w/api.php",
        headers=HEADERS,
        params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "sitelinks",
            "sitefilter": "frwiki",
            "format": "json",
        },
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    entities = (r.json().get("entities") or {}).get(qid) or {}
    sitelink = ((entities.get("sitelinks") or {}).get("frwiki") or {}).get("title")
    if not sitelink:
        return None

    # Étape 2 : appeler l'endpoint REST summary (renvoie extract propre)
    title_path = sitelink.replace(" ", "_")
    r = requests.get(
        f"{WIKIPEDIA_REST}/{title_path}",
        headers=HEADERS,
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        return None
    data = r.json()
    extract = data.get("extract")
    if not extract or len(extract) < 100:
        return None
    # Nettoyage minimal : supprimer pronoms phonétiques entre crochets
    extract = re.sub(r"\[[^\]]{0,30}\]", "", extract).strip()
    return extract[:1800]


# ==========================================================================
# DB AGGREGATION : top_models / top_engines
# ==========================================================================


def aggregate_top_models(vehicles: list[dict], limit: int = 8) -> list[dict]:
    """Groupe les vehicles par modele_id et retourne les top N par fréquence."""
    counts: dict[int, dict[str, Any]] = {}
    for v in vehicles:
        mid = v.get("modele_id")
        if not mid:
            continue
        if mid not in counts:
            name = v.get("modele_name") or ""
            year_from = v.get("type_year_from") or ""
            year_to = v.get("type_year_to") or ""
            years = ""
            if year_from:
                years = f"{year_from}-{year_to}" if year_to else f"{year_from}-"
            counts[mid] = {
                "modele_id": int(mid),
                "name": name.title() if name.isupper() else name,
                "years": years,
                "_count": 0,
            }
        counts[mid]["_count"] += 1
    ranked = sorted(counts.values(), key=lambda x: -x["_count"])[:limit]
    # Retirer le champ _count privé avant sérialisation
    return [
        {k: v for k, v in m.items() if not k.startswith("_") and v}
        for m in ranked
    ]


def aggregate_top_engines(vehicles: list[dict], limit: int = 6) -> list[dict]:
    """Groupe par (fuel, puissance) pour extraire les motorisations représentatives."""
    FUEL_MAP = {
        "essence": "essence",
        "diesel": "diesel",
        "hybride": "hybrid",
        "hybride léger": "hybrid",
        "hybride recharg": "hybrid",
        "electrique": "electric",
        "électrique": "electric",
        "gpl": "lpg",
    }
    counts: dict[tuple[str, int], dict[str, Any]] = {}
    for v in vehicles:
        fuel_raw = (v.get("type_fuel") or "").lower().strip()
        fuel = FUEL_MAP.get(fuel_raw)
        try:
            power = int(v.get("type_power_ps") or 0)
        except (ValueError, TypeError):
            power = 0
        if not fuel or power <= 0:
            continue
        key = (fuel, power)
        if key not in counts:
            counts[key] = {
                "code": f"{power}ch {fuel}",
                "fuel": fuel,
                "power_ps": power,
                "_count": 0,
            }
        counts[key]["_count"] += 1
    ranked = sorted(counts.values(), key=lambda x: -x["_count"])[:limit]
    return [{k: v for k, v in e.items() if not k.startswith("_")} for e in ranked]


# ==========================================================================
# FRONTMATTER COMPOSITION + I/O
# ==========================================================================


def compute_content_hash(payload: dict) -> str:
    """Hash déterministe du frontmatter pour détection de changement."""
    normalized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return "sha256:" + hashlib.sha256(normalized.encode()).hexdigest()[:16]


def compose_frontmatter(
    brand: dict,
    wikidata: dict,
    top_models: list[dict],
    top_engines: list[dict],
    history: str | None,
) -> dict[str, Any]:
    """Compose le frontmatter canonique (clé EN, 1 valeur par source).

    Ne produit que les champs factuels stables. Les champs éditoriaux
    (faq/common_issues/maintenance_tips) sont servis par __seo_brand_editorial
    directement côté enricher — pas dans le .md.
    """
    fm: dict[str, Any] = {
        "slug": brand["marque_alias"],
        "brand_id": brand["marque_id"],
        "brand_name": brand["marque_name"],
        "category": "constructeur",
        "lang": "fr",
    }
    if wikidata.get("wikidata_qid"):
        fm["wikidata_qid"] = wikidata["wikidata_qid"]
    for key in ("country", "founded_year", "group", "headquarters", "logo_uri"):
        if wikidata.get(key):
            fm[key] = wikidata[key]
    fm["top_models"] = top_models
    fm["top_engines"] = top_engines
    if history:
        fm["history"] = history

    fm["source_of_truth"] = {
        "country": "wikidata" if wikidata.get("country") else "unknown",
        "founded_year": "wikidata" if wikidata.get("founded_year") else "unknown",
        "group": "wikidata" if wikidata.get("group") else "unknown",
        "headquarters": "wikidata" if wikidata.get("headquarters") else "unknown",
        "top_models": "db" if top_models else "unknown",
        "top_engines": "db" if top_engines else "unknown",
        "history": "wikipedia" if history else "unknown",
    }

    today = datetime.now(timezone.utc).date().isoformat()
    # Calculer le hash sur payload sans lifecycle pour éviter auto-référence
    payload_for_hash = {k: v for k, v in fm.items() if k != "lifecycle"}
    fm["lifecycle"] = {
        "last_enriched_at": today,
        "last_enriched_by": SCRIPT_ID,
        "content_hash": compute_content_hash(payload_for_hash),
        "schema_version": SCHEMA_VERSION,
    }
    fm["verification_status"] = "oem_verified" if wikidata else "draft"
    fm["updated_at"] = today
    return fm


def load_existing_body(path: Path) -> str:
    """Récupère le body markdown (hors frontmatter) pour le préserver."""
    if not path.exists():
        return ""
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n[\s\S]*?\n---\n?([\s\S]*)$", raw)
    return m.group(1).lstrip() if m else raw


def write_brand_md(path: Path, frontmatter: dict, body: str) -> None:
    yaml_text = yaml.dump(
        frontmatter,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=120,
    )
    path.write_text(f"---\n{yaml_text}---\n{body}", encoding="utf-8")


# ==========================================================================
# VALIDATION MINIMALE (fail-fast avant write)
# ==========================================================================


def validate_frontmatter(fm: dict) -> list[str]:
    """Contrôles structurels avant écriture. L'enricher NestJS fait la validation Zod complète."""
    errors: list[str] = []
    for required in ("slug", "brand_id", "brand_name", "source_of_truth", "lifecycle"):
        if required not in fm:
            errors.append(f"champ requis manquant : {required}")
    if fm.get("country") and not isinstance(fm["country"], str):
        errors.append("country doit être str")
    if fm.get("founded_year") and not isinstance(fm["founded_year"], int):
        errors.append("founded_year doit être int")
    if not isinstance(fm.get("top_models"), list):
        errors.append("top_models doit être list")
    if not isinstance(fm.get("top_engines"), list):
        errors.append("top_engines doit être list")
    return errors


# ==========================================================================
# PIPELINE
# ==========================================================================


def build_brand(brand: dict, dry_run: bool) -> tuple[str, dict | None]:
    """Traite une marque, retourne (status, frontmatter|None).
    status ∈ {'built', 'skipped-no-qid', 'failed'}
    """
    alias = brand["marque_alias"]
    brand_id = brand["marque_id"]
    brand_name = brand["marque_name"]
    print(f"\n🏭 {alias} (id={brand_id})")

    qid = resolve_qid(brand_name, alias)
    if not qid:
        print(f"  ⚠️  Wikidata QID introuvable — skip")
        return "skipped-no-qid", None
    print(f"  QID résolu : {qid}")

    # 1. Wikidata
    try:
        wikidata = fetch_wikidata(qid)
        print(
            f"  Wikidata {qid} → country={wikidata.get('country')} founded={wikidata.get('founded_year')} group={wikidata.get('group')}"
        )
    except Exception as e:
        print(f"  ⚠️  Wikidata failed : {e}")
        wikidata = {"wikidata_qid": qid}
    time.sleep(REQUEST_DELAY)

    # 2. DB bestsellers
    try:
        bestsellers = fetch_bestsellers(brand_id)
        vehicles = bestsellers.get("vehicles") or []
        top_models = aggregate_top_models(vehicles)
        top_engines = aggregate_top_engines(vehicles)
        print(f"  DB: {len(vehicles)} vehicles → {len(top_models)} models, {len(top_engines)} engines")
    except Exception as e:
        print(f"  ⚠️  DB RPC failed : {e}")
        top_models, top_engines = [], []

    # 3. Wikipedia history
    try:
        history = fetch_wikipedia_history(brand["marque_name"], qid)
        print(f"  Wikipedia : {'OK' if history else 'no extract'} ({len(history) if history else 0}c)")
    except Exception as e:
        print(f"  ⚠️  Wikipedia failed : {e}")
        history = None
    time.sleep(REQUEST_DELAY)

    # 4. Compose + validate (editorial chargé côté enricher, pas ici)
    fm = compose_frontmatter(brand, wikidata, top_models, top_engines, history)
    errors = validate_frontmatter(fm)
    if errors:
        print(f"  ❌ validation échouée : {errors}")
        return "failed", None

    if dry_run:
        print(f"  [DRY-RUN] frontmatter valide, {len(fm)} champs")
        return "built", fm

    # 6. Write
    md_path = BRANDS_DIR / f"{alias}.md"
    body = load_existing_body(md_path)
    write_brand_md(md_path, fm, body)
    print(f"  ✅ {md_path.name} écrit ({len(fm)} champs, body={len(body)}c préservé)")
    return "built", fm


def main() -> int:
    ap = argparse.ArgumentParser(description="Build canonical R7 brand RAG frontmatter")
    ap.add_argument("--brand", help="Un alias spécifique (ex: alfa-romeo)")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.dry_run:
        BRANDS_DIR.mkdir(parents=True, exist_ok=True)

    brands = fetch_brands()
    if args.brand:
        brands = [b for b in brands if b["marque_alias"] == args.brand]
        if not brands:
            print(f"ERREUR : marque '{args.brand}' introuvable", file=sys.stderr)
            return 2
    if args.limit > 0:
        brands = brands[: args.limit]

    print(f"📦 {len(brands)} marque(s) à traiter — dry_run={args.dry_run}")
    stats = {"built": 0, "skipped-no-qid": 0, "failed": 0}
    for brand in brands:
        status, _ = build_brand(brand, args.dry_run)
        stats[status] += 1

    print(
        f"\n=== Résumé : built={stats['built']} skipped={stats['skipped-no-qid']} failed={stats['failed']} ==="
    )
    return 0 if stats["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
