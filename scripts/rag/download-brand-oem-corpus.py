#!/usr/bin/env python3
"""
download-brand-oem-corpus.py — Télécharge un corpus brut multi-source par marque
constructeur pour alimenter la curation éditoriale R7 (FAQ / common_issues /
maintenance_tips).

NON : ce script n'écrit PAS dans __seo_brand_editorial. Il produit du corpus
brut indexé, avec provenance par source, que l'admin (humain) exploite ensuite
via /admin/brands-seo ou via un script d'extraction à lancer manuellement.

Sources (toutes gratuites + API publique + provenance citable) :
  1. Wikipedia FR   — page principale marque + liste des modèles
  2. Wikidata SPARQL — modèles structurés avec motorisations (P176 + P279)
  3. Rappel Conso FR — rappels consommateurs véhicules (data.economie.gouv.fr)
  4. NHTSA (US)     — recalls structurés par make/year (api.nhtsa.gov) OPT-IN
  5. Wikipedia EN   — OPT-IN strict. Site & SEO sont FR, du contenu EN collé
                      dans l'éditorial R7 pollue le signal. Utiliser seulement
                      pour aider l'admin à cross-vérifier des infos techniques
                      — et traduire en FR avant de les poser dans l'UI.

Règle : **aucune synthèse LLM**. Ce script est 0-LLM. Il télécharge la source
brute avec l'URL d'origine dans le frontmatter/_meta. Toute synthèse doit
passer par un humain ou un second script dédié avec validation.

Output :
  /opt/automecanik/rag/knowledge/web/brands/{alias}/
    wikipedia-fr-main.md
    wikipedia-fr-models.md
    wikipedia-en-main.md
    wikipedia-en-models.md
    wikidata-models.json
    nhtsa-recalls.json
    rappel-conso-fr.json

Usage :
  python3 scripts/rag/download-brand-oem-corpus.py --brand alfa-romeo --dry-run
  python3 scripts/rag/download-brand-oem-corpus.py --brand bmw
  python3 scripts/rag/download-brand-oem-corpus.py --limit 5
  python3 scripts/rag/download-brand-oem-corpus.py --source wikipedia,wikidata
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)

# === CONFIG ========================================================
BRANDS_RAG_DIR = Path("/opt/automecanik/rag/knowledge/constructeurs")
OUTPUT_ROOT = Path("/opt/automecanik/rag/knowledge/web/brands")

SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://cxpojprgwgubzjyqzmoq.supabase.co"
)
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

WIKIPEDIA_API_FR = "https://fr.wikipedia.org/w/api.php"
WIKIPEDIA_API_EN = "https://en.wikipedia.org/w/api.php"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
NHTSA_API = "https://api.nhtsa.gov/recalls/recallsByVehicle"
RAPPEL_CONSO_API = (
    "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/"
    "rappelconso-v2-gtin-espaces/records"
)

REQUEST_DELAY = 0.9  # respect des rate limits (Wikipedia, Wikidata)
TIMEOUT = 20
SCHEMA_VERSION = 1
SCRIPT_ID = "download-brand-oem-corpus"
NHTSA_MIN_YEAR = 2000
NHTSA_MAX_YEAR = datetime.now(timezone.utc).year

HEADERS = {
    "User-Agent": (
        "AutoMecanik-BrandOEMCorpus/1.0 "
        "(https://www.automecanik.com; contact=automecanik.seo@gmail.com)"
    ),
    "Accept": "application/json",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
}

ALL_SOURCES = (
    "wikipedia-fr",
    "wikidata",
    "rappel-conso",
    "nhtsa",
    "wikipedia-en",
)
# Sources activées par défaut.
# - Wikipedia EN est exclu car site + SEO sont FR : du contenu EN collé
#   dans l'éditorial R7 pollue le signal. Opt-in via --source wikipedia-en
#   pour cross-vérification technique (à traduire avant usage).
# - NHTSA est opt-in car son API exige un triplet (make, model, modelYear) :
#   sans enumération de modèles, la requête retourne 0 résultat.
DEFAULT_SOURCES = ("wikipedia-fr", "wikidata", "rappel-conso")

# Alias → Wikipedia page title (FR puis EN). Si absent on fallback sur
# marque_name tel qu'en DB (la plupart du temps correct).
WIKI_TITLE_OVERRIDES_FR: dict[str, str] = {
    "alfa-romeo": "Alfa Romeo",
    "ds": "DS (automobile)",
    "mini": "Mini (BMW)",
    "smart": "Smart (automobile)",
    "mg": "MG Motor",
}
WIKI_TITLE_OVERRIDES_EN: dict[str, str] = {
    "alfa-romeo": "Alfa Romeo",
    "ds": "DS Automobiles",
    "mini": "Mini (marque)",
    "smart": "Smart (marque)",
    "mg": "MG Motor",
}

# Alias → NHTSA "make" (format attendu par l'API, majuscules, espaces encodés
# avec + par nous côté requête). Si absent on fallback marque_name.upper().
NHTSA_MAKE_OVERRIDES: dict[str, str] = {
    "alfa-romeo": "ALFA ROMEO",
    "land-rover": "LAND ROVER",
    "mercedes": "MERCEDES-BENZ",
    "mercedes-benz": "MERCEDES-BENZ",
    "aston-martin": "ASTON MARTIN",
    "rolls-royce": "ROLLS-ROYCE",
}


# === HELPERS =======================================================


def stderr(msg: str) -> None:
    print(msg, file=sys.stderr)


def fetch_json(url: str, params: dict[str, Any] | None = None) -> Any | None:
    try:
        resp = requests.get(
            url, params=params, headers=HEADERS, timeout=TIMEOUT
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as exc:
        stderr(f"  ⚠️  fetch {url} failed: {exc}")
        return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_md(
    path: Path, source_url: str, title: str, body: str, source_label: str
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    safe_title = title.replace("'", "\\'")[:160]
    frontmatter = (
        f"---\n"
        f"source_type: corpus\n"
        f"source_label: {source_label}\n"
        f"source_uri: {source_url}\n"
        f"fetched_at: '{now_iso()}'\n"
        f"script: {SCRIPT_ID}\n"
        f"schema_version: {SCHEMA_VERSION}\n"
        f"title: '{safe_title}'\n"
        f"---\n\n"
        f"# {title}\n\n"
    )
    path.write_text(frontmatter + body.strip() + "\n", encoding="utf-8")


def write_json(path: Path, source_url: str, payload: Any, source_label: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "_meta": {
            "source_label": source_label,
            "source_uri": source_url,
            "fetched_at": now_iso(),
            "script": SCRIPT_ID,
            "schema_version": SCHEMA_VERSION,
        },
        "data": payload,
    }
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")


# === SOURCES =======================================================


def fetch_wikipedia_page(
    api_url: str, title: str
) -> tuple[str, str, str] | None:
    """Renvoie (title_resolved, url, extract_plaintext) ou None."""
    params = {
        "action": "query",
        "prop": "extracts|info",
        "explaintext": 1,
        "inprop": "url",
        "redirects": 1,
        "titles": title,
        "format": "json",
    }
    data = fetch_json(api_url, params)
    if not data:
        return None
    pages = (data.get("query") or {}).get("pages") or {}
    for _, page in pages.items():
        if "missing" in page:
            continue
        extract = (page.get("extract") or "").strip()
        if len(extract) < 200:
            continue
        return page.get("title", title), page.get("fullurl", ""), extract
    return None


def fetch_wikidata_models(brand_qid: str) -> list[dict[str, Any]] | None:
    """Liste des modèles de la marque + motorisations associées.

    Query structure :
      - ?model wdt:P176 wd:{brand_qid}    # manufacturer
      - OPTIONAL  P306 engine, P571 inception, P528 official name, P2043 length
    """
    sparql = f"""
SELECT DISTINCT ?model ?modelLabel ?inception ?engineLabel ?fuelLabel WHERE {{
  ?model wdt:P176 wd:{brand_qid} .
  ?model wdt:P31/wdt:P279* wd:Q3231690 .  # subclass of automobile model
  OPTIONAL {{ ?model wdt:P571 ?inception . }}
  OPTIONAL {{ ?model wdt:P306 ?engine . }}
  OPTIONAL {{ ?model wdt:P4530 ?fuel . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en" }}
}}
ORDER BY DESC(?inception)
LIMIT 150
""".strip()
    resp = None
    try:
        resp = requests.get(
            WIKIDATA_SPARQL,
            params={"query": sparql, "format": "json"},
            headers={
                **HEADERS,
                "Accept": "application/sparql-results+json",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
    except requests.exceptions.RequestException as exc:
        stderr(f"  ⚠️  Wikidata SPARQL failed: {exc}")
        return None
    try:
        bindings = resp.json().get("results", {}).get("bindings", [])
    except ValueError:
        stderr("  ⚠️  Wikidata SPARQL returned non-JSON")
        return None
    out: list[dict[str, Any]] = []
    for b in bindings:
        out.append(
            {
                "qid": b.get("model", {}).get("value", "").split("/")[-1],
                "name": b.get("modelLabel", {}).get("value"),
                "inception": b.get("inception", {}).get("value"),
                "engine": b.get("engineLabel", {}).get("value"),
                "fuel": b.get("fuelLabel", {}).get("value"),
            }
        )
    return out


def fetch_nhtsa_recalls(
    make: str, models: list[str] | None = None
) -> list[dict[str, Any]]:
    """Aggregate recalls via NHTSA public API.

    NOTE : `recallsByVehicle` exige un triplet (make, model, modelYear). Sans
    liste de modèles fournie, le script n'appelle rien (retourne []). Pour
    l'activer proprement, passer `models=['320i','X5', …]` obtenus depuis
    wikidata-models.json ou la DB `auto_modele`.
    """
    if not models:
        stderr(
            f"  ⚠️  NHTSA: liste de modèles requise pour {make} (skip). "
            "Passer via un enumérateur modèles."
        )
        return []
    recalls: list[dict[str, Any]] = []
    for model in models:
        for year in range(NHTSA_MIN_YEAR, NHTSA_MAX_YEAR + 1):
            params = {"make": make, "model": model, "modelYear": year}
            data = fetch_json(NHTSA_API, params)
            time.sleep(REQUEST_DELAY / 2)  # NHTSA plus tolérant
            if not data:
                continue
            for r in data.get("results") or []:
                recalls.append(
                    {
                        "campaign": r.get("NHTSACampaignNumber"),
                        "component": r.get("Component"),
                        "model": r.get("Model"),
                        "model_year": r.get("ModelYear"),
                        "report_date": r.get("ReportReceivedDate"),
                        "summary": r.get("Summary"),
                        "consequence": r.get("Consequence"),
                        "remedy": r.get("Remedy"),
                    }
                )
    # Dédoublonne par campaign (certaines campaigns couvrent plusieurs années)
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for r in recalls:
        c = r.get("campaign") or ""
        if c and c in seen:
            continue
        if c:
            seen.add(c)
        unique.append(r)
    return unique


def fetch_rappel_conso_fr(brand_name: str) -> list[dict[str, Any]]:
    """Rappels consommateurs véhicules en France, filtré par marque.

    API v2.1 `rappelconso-v2-gtin-espaces` — filtre côté ODSQL (sous-catégorie
    contient "véhicule" + marque_produit matche brand_name, case-insensitive).
    """
    safe_brand = brand_name.replace('"', '\\"')
    where = (
        f'search(sous_categorie_produit, "automobiles") '
        f'AND search(marque_produit, "{safe_brand}")'
    )
    params = {
        "where": where,
        "limit": 100,
        "order_by": "date_publication desc",
    }
    data = fetch_json(RAPPEL_CONSO_API, params)
    if not data:
        return []
    records = data.get("results") or []
    out: list[dict[str, Any]] = []
    for rec in records:
        out.append(
            {
                "reference": rec.get("numero_fiche"),
                "date": rec.get("date_publication"),
                "brand": rec.get("marque_produit"),
                "model": rec.get("modeles_ou_references"),
                "category": rec.get("sous_categorie_produit"),
                "defect": rec.get("motif_rappel"),
                "risks": rec.get("risques_encourus"),
                "conduct": rec.get("preconisations_sanitaires"),
                "info": rec.get("informations_complementaires"),
            }
        )
    return out


# === DB ============================================================


def fetch_brands_from_db(limit: int = 0) -> list[dict[str, Any]]:
    """Liste des marques actives depuis auto_marque."""
    if not SERVICE_ROLE_KEY:
        stderr("❌ SUPABASE_SERVICE_ROLE_KEY manquant dans l'env")
        sys.exit(1)
    url = f"{SUPABASE_URL}/rest/v1/auto_marque"
    params = {
        "select": "marque_id,marque_name,marque_alias",
        "marque_display": "eq.1",
        "order": "marque_alias",
    }
    if limit > 0:
        params["limit"] = str(limit)
    try:
        resp = requests.get(
            url,
            params=params,
            headers={
                "apikey": SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
                "Accept": "application/json",
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json() or []
    except requests.exceptions.RequestException as exc:
        stderr(f"❌ DB fetch failed: {exc}")
        sys.exit(1)


def load_existing_qid(alias: str) -> str | None:
    """Si build-brand-rag.py a déjà résolu le QID, le récupérer du .md RAG."""
    md = BRANDS_RAG_DIR / f"{alias}.md"
    if not md.exists():
        return None
    try:
        raw = md.read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(
        r"^wikidata_qid:\s*(Q\d+)", raw, flags=re.MULTILINE
    )
    return match.group(1) if match else None


# === MAIN PROCESS ==================================================


def process_brand(
    brand: dict[str, Any],
    sources: set[str],
    dry_run: bool,
    force: bool,
) -> dict[str, int]:
    alias = brand["marque_alias"]
    name = brand["marque_name"]
    out_dir = OUTPUT_ROOT / alias
    counts = {s: 0 for s in ALL_SOURCES}

    if dry_run:
        print(f"  [DRY-RUN] output → {out_dir}")

    # --- 1. Wikipedia FR (défaut) ---
    if "wikipedia-fr" in sources:
        # DB stocke marque_name en MAJUSCULES (PEUGEOT, CITROËN). Wikipedia
        # exige "Peugeot" / "Citroën". On titlecase par défaut, l'override
        # priorise quand un nom officiel diffère (ex: DS, Alfa Romeo).
        fr_title = WIKI_TITLE_OVERRIDES_FR.get(alias, name.title())
        fr_main = out_dir / "wikipedia-fr-main.md"
        if fr_main.exists() and not force:
            print(f"  ⏭️  wikipedia-fr-main.md existe")
        else:
            if dry_run:
                print(f"  [DRY-RUN] would fetch FR:{fr_title}")
                counts["wikipedia-fr"] += 1
            else:
                res = fetch_wikipedia_page(WIKIPEDIA_API_FR, fr_title)
                time.sleep(REQUEST_DELAY)
                if res:
                    t, url, body = res
                    write_md(fr_main, url, t, body, "wikipedia-fr")
                    print(f"  ✅ wikipedia-fr-main ({len(body)}c)")
                    counts["wikipedia-fr"] += 1
                else:
                    print(f"  ⚠️  FR:{fr_title} not found")

        # Page liste modèles : "Liste des modèles {brand}" si existe
        fr_models = out_dir / "wikipedia-fr-models.md"
        if fr_models.exists() and not force:
            print(f"  ⏭️  wikipedia-fr-models.md existe")
        else:
            list_title = f"Liste des modèles {name.title()}"
            if dry_run:
                print(f"  [DRY-RUN] would fetch FR:{list_title}")
                counts["wikipedia-fr"] += 1
            else:
                res = fetch_wikipedia_page(WIKIPEDIA_API_FR, list_title)
                time.sleep(REQUEST_DELAY)
                if res:
                    t, url, body = res
                    write_md(fr_models, url, t, body, "wikipedia-fr-models")
                    print(f"  ✅ wikipedia-fr-models ({len(body)}c)")
                    counts["wikipedia-fr"] += 1

    # --- 2. Wikipedia EN (opt-in strict : site et SEO sont FR) ---
    if "wikipedia-en" in sources:
        en_title = WIKI_TITLE_OVERRIDES_EN.get(alias, name.title())
        en_main = out_dir / "wikipedia-en-main.md"
        if en_main.exists() and not force:
            print(f"  ⏭️  wikipedia-en-main.md existe")
        else:
            if dry_run:
                print(f"  [DRY-RUN] would fetch EN:{en_title} (opt-in)")
                counts["wikipedia-en"] += 1
            else:
                res = fetch_wikipedia_page(WIKIPEDIA_API_EN, en_title)
                time.sleep(REQUEST_DELAY)
                if res:
                    t, url, body = res
                    write_md(en_main, url, t, body, "wikipedia-en")
                    print(
                        f"  ✅ wikipedia-en-main ({len(body)}c) — "
                        f"⚠️  cross-ref technique seulement, "
                        f"NE PAS coller en direct dans l'UI FR"
                    )
                    counts["wikipedia-en"] += 1

    # --- 3. Wikidata SPARQL (models + engines) ---
    if "wikidata" in sources:
        out_json = out_dir / "wikidata-models.json"
        if out_json.exists() and not force:
            print(f"  ⏭️  wikidata-models.json existe")
        else:
            qid = load_existing_qid(alias)
            if not qid:
                print(f"  ⚠️  QID absent pour {alias} (wikidata skip)")
            elif dry_run:
                print(f"  [DRY-RUN] would SPARQL Wikidata {qid}")
                counts["wikidata"] += 1
            else:
                models = fetch_wikidata_models(qid)
                time.sleep(REQUEST_DELAY)
                if models is not None:
                    url = f"https://www.wikidata.org/wiki/{qid}"
                    write_json(
                        out_json, url, models, "wikidata-sparql-models"
                    )
                    print(f"  ✅ wikidata-models ({len(models)} entrées)")
                    counts["wikidata"] += 1

    # --- 4. NHTSA recalls (opt-in, requires model list) ---
    if "nhtsa" in sources:
        out_json = out_dir / "nhtsa-recalls.json"
        if out_json.exists() and not force:
            print(f"  ⏭️  nhtsa-recalls.json existe")
        else:
            make = NHTSA_MAKE_OVERRIDES.get(alias, name.upper())
            # Récupère la liste de modèles depuis wikidata-models.json si
            # déjà téléchargé, sinon on ne lance pas (API sans modèles = 0).
            wd_file = out_dir / "wikidata-models.json"
            models: list[str] = []
            if wd_file.exists():
                try:
                    wd_doc = json.loads(wd_file.read_text(encoding="utf-8"))
                    for m in wd_doc.get("data", []) or []:
                        n = m.get("name") or ""
                        # Supprime le préfixe "Alfa Romeo " / "BMW " pour
                        # obtenir le modèle brut attendu par NHTSA.
                        clean = re.sub(
                            rf"^{re.escape(name)}\s+", "", n, flags=re.I
                        ).strip()
                        if clean and len(clean) <= 40 and clean not in models:
                            models.append(clean)
                except (OSError, json.JSONDecodeError):
                    pass
            if dry_run:
                print(
                    f"  [DRY-RUN] would fetch NHTSA {make} × {len(models)} "
                    f"modèles × {NHTSA_MAX_YEAR - NHTSA_MIN_YEAR + 1} années"
                )
                counts["nhtsa"] += 1
            elif not models:
                print(
                    f"  ⚠️  NHTSA: pas de modèles (télécharger wikidata d'abord)"
                )
            else:
                recalls = fetch_nhtsa_recalls(make, models)
                url = f"{NHTSA_API}?make={quote(make)}"
                write_json(out_json, url, recalls, "nhtsa-recalls")
                print(
                    f"  ✅ nhtsa-recalls ({len(recalls)} campagnes, "
                    f"{len(models)} modèles interrogés)"
                )
                counts["nhtsa"] += 1

    # --- 5. Rappel Conso FR ---
    if "rappel-conso" in sources:
        out_json = out_dir / "rappel-conso-fr.json"
        if out_json.exists() and not force:
            print(f"  ⏭️  rappel-conso-fr.json existe")
        else:
            if dry_run:
                print(f"  [DRY-RUN] would fetch Rappel Conso {name}")
                counts["rappel-conso"] += 1
            else:
                rappels = fetch_rappel_conso_fr(name)
                time.sleep(REQUEST_DELAY)
                where_clause = (
                    'search(sous_categorie_produit, "automobiles") '
                    f'AND search(marque_produit, "{name}")'
                )
                url = f"{RAPPEL_CONSO_API}?where={quote(where_clause)}"
                write_json(out_json, url, rappels, "rappel-conso-fr")
                print(f"  ✅ rappel-conso-fr ({len(rappels)} fiches)")
                counts["rappel-conso"] += 1

    return counts


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Télécharge un corpus brut multi-source par marque pour R7 "
            "(Wikipedia FR+EN, Wikidata, NHTSA, Rappel Conso FR). Zéro LLM."
        ),
    )
    parser.add_argument(
        "--brand",
        type=str,
        help="Alias marque unique (ex: bmw). Omis = toutes les marques actives.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limite le nombre de marques traitées (debug/test).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Ne télécharge rien, affiche juste le plan.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Écrase les fichiers existants.",
    )
    parser.add_argument(
        "--source",
        type=str,
        default="default",
        help=(
            "Sources à activer. 'default' = wikipedia-fr + wikidata + "
            "rappel-conso (FR-only, fiable). 'all' = défaut + nhtsa + "
            "wikipedia-en (opt-in, contenu EN à NE PAS coller en direct "
            f"dans l'éditorial FR). Ou CSV parmi {','.join(ALL_SOURCES)}."
        ),
    )
    args = parser.parse_args()

    if args.source == "all":
        sources = set(ALL_SOURCES)
    elif args.source == "default":
        sources = set(DEFAULT_SOURCES)
    else:
        sources = {s.strip() for s in args.source.split(",") if s.strip()}
        unknown = sources - set(ALL_SOURCES)
        if unknown:
            stderr(f"❌ sources inconnues: {unknown}. Valides: {ALL_SOURCES}")
            sys.exit(2)

    print("=== download-brand-oem-corpus.py ===")
    print(f"Sources activées : {sorted(sources)}")
    print(f"Output root      : {OUTPUT_ROOT}")
    if args.dry_run:
        print("[MODE DRY-RUN]")

    brands = fetch_brands_from_db(limit=0)
    if args.brand:
        brands = [b for b in brands if b["marque_alias"] == args.brand]
        if not brands:
            stderr(f"❌ alias inconnu ou inactif : {args.brand}")
            sys.exit(2)
    elif args.limit > 0:
        brands = brands[: args.limit]

    print(f"Marques à traiter : {len(brands)}\n")

    totals: dict[str, int] = {s: 0 for s in ALL_SOURCES}
    for i, brand in enumerate(brands, 1):
        print(
            f"[{i}/{len(brands)}] {brand['marque_alias']} "
            f"(id={brand['marque_id']}, name={brand['marque_name']})"
        )
        counts = process_brand(brand, sources, args.dry_run, args.force)
        for k, v in counts.items():
            totals[k] = totals.get(k, 0) + v
        print()

    print("=== RÉSULTAT ===")
    for s in ALL_SOURCES:
        print(f"  {s:<14} : {totals.get(s, 0)} fichiers")
    print()
    print("Prochaines étapes suggérées :")
    print(f"  - Inspecter le corpus : ls {OUTPUT_ROOT}/<alias>/")
    print("  - Curation admin     : /admin/brands-seo?brand=<alias>")
    print(
        "  - (futur) extraction candidats éditoriaux : "
        "scripts/rag/extract-brand-editorial-candidates.py"
    )


if __name__ == "__main__":
    main()
