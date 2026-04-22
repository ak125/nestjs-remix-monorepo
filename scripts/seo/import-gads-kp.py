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

STOP_WORDS = {'a', 'de', 'd', 'du', 'le', 'la', 'les', 'l', 'un', 'une', 'des', 'en', 'et', 'ou', 'pour'}


# ─── HELPERS ───────────────────────────────────────────────────────────

def normalize_kw(text: str) -> str:
    """Lowercase, no accents, no apostrophes/hyphens, single spaces, trimmed."""
    text = text.lower().strip()
    # Replace apostrophes (ASCII + typographiques) + hyphens + underscores by space
    # Critical: pg_names like "Filtre d'habitacle" must normalize to "filtre d habitacle"
    # so that extract_core_words can split and find "habitacle" (not "d'habitacle")
    text = re.sub(r"[''’'\-_]", ' ', text)
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


ALIAS_EXPANSIONS_PATH = '/opt/automecanik/app/config/rag-alias-expansions.yaml'
_alias_expansions_cache: Optional[dict] = None


def load_alias_expansions() -> dict:
    """Load centralized SEO alias expansions (cached)."""
    global _alias_expansions_cache
    if _alias_expansions_cache is not None:
        return _alias_expansions_cache
    try:
        import yaml
        with open(ALIAS_EXPANSIONS_PATH, encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
        _alias_expansions_cache = data if isinstance(data, dict) else {}
    except FileNotFoundError:
        _alias_expansions_cache = {}
    except Exception as e:
        print(f"  [WARN] Failed to load alias expansions: {e}")
        _alias_expansions_cache = {}
    return _alias_expansions_cache


def load_gamme_rag(pg_alias: str) -> dict:
    """Load gamme RAG file → extract aliases + must_not_contain + confusion_with.

    Aliases sources (fusionnés) :
      1. title du RAG
      2. variants[].aliases + variants[].name du RAG
      3. ALIAS_EXPANSIONS_PATH YAML central (synonymes SEO commerciaux)
    """
    result = {
        'aliases': set(),
        'must_not_contain': set(),
        'confusion_terms': set(),
    }
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

    # Merge centralized alias expansions (additive, never removes existing)
    expansions = load_alias_expansions()
    for extra in (expansions.get(pg_alias) or []):
        if isinstance(extra, str) and extra.strip():
            result['aliases'].add(normalize_kw(extra))

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


# ─── SUGGEST ALIASES (R-SEO-KW-05) ─────────────────────────────────────

def emit_alias_suggestions(
    pg_alias: str,
    rejects: list[dict],
    csv_filename: str,
    threshold_vol: int = 50,
) -> None:
    """Print a YAML block of candidate aliases for rag-alias-expansions.yaml.

    Only emits rejects with reason 'no_core_match' AND volume >= threshold_vol,
    sorted by volume desc. The other reject reasons (exclude:*, confusion:*)
    are intentional and should NOT become aliases.
    """
    candidates = [
        r for r in rejects
        if r.get('reason') == 'no_core_match' and (r.get('volume') or 0) >= threshold_vol
    ]
    if not candidates:
        print(f"\n  [SUGGEST] No rejects above threshold vol={threshold_vol}.")
        return

    candidates.sort(key=lambda r: -(r.get('volume') or 0))
    total_vol = sum(r.get('volume') or 0 for r in candidates)
    seen_norms: set[str] = set()

    print(f"\n  [SUGGEST] {len(candidates)} candidates, vol cumule={total_vol}/mois")
    print(f"  [SUGGEST] YAML pret-a-coller dans config/rag-alias-expansions.yaml :")
    print()
    print(f"{pg_alias}:")
    print(f"  # suggested from {csv_filename} ({len(candidates)} rejets, vol {total_vol})")
    for r in candidates:
        norm = r.get('normalized') or ''
        if norm in seen_norms:
            continue
        seen_norms.add(norm)
        kw = r.get('keyword') or norm
        vol = r.get('volume') or 0
        print(f"  - {norm}  # vol={vol}  raw='{kw}'")
    print()


# ─── MAIN PIPELINE ─────────────────────────────────────────────────────

def process_file(
    filepath: str,
    pg_id_override: Optional[int],
    dry_run: bool,
    verbose: bool,
    suggest_aliases: bool = False,
    suggest_threshold_vol: int = 50,
) -> dict:
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
    rejects_detail: list[dict] = []  # {keyword, normalized, volume, reason}
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
            rejects_detail.append({**row, 'reason': reason})

    print(f"        {len(deduped)} → {len(relevant)} pertinents")
    print(f"        Rejets: {dict(reject_counts)}")

    # R-SEO-KW-05 : --suggest-aliases imprime un bloc YAML pret-a-coller
    # pour les rejets no_core_match au-dessus du threshold de volume.
    # Ne touche pas la DB (le flag implique souvent --dry-run).
    if suggest_aliases:
        emit_alias_suggestions(
            pg_alias=pg_alias,
            rejects=rejects_detail,
            csv_filename=os.path.basename(filepath),
            threshold_vol=suggest_threshold_vol,
        )

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
    parser.add_argument(
        '--suggest-aliases',
        action='store_true',
        help='Print YAML block of candidate aliases for rag-alias-expansions.yaml '
             '(rejects with reason=no_core_match above --threshold-vol). R-SEO-KW-05.',
    )
    parser.add_argument(
        '--threshold-vol',
        type=int,
        default=50,
        help='Min monthly volume for --suggest-aliases candidates (default: 50)',
    )
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

    import shutil
    from datetime import datetime

    # Destinations canoniques pour le lifecycle du fichier CSV
    processed_dir = '/opt/automecanik/app/data/keywords/processed'
    failed_dir = '/opt/automecanik/app/data/keywords/failed'
    output_dir = '/opt/automecanik/app/data/keywords/output'
    logs_dir = '/opt/automecanik/app/data/keywords/logs'
    for d in (processed_dir, failed_dir, output_dir, logs_dir):
        os.makedirs(d, exist_ok=True)

    results = []
    for f in files:
        r = process_file(
            f,
            args.pg_id,
            args.dry_run,
            args.verbose,
            suggest_aliases=args.suggest_aliases,
            suggest_threshold_vol=args.threshold_vol,
        )
        results.append({**r, '_src_path': f})

        # Lifecycle : déplacer le CSV + écrire snapshot JSON "nettoyé".
        # Ne s'applique pas en dry-run, ni quand on est en mode review aliases.
        if not args.dry_run and not args.suggest_aliases and os.path.isfile(f):
            ts = datetime.now().strftime('%Y-%m-%dT%H%M%S')
            basename = os.path.basename(f)

            if r.get('status') == 'success':
                # CSV brut → processed/ (garde l'original pour audit)
                dst = os.path.join(processed_dir, f'{ts}__{basename}')
                shutil.move(f, dst)
                print(f"        → moved to processed/{os.path.basename(dst)}")

                # Snapshot JSON "nettoyé" dans output/ (les KW pertinents post-filtre RAG)
                snapshot = {
                    'imported_at': datetime.now().isoformat(),
                    'source_csv': basename,
                    'pg_id': r.get('pg_id'),
                    'pg_alias': r.get('pg_alias'),
                    'raw_count': r.get('raw'),
                    'deduped_count': r.get('deduped'),
                    'relevant_count': r.get('relevant'),
                    'rejected': r.get('rejects'),
                    'upserted': r.get('upserted'),
                }
                snap_path = os.path.join(
                    output_dir,
                    f'{ts}__{r.get("pg_alias")}__import-summary.json'
                )
                with open(snap_path, 'w', encoding='utf-8') as fo:
                    json.dump(snapshot, fo, ensure_ascii=False, indent=2)
                print(f"        → summary output/{os.path.basename(snap_path)}")
            else:
                dst = os.path.join(failed_dir, f'{ts}__{basename}')
                shutil.move(f, dst)
                print(f"        → moved to failed/{os.path.basename(dst)}")

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
