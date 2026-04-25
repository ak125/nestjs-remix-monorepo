#!/usr/bin/env python3
"""
rag-enrich-vehicle-from-web.py — Stage 1.B : enrich vehicles/<slug>.md frontmatter
with per-motorisation data extracted from web-vehicles/*.md (Stage 1.A output).

Mirror of `rag-enrich-from-web-corpus.py` (gamme), adapté véhicule.

Logique :
  1. Pour chaque modele cible, lit web-vehicles/*.md taggés target_modele_id=X
  2. Parse les codes moteur (K9K, D4F, K4J, F4R, etc.) + leur power range
  3. Pour chaque type_id du modele :
     - Match power → engine_code via dict extrait
     - Derive norme Euro depuis year_from
     - Récupère CNIT depuis auto_type_number_code DB
  4. Auto-verify gate : 5 cross-checks DB → verdict {verified, partial, rejected}
  5. Écrit motorisations[] enrichi dans vehicles/<slug>.md

Usage:
  python3 scripts/rag/rag-enrich-vehicle-from-web.py --modele clio-3 --dry-run
  python3 scripts/rag/rag-enrich-vehicle-from-web.py --modele clio-3 --apply
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
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
    """Engine description extracted from a web doc line."""
    family: str          # 'dCi', 'TCe', 'F4R'…
    code: str | None     # 'K9K', 'F4R', 'D4F'…
    displacement_l: str  # '1.5'
    powers_ps: list[int]  # [70, 75, 85, 90, 100, 105]
    fuel: str            # 'Essence' | 'Diesel' | 'Hybride' | ''
    source_url: str


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


def parse_engine_lines(doc: WebDoc) -> list[ParsedEngine]:
    """Extract one ParsedEngine per `displacement … power+ch` substring,
    even when several engines are packed on the same line (Wikipedia table)."""
    out: list[ParsedEngine] = []
    seen_keys: set[tuple[str, tuple[int, ...]]] = set()
    for m in PER_ENGINE_RE.finditer(doc.body):
        powers_raw = m.group("powers") or ""
        powers = [int(x.strip()) for x in re.split(r"[/-]", powers_raw) if x.strip().isdigit()]
        powers = [x for x in powers if 30 <= x <= 800]
        if not powers:
            continue
        displ = m.group("displ")
        extra = (m.group("extra") or "").strip()
        # Engine code dans extra
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
        # Fuel context — look at the text BEFORE the displacement match
        fuel = _fuel_from_context(doc.body[: m.start()])
        # Family token can also discriminate
        if not fuel and family.lower() in {"dci", "hdi", "tdi", "cdi"}:
            fuel = "Diesel"
        if not fuel and family.lower() in {"tce", "tfsi", "thp", "vti", "tsi", "fsi", "mpi"}:
            fuel = "Essence"

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
    # Enriched fields
    code_moteur: str | None = None
    famille_moteur: str | None = None
    norme_euro: str | None = None
    cnit: list[str] = field(default_factory=list)
    source_urls: list[str] = field(default_factory=list)
    # Auto-verify
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
        match = match_engine(all_engines, t)
        if match:
            e.code_moteur = match.code
            e.famille_moteur = match.family or None
            e.source_urls.append(match.source_url)
        e.norme_euro = derive_euro(e.year_from)
        e.cnit = sorted(set(cnit_map.get(e.type_id, [])))[:3]

        # Auto-verify gate (5 checks against DB) — DB is the source of truth
        # for power/fuel/year/cylindree, so these always match by construction.
        # The web adds : code_moteur (no DB row to compare), euro_norm (derived),
        # cnit (sourced from DB). The gate measures completeness of enrichment.
        e.checks = {
            "power_ps_known": e.power_ps > 0,
            "fuel_known": bool(e.fuel),
            "year_from_known": e.year_from > 0,
            "code_moteur_found": bool(e.code_moteur),
            "cnit_found": bool(e.cnit),
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
        if e.cnit:
            item["cnit"] = e.cnit
        if e.source_urls:
            item["source_url"] = e.source_urls[0]
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


def _bootstrap_vehicle_md(path: str, modele: dict) -> None:
    """Create a minimal vehicles/<slug>.md when missing, before enrichment."""
    now = datetime.now(timezone.utc).date().isoformat()
    md = (
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
        f"`scripts/rag/rag-enrich-vehicle-from-web.py` Stage 1.B.\n"
    )
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(md)


def write_back(path: str, new_motorisations_yaml: str, dry_run: bool, modele: dict | None = None) -> None:
    if not os.path.isfile(path) and modele is not None:
        if dry_run:
            print(f"  → DRY RUN : would bootstrap {path}")
        else:
            _bootstrap_vehicle_md(path, modele)
            print(f"  ✓ bootstrapped {path}")

    with open(path, encoding="utf-8") as f:
        raw = f.read()
    m = re.match(r"(---\n)(.+?)(\n---\n)(.*)", raw, re.DOTALL)
    if not m:
        print(f"  ! pas de frontmatter dans {path}")
        return
    head, fm_text, sep, body = m.groups()
    new_fm = _replace_motorisations_block(fm_text, new_motorisations_yaml)
    new_fm = re.sub(
        r"updated_at: '[^']+'",
        f"updated_at: '{datetime.now(timezone.utc).date().isoformat()}'",
        new_fm,
    )
    new_raw = head + new_fm + sep + body
    if dry_run:
        print(f"  --- DRY RUN diff for {path} ---")
        # Count motorisations entries in NEW yaml
        n_entries = len([l for l in new_motorisations_yaml.splitlines() if l.startswith("- type_id:") or l.startswith("- moteur:")])
        print(f"  NEW motorisations[] : {n_entries} entries")
        for line in new_motorisations_yaml.splitlines()[:8]:
            print(f"    {line}")
        return
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_raw)
    print(f"  ✓ wrote {path}")


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

        # Write back. If file missing, bootstrap a minimal one so the pilot
        # can cover modeles not yet served by VehicleRagGeneratorService.
        m_dict = dict(m)
        path = find_vehicle_md(m_dict)
        if not path:
            slug = f"{m_dict['marque_alias']}-{m_dict['modele_alias']}"
            path = os.path.join(VEHICLES_DIR, f"{slug}.md")
            print(f"  → no vehicles/{slug}.md, will bootstrap")
        yaml_block = render_motorisations_yaml(enrichments)
        write_back(path, yaml_block, dry_run=args.dry_run, modele=m_dict)

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
