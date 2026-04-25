#!/usr/bin/env python3
"""
rag-propose-vehicle-from-web.py — Stage 1.B : propose vehicles/<slug>.md enrichments
with per-motorisation data extracted from web-vehicles/*.md (Stage 1.A output).

**Mode propose-before-write (ADR-022 L1)**. NEVER writes to disk RAG.
Inserts proposals into __rag_proposals table with status='pending'.
A separate process merges approved proposals into rag/knowledge/vehicles/<slug>.md.

Diff vs ancienne version (closed PR #172, fermée car violait L1) :
  - write_back / _bootstrap_vehicle_md → propose_to_db / _bootstrap_template (in-memory)
  - INSERT __rag_proposals avec input_fingerprint (idempotence par no-op sur duplicate)
  - hashes sha256 base + proposed
  - diff_unified pour review humain
  - risk_level + risk_flags ADR-022 L4
  - expires_at = NOW() + 14 days

Logique parsing (inchangée) :
  1. Pour chaque modele cible, lit web-vehicles/*.md taggés target_modele_id=X
  2. Parse codes moteur (K9K, D4F, K4J, F4R...) + per-row context (couple, vmax, 0-100, masse, boite)
  3. Pour chaque type_id du modele :
     - Match power → engine fields via parsed engines
     - Derive norme Euro depuis year_from
     - Récupère CNIT depuis auto_type_number_code DB
  4. Auto-verify gate : 5 cross-checks DB → verdict {verified, partial, rejected}
  5. Compute proposed file content + INSERT __rag_proposals (status=pending)

Usage:
  # Dry-run : compute proposal payload, no DB write
  python3 scripts/rag/rag-propose-vehicle-from-web.py --modele clio-iii --dry-run

  # Apply : INSERT __rag_proposals (status=pending, expires_at=now+14d)
  python3 scripts/rag/rag-propose-vehicle-from-web.py --modele clio-iii --apply

After --apply : approve proposals manually via SQL or admin endpoint, then
a separate writer process merges the approved proposed_content into
rag/knowledge/vehicles/<slug>.md via PR signed G3.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import os
import re
import sys
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

try:
    import psycopg2
    import psycopg2.extras
    import yaml
except ImportError:
    print("Manque : pip install psycopg2-binary pyyaml")
    sys.exit(1)

# === CONFIG ============================================================

WEB_VEHICLES_DIR = "/opt/automecanik/rag/knowledge/web-vehicles"
VEHICLES_DIR = "/opt/automecanik/rag/knowledge/vehicles"

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")
if not DB_PASSWORD:
    sys.stderr.write(
        "[FATAL] SUPABASE_DB_PASSWORD missing in env. "
        "source backend/.env then re-run.\n"
    )
    sys.exit(1)
DB_DSN = (
    f"host=db.{PROJECT_REF}.supabase.co port=5432 user=postgres "
    f"dbname=postgres password={DB_PASSWORD} sslmode=require"
)


# === ENGINE CODE EXTRACTION ============================================

# Regex generic for engine codes : 1-2 letters + 3 digits + optional suffix.
# Examples : K9K, K9K700, D4F, K4J, F4R, M9R, M9T, N47, M57, N52, B47, BWA, BSE
ENGINE_CODE_RE = re.compile(
    r"\b([A-Z]\d?[A-Z]\d{2,3}[A-Z]?\b|[A-Z]{2,3}\d{2,3}[A-Z]?)\b"
)

# Regex for "X.Y dCi/HDi/TDI/TCe/TFSI etc. NN[/NN]+ ch" patterns
ENGINE_LINE_RE = re.compile(
    r"(?P<displ>\d\.\d)\s*(?P<family>dCi|HDi|TDI|TCe|TFSI|THP|VTi|MPI|CDi|"
    r"FSI|TSI|EcoBoost|D4F|K4J|K9K|F4R|M9R|N47|N52|B47|BWA|BSE|MultiAir)?\s*"
    r"(?P<code>[A-Z]\d?[A-Z]\d{2,3}[A-Z]?)?\s*"
    r"(?P<powers>\d{2,3}(?:\s*[/-]\s*\d{2,3})*)\s*ch",
    re.IGNORECASE,
)

# Euro norm derived from year_from
def derive_euro(year: int) -> str | None:
    if not year or year <= 1980:
        return None
    if year < 1996: return "Euro 1"
    if year < 2000: return "Euro 2"
    if year < 2005: return "Euro 3"
    if year < 2009: return "Euro 4"
    if year < 2014: return "Euro 5"
    if year < 2017: return "Euro 6b"
    if year < 2020: return "Euro 6c"
    return "Euro 6d"


# === DB ACCESS =========================================================

def db_connect():
    return psycopg2.connect(DB_DSN)


def fetch_modele_info(modele_id: int) -> dict | None:
    sql = """
        SELECT m.modele_id, m.modele_alias, m.modele_name, m.modele_year_from,
               b.marque_alias, b.marque_name
        FROM auto_modele m
        JOIN auto_marque b ON b.marque_id::int = m.modele_marque_id
        WHERE m.modele_id = %s
    """
    with db_connect() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, [modele_id])
        return cur.fetchone()


def fetch_modeles_by_filter(args) -> list[dict]:
    sql = """
        SELECT m.modele_id, m.modele_alias, m.modele_name,
               b.marque_alias, b.marque_name
        FROM auto_modele m
        JOIN auto_marque b ON b.marque_id::int = m.modele_marque_id
        WHERE m.modele_display = 1 AND b.marque_display = '1'
    """
    params: list = []
    if args.modele_id:
        sql += " AND m.modele_id = %s"
        params.append(args.modele_id)
    elif args.modele:
        roman_map = {"-1": "-i", "-2": "-ii", "-3": "-iii", "-4": "-iv", "-5": "-v"}
        alt = args.modele.lower()
        for arabic, roman in roman_map.items():
            if alt.endswith(arabic):
                alt = alt[: -len(arabic)] + roman
                break
        sql += " AND lower(m.modele_alias) IN (lower(%s), lower(%s))"
        params.extend([args.modele, alt])
    elif args.brand:
        sql += " AND lower(b.marque_alias) = lower(%s)"
        params.append(args.brand)
    else:
        sql += """
            AND (
                (lower(b.marque_alias) = 'renault' AND lower(m.modele_alias) LIKE 'clio-iii%%')
                OR lower(b.marque_alias) = 'smart'
                OR (lower(b.marque_alias) = 'ds' AND lower(m.modele_alias) LIKE 'ds-3%%')
            )
        """
    sql += " ORDER BY b.marque_alias, m.modele_alias LIMIT 50"
    with db_connect() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def fetch_types_for_modele(modele_id: int) -> list[dict]:
    sql = """
        SELECT t.type_id_i AS type_id,
               t.type_name, t.type_fuel,
               t.type_power_ps::int AS power_ps,
               t.type_liter, t.type_body,
               t.type_year_from::int AS year_from,
               t.type_year_to::int AS year_to
        FROM auto_type t
        WHERE t.type_display = '1'
          AND t.type_modele_id_i = %s
          AND t.type_power_ps ~ '^[0-9]+$'
        ORDER BY t.type_id_i
    """
    with db_connect() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, [modele_id])
        return list(cur.fetchall())


def fetch_cnit_for_types(type_ids: list[int]) -> dict[int, list[str]]:
    """Map type_id → list of CNIT codes from auto_type_number_code."""
    if not type_ids:
        return {}
    sql = """
        SELECT tnc_type_id::int AS type_id, tnc_cnit
        FROM auto_type_number_code
        WHERE tnc_type_id::int = ANY(%s)
          AND tnc_cnit IS NOT NULL AND tnc_cnit != ''
    """
    out: dict[int, list[str]] = defaultdict(list)
    with db_connect() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, [type_ids])
        for row in cur.fetchall():
            out[int(row["type_id"])].append(str(row["tnc_cnit"]).strip())
    return dict(out)


# === WEB CORPUS PARSE ==================================================

@dataclass
class WebDoc:
    path: str
    source_provider: str
    source_url: str
    target_type_ids: list[int]
    body: str


def load_web_docs_for_modele(modele_id: int) -> list[WebDoc]:
    out: list[WebDoc] = []
    if not os.path.isdir(WEB_VEHICLES_DIR):
        return out
    for fn in sorted(os.listdir(WEB_VEHICLES_DIR)):
        if not fn.endswith(".md"):
            continue
        path = os.path.join(WEB_VEHICLES_DIR, fn)
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        m = re.match(r"---\n(.+?)\n---\n(.*)", raw, re.DOTALL)
        if not m:
            continue
        try:
            fm = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            continue
        if int(fm.get("target_modele_id", -1)) != modele_id:
            continue
        out.append(
            WebDoc(
                path=path,
                source_provider=str(fm.get("source_provider", "")),
                source_url=str(fm.get("source_url", "")),
                target_type_ids=list(fm.get("target_type_ids") or []),
                body=m.group(2),
            )
        )
    return out


@dataclass
class ParsedEngine:
    """Engine description extracted from a web doc line. Maximalist :
    capture every factual field available so siblings of same engine code
    can still be differentiated by power_rpm, couple, vmax, 0-100, boite,
    masse, etc."""
    family: str          # 'dCi', 'TCe', 'F4R'…
    code: str | None     # 'K9K', 'F4R', 'D4F'…
    displacement_l: str  # '1.5'
    powers_ps: list[int]  # [70, 75, 85, 90, 100, 105]
    fuel: str            # 'Essence' | 'Diesel' | 'Hybride' | ''
    source_url: str
    source_provider: str = ""
    # Per-row extraction (fiches-auto Performances et moteurs table)
    power_rpm: int | None = None       # 3500 (T/min)
    couple_nm: int | None = None       # 200
    couple_rpm: int | None = None      # 2000 (T/min)
    vitesse_max_kmh: int | None = None # 183
    zero_a_cent_s: float | None = None # 12.9
    boite: str | None = None           # 'Boîte 5' / 'Boîte 6'
    masse_kg: int | None = None        # 1170


FAMILY_TOKENS = {
    "dci", "hdi", "tdi", "tce", "tfsi", "thp", "vti", "mpi", "cdi", "fsi",
    "tsi", "ecoboost", "multiair", "ecotec", "vvt", "vvti",
}

DISPL_RE = re.compile(r"\b(\d\.\d)\b")
POWERS_RE = re.compile(r"\b(\d{2,3}(?:\s*[/-]\s*\d{2,3})*)\s*ch\b", re.IGNORECASE)
CODE_RE = re.compile(
    r"\b("
    r"[A-Z]\d[A-Z]\d{0,4}[A-Z]?"   # D4F, K9K, K9K766, F4R-style (Renault, PSA)
    r"|[A-Z]\d{2,3}"                # B47, N47, N52 (BMW)
    r"|[A-Z]{3}\d{0,3}"             # BWA, BSE, EA888 (VAG)
    r")\b"
)


PER_ENGINE_RE = re.compile(
    r"(?P<displ>\d\.\d)\s+"                           # displacement
    r"(?:(?P<extra>[A-Za-z0-9 ]{0,40}?)\s+)?"         # any text in between
    r"(?P<powers>\d{2,3}(?:\s*[/-]\s*\d{2,3})*)\s*ch",  # powers list + ch
    re.IGNORECASE,
)


FUEL_MARKER_RE = re.compile(
    r"\b(Essence|Diesel|Hybride|Electrique|Électrique|GPL|Ethanol|Éthanol)\b",
    re.IGNORECASE,
)


def _fuel_from_context(text_before: str) -> str:
    """Find the last 'Essence' or 'Diesel' marker before this match. The
    Wikipedia tables list engines by section so the closest preceding
    fuel keyword tags the engine."""
    matches = list(FUEL_MARKER_RE.finditer(text_before))
    if not matches:
        return ""
    raw = matches[-1].group(1).lower()
    if raw == "essence":
        return "Essence"
    if raw == "diesel":
        return "Diesel"
    if raw.startswith("hybr"):
        return "Hybride"
    if raw in {"electrique", "électrique"}:
        return "Electrique"
    if raw == "gpl":
        return "GPL"
    if raw.startswith("ethan") or raw.startswith("éthan"):
        return "Ethanol"
    return ""


POWER_RPM_RE = re.compile(r"(\d{2,3})\s*ch\s*[àa]\s*(\d{3,5})\s*T", re.IGNORECASE)
COUPLE_RE = re.compile(r"(\d{2,4})\s*N[\.\s]?M\s*[àa]\s*(\d{3,5})\s*T", re.IGNORECASE)
COUPLE_SIMPLE_RE = re.compile(r"(\d{2,4})\s*N[\.\s]?M", re.IGNORECASE)
VMAX_RE = re.compile(r"(\d{2,3})\s*Km\s*/\s*h", re.IGNORECASE)
ZERO_CENT_RE = re.compile(r"(\d{1,2}(?:[.,]\d+)?)\s*sec\.?", re.IGNORECASE)
MASSE_RE = re.compile(r"\((\d{3,4})\s*kg\)", re.IGNORECASE)
BOITE_RE = re.compile(r"Bo[ïi]te\s*\d+|M[ée]ca\.?\s*\d+|Auto\.?\s*\d+", re.IGNORECASE)


def _line_containing(body: str, pos: int) -> str:
    """Return the full line of `body` that contains character index `pos`."""
    start = body.rfind("\n", 0, pos) + 1
    end = body.find("\n", pos)
    if end == -1:
        end = len(body)
    return body[start:end]


def parse_engine_lines(doc: WebDoc) -> list[ParsedEngine]:
    """Extract one ParsedEngine per `displacement … power+ch` substring.
    For fiches-auto-style table rows, ALSO extract per-row context :
    couple, vitesse max, 0-100 km/h, boite, masse — so siblings of the
    same engine code remain differentiated."""
    out: list[ParsedEngine] = []
    seen_keys: set[tuple[str, str, tuple[int, ...]]] = set()
    for m in PER_ENGINE_RE.finditer(doc.body):
        powers_raw = m.group("powers") or ""
        powers = [int(x.strip()) for x in re.split(r"[/-]", powers_raw) if x.strip().isdigit()]
        powers = [x for x in powers if 30 <= x <= 800]
        if not powers:
            continue
        displ = m.group("displ")
        extra = (m.group("extra") or "").strip()

        # Engine code in `extra`
        code: str | None = None
        for cm in CODE_RE.finditer(extra):
            tok = cm.group(1)
            if tok.lower() not in FAMILY_TOKENS and len(tok) >= 3 and not tok.isdigit():
                code = tok
                break

        # Family marker
        family: str = ""
        for tok in re.findall(r"[A-Za-z]{2,8}", extra):
            if tok.lower() in FAMILY_TOKENS:
                family = tok
                break

        # Fuel context — last "Essence"/"Diesel" marker before this match
        fuel = _fuel_from_context(doc.body[: m.start()])
        if not fuel and family.lower() in {"dci", "hdi", "tdi", "cdi"}:
            fuel = "Diesel"
        if not fuel and family.lower() in {"tce", "tfsi", "thp", "vti", "tsi", "fsi", "mpi"}:
            fuel = "Essence"

        # ── Per-row maximalist extraction (fiches-auto table) ─────────
        line_full = _line_containing(doc.body, m.start())
        # Power + RPM together "70 ch à 4000 T/min"
        power_rpm: int | None = None
        prm = POWER_RPM_RE.search(line_full)
        if prm and powers and int(prm.group(1)) in powers:
            power_rpm = int(prm.group(2))
        # Couple + RPM together "200 NM à 2000 T/min"
        couple_nm: int | None = None
        couple_rpm: int | None = None
        crm = COUPLE_RE.search(line_full)
        if crm:
            couple_nm = int(crm.group(1))
            couple_rpm = int(crm.group(2))
        else:
            cm2 = COUPLE_SIMPLE_RE.search(line_full)
            if cm2:
                couple_nm = int(cm2.group(1))
        # Vitesse max
        vmax_m = VMAX_RE.search(line_full)
        vmax = int(vmax_m.group(1)) if vmax_m else None
        # 0-100 km/h
        zero_m = ZERO_CENT_RE.search(line_full)
        zero = float(zero_m.group(1).replace(",", ".")) if zero_m else None
        # Masse
        masse_m = MASSE_RE.search(line_full)
        masse = int(masse_m.group(1)) if masse_m else None
        # Boîte
        boite_m = BOITE_RE.search(line_full)
        boite = boite_m.group(0).strip() if boite_m else None

        # Per fiches-auto, each row is 1 power. Wikipedia rows list multiple powers.
        # If row has 1 power AND we extracted couple/vmax/0-100, treat as
        # 1 ParsedEngine per power (so the data attaches correctly).
        is_per_power_row = couple_nm is not None and vmax is not None and len(powers) == 1
        if is_per_power_row:
            key = (displ, fuel, tuple(powers))
            if key in seen_keys:
                continue
            seen_keys.add(key)
            out.append(
                ParsedEngine(
                    family=family,
                    code=code,
                    displacement_l=displ,
                    powers_ps=powers,
                    fuel=fuel,
                    source_url=doc.source_url,
                    source_provider=doc.source_provider,
                    power_rpm=power_rpm,
                    couple_nm=couple_nm,
                    couple_rpm=couple_rpm,
                    vitesse_max_kmh=vmax,
                    zero_a_cent_s=zero,
                    boite=boite,
                    masse_kg=masse,
                )
            )
        else:
            # Wikipedia-style : 1 line / multiple powers, no per-row detail
            key = (displ, fuel, tuple(sorted(set(powers))))
            if key in seen_keys:
                continue
            seen_keys.add(key)
            out.append(
                ParsedEngine(
                    family=family,
                    code=code,
                    displacement_l=displ,
                    powers_ps=powers,
                    fuel=fuel,
                    source_url=doc.source_url,
                    source_provider=doc.source_provider,
                )
            )
    return out


# === ENRICHMENT + AUTO-VERIFY ==========================================

@dataclass
class TypeEnrichment:
    type_id: int
    type_name: str
    fuel: str
    power_ps: int
    year_from: int
    year_to: int | None
    cylindree: str
    body: str
    # Enriched fields (maximalist)
    code_moteur: str | None = None
    famille_moteur: str | None = None
    norme_euro: str | None = None
    power_rpm: int | None = None
    couple_nm: int | None = None
    couple_rpm: int | None = None
    vitesse_max_kmh: int | None = None
    zero_a_cent_s: float | None = None
    boite: str | None = None
    masse_kg: int | None = None
    cnit: list[str] = field(default_factory=list)
    source_urls: list[str] = field(default_factory=list)
    sources_confirming: set[str] = field(default_factory=set)
    # Auto-verify (real cross-source)
    checks: dict = field(default_factory=dict)
    verdict: str = ""


def match_engine(engines: list[ParsedEngine], type_row: dict) -> ParsedEngine | None:
    """Pick the engine entry whose powers list contains type_row.power_ps,
    filtered by fuel match (essence type → essence engine)."""
    target_power = int(type_row["power_ps"])
    target_fuel = (type_row.get("type_fuel") or "").strip().lower()

    def fuel_matches(engine_fuel: str) -> bool:
        if not target_fuel or not engine_fuel:
            return True  # be tolerant when fuel is unknown on either side
        ef = engine_fuel.lower()
        # Hybride essence-électrique → engine-side may say 'Essence'
        if "essence" in target_fuel and ef == "essence":
            return True
        if "diesel" in target_fuel and ef == "diesel":
            return True
        if "electrique" in target_fuel and ef == "electrique":
            return True
        return ef == target_fuel

    # Exact power + fuel match
    for e in engines:
        if target_power in e.powers_ps and fuel_matches(e.fuel):
            return e
    # Tolerant ±2 ch + fuel match
    for e in engines:
        if any(abs(p - target_power) <= 2 for p in e.powers_ps) and fuel_matches(e.fuel):
            return e
    # Last resort : power match without fuel filter
    for e in engines:
        if target_power in e.powers_ps:
            return e
    return None


def enrich_modele(modele: dict, dry_run: bool) -> tuple[list[TypeEnrichment], dict]:
    modele_id = int(modele["modele_id"])
    types = fetch_types_for_modele(modele_id)
    docs = load_web_docs_for_modele(modele_id)

    # Aggregate engine entries from all web docs
    all_engines: list[ParsedEngine] = []
    sources_used: set[str] = set()
    for d in docs:
        engines = parse_engine_lines(d)
        if engines:
            sources_used.add(d.source_provider)
        all_engines.extend(engines)

    # CNIT from DB
    type_ids = [int(t["type_id"]) for t in types]
    cnit_map = fetch_cnit_for_types(type_ids)

    enrichments: list[TypeEnrichment] = []
    for t in types:
        e = TypeEnrichment(
            type_id=int(t["type_id"]),
            type_name=str(t["type_name"] or ""),
            fuel=str(t["type_fuel"] or ""),
            power_ps=int(t["power_ps"] or 0),
            year_from=int(t["year_from"] or 0),
            year_to=int(t["year_to"]) if t.get("year_to") else None,
            cylindree=str(t["type_liter"] or ""),
            body=str(t["type_body"] or ""),
        )
        # Aggregate ALL matching engines from ALL sources for this type_id.
        target_power = int(t["power_ps"])
        target_fuel = (t.get("type_fuel") or "").strip().lower()

        def _fuel_ok(eng_fuel: str) -> bool:
            if not target_fuel or not eng_fuel:
                return True
            ef = eng_fuel.lower()
            return (
                ef == target_fuel
                or ("essence" in target_fuel and ef == "essence")
                or ("diesel" in target_fuel and ef == "diesel")
            )

        # Exact power match (priority), then ±2 ch fallback
        matches = [eng for eng in all_engines if target_power in eng.powers_ps and _fuel_ok(eng.fuel)]
        if not matches:
            matches = [
                eng for eng in all_engines
                if any(abs(p - target_power) <= 2 for p in eng.powers_ps) and _fuel_ok(eng.fuel)
            ]

        for match in matches:
            if match.source_provider:
                e.sources_confirming.add(match.source_provider)
            if match.source_url and match.source_url not in e.source_urls:
                e.source_urls.append(match.source_url)
            if not e.code_moteur and match.code:
                e.code_moteur = match.code
            if not e.famille_moteur and match.family:
                e.famille_moteur = match.family
            # Per-power factual fields (only set from per-power rows)
            if e.power_rpm is None and match.power_rpm:
                e.power_rpm = match.power_rpm
            if e.couple_nm is None and match.couple_nm:
                e.couple_nm = match.couple_nm
            if e.couple_rpm is None and match.couple_rpm:
                e.couple_rpm = match.couple_rpm
            if e.vitesse_max_kmh is None and match.vitesse_max_kmh:
                e.vitesse_max_kmh = match.vitesse_max_kmh
            if e.zero_a_cent_s is None and match.zero_a_cent_s:
                e.zero_a_cent_s = match.zero_a_cent_s
            if not e.boite and match.boite:
                e.boite = match.boite
            if e.masse_kg is None and match.masse_kg:
                e.masse_kg = match.masse_kg

        e.norme_euro = derive_euro(e.year_from)
        e.cnit = sorted(set(cnit_map.get(e.type_id, [])))[:3]

        # ── Real cross-source validation (5 checks, NOT bidons) ─────────
        def _displ_match() -> bool:
            if not e.cylindree or not matches:
                return False
            try:
                db_cc = int(e.cylindree)
            except (ValueError, TypeError):
                return False
            if 50 <= db_cc <= 250:
                db_cc *= 10  # 150 → 1500 cc
            for mat in matches:
                try:
                    web_cc = int(float(mat.displacement_l) * 1000)
                except (ValueError, TypeError):
                    continue
                if abs(db_cc - web_cc) <= 100:
                    return True
            return False

        def _fuel_match() -> bool:
            if not e.fuel or not matches:
                return False
            target = e.fuel.lower()
            return any(
                m.fuel and (
                    m.fuel.lower() == target
                    or ("essence" in target and m.fuel.lower() == "essence")
                    or ("diesel" in target and m.fuel.lower() == "diesel")
                )
                for m in matches
            )

        e.checks = {
            "C1_power_match_in_web": bool(matches),
            "C2_displ_match_db_web": _displ_match(),
            "C3_fuel_match_db_web": _fuel_match(),
            "C4_engine_code_found": bool(e.code_moteur),
            "C5_cross_source_2plus": len(e.sources_confirming) >= 2,
        }
        passed = sum(1 for v in e.checks.values() if v)
        if passed == 5:
            e.verdict = "verified"
        elif passed >= 3:
            e.verdict = "partial"
        else:
            e.verdict = "rejected"
        enrichments.append(e)

    summary = {
        "modele_id": modele_id,
        "modele_label": f"{modele['marque_name']} {modele['modele_name']}",
        "type_count": len(types),
        "web_docs_used": len(docs),
        "engines_parsed": len(all_engines),
        "sources_used": sorted(sources_used),
        "verified": sum(1 for e in enrichments if e.verdict == "verified"),
        "partial": sum(1 for e in enrichments if e.verdict == "partial"),
        "rejected": sum(1 for e in enrichments if e.verdict == "rejected"),
    }
    return enrichments, summary


# === WRITE BACK TO vehicles/<slug>.md ==================================

def find_vehicle_md(modele: dict) -> str | None:
    """Locate the existing vehicles/<slug>.md for this modele."""
    candidates = [
        f"{modele['marque_alias']}-{modele['modele_alias']}.md",
        f"{modele['modele_alias']}.md",
    ]
    for c in candidates:
        path = os.path.join(VEHICLES_DIR, c)
        if os.path.isfile(path):
            return path
    return None


def render_motorisations_yaml(enrichments: Iterable[TypeEnrichment]) -> str:
    """Produce the YAML block for motorisations[] (frontmatter compatible)."""
    items = []
    for e in enrichments:
        if e.verdict == "rejected":
            continue
        item: dict = {
            "type_id": e.type_id,
            "moteur": e.type_name,
            "puissance": f"{e.power_ps} ch",
            "fuel": e.fuel,
            "code_moteur": e.code_moteur or "-",
        }
        if e.famille_moteur:
            item["famille_moteur"] = e.famille_moteur
        if e.cylindree:
            item["cylindree"] = e.cylindree
        if e.body:
            item["body"] = e.body
        if e.year_from:
            range_str = f"{e.year_from}"
            if e.year_to:
                range_str += f"-{e.year_to}"
            item["periode"] = range_str
        if e.norme_euro:
            item["norme_euro"] = e.norme_euro
        if e.power_rpm:
            item["power_rpm"] = e.power_rpm
        if e.couple_nm:
            item["couple_nm"] = e.couple_nm
        if e.couple_rpm:
            item["couple_rpm"] = e.couple_rpm
        if e.vitesse_max_kmh:
            item["vitesse_max_kmh"] = e.vitesse_max_kmh
        if e.zero_a_cent_s:
            item["zero_a_cent_s"] = e.zero_a_cent_s
        if e.boite:
            item["boite"] = e.boite
        if e.masse_kg:
            item["masse_kg"] = e.masse_kg
        if e.cnit:
            item["cnit"] = e.cnit
        if e.source_urls:
            item["source_urls"] = e.source_urls
        if e.sources_confirming:
            item["sources_confirming"] = sorted(e.sources_confirming)
        item["verification_status"] = e.verdict
        items.append(item)
    if not items:
        return "motorisations: []\n"
    return yaml.safe_dump(
        {"motorisations": items},
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=200,
    )


def _replace_motorisations_block(fm_text: str, new_yaml: str) -> str:
    """Replace the `motorisations:` block in YAML frontmatter with `new_yaml`.

    Handles both "no entries" (`motorisations: []`) and lists with dash-prefixed
    or indented entries. Stops at the next top-level YAML key (line starting
    with `[a-z_]+:` at column 0).
    """
    lines = fm_text.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    replaced = False
    while i < len(lines):
        line = lines[i]
        if not replaced and re.match(r"^motorisations:\s*$", line.rstrip()):
            # Skip everything from this line up to (excluding) the next
            # top-level key.
            i += 1
            while i < len(lines):
                nxt = lines[i]
                if re.match(r"^[A-Za-z_][A-Za-z0-9_]*\s*:", nxt):
                    break
                i += 1
            block = new_yaml.rstrip("\n") + "\n"
            out.append(block)
            replaced = True
            continue
        # Old inline form : `motorisations: []` on one line
        if not replaced and re.match(r"^motorisations:\s*\[\]\s*$", line.rstrip()):
            out.append(new_yaml.rstrip("\n") + "\n")
            replaced = True
            i += 1
            continue
        out.append(line)
        i += 1
    if not replaced:
        # Append at end of frontmatter
        if not "".join(out).endswith("\n"):
            out.append("\n")
        out.append(new_yaml.rstrip("\n") + "\n")
    return "".join(out)


def _bootstrap_template(modele: dict) -> str:
    """In-memory bootstrap content for vehicles/<slug>.md when missing.

    Used as the *proposed* content base when no current file exists.
    Returns the full markdown text. Does NOT write to disk.
    """
    now = datetime.now(timezone.utc).date().isoformat()
    return (
        f"---\n"
        f"category: catalog/vehicle\n"
        f"doc_family: catalog\n"
        f"source_type: vehicle\n"
        f"title: Fiche vehicule - {modele['marque_name']} {modele['modele_name']}\n"
        f"truth_level: L2\n"
        f"updated_at: '{now}'\n"
        f"verification_status: draft\n"
        f"modele_id: {modele['modele_id']}\n"
        f"marque_id: {modele.get('marque_id', '')}\n"
        f"motorisations: []\n"
        f"lang: fr\n"
        f"---\n\n"
        f"# {modele['marque_name']} {modele['modele_name']}\n\n"
        f"Fiche véhicule auto-générée — enrichie via "
        f"`scripts/rag/rag-propose-vehicle-from-web.py` (mode propose-before-write).\n"
    )


def _sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _input_fingerprint(modele: dict, enrichments: list, sources: list[str]) -> str:
    """Deterministic fingerprint of inputs (idempotence guard).

    Same model + same enrichment fields + same source URLs → same fingerprint.
    Used by partial unique index in __rag_proposals to no-op repeat regen.
    """
    payload = {
        "modele_id": int(modele["modele_id"]),
        "type_ids": sorted(int(e.type_id) for e in enrichments),
        "fields_hash": _sha256(
            "|".join(
                f"{e.type_id}:{getattr(e, 'engine_code', '')}:"
                f"{getattr(e, 'couple_nm', '')}:{getattr(e, 'vitesse_max_kmh', '')}:"
                f"{getattr(e, 'masse_kg', '')}"
                for e in enrichments
            )
        ),
        "sources": sorted(sources),
        "version": "rag-propose-vehicle-from-web/v1",
    }
    return _sha256(json.dumps(payload, sort_keys=True, ensure_ascii=True))


def _compute_risk(diff_lines_added: int, diff_lines_removed: int) -> tuple[str, list[str]]:
    """ADR-022 L4 risk classification (low/medium/high) + flags.

    low : <=20 lines changed total
    medium : 21-100 lines or removes >5 lines
    high : >100 lines OR removes >20 lines OR new file
    """
    total = diff_lines_added + diff_lines_removed
    flags = []
    if diff_lines_removed > 20:
        flags.append("removes_many_lines")
    if total > 100:
        flags.append("large_diff")
    if total > 200:
        flags.append("very_large_diff")
    if diff_lines_added > 0 and diff_lines_removed == 0:
        flags.append("additive_only")
    if total > 100 or diff_lines_removed > 20:
        risk = "high"
    elif total > 20 or diff_lines_removed > 5:
        risk = "medium"
    else:
        risk = "low"
    return risk, flags


def _build_proposed_content(
    current_raw: str,
    new_motorisations_yaml: str,
    modele: dict,
) -> str:
    """Compute the proposed full file content in-memory. NEVER writes to disk."""
    if not current_raw:
        # Bootstrap from template, then apply motorisations block
        current_raw = _bootstrap_template(modele)

    m = re.match(r"(---\n)(.+?)(\n---\n)(.*)", current_raw, re.DOTALL)
    if not m:
        # Treat unmatched content as opaque body, prepend template frontmatter
        bootstrap = _bootstrap_template(modele)
        m = re.match(r"(---\n)(.+?)(\n---\n)(.*)", bootstrap, re.DOTALL)
        if not m:
            raise RuntimeError("bootstrap template has no valid frontmatter — bug")
        head, fm_text, sep, body = m.groups()
    else:
        head, fm_text, sep, body = m.groups()

    new_fm = _replace_motorisations_block(fm_text, new_motorisations_yaml)
    new_fm = re.sub(
        r"updated_at: '[^']+'",
        f"updated_at: '{datetime.now(timezone.utc).date().isoformat()}'",
        new_fm,
    )
    return head + new_fm + sep + body


def propose_to_db(
    path: str,
    new_motorisations_yaml: str,
    enrichments: list,
    modele: dict,
    sources: list[str],
    dry_run: bool,
) -> str | None:
    """Compute a proposal and INSERT into __rag_proposals (status='pending').

    NEVER writes to disk. Respects ADR-022 L1 (propose-before-write).
    Returns the proposal_uuid on success, None on dry-run.
    """
    # 1. Load current content (empty if file missing)
    current_raw = ""
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            current_raw = f.read()

    # 2. Compute proposed full file content
    proposed_raw = _build_proposed_content(current_raw, new_motorisations_yaml, modele)

    # 3. Hashes + fingerprint
    base_hash = _sha256(current_raw) if current_raw else None
    proposed_hash = _sha256(proposed_raw)
    fingerprint = _input_fingerprint(modele, enrichments, sources)

    # 4. Diff unified
    diff_lines = list(
        difflib.unified_diff(
            current_raw.splitlines(keepends=True),
            proposed_raw.splitlines(keepends=True),
            fromfile=f"a/{os.path.relpath(path, '/opt/automecanik/rag/knowledge')}",
            tofile=f"b/{os.path.relpath(path, '/opt/automecanik/rag/knowledge')}",
            n=3,
        )
    )
    diff_unified = "".join(diff_lines)
    added = sum(1 for line in diff_lines if line.startswith("+") and not line.startswith("+++"))
    removed = sum(1 for line in diff_lines if line.startswith("-") and not line.startswith("---"))

    # 5. Risk classification
    risk_level, risk_flags = _compute_risk(added, removed)

    # 6. Target metadata
    relpath = os.path.relpath(path, "/opt/automecanik/rag/knowledge")
    target_slug = modele.get("modele_alias") or os.path.splitext(os.path.basename(path))[0]

    # 7. Validation report (lightweight — full schema validation done by CI workflow)
    validation_report = {
        "scraped_motorisations": len(enrichments),
        "sources_used": sorted(sources),
        "fingerprint_version": "v1",
    }

    print(f"  proposal {target_slug} ({relpath}):")
    print(f"    base_content_hash : {base_hash[:12] if base_hash else 'NEW_FILE'}")
    print(f"    proposed_hash     : {proposed_hash[:12]}")
    print(f"    fingerprint       : {fingerprint[:12]}")
    print(f"    diff              : +{added} -{removed} lines")
    print(f"    risk_level        : {risk_level} {risk_flags or ''}")

    if dry_run:
        print(f"  → DRY RUN : would INSERT __rag_proposals (status=pending, expires_at=now+14d)")
        return None

    # 8. INSERT __rag_proposals
    proposal_uuid = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=14)

    conn = db_connect()
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO __rag_proposals (
                    proposal_uuid, target_path, target_slug, target_kind,
                    base_commit_sha, base_content_hash,
                    proposed_content, proposed_content_hash,
                    diff_unified, input_fingerprint,
                    status, created_at, created_by, expires_at,
                    risk_level, risk_flags,
                    diff_lines_added, diff_lines_removed,
                    schema_valid, validation_report
                ) VALUES (
                    %s, %s, %s, 'vehicle',
                    %s, %s,
                    %s, %s,
                    %s, %s,
                    'pending', NOW(), %s, %s,
                    %s, %s,
                    %s, %s,
                    NULL, %s
                )
                ON CONFLICT (input_fingerprint) WHERE status IN ('pending','validating','approved')
                DO NOTHING
                RETURNING proposal_uuid
                """,
                (
                    proposal_uuid,
                    relpath,
                    target_slug,
                    "HEAD",  # base_commit_sha — caller can override later if needed
                    base_hash,
                    proposed_raw,
                    proposed_hash,
                    diff_unified,
                    fingerprint,
                    "rag-propose-vehicle-from-web/v1",
                    expires_at,
                    risk_level,
                    risk_flags,
                    added,
                    removed,
                    json.dumps(validation_report),
                ),
            )
            row = cur.fetchone()
            if row:
                print(f"  ✓ INSERT __rag_proposals proposal_uuid={row[0]}")
                return str(row[0])
            else:
                print(f"  → no-op (fingerprint already pending — idempotence)")
                return None
    finally:
        conn.close()


# === MAIN ==============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--modele", help="modele alias")
    parser.add_argument("--modele-id", type=int)
    parser.add_argument("--brand")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply")
        sys.exit(1)

    modeles = fetch_modeles_by_filter(args)
    if not modeles:
        print("No modele matched.")
        sys.exit(1)

    print(f"Pilot scope : {len(modeles)} modele(s)")
    summaries: list[dict] = []
    for m in modeles:
        print(f"\n=== {m['marque_name']} {m['modele_name']} (modele_id={m['modele_id']}) ===")
        enrichments, summary = enrich_modele(dict(m), dry_run=args.dry_run)
        summaries.append(summary)
        print(
            f"  web docs={summary['web_docs_used']} "
            f"engines parsed={summary['engines_parsed']} "
            f"sources={summary['sources_used']}"
        )
        print(
            f"  verdicts : verified={summary['verified']} "
            f"partial={summary['partial']} rejected={summary['rejected']} "
            f"of {summary['type_count']} types"
        )

        # Show 3 sample enrichments
        for e in enrichments[:3]:
            ck_pass = sum(1 for v in e.checks.values() if v)
            code = e.code_moteur or "-"
            print(
                f"    type_id={e.type_id} {e.type_name} {e.power_ps}ch ({e.fuel}) "
                f"→ code={code} euro={e.norme_euro} cnit={len(e.cnit)} "
                f"checks={ck_pass}/5 → {e.verdict}"
            )

        # Propose to __rag_proposals (ADR-022 L1 propose-before-write).
        # If file missing, the proposal contains the bootstrap content as the
        # proposed_content (base_content stays empty). Disk is never touched.
        m_dict = dict(m)
        path = find_vehicle_md(m_dict)
        if not path:
            slug = f"{m_dict['marque_alias']}-{m_dict['modele_alias']}"
            path = os.path.join(VEHICLES_DIR, f"{slug}.md")
            print(f"  → no vehicles/{slug}.md, proposal will bootstrap from template")
        yaml_block = render_motorisations_yaml(enrichments)
        sources_used = sorted({d.source_provider for d in load_web_docs_for_modele(m_dict["modele_id"])})
        propose_to_db(
            path,
            yaml_block,
            list(enrichments),
            m_dict,
            sources_used,
            dry_run=args.dry_run,
        )

    print("\n=== AGGREGATE ===")
    total_types = sum(s["type_count"] for s in summaries)
    total_verified = sum(s["verified"] for s in summaries)
    total_partial = sum(s["partial"] for s in summaries)
    total_rejected = sum(s["rejected"] for s in summaries)
    print(
        f"types total : {total_types} | verified : {total_verified} "
        f"({100 * total_verified / max(total_types, 1):.0f}%) | "
        f"partial : {total_partial} | rejected : {total_rejected}"
    )
    if args.dry_run:
        print("(dry-run — pas d'écriture)")


if __name__ == "__main__":
    main()
