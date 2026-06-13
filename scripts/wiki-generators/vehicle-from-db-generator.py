#!/usr/bin/env python3
"""
vehicle-from-db-generator.py — Génère les fiches RAW véhicule (maille modèle-génération)
depuis la DB interne (couche FAITS, DB-first — plan « RAW Encyclopédie » PR-D.0/PR-D.1).

Maille = modèle-génération (JAMAIS un fichier par auto_type — 53 959 types).
Sélection = nb de type_id actifs legacy (< 60000, type_display='1') × récence
(modele_year_to NULL ou >= 2010). SANS V-Level (non finalisé).

Sens unique DB → RAW (ADR-031) : ce script ne fait QUE des SELECT (REST GET).
Aucune écriture DB. Aucun consommateur runtime ne lit RAW.

Provenance champ par champ : chaque bloc important porte
`source: {type: db, table: ..., confidence: high}`.
truth_level: L1 (faits DB possédés) · verification_status: verified (blocs db)
· provenance.ingested_by: 'script:vehicle-from-db-generator@v1'.

MOTORISATION = axe transverse (raffinement owner 2026-06-13) :
  Granularité PROGRESSIVE « carburant d'abord, famille-moteur ensuite ».
  - BRONZE (DB, immédiat, zéro invention) : SEUL l'axe CARBURANT
    (`auto_type.type_fuel` → Diesel/Essence/Électrique/Hybride/GPL) est émis — une
    entrée `fuel:<classe>` par carburant présent, clé NORMALISÉE + `axis_key_type`.
    `issues: []` / `operations: []` = squelette, rempli au scraping PR-C.2.
  - ARGENT/OR (scraping) : les clés plus fines `fuel_displacement:` /
    `engine_family:` sont CRÉÉES à la demande par le scraping (structure-follows-
    evidence), jamais pré-émises vides ici. `auto_type_motor_code` quasi vide →
    `engine_code: null` honnête + validation_note.

CLÉS MOTORISATION NORMALISÉES — trois formes seulement, aucune clé libre :
  - `fuel:<fuel>`                       — ex. `fuel:diesel` (SEULE forme émise en BRONZE)
  - `fuel_displacement:<fuel>:<liter>`  — ex. `fuel_displacement:diesel:2.0` (bucket
                                          0.1 L ; créée par le scraping uniquement)
  - `engine_family:<code>`              — ex. `engine_family:k9k` (code minuscule ;
                                          scraping/backfill uniquement, jamais ici)
  Chaque entrée des maps porte `axis_key_type` (fuel | fuel_displacement |
  engine_family) — lève l'ambiguïté du nom `…_by_engine` quand la clé est en
  réalité un carburant.

CONVENTION PROVENANCE des entrées éditoriales (scraping PR-C.2 — hors dry-run, mais
le squelette le prévoit). Chaque issue/operation scrapée portera :
  applies_to: {make, model_generation, fuel, engine_family, market}
  source: {type, source_market: FR|EU|DE|UK|US|unknown, lang_original: de|en|fr|it,
           confidence, evidence_id}
  (un même modèle a des motorisations ≠ selon le marché ; faits reformulés FR-only,
   provenance conservée ; valeurs prescriptives = fail-closed). Les clés
  engine_family sont `engine_family:<code minuscule>`.

Deux modes (jamais d'écrasement de l'éditorial humain) :
  - défaut (--create-missing implicite) : crée uniquement les fiches absentes,
    skip si le fichier existe déjà.
  - --merge-managed-blocks : réécrit UNIQUEMENT les blocs frontmatter délimités
    `db_profile` / `motorizations` / `known_issues_by_engine` /
    `maintenance_by_engine` / `validation_notes` (marqueurs
    `# >>> DB-MANAGED BLOCK:` / `# <<< END DB-MANAGED BLOCK:`). L'éditorial et
    toute autre clé frontmatter / le body restent intouchés byte-à-byte.

NOTE content_hash : calculé sur le body à la création. --merge-managed-blocks ne
touche pas le body, donc ne recalcule pas content_hash (clé hors blocs managed).

Configurable via env :
  AUTOMECANIK_RAW_PATH       (default /opt/automecanik/automecanik-raw)
  SUPABASE_URL               (default projet canonique)
  SUPABASE_SERVICE_ROLE_KEY  (requis — sinon chargé depuis backend/.env)
  BACKEND_ENV_FILE           (optionnel — chemin .env alternatif)

Usage :
  python3 scripts/wiki-generators/vehicle-from-db-generator.py --top 5 --dry-run --out-dir /tmp/prd0-dryrun
  python3 scripts/wiki-generators/vehicle-from-db-generator.py --top 50 --create-missing
  python3 scripts/wiki-generators/vehicle-from-db-generator.py --top 50 --merge-managed-blocks

Refs :
  - Plan : ~/.claude/plans/verifier-je-comprends-steady-parrot.md
  - Schéma cible WIKI : automecanik-wiki/_meta/schema/entity-data/vehicle.schema.json (v1.1.0)
  - Convention fiche : automecanik-raw/recycled/rag-knowledge/vehicles/renault-clio-3.md
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
import uuid
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("Manque : pip install pyyaml\n")
    sys.exit(1)

SCRIPT_ID = "script:vehicle-from-db-generator@v1"
RAW_REPO = Path(os.environ.get("AUTOMECANIK_RAW_PATH", "/opt/automecanik/automecanik-raw"))
VEHICLES_SUBDIR = Path("recycled") / "rag-knowledge" / "vehicles"
TIMEOUT = 30
PAGE_SIZE = 1000  # cap PostgREST — pagination Range obligatoire au-delà
LEGACY_TYPE_ID_MAX = 60000  # type_id >= 60000 = remappés fournisseur, JAMAIS utilisés ici
RECENT_YEAR_MIN = 2010

MANAGED_KEYS = (
    "db_profile",
    "motorizations",
    "known_issues_by_engine",
    "maintenance_by_engine",
    "validation_notes",
)

FUEL_NORMALIZATION = {
    "essence": "essence",
    "diesel": "diesel",
    "hybride": "hybride",
    "electrique": "electrique",
    "électrique": "electrique",
    "gpl": "gpl",
    "ethanol": "ethanol",
}

# Classe carburant CANONIQUE pour les clés normalisées des maps fuel-aware
# (`fuel:<classe>`). Owner 2026-06-13 : Diesel/Essence/Électrique/Hybride/GPL.
# Les carburants composites DB (`Essence-Électrique`, `Diesel-Électrique`,
# `Essence-Gaz GPL`, `Essence-Éthanol`…) sont rattachés à leur classe dominante
# de façon déterministe et documentée — jamais d'invention. Voir fuel_class().
FUEL_CLASS_NORMALIZATION = {
    "diesel": "diesel",
    "essence": "essence",
    "electrique": "electrique",
    "électrique": "electrique",
    "hybride": "hybride",
    "gpl": "gpl",
    "ethanol": "essence",  # E85/flex-fuel = bloc essence (carburant alternatif)
}


# ==========================================================================
# ENV + SUPABASE REST (lecture SEULE — GET uniquement)
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

    Lecture seule : GET uniquement, jamais de POST/PATCH/DELETE.
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


def chunked(seq: list, size: int = 150):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


# ==========================================================================
# HELPERS
# ==========================================================================


def to_int(value) -> int | None:
    """Coercition défensive : les colonnes auto_* sont TEXT en DB (anti-pattern connu)."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or not re.fullmatch(r"-?\d+", s):
        return None
    return int(s)


def normalize_fuel(raw: str | None, notes: list[str], type_id) -> str | None:
    if not raw:
        return None
    fuel = FUEL_NORMALIZATION.get(raw.strip().lower())
    if fuel is None:
        fuel = raw.strip().lower()
        notes.append(
            f"type_id {type_id}: carburant DB non normalisé ({raw!r}) — conservé tel quel (lowercase)."
        )
    return fuel


def fuel_class(raw: str | None, notes: list[str], type_id) -> str:
    """Classe carburant canonique (diesel/essence/electrique/hybride/gpl) pour les
    clés normalisées des maps fuel-aware. Déterministe, documenté, zéro invention.

    Règles de rattachement des composites DB (constat 2026-06-12) :
      - '<X>-Électrique'      → hybride  (thermique + électrique = hybride)
      - 'Essence-Gaz GPL/GNC' → gpl      (bivalent gaz, bloc gpl/gaz)
      - 'Essence-Éthanol'/'Éthanol' → essence (E85/flex-fuel = bloc essence)
      - sinon mapping direct, accents tolérés (Électrique → electrique).
    `unknown` retourné + validation_note si non reconnu (no silent fallback).
    """
    if not raw:
        notes.append(f"type_id {type_id}: type_fuel DB vide — fuel_class='unknown' (no silent fallback).")
        return "unknown"
    norm = raw.strip().lower()
    if "électrique" in norm or "electrique" in norm:
        # 'électrique' seul = electrique ; combiné à un thermique = hybride
        if norm in ("électrique", "electrique"):
            return "electrique"
        return "hybride"
    if "gpl" in norm or "gnc" in norm or "gaz" in norm:
        return "gpl"
    if "diesel" in norm:
        return "diesel"
    if "essence" in norm or "éthanol" in norm or "ethanol" in norm:
        return "essence"
    direct = FUEL_CLASS_NORMALIZATION.get(norm)
    if direct is not None:
        return direct
    notes.append(
        f"type_id {type_id}: type_fuel DB '{raw}' non rattaché à une classe canonique "
        "(diesel/essence/electrique/hybride/gpl) — fuel_class='unknown' (à arbitrer)."
    )
    return "unknown"


def displacement_bucket(displacement_l: float | None) -> str | None:
    """Bucket de cylindrée = litres arrondis à 0.1 L (ex. 1.998 → '2.0'). None si absent."""
    if displacement_l is None:
        return None
    return f"{round(displacement_l, 1):.1f}"


def extract_generation(modele_name: str | None) -> str | None:
    """Génération extraite mécaniquement de auto_modele.modele_name si '(...)' final.

    Pas d'inférence au-delà (pas de runtime guessing) : sinon None + validation_note.
    """
    if not modele_name:
        return None
    m = re.search(r"\(([^)]+)\)\s*$", modele_name)
    return m.group(1) if m else None


def doc_id_for(slug: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"automecanik-raw/{VEHICLES_SUBDIR}/{slug}.md"))


def content_hash_for(body: str) -> str:
    return "sha256:" + hashlib.sha256(body.encode("utf-8")).hexdigest()[:16]


def dump_yaml(data) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=110, default_flow_style=False)


# ==========================================================================
# SÉLECTION — top N modèles-générations (nb types actifs legacy × récence)
# ==========================================================================


def select_top_models(top_n: int, verbose: bool = False) -> list[dict]:
    """Classe les modèles par nb de type_id actifs legacy, filtre récence, prend top N.

    Équivalent SQL :
      SELECT type_modele_id, COUNT(*) FROM auto_type
      WHERE type_id::int < 60000 AND type_display = '1'
      GROUP BY type_modele_id
      -- joint auto_modele ; filtre modele_year_to IS NULL OR modele_year_to >= 2010 ;
      -- tri count DESC, modele_id ASC (tie-break déterministe)
    """
    counts: Counter = Counter()
    types = sb_select(
        "auto_type",
        {
            "select": "type_id,type_modele_id",
            "type_id": f"lt.{LEGACY_TYPE_ID_MAX}",
            "type_display": "eq.1",
            "order": "type_id.asc",
        },
    )
    for t in types:
        modele_id = to_int(t.get("type_modele_id"))
        if modele_id is not None:
            counts[modele_id] += 1
    if verbose:
        print(f"[select] {len(types)} types actifs legacy, {len(counts)} modèles distincts")

    # Candidats = sur-échantillon (le filtre récence en élimine), tie-break modele_id asc
    candidates = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[: max(top_n * 6, 60)]
    modele_ids = [m for m, _ in candidates]
    modeles: dict[int, dict] = {}
    for chunk in chunked(modele_ids):
        rows = sb_select(
            "auto_modele",
            {
                "select": (
                    "modele_id,modele_parent,modele_marque_id,modele_alias,modele_name,"
                    "modele_ful_name,modele_year_from,modele_year_to,modele_body"
                ),
                "modele_id": f"in.({','.join(str(m) for m in chunk)})",
            },
        )
        for r in rows:
            mid = to_int(r.get("modele_id"))
            if mid is not None:
                modeles[mid] = r

    selected = []
    for modele_id, count in candidates:
        row = modeles.get(modele_id)
        if row is None:
            continue  # comptage sans ligne modèle = anomalie, ignorée de la sélection
        year_to = to_int(row.get("modele_year_to"))
        if year_to is not None and year_to < RECENT_YEAR_MIN:
            continue  # récence : modele_year_to NULL (en cours) ou >= 2010
        selected.append({"modele": row, "active_type_count": count, "selection_rank": len(selected) + 1})
        if len(selected) >= top_n:
            break
    return selected


# ==========================================================================
# FETCH DÉTAIL — types + codes moteur + marque
# ==========================================================================


def fetch_marques(marque_ids: list[int]) -> dict[int, dict]:
    out: dict[int, dict] = {}
    for chunk in chunked(sorted(set(marque_ids))):
        rows = sb_select(
            "auto_marque",
            {
                "select": "marque_id,marque_alias,marque_name",
                "marque_id": f"in.({','.join(str(m) for m in chunk)})",
            },
        )
        for r in rows:
            mid = to_int(r.get("marque_id"))
            if mid is not None:
                out[mid] = r
    return out


def fetch_types_for_modele(modele_id: int) -> list[dict]:
    return sb_select(
        "auto_type",
        {
            "select": (
                "type_id,type_alias,type_name,type_engine,type_fuel,type_power_ps,"
                "type_power_kw,type_liter,type_month_from,type_month_to,type_year_from,"
                "type_year_to,type_body"
            ),
            "type_modele_id": f"eq.{modele_id}",
            "type_id": f"lt.{LEGACY_TYPE_ID_MAX}",
            "type_display": "eq.1",
            "order": "type_id.asc",
        },
    )


def fetch_motor_codes(type_ids: list[int]) -> dict[int, list[str]]:
    """Codes moteur par type via auto_type_motor_code (tmc_type_id → tmc_code).

    État DB constaté 2026-06-12 : table quasi vide (1 ligne sentinelle tmc_type_id='0').
    Le join est implémenté tel que spécifié ; l'absence de code est tracée en
    validation_notes (jamais d'invention de code moteur).
    """
    out: dict[int, list[str]] = {}
    for chunk in chunked(sorted(set(type_ids))):
        rows = sb_select(
            "auto_type_motor_code",
            {
                "select": "tmc_type_id,tmc_code",
                "tmc_type_id": f"in.({','.join(str(t) for t in chunk)})",
            },
        )
        for r in rows:
            tid = to_int(r.get("tmc_type_id"))
            code = (r.get("tmc_code") or "").strip()
            if tid is not None and code:
                out.setdefault(tid, []).append(code)
    return out


# ==========================================================================
# CONSTRUCTION FICHE
# ==========================================================================


def build_motorization_entry(t: dict, motor_codes: dict[int, list[str]], notes: list[str]) -> dict:
    type_id = to_int(t.get("type_id"))
    codes = motor_codes.get(type_id, [])
    liter = to_int(t.get("type_liter"))
    # type_liter DB = centièmes de litre (ex: '200' → 2.0 L)
    displacement_l = (liter / 100.0) if liter is not None else None
    entry: dict = {
        "type_id": type_id,
        "name": (t.get("type_name") or "").strip() or None,
        "alias": (t.get("type_alias") or "").strip() or None,
        "engine_code": codes[0] if codes else None,
        "fuel": normalize_fuel(t.get("type_fuel"), notes, type_id),
        # Classe carburant canonique + bucket cylindrée : axes des clés normalisées
        # des maps fuel-aware (jamais une clé libre dérivée du nom de motorisation).
        "fuel_class": fuel_class(t.get("type_fuel"), notes, type_id),
        "displacement_bucket": displacement_bucket(displacement_l),
        "power_ps": to_int(t.get("type_power_ps")),
        "power_kw": to_int(t.get("type_power_kw")),
        "displacement_l": displacement_l,
        "body": (t.get("type_body") or "").strip() or None,
        "period": {
            "from_year": to_int(t.get("type_year_from")),
            "from_month": to_int(t.get("type_month_from")),
            "to_year": to_int(t.get("type_year_to")),
            "to_month": to_int(t.get("type_month_to")),
        },
        "source": {
            "type": "db",
            "table": "auto_type" if not codes else "auto_type + auto_type_motor_code",
            "confidence": "high",
        },
    }
    if len(codes) > 1:
        entry["engine_codes_all"] = codes
    return entry


def build_engine_axis_maps(
    motorizations: list[dict], make: str, model_generation: str, notes: list[str]
) -> tuple[dict, dict]:
    """Émet les maps BRONZE `known_issues_by_engine` / `maintenance_by_engine`.

    BRONZE = seules les clés `fuel:<classe>` (axe carburant DB-CERTAIN, owner 2026-06-13).
    Granularité PROGRESSIVE, structure-follows-evidence : les clés plus fines
    `fuel_displacement:<classe>:<bucket>` et `engine_family:<code>` ne sont PAS pré-créées
    ici (ce serait spéculatif — on ne sait pas encore si une panne diffère par cylindrée /
    moteur). Le SCRAPING (PR-C.2) les CRÉE à la demande quand il trouve une panne propre à ce
    niveau ; il déduit les cylindrées disponibles de `motorizations[]` (complet). Clés toujours
    normalisées + `axis_key_type`. Squelette éditorial vide (`issues: []` / `operations: []`),
    jamais de panne devinée.
    """
    # Classes carburant présentes (déterministe, trié) — SEUL axe émis en BRONZE.
    fuel_classes: list[str] = sorted({m["fuel_class"] for m in motorizations})

    known_issues: dict[str, dict] = {}
    maintenance: dict[str, dict] = {}

    def _applies_to(fuel: str, bucket: str | None) -> dict:
        base = {"make": make, "model_generation": model_generation, "fuel": fuel,
                "engine_family": None, "market": "unknown"}
        if bucket is not None:
            base["displacement_liter"] = float(bucket)
        return base

    def _src() -> dict:
        # Squelette BRONZE : axe DB-fiable, contenu éditorial à venir (scraping).
        return {"type": "db", "table": "auto_type", "axis": "type_fuel",
                "confidence": "high", "note": "axe carburant DB-fiable ; "
                "issues/operations remplis au scraping PR-C.2 (jamais inventés)."}

    # Niveau 1 — par carburant (`fuel:<classe>`)
    for fuel in fuel_classes:
        key = f"fuel:{fuel}"
        known_issues[key] = {
            "axis_key_type": "fuel",
            "applies_to": _applies_to(fuel, None),
            "source": _src(),
            "issues": [],
        }
        maintenance[key] = {
            "axis_key_type": "fuel",
            "applies_to": _applies_to(fuel, None),
            "source": _src(),
            "operations": [],
        }

    # Niveau 2+ (`fuel_displacement:` / `engine_family:`) : NON émis en BRONZE.
    # Créés à la demande par le scraping PR-C.2 quand une panne est propre à ce niveau
    # (structure-follows-evidence — pas de bucket vide spéculatif).

    if "unknown" in fuel_classes:
        notes.append(
            "fuel_class 'unknown' présente dans les maps known_issues_by_engine/"
            "maintenance_by_engine (carburant DB non rattaché à une classe canonique) — "
            "clé `fuel:unknown` à arbitrer avant promotion WIKI."
        )
    return known_issues, maintenance


def build_fiche(selection: dict, marques: dict[int, dict], generated_at: str) -> dict:
    """Construit frontmatter (clés stables + blocs managed) + body pour un modèle."""
    modele = selection["modele"]
    modele_id = to_int(modele.get("modele_id"))
    marque = marques.get(to_int(modele.get("modele_marque_id")) or -1, {})
    marque_alias = (marque.get("marque_alias") or "marque-inconnue").strip()
    modele_alias = (modele.get("modele_alias") or f"modele-{modele_id}").strip()
    slug = f"{marque_alias}-{modele_alias}"
    ful_name = (modele.get("modele_ful_name") or modele.get("modele_name") or slug).strip()

    notes: list[str] = []
    types = fetch_types_for_modele(modele_id)
    type_ids = [to_int(t.get("type_id")) for t in types if to_int(t.get("type_id")) is not None]
    motor_codes = fetch_motor_codes(type_ids)

    motorizations = [build_motorization_entry(t, motor_codes, notes) for t in types]
    motorizations.sort(key=lambda m: (m.get("fuel") or "", m.get("displacement_l") or 0,
                                      m.get("power_ps") or 0, m.get("type_id") or 0))

    missing_codes = sum(1 for m in motorizations if not m.get("engine_code"))
    if missing_codes:
        notes.append(
            f"engine_code absent pour {missing_codes}/{len(motorizations)} motorisations : "
            "auto_type_motor_code est vide pour ces type_id (constat DB 2026-06-12 : table "
            "quasi vide, 1 ligne sentinelle). Aucun code moteur inventé — à compléter par "
            "source éditoriale vérifiée (PR-C.2) ou backfill DB."
        )

    year_from = to_int(modele.get("modele_year_from"))
    year_to = to_int(modele.get("modele_year_to"))
    generation = extract_generation(modele.get("modele_name"))
    if generation is None:
        notes.append(
            "generation non dérivable mécaniquement de modele_name (pas de suffixe entre "
            "parenthèses) — laissée à null, à confirmer éditorialement."
        )
    if year_to is None:
        notes.append(
            "modele_year_to NULL en DB : traité comme 'encore en production' par le filtre de "
            "récence — à vérifier (certains modèles legacy ont une fin de production manquante)."
        )

    fuels = Counter(m.get("fuel") or "inconnu" for m in motorizations)
    bodies = sorted({m.get("body") for m in motorizations if m.get("body")})

    stable_fm = {
        "category": "catalog/vehicle",
        "doc_family": "catalog",
        "domain": "vehicule",
        "source_type": "vehicle",
        "title": f"Fiche véhicule - {ful_name}",
        "truth_level": "L1",
        "updated_at": generated_at[:10],
        "verification_status": "verified",
        "doc_id": doc_id_for(slug),
        "lang": "fr",
        "make": marque_alias,
        "model": modele_alias,
        "generation": generation,
        "years": [year_from, year_to],
        "provenance": {
            "ingested_by": SCRIPT_ID,
            "generated_at": generated_at,
            "source_db": "supabase (SELECT only — auto_marque/auto_modele/auto_type/auto_type_motor_code)",
        },
    }

    db_profile = {
        "modele_id": modele_id,
        "marque_id": to_int(modele.get("modele_marque_id")),
        "modele_alias": modele_alias,
        "modele_parent": to_int(modele.get("modele_parent")),
        "active_type_count": selection["active_type_count"],
        "type_id_scope": f"legacy < {LEGACY_TYPE_ID_MAX} (type_display='1')",
        "selection_rank": selection["selection_rank"],
        "fuel_breakdown": dict(sorted(fuels.items())),
        "bodies": bodies,
        "last_db_sync": generated_at,
        "source": {"type": "db", "table": "auto_modele + auto_type", "confidence": "high"},
    }

    # Maps BRONZE par carburant (axe motorisation transverse — owner 2026-06-13)
    known_issues_by_engine, maintenance_by_engine = build_engine_axis_maps(
        motorizations, marque_alias, modele_alias, notes
    )

    body = render_body(ful_name, year_from, year_to, generation, bodies, motorizations,
                       fuels, known_issues_by_engine)

    return {
        "slug": slug,
        "stable_fm": stable_fm,
        "managed": {
            "db_profile": db_profile,
            "motorizations": motorizations,
            "known_issues_by_engine": known_issues_by_engine,
            "maintenance_by_engine": maintenance_by_engine,
            "validation_notes": notes,
        },
        "body": body,
    }


def _fmt_period(m: dict) -> str:
    p = m.get("period") or {}
    start = str(p.get("from_year") or "?")
    end = str(p.get("to_year") or "…")
    return f"{start}-{end}"


FUEL_CLASS_LABELS = {
    "diesel": "Diesel",
    "essence": "Essence",
    "electrique": "Électrique",
    "hybride": "Hybride",
    "gpl": "GPL / Gaz",
    "unknown": "Carburant non classé",
}


def render_body(ful_name: str, year_from, year_to, generation, bodies, motorizations,
                fuels, known_issues_by_engine: dict) -> str:
    years_label = f"({year_from or '?'}-{year_to or 'en cours'})"
    fuel_label = ", ".join(f"{count} {fuel}" for fuel, count in sorted(fuels.items()))
    lines = [
        f"# {ful_name} {years_label}",
        "",
        "## Identité",
        "",
        f"- **Modèle** : {ful_name}",
        f"- **Génération** : {generation or 'non renseignée en DB'}",
        f"- **Production** : {year_from or '?'} - {year_to or 'en cours'}",
        f"- **Carrosseries** : {', '.join(bodies) if bodies else 'non renseignées en DB'}",
        f"- **Motorisations actives au catalogue** : {len(motorizations)} ({fuel_label})",
        "",
        "> Bloc FAITS générés depuis la DB interne (auto_modele / auto_type / auto_type_motor_code).",
        "> Source de vérité structurée : frontmatter `motorizations` (provenance champ par champ).",
        "",
        "## Motorisations (DB)",
        "",
    ]
    by_fuel: dict[str, list[dict]] = {}
    for m in motorizations:
        by_fuel.setdefault((m.get("fuel") or "inconnu").capitalize(), []).append(m)
    for fuel in sorted(by_fuel):
        lines.append(f"### {fuel}")
        lines.append("")
        lines.append("| Motorisation | Code moteur | Puissance | kW | Cylindrée | Période | type_id |")
        lines.append("|--------------|-------------|-----------|----|-----------|---------|---------|")
        for m in by_fuel[fuel]:
            disp = f"{m['displacement_l']:.1f} L" if m.get("displacement_l") is not None else "?"
            lines.append(
                f"| {m.get('name') or '?'} | {m.get('engine_code') or '—'} | "
                f"{m.get('power_ps') or '?'} ch | {m.get('power_kw') or '?'} | {disp} | "
                f"{_fmt_period(m)} | {m.get('type_id')} |"
            )
        lines.append("")
    # Carburants présents (niveau `fuel:` des clés normalisées), ordre déterministe.
    fuel_classes_present = sorted(
        k.split(":", 1)[1] for k in known_issues_by_engine if k.startswith("fuel:")
    )

    lines += [
        "## Problèmes connus",
        "",
        "> Organisé PAR CARBURANT (axe motorisation — owner 2026-06-13). Squelette BRONZE :",
        "> les clés `fuel:<carburant>` / `fuel_displacement:<carburant>:<L>` du frontmatter",
        "> `known_issues_by_engine` sont DB-fiables ; le contenu est rempli au scraping PR-C.2",
        "> (pannes PAR motorisation, rappels Rappel Conso) — jamais inventé, divergence DB →",
        "> validation_notes. Le raffinement famille-moteur (`engine_family:<code>`) viendra avec",
        "> le code moteur (absent en DB aujourd'hui → engine_code: null honnête).",
        "",
    ]
    for fc in fuel_classes_present:
        lines.append(f"### {FUEL_CLASS_LABELS.get(fc, fc.capitalize())}")
        lines.append("")
        lines.append(
            f"<!-- TODO éditorial PR-C.2 — pannes connues du bloc {fc} "
            f"(clé `fuel:{fc}`). applies_to.{{make,model_generation,fuel,engine_family,market}}"
            " + source.{type,source_market,lang_original,confidence,evidence_id} ; FR-only,"
            " reformulé non-verbatim. -->"
        )
        lines.append("")

    lines += [
        "## Entretien",
        "",
        "> Organisé PAR CARBURANT (intervalles fuel-dépendants : filtre gasoil 20-30k vs filtre",
        "> essence 60k…). Clés normalisées du frontmatter `maintenance_by_engine`. Squelette",
        "> BRONZE rempli au scraping PR-C.2 (data réparation constructeur) — jamais inventé.",
        "",
    ]
    for fc in fuel_classes_present:
        lines.append(f"### {FUEL_CLASS_LABELS.get(fc, fc.capitalize())}")
        lines.append("")
        lines.append(
            f"<!-- TODO éditorial PR-C.2 — entretien du bloc {fc} (clé `fuel:{fc}`) : "
            "intervalles par moteur, opérations spécifiques. Valeurs prescriptives (couples…)"
            " = fail-closed sans source constructeur/OEM. -->"
        )
        lines.append("")

    lines += [
        "## Pièces fréquentes",
        "",
        "<!-- TODO éditorial — croisement gammes ↔ véhicule (compatible_part_families),",
        "     fuel-aware (un FAP ne concerne que les diesels, une bougie d'allumage que",
        "     l'essence), maillé par les clés DB (PR-D.1+). -->",
        "",
        "## FAQ",
        "",
        "<!-- TODO éditorial — questions propriétaire sourcées (PR-C.2). -->",
        "",
    ]
    return "\n".join(lines)


# ==========================================================================
# RENDU FICHIER + MODES create-missing / merge-managed-blocks
# ==========================================================================


def render_managed_block(key: str, value) -> str:
    return (
        f"# >>> DB-MANAGED BLOCK: {key} — {SCRIPT_ID} (ne pas éditer à la main)\n"
        + dump_yaml({key: value})
        + f"# <<< END DB-MANAGED BLOCK: {key}\n"
    )


def render_full_file(fiche: dict) -> str:
    fm_text = dump_yaml({**fiche["stable_fm"], "content_hash": content_hash_for(fiche["body"])})
    managed_text = "".join(render_managed_block(k, fiche["managed"][k]) for k in MANAGED_KEYS)
    return f"---\n{fm_text}{managed_text}---\n\n{fiche['body']}\n"


def merge_managed_blocks(existing: str, fiche: dict) -> str:
    """Remplace UNIQUEMENT les blocs managed délimités ; tout le reste byte-à-byte.

    Bloc absent (fiche pré-existante non générée) → inséré juste avant le `---`
    fermant du frontmatter (ajout additif, zéro octet modifié ailleurs).
    """
    if not existing.startswith("---\n"):
        raise ValueError("fichier sans frontmatter YAML — merge refusé (pas d'écrasement aveugle)")
    fm_end = existing.find("\n---", 4)
    if fm_end == -1:
        raise ValueError("frontmatter non fermé — merge refusé")

    content = existing
    for key in MANAGED_KEYS:
        new_block = render_managed_block(key, fiche["managed"][key])
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
    parser = argparse.ArgumentParser(description="Génère les fiches RAW véhicule DB-first (maille modèle-génération).")
    parser.add_argument("--top", type=int, default=5, help="Nombre de modèles-générations à sélectionner (défaut 5)")
    parser.add_argument("--create-missing", action="store_true",
                        help="Crée uniquement les fiches absentes (mode par défaut, flag explicite)")
    parser.add_argument("--merge-managed-blocks", action="store_true",
                        help="Met à jour UNIQUEMENT les blocs DB-managed des fiches existantes")
    parser.add_argument("--dry-run", action="store_true", help="Écrit dans --out-dir au lieu du RAW")
    parser.add_argument("--out-dir", type=str, default=None, help="Répertoire de sortie pour --dry-run")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    if args.dry_run and not args.out_dir:
        parser.error("--dry-run requiert --out-dir (aucune écriture dans le RAW en dry-run)")
    if args.merge_managed_blocks and args.dry_run:
        print("[info] dry-run + merge : le merge est simulé sur les fiches du RAW, sortie dans --out-dir")

    out_dir = Path(args.out_dir) / "vehicles" if args.dry_run else RAW_REPO / VEHICLES_SUBDIR
    out_dir.mkdir(parents=True, exist_ok=True)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    selections = select_top_models(args.top, verbose=args.verbose)
    if not selections:
        print("Aucun modèle sélectionné — abandon.", file=sys.stderr)
        return 1
    marques = fetch_marques([
        to_int(s["modele"].get("modele_marque_id")) for s in selections
        if to_int(s["modele"].get("modele_marque_id")) is not None
    ])

    created, merged, skipped = 0, 0, 0
    for sel in selections:
        fiche = build_fiche(sel, marques, generated_at)
        target = out_dir / f"{fiche['slug']}.md"
        raw_target = RAW_REPO / VEHICLES_SUBDIR / f"{fiche['slug']}.md"

        if args.merge_managed_blocks and raw_target.exists():
            merged_content = merge_managed_blocks(raw_target.read_text(encoding="utf-8"), fiche)
            target.write_text(merged_content, encoding="utf-8")
            merged += 1
            print(f"[merge ] {target} (blocs: {', '.join(MANAGED_KEYS)})")
        elif not args.merge_managed_blocks and not args.dry_run and target.exists():
            skipped += 1
            print(f"[skip  ] {target} existe déjà (mode create-missing — jamais d'écrasement)")
        else:
            target.write_text(render_full_file(fiche), encoding="utf-8")
            created += 1
            print(f"[create] {target} ({sel['active_type_count']} motorisations, rang {sel['selection_rank']})")

    print(f"\nRésumé : {created} créée(s), {merged} mergée(s), {skipped} skippée(s) — sortie {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
