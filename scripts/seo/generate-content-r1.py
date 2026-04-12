#!/usr/bin/env python3
"""
Generate R1 Content — On-demand pipeline for a single gamme.

Takes a raw Google Ads Keyword Planner CSV for one gamme, imports KW,
classifies them, generates R1 editorial HTML via Anthropic API, and writes
the result to __seo_gamme.sg_content_draft (DRAFT ONLY — live untouched).

Usage:
    python3 scripts/seo/generate-content-r1.py data/keywords/raw/plaquette-de-frein.csv
    python3 scripts/seo/generate-content-r1.py data/keywords/raw/export.csv --pg-id 402
    python3 scripts/seo/generate-content-r1.py data/keywords/raw/plaquette-de-frein.csv --dry-run
    python3 scripts/seo/generate-content-r1.py data/keywords/raw/plaquette-de-frein.csv --skip-import

Flow:
    1. Resolve gamme from filename or --pg-id
    2. Import KW via import-gads-kp.py (unless --skip-import)
    3. Load context (RAG + KW + aggregates + links)
    4. Build prompt (editorial.md + RAG + KW + aggregates)
    5. Call Anthropic API (claude-sonnet-4)
    6. Validate (lint gates: forbidden vocab + KW score + length + H2 count)
    7. Write sg_content_draft (if not --dry-run)
"""
from __future__ import annotations
import os
import re
import sys
import json
import argparse
import unicodedata
import urllib.request
from pathlib import Path
from typing import Optional

# ─── ENV ────────────────────────────────────────────────────────────────
env_path = Path('/opt/automecanik/app/backend/.env')
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = os.environ.get('ANTHROPIC_MODEL', 'claude-sonnet-4-20250514')

RAG_DIR = Path('/opt/automecanik/rag/knowledge/gammes')
PROMPT_PATH = Path('/opt/automecanik/app/.claude/prompts/R1_ROUTER/editorial.md')

# Lint gates
FORBIDDEN_VOCAB = [
    # Anglicismes strict (non-whitelistes)
    'spin-on', 'spin on', 'multi-pass', 'multi pass',
    'anti-drain back', 'anti-drainback', 'drain-back',
    'brake fluid', 'oil pan',
    # Cross-role (R3, R5, R6)
    'demonter', 'démonter', 'remontage', 'couple de serrage',
    'etape 1', 'étape 1', 'etape 2', 'étape 2', 'étape 3',
    'tutoriel', 'pas-a-pas', 'pas à pas',
    'symptome', 'symptôme', 'panne',
    'definition', 'définition', 'glossaire',
    "qu'est-ce que", 'comment choisir', "guide d'achat", 'comparatif qualite',
    # Scope R1 hors-auto
    'tondeuse', 'briggs stratton', 'briggs et stratton',
    'tracteur agricole', 'engin agricole', 'poids lourd', 'poids lourds',
    'hydraulique', 'centrifuge',
    # ^^ these may be fine in some contexts; scan as warning, not block
]
FORBIDDEN_BLOCKING = [
    'spin-on', 'multi-pass', 'anti-drain back', 'brake fluid',
    'demonter', 'démonter', 'tutoriel', 'comment choisir', "guide d'achat",
    'tondeuse', 'briggs stratton', 'tracteur agricole', 'engin agricole',
    'filtre centrifuge',
]


# ─── HELPERS ───────────────────────────────────────────────────────────

def normalize_kw(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'\s+', ' ', text)
    text = unicodedata.normalize('NFD', text)
    return ''.join(c for c in text if unicodedata.category(c) != 'Mn')


def slug_from_filename(filepath: Path) -> Optional[str]:
    base = filepath.stem
    base = re.sub(r'_\d{4}-\d{2}-\d{2}.*$', '', base)
    base = re.sub(r'_clean$', '', base)
    if re.match(r'^[a-z0-9-]+$', base) and len(base) > 3:
        return base
    return None


def db_get(path: str) -> Optional[dict]:
    """GET request to Supabase REST API."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            return data
    except Exception as e:
        print(f"  [WARN] DB GET failed {path}: {e}")
        return None


def db_patch(path: str, payload: dict) -> bool:
    """PATCH request to update a row."""
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=body, method='PATCH', headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    })
    try:
        urllib.request.urlopen(req, timeout=15)
        return True
    except Exception as e:
        print(f"  [ERROR] DB PATCH failed {path}: {e}")
        return False


def resolve_gamme(slug: Optional[str], pg_id: Optional[int]) -> Optional[dict]:
    """Lookup gamme by slug or pg_id."""
    if pg_id:
        rows = db_get(f"pieces_gamme?pg_id=eq.{pg_id}&select=pg_id,pg_alias,pg_name&limit=1")
    elif slug:
        rows = db_get(f"pieces_gamme?pg_alias=eq.{slug}&select=pg_id,pg_alias,pg_name&limit=1")
    else:
        return None
    return rows[0] if rows else None


def load_rag(pg_alias: str) -> Optional[dict]:
    """Load RAG .md frontmatter + body preview."""
    rag_path = RAG_DIR / f'{pg_alias}.md'
    if not rag_path.exists():
        return None

    import yaml
    content = rag_path.read_text(encoding='utf-8')
    parts = content.split('---', 2)
    if len(parts) < 3:
        return None

    try:
        data = yaml.safe_load(parts[1])
    except Exception as e:
        print(f"  [WARN] RAG YAML parse failed: {e}")
        return None

    return data if isinstance(data, dict) else None


def load_kw(pg_id: int, role: str = 'R1') -> list[dict]:
    """Load classified KW from __seo_keyword_results.

    Fetches HIGH + MED explicitly (critical for generation), plus a sample of LOW.
    """
    high = db_get(f"__seo_keyword_results?pg_id=eq.{pg_id}&role=eq.{role}&vol=eq.HIGH&select=kw,intent,vol") or []
    med = db_get(f"__seo_keyword_results?pg_id=eq.{pg_id}&role=eq.{role}&vol=eq.MED&select=kw,intent,vol") or []
    low = db_get(f"__seo_keyword_results?pg_id=eq.{pg_id}&role=eq.{role}&vol=eq.LOW&select=kw,intent,vol&limit=30") or []
    return high + med + low


def load_aggregates(pg_id: int) -> Optional[dict]:
    """Load gamme_aggregates."""
    rows = db_get(f"gamme_aggregates?ga_pg_id=eq.{pg_id}&select=products_total,top_brands,vehicle_coverage&limit=1")
    return rows[0] if rows else None


def load_links(pg_id: int) -> list[dict]:
    """Load __seo_gamme_links."""
    rows = db_get(f"__seo_gamme_links?source_pg_id=eq.{pg_id}&select=target_pg_id,anchor_text,context,relation")
    return rows or []


def load_existing_draft(pg_id: int) -> Optional[dict]:
    """Load existing sg_content_draft (for anti-regression)."""
    rows = db_get(f"__seo_gamme?sg_pg_id=eq.{pg_id}&select=sg_content_draft,sg_title_draft,sg_descrip_draft,sg_draft_source,sg_draft_updated_at&limit=1")
    return rows[0] if rows else None


# ─── VALIDATION (lint gates) ────────────────────────────────────────────

def validate_content(html: str, kw_list: list[dict], min_length: int = 10000) -> tuple[bool, list[str]]:
    """Run lint gates on generated HTML.

    Returns (ok, errors)
    """
    errors = []

    # Gate 1: Length
    if len(html) < min_length:
        errors.append(f"LENGTH: {len(html)} chars < min {min_length}")

    # Gate 2: H2 count
    h2_count = html.count('<h2>')
    if h2_count < 6:
        errors.append(f"H2_COUNT: {h2_count} H2 < 6 required")
    elif h2_count > 10:
        errors.append(f"H2_COUNT: {h2_count} H2 > 10 (too verbose)")

    # Gate 3: Forbidden vocabulary (blocking)
    html_lower = html.lower()
    found_blocking = [term for term in FORBIDDEN_BLOCKING if term.lower() in html_lower]
    if found_blocking:
        errors.append(f"FORBIDDEN_VOCAB: {found_blocking[:5]}")

    # Gate 4: KW HIGH coverage (must be 100%)
    html_norm = normalize_kw(html)
    high_kw = [k for k in kw_list if k['vol'] == 'HIGH']
    missing_high = []
    for k in high_kw:
        kw_norm = normalize_kw(k['kw'])
        # Fuzzy: all tokens present within 100-char window
        tokens = [t for t in kw_norm.split() if len(t) >= 2]
        if not tokens:
            continue
        found = False
        idx = 0
        while idx < len(html_norm):
            pos = html_norm.find(tokens[0], idx)
            if pos == -1:
                break
            if all(t in html_norm[pos:pos+100] for t in tokens):
                found = True
                break
            idx = pos + 1
        if not found:
            missing_high.append(k['kw'])

    if missing_high:
        errors.append(f"KW_HIGH_MISSING: {len(missing_high)} missing ({missing_high[:5]})")

    return len(errors) == 0, errors


# ─── ANTHROPIC API ──────────────────────────────────────────────────────

def call_anthropic(system_prompt: str, user_message: str, max_tokens: int = 8000) -> str:
    """Call Anthropic API (Messages endpoint).

    Uses urllib to avoid extra dependencies.
    """
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    url = "https://api.anthropic.com/v1/messages"
    body = json.dumps({
        "model": ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
    }).encode('utf-8')

    req = urllib.request.Request(url, data=body, method='POST', headers={
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
    })

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"Anthropic API error {e.code}: {err_body}")

    if 'content' not in data:
        raise RuntimeError(f"Unexpected response: {data}")

    text = ''
    for block in data['content']:
        if block.get('type') == 'text':
            text += block.get('text', '')

    usage = data.get('usage', {})
    print(f"    Tokens : input={usage.get('input_tokens', 0)}, output={usage.get('output_tokens', 0)}")

    return text


def build_user_message(gamme: dict, rag: dict, kw: list[dict], aggregates: dict, links: list[dict], existing: Optional[dict]) -> str:
    """Build user message payload for Anthropic."""
    # Simplify RAG (keep only key sections)
    rag_simplified = {
        'domain': rag.get('domain', {}),
        'variants': rag.get('variants', []),
        'selection': rag.get('selection', {}),
        'diagnostic': rag.get('diagnostic', {}),
        'maintenance': rag.get('maintenance', {}),
        'rendering': {'faq': rag.get('rendering', {}).get('faq', [])},
    }

    kw_grouped = {
        'HIGH': [k['kw'] for k in kw if k['vol'] == 'HIGH'],
        'MED': [k['kw'] for k in kw if k['vol'] == 'MED'],
        'LOW_sample': [k['kw'] for k in kw if k['vol'] == 'LOW'][:20],
    }

    msg = {
        'gamme_name': gamme['pg_name'],
        'gamme_alias': gamme['pg_alias'],
        'pg_id': gamme['pg_id'],
        'keywords_r1': kw_grouped,
        'rag': rag_simplified,
        'aggregates': aggregates,
        'internal_links': links,
    }
    if existing and existing.get('sg_content_draft'):
        msg['existing_draft_length'] = len(existing['sg_content_draft'])

    return (
        "Genere le contenu R1 editorial pour cette gamme selon la structure obligatoire "
        "(8 H2), les regles de qualite, le forbidden vocabulary strict, et le scope R1 voiture. "
        "Retourne UNIQUEMENT le HTML (pas de markdown, pas d'explication).\n\n"
        "DONNEES GAMME :\n```json\n" + json.dumps(msg, indent=2, ensure_ascii=False) + "\n```"
    )


# ─── MAIN ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='On-demand R1 content generation for single gamme')
    parser.add_argument('csv', nargs='?', type=str, help='CSV file path (Google Ads KP export)')
    parser.add_argument('--pg-id', type=int, help='Override pg_id (bypass CSV + import)')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing DB')
    parser.add_argument('--skip-import', action='store_true', help='Skip KW import step (if already done)')
    parser.add_argument('--output', type=str, help='Write generated HTML to file (for inspection)')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
        return 1
    if not ANTHROPIC_API_KEY and not args.dry_run:
        print("ERROR: ANTHROPIC_API_KEY not set in backend/.env")
        print("       (use --dry-run to test without API key)")
        return 1

    # 1. Resolve gamme
    if args.pg_id:
        gamme = resolve_gamme(None, args.pg_id)
        csv_path = Path(args.csv) if args.csv else None
    else:
        if not args.csv:
            print("ERROR: Must provide CSV path or --pg-id")
            return 1
        csv_path = Path(args.csv)
        if not csv_path.exists():
            print(f"ERROR: {csv_path} not found")
            return 1
        slug = slug_from_filename(csv_path)
        gamme = resolve_gamme(slug, None) if slug else None

    if not gamme:
        print(f"ERROR: Cannot resolve gamme from CSV/pg-id. Use --pg-id.")
        return 1

    print(f"\n{'=' * 60}")
    print(f"  GAMME : {gamme['pg_name']} (pg_id={gamme['pg_id']}, slug={gamme['pg_alias']})")
    print(f"  MODE  : {'DRY RUN' if args.dry_run else 'LIVE'}")
    print(f"{'=' * 60}\n")

    # 2. Import KW (unless skipped)
    if not args.skip_import and csv_path:
        print("[1/6] Import KW from CSV...")
        import subprocess
        cmd = ['python3', 'scripts/seo/import-gads-kp.py', str(csv_path), '--pg-id', str(gamme['pg_id'])]
        if args.dry_run:
            cmd.append('--dry-run')
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"  [ERROR] KW import failed:\n{result.stderr}")
            return 1
        print(f"  OK — KW imported")
    else:
        print("[1/6] Skipping KW import (--skip-import or --pg-id)")

    # 3. Load context
    print("\n[2/6] Loading context...")
    rag = load_rag(gamme['pg_alias'])
    if not rag:
        print(f"  ERROR: RAG not found for {gamme['pg_alias']}")
        return 1
    print(f"  RAG : {len(str(rag))} chars, domain={bool(rag.get('domain'))}, variants={len(rag.get('variants', []))}")

    kw = load_kw(gamme['pg_id'], 'R1')
    kw_high = [k for k in kw if k['vol'] == 'HIGH']
    kw_med = [k for k in kw if k['vol'] == 'MED']
    print(f"  KW  : {len(kw)} total ({len(kw_high)} HIGH, {len(kw_med)} MED)")

    if not kw:
        print(f"  ERROR: No KW classified for pg_id={gamme['pg_id']} role=R1")
        print(f"  Run /kw-classify {gamme['pg_alias']} first")
        return 1

    aggregates = load_aggregates(gamme['pg_id'])
    links = load_links(gamme['pg_id'])
    existing = load_existing_draft(gamme['pg_id'])

    print(f"  Aggregates : {aggregates['products_total'] if aggregates else 0} products")
    print(f"  Links      : {len(links)}")
    if existing and existing.get('sg_content_draft'):
        print(f"  Existing draft : {len(existing['sg_content_draft'])} chars ({existing.get('sg_draft_source', 'unknown')})")

    # 4. Build prompt
    print("\n[3/6] Building prompt...")
    system_prompt = PROMPT_PATH.read_text(encoding='utf-8')
    user_message = build_user_message(gamme, rag, kw, aggregates or {}, links, existing)
    print(f"  System : {len(system_prompt)} chars")
    print(f"  User   : {len(user_message)} chars")

    # 5. Call Anthropic
    print(f"\n[4/6] Calling Anthropic ({ANTHROPIC_MODEL})...")
    if args.dry_run:
        print("  [DRY RUN] Skipping API call")
        html = '<h2>DRY RUN PLACEHOLDER</h2><p>Content not generated in dry-run mode.</p>'
    else:
        try:
            html = call_anthropic(system_prompt, user_message)
            print(f"  OK — {len(html)} chars generated")
        except Exception as e:
            print(f"  ERROR: {e}")
            return 1

    # 6. Validate
    print("\n[5/6] Validating (lint gates)...")
    if not args.dry_run:
        ok, errors = validate_content(html, kw)
        if not ok:
            print(f"  VALIDATION FAILED:")
            for err in errors:
                print(f"    - {err}")
            if args.output:
                Path(args.output).write_text(html, encoding='utf-8')
                print(f"  HTML saved to {args.output} for review")
            return 1
        print(f"  OK — all lint gates passed")
    else:
        print(f"  [DRY RUN] Skipped")

    # 7. Write draft
    print("\n[6/6] Writing sg_content_draft...")
    if args.dry_run:
        print("  [DRY RUN] Not writing DB")
    else:
        # Extract meta tags (basic: first H2 title, first paragraph)
        h2_match = re.search(r'<h2>([^<]+)</h2>', html)
        title = (h2_match.group(1) if h2_match else gamme['pg_name'])[:60]

        # Simple description: first paragraph stripped of HTML
        p_match = re.search(r'<p>([^<]+)</p>', html)
        descrip = (re.sub(r'\s+', ' ', p_match.group(1)) if p_match else '')[:155]

        payload = {
            'sg_content_draft': html,
            'sg_title_draft': title,
            'sg_descrip_draft': descrip,
            'sg_draft_source': 'generate-content-r1-script-v1',
            'sg_draft_updated_at': 'now()',
            'sg_draft_llm_model': ANTHROPIC_MODEL,
        }

        ok = db_patch(f"__seo_gamme?sg_pg_id=eq.{gamme['pg_id']}", payload)
        if ok:
            print(f"  OK — draft ecrit ({len(html)} chars)")
        else:
            print(f"  ERROR: write failed")
            return 1

    if args.output:
        Path(args.output).write_text(html, encoding='utf-8')
        print(f"  HTML saved to {args.output}")

    # Final report
    print(f"\n{'=' * 60}")
    print(f"  SUCCESS")
    print(f"{'=' * 60}")
    print(f"  Gamme  : {gamme['pg_name']}")
    print(f"  Length : {len(html)} chars")
    print(f"  H2     : {html.count('<h2>')}")
    if not args.dry_run:
        print(f"\n  Review command :")
        print(f"    SELECT length(sg_content_draft), sg_draft_source FROM __seo_gamme WHERE sg_pg_id='{gamme['pg_id']}';")
        print(f"\n  Promotion command (apres review) :")
        print(f"    UPDATE __seo_gamme SET")
        print(f"      sg_content = sg_content_draft,")
        print(f"      sg_title = sg_title_draft,")
        print(f"      sg_descrip = sg_descrip_draft")
        print(f"    WHERE sg_pg_id='{gamme['pg_id']}';")
        print(f"    redis-cli DEL gamme:rpc:v2:{gamme['pg_id']}")

    return 0


if __name__ == '__main__':
    exit(main())
