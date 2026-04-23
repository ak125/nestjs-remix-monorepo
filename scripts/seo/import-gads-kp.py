#!/usr/bin/env python3
"""
Google Ads KP → __seo_keywords (Skills-First Architecture)

Script minimaliste : import RAW + filtre pertinence gamme.
AUCUNE classification semantique (role/intent). C'est /content-gen (Claude)
qui classifie au moment de generer le contenu.

Usage:
    # Fichier unique (detecte gamme depuis le nom du fichier)
    python3 import-gads-kp.py data/keywords/filtre-a-huile_2026-04-11.csv

    # Fichier unique + pg_id explicite
    python3 import-gads-kp.py data/keywords/export.csv --pg-id 7

    # Dossier (tous les CSV)
    python3 import-gads-kp.py data/keywords/

    # Dry-run
    python3 import-gads-kp.py data/keywords/ --dry-run
"""
from __future__ import annotations
import re
import os
import sys
import csv
import json
import unicodedata
import argparse
import urllib.request
from collections import Counter
from typing import Optional

# ─── ENV ────────────────────────────────────────────────────────────────
env_path = '/opt/automecanik/app/backend/.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
RAG_GAMMES = '/opt/automecanik/rag/knowledge/gammes'
ALIAS_EXPANSIONS_YAML = '/opt/automecanik/app/config/rag-alias-expansions.yaml'

STOP_WORDS = {'a', 'de', 'd', 'du', 'le', 'la', 'les', 'l', 'un', 'une', 'des', 'en', 'et', 'ou', 'pour'}

# Module-level cache — loaded once at first call
_ALIAS_EXPANSIONS_CACHE: Optional[dict[str, list[str]]] = None


def load_alias_expansions() -> dict[str, list[str]]:
    """Load the centralized SEO alias dictionary (config/rag-alias-expansions.yaml).

    Merged with variants[].aliases from RAG .md at matching time (additive, idempotent).
    Cached at module level — loaded once per process.
    """
    global _ALIAS_EXPANSIONS_CACHE
    if _ALIAS_EXPANSIONS_CACHE is not None:
        return _ALIAS_EXPANSIONS_CACHE
    if not os.path.exists(ALIAS_EXPANSIONS_YAML):
        _ALIAS_EXPANSIONS_CACHE = {}
        return _ALIAS_EXPANSIONS_CACHE
    try:
        import yaml
        with open(ALIAS_EXPANSIONS_YAML, encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
        if not isinstance(data, dict):
            _ALIAS_EXPANSIONS_CACHE = {}
            return _ALIAS_EXPANSIONS_CACHE
        _ALIAS_EXPANSIONS_CACHE = {
            slug: [str(a) for a in (aliases or []) if a]
            for slug, aliases in data.items()
            if isinstance(slug, str)
        }
    except Exception as e:
        print(f"  [WARN] Failed to load {ALIAS_EXPANSIONS_YAML}: {e}")
        _ALIAS_EXPANSIONS_CACHE = {}
    return _ALIAS_EXPANSIONS_CACHE


# ─── HELPERS ───────────────────────────────────────────────────────────

def normalize_kw(text: str) -> str:
    """Lowercase, no accents, single spaces, trimmed.

    Replaces apostrophes/hyphens/underscores with spaces BEFORE splitting so
    "Filtre d'habitacle" → core words ['filtre', 'habitacle'] (not "d'habitacle").
    Critical for gammes with apostrophe in pg_name (filtre-d-habitacle, etc.).
    """
    text = text.lower().strip()
    # Strip apostrophes (straight, curly, typographic) + hyphens + underscores
    text = re.sub(r"[‘’‛'\-_]", ' ', text)
    text = re.sub(r'\s+', ' ', text)
    text = unicodedata.normalize('NFD', text)
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def extract_core_words(text: str) -> list[str]:
    """Significant words from gamme name (no stop words, len >= 3)."""
    normalized = normalize_kw(text)
    return [w for w in normalized.split() if w not in STOP_WORDS and len(w) >= 3]


def slug_from_filename(filepath: str) -> Optional[str]:
    """Extract gamme slug from filename like 'filtre-a-huile_2026-04-11.csv'."""
    base = os.path.basename(filepath).replace('.csv', '')
    base = re.sub(r'_\d{4}-\d{2}-\d{2}.*$', '', base)
    base = re.sub(r'_clean$', '', base)
    if re.match(r'^[a-z0-9-]+$', base) and len(base) > 3:
        return base
    return None


# ─── GAMME RESOLVER (DB + RAG) ─────────────────────────────────────────

def resolve_gamme_from_db_by_id(pg_id: int) -> Optional[dict]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = f"{SUPABASE_URL}/rest/v1/pieces_gamme?pg_id=eq.{pg_id}&select=pg_id,pg_alias,pg_name&limit=1"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return data[0]
    except Exception as e:
        print(f"  [WARN] DB lookup by pg_id failed: {e}")
    return None


def resolve_gamme_from_db_by_slug(slug: str) -> Optional[dict]:
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    url = f"{SUPABASE_URL}/rest/v1/pieces_gamme?pg_alias=eq.{slug}&select=pg_id,pg_alias,pg_name&limit=1"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data:
                return data[0]
    except Exception as e:
        print(f"  [WARN] DB lookup by slug failed: {e}")
    return None


def load_gamme_rag(pg_alias: str) -> dict:
    """Load gamme RAG file → extract aliases + must_not_contain + confusion_with.

    Also merges in aliases from config/rag-alias-expansions.yaml (centralized SEO dict).
    """
    result = {
        'aliases': set(),
        'must_not_contain': set(),
        'confusion_terms': set(),
    }

    # Merge centralized alias-expansions dict (additive, independent of RAG .md)
    expansions = load_alias_expansions().get(pg_alias, [])
    for alias in expansions:
        result['aliases'].add(normalize_kw(alias))

    rag_path = os.path.join(RAG_GAMMES, f'{pg_alias}.md')
    if not os.path.exists(rag_path):
        return result

    try:
        import yaml
        with open(rag_path, encoding='utf-8') as f:
            content = f.read()
        parts = content.split('---', 2)
        if len(parts) < 3:
            return result
        data = yaml.safe_load(parts[1])
        if not isinstance(data, dict):
            return result

        # Title (always an alias)
        if data.get('title'):
            result['aliases'].add(normalize_kw(data['title']))

        # Variant aliases (spin-on, cartouche filtrante, etc.)
        for v in (data.get('variants') or []):
            if isinstance(v, dict):
                for alias in (v.get('aliases') or []):
                    result['aliases'].add(normalize_kw(alias))
                if v.get('name'):
                    result['aliases'].add(normalize_kw(v['name']))

        # Domain exclusions
        domain = data.get('domain') or {}
        for term in (domain.get('must_not_contain') or []):
            result['must_not_contain'].add(normalize_kw(term))

        # Confusion terms (other gammes people confuse with this one)
        for conf in (domain.get('confusion_with') or []):
            if isinstance(conf, dict):
                term = conf.get('term', '')
            else:
                term = str(conf)
            if term:
                # Store as core words for matching
                norm = normalize_kw(term.replace('-', ' '))
                result['confusion_terms'].add(norm)

    except Exception as e:
        print(f"  [WARN] RAG parse failed for {pg_alias}: {e}")

    return result


# ─── RELEVANCE FILTER ──────────────────────────────────────────────────

def check_relevance(
    kw_normalized: str,
    gamme_core_words: list[str],
    gamme_aliases: set[str],
    must_not_contain: set[str],
    confusion_terms: set[str],
) -> tuple[bool, Optional[str]]:
    """
    Check if keyword is relevant to this gamme.

    Rules:
    1. If kw contains any must_not_contain term → REJECT (reason: must_not_contain)
    2. If kw contains an alias → ACCEPT
    3. If kw matches ALL core words of gamme name → ACCEPT
       UNLESS it also strongly matches a confusion term → REJECT (reason: confusion)
    4. Otherwise → REJECT (reason: no_match)

    Returns: (is_relevant, reject_reason)
    """
    kw_words = set(kw_normalized.split())

    # Rule 1: hard exclusion (hydraulique, industriel, universel...)
    for bad in must_not_contain:
        if bad in kw_normalized or bad in kw_words:
            return False, f'exclude:{bad}'

    # Rule 2: alias match (spin-on, cartouche filtrante...)
    for alias in gamme_aliases:
        if alias and alias in kw_normalized:
            return True, None

    # Rule 3: all core words present
    core_match = gamme_core_words and all(w in kw_words for w in gamme_core_words)
    if not core_match:
        return False, 'no_core_match'

    # Rule 3b: core words present BUT stronger match to confusion term → reject
    # Example: filtre-a-huile has core [filtre, huile], confusion with [filtre a air]
    # "filtre a air a bain d huile" has all core words AND matches "filtre a air" stronger
    for conf in confusion_terms:
        conf_words = set(conf.split())
        # Confusion term fully present in kw?
        if conf_words.issubset(kw_words):
            # Is the confusion term MORE specific than the core words match?
            # If confusion term has MORE words than core AND all present → confusion wins
            if len(conf_words) > len(gamme_core_words):
                return False, f'confusion:{conf}'
            # Equal specificity — check if kw is closer to confusion
            # (e.g., kw starts with confusion term)
            if kw_normalized.startswith(conf):
                return False, f'confusion:{conf}'

    return True, None


# ─── CSV READER ────────────────────────────────────────────────────────

def read_gads_csv(filepath: str) -> list[dict]:
    """Read Google Ads KP CSV (UTF-16 LE or UTF-8) → clean rows."""
    content = None
    for enc in ['utf-16-le', 'utf-16', 'utf-8-sig', 'utf-8']:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                content = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if content is None:
        raise ValueError(f"Cannot decode {filepath}")

    lines = content.strip().split('\n')
    header_idx = None
    for i, line in enumerate(lines):
        if 'Keyword' in line and ('searches' in line.lower() or 'volume' in line.lower()):
            header_idx = i
            break
        if '\t' in line and 'keyword' in line.lower():
            header_idx = i
            break

    if header_idx is None:
        header_idx = 0

    data_lines = lines[header_idx:]
    if len(data_lines) < 2:
        return []

    reader = csv.DictReader(data_lines, delimiter='\t')
    rows = []
    for row in reader:
        kw = (row.get('Keyword') or row.get('keyword') or row.get('Mot-clé') or '').strip()
        if not kw or len(kw) < 2:
            continue

        vol_str = (row.get('Avg. monthly searches')
                   or row.get('volume')
                   or row.get('Recherches mensuelles moy.')
                   or '0')
        vol_str = re.sub(r'[^\d]', '', str(vol_str))
        volume = int(vol_str) if vol_str else 0
        if volume <= 0:
            continue

        comp = (row.get('Competition') or row.get('competition')
                or row.get('Concurrence') or '').strip() or None
        comp_idx_str = (row.get('Competition (indexed value)')
                        or row.get('Concurrence (valeur indexée)') or '')
        comp_idx_str = re.sub(r'[^\d]', '', str(comp_idx_str))
        comp_idx = int(comp_idx_str) if comp_idx_str else None

        rows.append({
            'keyword': kw,
            'volume': volume,
            'competition': comp,
            'competition_idx': comp_idx,
        })

    return rows


# ─── UPSERT ────────────────────────────────────────────────────────────

def upsert_to_db(table: str, records: list[dict], conflict_cols: str, dry_run: bool = False) -> int:
    if dry_run or not records:
        return 0

    url = f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={conflict_cols}"
    inserted = 0
    BATCH = 500

    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        body = json.dumps(batch, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='POST', headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
        })
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                inserted += len(batch)
        except Exception as e:
            print(f"    [ERROR] Batch {i}-{i+len(batch)}: {e}")

    return inserted


# ─── MAIN PIPELINE ─────────────────────────────────────────────────────

def process_file(filepath: str, pg_id_override: Optional[int], dry_run: bool, verbose: bool) -> dict:
    print(f"\n{'='*60}")
    print(f"  {os.path.basename(filepath)}")
    print(f"{'='*60}")

    # 1. Resolve gamme
    slug = slug_from_filename(filepath)
    gamme_info = None

    if pg_id_override:
        gamme_info = resolve_gamme_from_db_by_id(pg_id_override)
    elif slug:
        gamme_info = resolve_gamme_from_db_by_slug(slug)

    if not gamme_info:
        print(f"  [SKIP] Cannot resolve gamme. Use --pg-id or name file as {{slug}}_{{date}}.csv")
        return {'status': 'skipped', 'reason': 'no_gamme'}

    pg_id = gamme_info['pg_id']
    pg_alias = gamme_info['pg_alias']
    pg_name = gamme_info['pg_name']
    print(f"  Gamme: {pg_name} (pg_id={pg_id}, slug={pg_alias})")

    # 2. Load RAG signals
    rag = load_gamme_rag(pg_alias)
    core_words = extract_core_words(pg_name)
    print(f"  [RAG] Core words: {core_words}")
    print(f"  [RAG] Aliases: {len(rag['aliases'])} | Must-not: {len(rag['must_not_contain'])} | Confusion: {len(rag['confusion_terms'])}")
    if verbose:
        if rag['must_not_contain']:
            print(f"        must_not_contain: {list(rag['must_not_contain'])}")
        if rag['confusion_terms']:
            print(f"        confusion_terms: {list(rag['confusion_terms'])}")

    # 3. Read CSV
    print(f"  [1/4] Lecture CSV...")
    rows = read_gads_csv(filepath)
    print(f"        {len(rows)} keywords avec volume > 0")
    if not rows:
        return {'status': 'empty', 'pg_alias': pg_alias}

    # 4. Normalize + dedup
    print(f"  [2/4] Dedup...")
    seen: dict[str, dict] = {}
    for row in rows:
        norm = normalize_kw(row['keyword'])
        if norm in seen:
            if row['volume'] > seen[norm]['volume']:
                seen[norm] = {**row, 'normalized': norm}
        else:
            seen[norm] = {**row, 'normalized': norm}
    deduped = list(seen.values())
    print(f"        {len(rows)} → {len(deduped)} apres dedup")

    # 5. Filter gamme relevance (RAG-driven)
    print(f"  [3/4] Filtre pertinence gamme (RAG)...")
    relevant = []
    reject_counts = Counter()
    for row in deduped:
        is_rel, reason = check_relevance(
            row['normalized'],
            core_words,
            rag['aliases'],
            rag['must_not_contain'],
            rag['confusion_terms'],
        )
        if is_rel:
            relevant.append(row)
        else:
            reject_counts[reason.split(':')[0]] += 1

    print(f"        {len(deduped)} → {len(relevant)} pertinents")
    print(f"        Rejets: {dict(reject_counts)}")

    if verbose and len(relevant) > 0:
        print(f"        Echantillon:")
        for r in relevant[:5]:
            print(f"          ✓ {r['keyword'][:55]:55} vol={r['volume']}")

    # 6. UPSERT __seo_keywords (SANS role — sera classifie par /content-gen)
    print(f"  [4/4] UPSERT __seo_keywords ({len(relevant)} rows)...")
    records = []
    for r in relevant:
        records.append({
            'keyword': r['keyword'],
            'keyword_normalized': r['normalized'],
            'gamme': pg_name,
            'type': 'generic',  # requis NOT NULL — pas de semantique ici
            'source': 'google-ads-kp',
            'volume': r['volume'],
            'pg_id': pg_id,
            'competition': r.get('competition'),
            'competition_idx': r.get('competition_idx'),
            # PAS de content_type — sera rempli par /content-gen
        })

    n = upsert_to_db('__seo_keywords', records, 'keyword,gamme', dry_run)
    print(f"        {'[DRY RUN]' if dry_run else f'{n} rows upserted'}")

    return {
        'status': 'success',
        'pg_alias': pg_alias,
        'pg_id': pg_id,
        'raw': len(rows),
        'deduped': len(deduped),
        'relevant': len(relevant),
        'rejects': dict(reject_counts),
        'upserted': n,
    }


def main():
    parser = argparse.ArgumentParser(description='Import Google Ads KP CSV → __seo_keywords (raw)')
    parser.add_argument('path', help='CSV file or directory')
    parser.add_argument('--pg-id', type=int, help='Override pg_id (skip slug detection)')
    parser.add_argument('--dry-run', action='store_true', help='Validate without writing')
    parser.add_argument('--verbose', action='store_true', help='Show details')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
        sys.exit(1)

    if os.path.isdir(args.path):
        files = sorted([
            os.path.join(args.path, f) for f in os.listdir(args.path)
            if f.endswith('.csv') and not f.startswith('.')
        ])
    elif os.path.isfile(args.path):
        files = [args.path]
    else:
        print(f"ERROR: {args.path} not found")
        sys.exit(1)

    print(f"Pipeline Google Ads KP → __seo_keywords")
    print(f"{'DRY RUN' if args.dry_run else 'LIVE'} mode")
    print(f"{len(files)} fichier(s)")

    results = [process_file(f, args.pg_id, args.dry_run, args.verbose) for f in files]

    ok = [r for r in results if r.get('status') == 'success']
    skip = [r for r in results if r.get('status') != 'success']

    print(f"\n{'='*60}")
    print(f"  RESUME")
    print(f"{'='*60}")
    print(f"  Fichiers: {len(files)}")
    print(f"  OK: {len(ok)} | Skip: {len(skip)}")

    if ok:
        total_raw = sum(r.get('raw', 0) for r in ok)
        total_relevant = sum(r.get('relevant', 0) for r in ok)
        total_rejects = Counter()
        for r in ok:
            total_rejects.update(r.get('rejects', {}))
        print(f"  Total raw: {total_raw}")
        print(f"  Total pertinents: {total_relevant}")
        print(f"  Rejets: {dict(total_rejects)}")

    print(f"\nProchaine etape: /content-gen <gamme> --r1|--r3|--r4|--r6")
    print(f"  → Le skill classifie les KW par role au moment de generer le contenu.")


if __name__ == '__main__':
    main()
