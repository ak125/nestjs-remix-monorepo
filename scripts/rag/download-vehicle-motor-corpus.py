#!/usr/bin/env python3
"""
download-vehicle-motor-corpus.py — Stage 1.A : scrape vehicle per-motorisation
data from public web sources, write to /opt/automecanik/rag/knowledge/web-vehicles/.

Mirror of `download-oem-corpus.py` (gamme), but for vehicle motorisations.

Sources (decision utilisateur 2026-04-25, élargies) :
  Tier 1 (specs structurées)  : fiches-auto.fr, caradisiac, largus.fr,
                                 turbo.fr, autoplus.fr, autotitre.com
  Tier 2 (encyclopédique)      : fr.wikipedia.org, en.wikipedia.org

Tiers 3-5 (fiabilité, regulatory, aftermarket cross-ref) ajoutés selon
recall mesuré sur le pilote.

Usage:
  python3 scripts/rag/download-vehicle-motor-corpus.py --modele clio-3 --dry-run
  python3 scripts/rag/download-vehicle-motor-corpus.py --modele clio-3 --apply
  python3 scripts/rag/download-vehicle-motor-corpus.py --brand smart --apply
  python3 scripts/rag/download-vehicle-motor-corpus.py --modele-id 140004 --apply

Output : /opt/automecanik/rag/knowledge/web-vehicles/<hash>-s<N>.md
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import textwrap
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import quote, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Manque : pip install requests beautifulsoup4")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Manque : pip install psycopg2-binary")
    sys.exit(1)

# === CONFIG ============================================================

WEB_VEHICLES_DIR = "/opt/automecanik/rag/knowledge/web-vehicles"
REQUEST_DELAY_S = 1.2
MAX_RETRIES = 2
TIMEOUT_S = 12
MIN_CONTENT_LEN = 250

# DB connection — pattern aligné avec scripts/db/adr017-create-index-concurrently.py
PROJECT_REF = "cxpojprgwgubzjyqzmoq"
DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD")
if not DB_PASSWORD:
    sys.stderr.write(
        "[FATAL] SUPABASE_DB_PASSWORD missing in env. "
        "Run: source backend/.env (or set SUPABASE_DB_PASSWORD=...)\n"
    )
    sys.exit(1)
DB_DSN = (
    f"host=db.{PROJECT_REF}.supabase.co "
    f"port=5432 user=postgres dbname=postgres "
    f"password={DB_PASSWORD} sslmode=require"
)

WIKI_API_FR = "https://fr.wikipedia.org/w/api.php"
WIKI_API_EN = "https://en.wikipedia.org/w/api.php"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AutoMecanik-RAGBot/1.0; vehicle-data-research; contact: automecanik.seo@gmail.com)",
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml",
}


# === MODELS ============================================================

@dataclass
class Modele:
    modele_id: int
    marque_id: int
    marque_alias: str  # e.g. 'renault'
    marque_name: str   # e.g. 'RENAULT'
    modele_alias: str  # e.g. 'clio-3'
    modele_name: str   # e.g. 'CLIO III'


@dataclass
class TypeMotor:
    type_id: int
    modele_id: int
    type_name: str    # e.g. '1.5 dCi'
    fuel: str         # e.g. 'Diesel'
    power_ps: int     # e.g. 88
    liter: str        # e.g. '150' (=1.5 L) or '1461'
    body: str
    year_from: int


@dataclass
class ScrapeJob:
    source: str       # e.g. 'fiches-auto'
    url: str
    modele_id: int
    type_ids: list[int] = field(default_factory=list)
    status: str = "pending"  # pending | success | 404 | parse_error | skipped
    title: str = ""
    content_len: int = 0


# === DB ACCESS =========================================================

def db_connect():
    return psycopg2.connect(DB_DSN)


def fetch_modeles_by_filter(args) -> list[Modele]:
    """Fetch the list of modeles to process based on CLI filters."""
    sql = """
        SELECT m.modele_id, m.modele_marque_id, m.modele_alias, m.modele_name,
               b.marque_alias, b.marque_name
        FROM auto_modele m
        JOIN auto_marque b ON b.marque_id::int = m.modele_marque_id::int
        WHERE m.modele_display = 1 AND b.marque_display = '1'
    """
    params: list = []
    if args.modele_id:
        sql += " AND m.modele_id = %s"
        params.append(args.modele_id)
    elif args.modele:
        # Accept both arabic ("clio-3") and roman ("clio-iii") forms.
        roman_map = {"-1": "-i", "-2": "-ii", "-3": "-iii", "-4": "-iv", "-5": "-v", "-6": "-vi"}
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
        # default pilot scope (decision utilisateur 2026-04-25) :
        # Renault Clio III + Smart + DS 3 (cohortes déjà enrichies en R8).
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
        rows = cur.fetchall()
    return [
        Modele(
            modele_id=int(r["modele_id"]),
            marque_id=int(r["modele_marque_id"]),
            marque_alias=str(r["marque_alias"]).strip().lower(),
            marque_name=str(r["marque_name"]).strip(),
            modele_alias=str(r["modele_alias"]).strip().lower(),
            modele_name=str(r["modele_name"]).strip(),
        )
        for r in rows
    ]


def fetch_types_for_modele(modele_id: int) -> list[TypeMotor]:
    sql = """
        SELECT type_id_i, type_modele_id_i, type_name, type_fuel,
               type_power_ps, type_liter, type_body, type_year_from
        FROM auto_type
        WHERE type_display = '1'
          AND type_modele_id_i = %s
          AND type_power_ps ~ '^[0-9]+$'
        ORDER BY type_id_i
    """
    with db_connect() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, [modele_id])
        rows = cur.fetchall()
    out: list[TypeMotor] = []
    for r in rows:
        try:
            out.append(
                TypeMotor(
                    type_id=int(r["type_id_i"]),
                    modele_id=int(r["type_modele_id_i"]),
                    type_name=str(r["type_name"] or "").strip(),
                    fuel=str(r["type_fuel"] or "").strip(),
                    power_ps=int(r["type_power_ps"] or 0),
                    liter=str(r["type_liter"] or "").strip(),
                    body=str(r["type_body"] or "").strip(),
                    year_from=int(r["type_year_from"] or 0),
                )
            )
        except (TypeError, ValueError):
            continue
    return out


# === HTTP HELPERS ======================================================

def fetch_url(url: str) -> str | None:
    for attempt in range(MAX_RETRIES + 1):
        try:
            r = requests.get(
                url, headers=HEADERS, timeout=TIMEOUT_S, allow_redirects=True,
            )
            ctype = r.headers.get("Content-Type", "")
            if r.status_code == 200 and "text/html" in ctype:
                r.encoding = r.apparent_encoding
                return r.text
            if r.status_code in (403, 404, 410, 429, 503):
                return None
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY_S * 2)
        except requests.RequestException as exc:
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY_S)
            else:
                print(f"    ! réseau {url[:60]} : {exc}")
    return None


# === EXTRACTORS PER SOURCE =============================================

def extract_text_generic(html: str) -> tuple[str, str]:
    """Generic main-content extractor (used for fiches-auto, caradisiac, etc.)."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.find_all(
        ["nav", "footer", "script", "style", "header", "aside", "noscript", "iframe", "form"]
    ):
        tag.decompose()
    for tag in soup.find_all(class_=re.compile(r"(cookie|gdpr|banner|popup|menu|ads|pub)", re.I)):
        tag.decompose()

    title = soup.title.get_text(strip=True) if soup.title else ""
    main = soup.find("main") or soup.find("article") or soup.body
    if not main:
        return title, ""

    # Table-aware : <tr> joined with | so engine specs stay on one line.
    lines: list[str] = []
    visited_cells: set = set()
    for el in main.find_all(["h1", "h2", "h3", "p", "li", "tr"]):
        if el.name == "tr":
            cells = [
                re.sub(r"\s+", " ", c.get_text(" ", strip=True)).strip()
                for c in el.find_all(["td", "th"])
            ]
            cells = [c for c in cells if c]
            if not cells or all(len(c) < 2 for c in cells):
                continue
            line = "| " + " | ".join(cells) + " |"
            if len(line) >= 8:
                lines.append(line)
                for c in el.find_all(["td", "th"]):
                    visited_cells.add(id(c))
            continue
        text = re.sub(r"\s+", " ", el.get_text(separator=" ", strip=True)).strip()
        if len(text) < 12:
            continue
        if el.name in ("h1", "h2", "h3"):
            lines.append(f"\n## {text}\n")
        elif el.name == "li":
            lines.append(f"- {text}")
        else:
            lines.append(text)

    # Catch standalone td/th not inside <tr>
    for cell in main.find_all(["td", "th"]):
        if id(cell) in visited_cells:
            continue
        text = re.sub(r"\s+", " ", cell.get_text(" ", strip=True)).strip()
        if len(text) >= 12:
            lines.append(f"| {text} |")

    return title, "\n".join(lines[:400])


def extract_text_wikipedia(html: str) -> tuple[str, str]:
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    if soup.find("h1", id="firstHeading"):
        title = soup.find("h1", id="firstHeading").get_text(strip=True)

    content_div = soup.find("div", id="mw-content-text")
    if not content_div:
        return title, ""

    for tag in content_div.find_all(
        ["table", "sup", "cite"],
        class_=re.compile(r"(navbox|reflist|toc|hatnote|thumb)", re.I),
    ):
        tag.decompose()
    for tag in content_div.find_all(id=re.compile(r"(references|notes|liens)", re.I)):
        if tag.parent:
            tag.parent.decompose()

    lines: list[str] = []
    for el in content_div.find_all(["h2", "h3", "h4", "p", "li", "td", "th"]):
        text = el.get_text(separator=" ", strip=True)
        text = re.sub(r"\[\d+\]", "", text)
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < 12:
            continue
        if el.name in ("h2", "h3", "h4"):
            lines.append(f"\n## {text}\n")
        elif el.name == "li":
            lines.append(f"- {text}")
        elif el.name in ("td", "th"):
            lines.append(f"| {text} |")
        else:
            lines.append(text)
    return title, "\n".join(lines[:300])


# === URL DISCOVERY PER SOURCE ==========================================

def url_candidates_fiches_auto(modele: Modele, type_motor: TypeMotor | None = None) -> list[str]:
    """fiches-auto.fr URL patterns."""
    base = "https://www.fiches-auto.fr"
    brand = modele.marque_alias
    model = modele.modele_alias
    candidates = [
        f"{base}/{brand}/{model}",
        f"{base}/{brand}/{model}/",
        f"{base}/articles-auto/fiabilite-des-voitures/{brand}-{model}.php",
    ]
    if type_motor:
        # Power-tagged variants
        candidates.append(f"{base}/{brand}/{model}-{type_motor.power_ps}")
        candidates.append(f"{base}/{brand}/{model}/{type_motor.power_ps}")
    return candidates


def url_candidates_caradisiac(modele: Modele) -> list[str]:
    base = "https://www.caradisiac.com"
    slug = f"{modele.marque_alias}-{modele.modele_alias}"
    # Year fallbacks (model-level page with sections per motor)
    return [
        f"{base}/fiches-techniques/modele--{slug}/",
        f"{base}/fiches-techniques/modele--{slug}/2010/",
        f"{base}/fiches-techniques/modele--{slug}/2009/",
    ]


def url_candidates_largus(modele: Modele) -> list[str]:
    base = "https://www.largus.fr"
    return [
        f"{base}/fiches-techniques/{modele.marque_alias}/{modele.modele_alias}/",
        f"{base}/cote-auto/{modele.marque_alias}/{modele.modele_alias}.html",
    ]


def url_candidates_turbo(modele: Modele) -> list[str]:
    base = "https://www.turbo.fr"
    return [
        f"{base}/fiches-techniques/{modele.marque_alias}-{modele.modele_alias}.html",
        f"{base}/fiche-technique/{modele.marque_alias}/{modele.modele_alias}",
    ]


def url_candidates_autoplus(modele: Modele) -> list[str]:
    base = "https://www.autoplus.fr"
    return [f"{base}/fiches-techniques/{modele.marque_alias}-{modele.modele_alias}/"]


def url_candidates_autotitre(modele: Modele) -> list[str]:
    """Vraie URL : /fiche-technique/<Brand>/<Model>/<VariantRoman>"""
    base = "https://www.autotitre.com"
    brand_t = modele.marque_alias.title()
    parts = modele.modele_alias.split("-")
    titled: list[str] = []
    for p in parts:
        if not p:
            continue
        if re.fullmatch(r"[ivxIVX]+", p):
            titled.append(p.upper())
        else:
            titled.append(p.title())
    if len(titled) >= 2 and re.fullmatch(r"[IVX]+", titled[-1]):
        path = "/".join(titled[:-1]) + "/" + titled[-1]
    else:
        path = "/".join(titled) if titled else modele.modele_alias
    return [
        f"{base}/fiche-technique/{brand_t}/{path}",
        f"{base}/fiche-technique-{modele.marque_alias}-{modele.modele_alias}.html",
    ]


def _arabic_alias(alias: str) -> str:
    """Convert roman suffix to arabic ('clio-iii' → 'clio-3')."""
    roman_to_arabic = {"-i": "-1", "-ii": "-2", "-iii": "-3", "-iv": "-4", "-v": "-5", "-vi": "-6"}
    for roman, arabic in roman_to_arabic.items():
        if alias.endswith(roman):
            return alias[: -len(roman)] + arabic
    return alias


def url_candidates_user_manual_renault(modele: Modele) -> list[str]:
    """Renault constructor manuals (Renault only)."""
    if modele.marque_alias != "renault":
        return []
    base = "https://www.user-manual.renault.com"
    arabic = _arabic_alias(modele.modele_alias)
    return [
        f"{base}/fr/content/{modele.marque_alias}-{arabic}-phase-1",
        f"{base}/fr/content/{modele.marque_alias}-{arabic}-phase-2",
        f"{base}/fr/content/{modele.marque_alias}-{arabic}",
    ]


def url_candidates_lenouvelautomobiliste(modele: Modele) -> list[str]:
    """Editorial articles via search archive."""
    base = "https://lenouvelautomobiliste.fr"
    arabic = _arabic_alias(modele.modele_alias)
    q = f"{modele.marque_alias}+{arabic.replace('-', '+')}"
    return [f"{base}/?s={q}"]


# Curated URL override (CSV-based) — priority over heuristic patterns
CURATED_CSV = "/opt/automecanik/app/scripts/rag/vehicles-known-urls.csv"


def load_curated_urls(modele_alias: str) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    if not os.path.isfile(CURATED_CSV):
        return out
    import csv as _csv
    with open(CURATED_CSV, encoding="utf-8", newline="") as f:
        for row in _csv.DictReader(f):
            if (row.get("modele_alias") or "").strip().lower() == modele_alias.lower():
                src = (row.get("source") or "").strip()
                url = (row.get("url") or "").strip()
                if src and url:
                    out.setdefault(src, []).append(url)
    return out


def url_candidates_wikipedia_fr(modele: Modele) -> list[str]:
    """Use Wikipedia API to find the article."""
    queries = [
        f"{modele.marque_name} {modele.modele_name}",
        f"{modele.marque_alias} {modele.modele_alias}",
    ]
    return [_wiki_lookup(q, lang="fr") for q in queries]


def url_candidates_wikipedia_en(modele: Modele) -> list[str]:
    queries = [
        f"{modele.marque_name} {modele.modele_name}",
        f"{modele.marque_name.title()} {modele.modele_name.title()}",
    ]
    return [_wiki_lookup(q, lang="en") for q in queries]


def _wiki_lookup(query: str, lang: str = "fr") -> str | None:
    api = WIKI_API_FR if lang == "fr" else WIKI_API_EN
    base = f"https://{lang}.wikipedia.org/wiki/"
    try:
        r = requests.get(
            api,
            params={
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": 3,
                "srnamespace": 0,
                "format": "json",
            },
            headers={"User-Agent": HEADERS["User-Agent"]},
            timeout=8,
        )
        results = r.json().get("query", {}).get("search", [])
        for res in results:
            title = res["title"]
            return base + quote(title.replace(" ", "_"))
    except Exception:
        pass
    return None


# === SCRAPE WORKFLOW ===================================================

SOURCES = [
    # (source_name, url_builder, extractor, applies_per_type)
    ("fiches-auto", url_candidates_fiches_auto, extract_text_generic, True),
    ("caradisiac", url_candidates_caradisiac, extract_text_generic, False),
    ("largus", url_candidates_largus, extract_text_generic, False),
    ("turbo", url_candidates_turbo, extract_text_generic, False),
    ("autoplus", url_candidates_autoplus, extract_text_generic, False),
    ("autotitre", url_candidates_autotitre, extract_text_generic, False),
    ("wikipedia-fr", url_candidates_wikipedia_fr, extract_text_wikipedia, False),
    ("wikipedia-en", url_candidates_wikipedia_en, extract_text_wikipedia, False),
    ("user-manual-renault", url_candidates_user_manual_renault, extract_text_generic, False),
    ("lenouvelautomobiliste", url_candidates_lenouvelautomobiliste, extract_text_generic, False),
    ("lacentrale", lambda m: [], extract_text_generic, False),  # curated only (anti-bot)
]


def slugify_to_hash(modele: Modele, url: str) -> str:
    raw = f"{modele.marque_alias}/{modele.modele_alias}|{url}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:12]


def save_file(
    modele: Modele,
    type_ids: list[int],
    source: str,
    url: str,
    title: str,
    content: str,
) -> str | None:
    if len(content.strip()) < MIN_CONTENT_LEN:
        return None
    h = slugify_to_hash(modele, url)
    existing = [f for f in os.listdir(WEB_VEHICLES_DIR) if f.startswith(h)]
    section_num = len(existing) + 1
    filename = f"{h}-s{section_num:03d}.md"
    path = os.path.join(WEB_VEHICLES_DIR, filename)
    now = datetime.now(timezone.utc).isoformat()
    domain = urlparse(url).netloc
    safe_title = title.replace("'", "\\'")[:120] if title else f"{modele.marque_name} {modele.modele_name}"

    type_ids_yaml = "[]"
    if type_ids:
        type_ids_yaml = "[" + ", ".join(str(t) for t in type_ids) + "]"

    md = (
        f"---\n"
        f"title: '{safe_title} - s{section_num:03d}'\n"
        f"source_type: vehicle_motor\n"
        f"target_kind: vehicle_motor\n"
        f"target_modele_id: {modele.modele_id}\n"
        f"target_type_ids: {type_ids_yaml}\n"
        f"target_marque: {modele.marque_alias}\n"
        f"target_modele: {modele.modele_alias}\n"
        f"category: knowledge\n"
        f"truth_level: L2\n"
        f"verification_status: unverified\n"
        f"source_uri: {url}\n"
        f"source_url: {url}\n"
        f"source_domain: {domain}\n"
        f"source_tier: {_source_tier(source)}\n"
        f"source_provider: {source}\n"
        f"created_at: '{now}'\n"
        f"updated_at: '{now}'\n"
        f"---\n"
        f"\n"
        f"# {safe_title}\n"
        f"\n"
        f"{content}\n"
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(md)
    return path


def _source_tier(source: str) -> int:
    if source in {"fiches-auto", "caradisiac", "largus", "turbo", "autoplus", "autotitre"}:
        return 1
    if source.startswith("wikipedia"):
        return 2
    return 3


def process_modele(modele: Modele, dry_run: bool, only_sources: set[str] | None = None) -> dict:
    types = fetch_types_for_modele(modele.modele_id)
    type_ids_all = [t.type_id for t in types]
    print(f"\n=== {modele.marque_name} {modele.modele_name} (modele_id={modele.modele_id}, {len(types)} types) ===")

    jobs: list[ScrapeJob] = []
    saved = 0
    skipped = 0

    # Curated URL overrides — read from data/vehicles_known_urls.csv
    curated = load_curated_urls(modele.modele_alias)
    if curated:
        print(f"  → curated URLs from CSV: {sum(len(v) for v in curated.values())} entries")

    for source_name, url_fn, extractor, per_type in SOURCES:
        if only_sources and source_name not in only_sources:
            continue
        candidates_iter: list[tuple[str, list[int]]] = []
        # 1) curated URLs (priority)
        for cu in curated.get(source_name, []):
            candidates_iter.append((cu, type_ids_all))
        # 2) heuristic patterns
        if per_type:
            for tm in types:
                urls = url_fn(modele, tm)
                for url in urls:
                    if url:
                        candidates_iter.append((url, [tm.type_id]))
        else:
            urls = url_fn(modele)
            for url in urls:
                if url:
                    candidates_iter.append((url, type_ids_all))

        # Dedupe URLs
        seen: set[str] = set()
        candidates: list[tuple[str, list[int]]] = []
        for url, tid in candidates_iter:
            if url in seen:
                continue
            seen.add(url)
            candidates.append((url, tid))

        for url, type_ids in candidates:
            job = ScrapeJob(source=source_name, url=url, modele_id=modele.modele_id, type_ids=type_ids)
            print(f"  [{source_name}] {url[:90]} … ", end="", flush=True)
            if dry_run:
                print("DRY-RUN (no fetch)")
                job.status = "skipped"
                jobs.append(job)
                continue

            html = fetch_url(url)
            time.sleep(REQUEST_DELAY_S)
            if not html:
                print("404/err")
                job.status = "404"
                jobs.append(job)
                continue
            try:
                title, content = extractor(html)
            except Exception as exc:
                print(f"parse_err: {exc}")
                job.status = "parse_error"
                jobs.append(job)
                continue
            if len(content.strip()) < MIN_CONTENT_LEN:
                print("thin")
                job.status = "parse_error"
                jobs.append(job)
                skipped += 1
                continue
            path = save_file(modele, type_ids, source_name, url, title, content)
            if path:
                print(f"OK → {os.path.basename(path)} ({len(content)} chars)")
                job.status = "success"
                job.title = title
                job.content_len = len(content)
                saved += 1
            else:
                print("save_err")
                job.status = "parse_error"
            jobs.append(job)

    return {
        "modele_id": modele.modele_id,
        "modele_label": f"{modele.marque_name} {modele.modele_name}",
        "type_count": len(types),
        "saved": saved,
        "skipped": skipped,
        "jobs": jobs,
    }


# === MAIN ==============================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--modele", help="modele alias (e.g. clio-3)")
    parser.add_argument("--modele-id", type=int, help="modele_id_i numeric")
    parser.add_argument("--brand", help="marque alias (e.g. renault)")
    parser.add_argument("--sources", help="comma-separated source names to enable (default: all)")
    parser.add_argument("--dry-run", action="store_true", help="discover URLs only, no HTTP fetch")
    parser.add_argument("--apply", action="store_true", help="actually fetch + save")
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        print("⚠ Must specify --dry-run or --apply")
        sys.exit(1)

    only_sources: set[str] | None = None
    if args.sources:
        only_sources = {s.strip() for s in args.sources.split(",")}

    os.makedirs(WEB_VEHICLES_DIR, exist_ok=True)
    modeles = fetch_modeles_by_filter(args)
    if not modeles:
        print("No modele matched the filter.")
        sys.exit(1)

    print(f"Pilot scope : {len(modeles)} modeles")
    for m in modeles[:5]:
        print(f"  - {m.marque_alias}/{m.modele_alias} (id={m.modele_id})")
    if len(modeles) > 5:
        print(f"  … +{len(modeles)-5} more")

    summaries = []
    for m in modeles:
        s = process_modele(m, dry_run=args.dry_run, only_sources=only_sources)
        summaries.append(s)

    print("\n=== SUMMARY ===")
    total_saved = sum(s["saved"] for s in summaries)
    total_jobs = sum(len(s["jobs"]) for s in summaries)
    print(f"modeles processed : {len(summaries)}")
    print(f"jobs total : {total_jobs}")
    print(f"files saved : {total_saved}")
    if args.dry_run:
        print("(dry-run — no files written)")


if __name__ == "__main__":
    main()
