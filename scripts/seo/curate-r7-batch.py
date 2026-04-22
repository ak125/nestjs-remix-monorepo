#!/usr/bin/env python3
"""
curate-r7-batch.py — Re-apply R7 editorial drafts to __seo_brand_editorial
via the admin API.

Reads drafts from /opt/automecanik/rag/knowledge/web/brands/{alias}/
editorial-draft.json and PUTs each to /api/admin/r7/editorial/:marqueId.

This script does NOT generate content. Drafts are authored manually by a
human, sourced from Wikipedia FR + RAG frontmatter, marque-level strict
(no model/engine mention — see r7-vs-r8-content-rule).

The script only handles orchestration:
  - session login
  - PUT each draft (auto-trigger enrichSingle unless --skip-enrich)
  - log score + decision per brand
  - summary

Drafts format (conforme à BrandEditorialPayloadSchema) :
  {
    "_meta": { "brand_alias": "peugeot", "marque_id": 128, ... },
    "curated_by": "...",
    "faq":             [ { "q": "...", "a": "..." }, ... ],     # max 15
    "common_issues":   [ { "symptom": "...", ... }, ... ],       # max 20
    "maintenance_tips":[ { "part": "...", ... }, ... ]           # max 20
  }

Usage:
  python3 scripts/seo/curate-r7-batch.py --brand peugeot
  python3 scripts/seo/curate-r7-batch.py --all
  python3 scripts/seo/curate-r7-batch.py --all --dry-run
  python3 scripts/seo/curate-r7-batch.py --all --skip-enrich

Env vars (all optional) :
  R7_BASE_URL       default http://localhost:3000
  R7_ADMIN_EMAIL    default superadmin@autoparts.com
  R7_ADMIN_PASSWORD default SuperAdmin2025! (override in secure env)

Produced by session 2026-04-22-session-r7-full-curation — captures the
orchestration that was first executed as ad-hoc scripts in /tmp/wave{N}-drafts.py
for 36/36 brands.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("pip install requests", file=sys.stderr)
    sys.exit(1)

DRAFTS_DIR = Path("/opt/automecanik/rag/knowledge/web/brands")
BASE_URL = os.environ.get("R7_BASE_URL", "http://localhost:3000")
ADMIN_EMAIL = os.environ.get("R7_ADMIN_EMAIL", "superadmin@autoparts.com")
ADMIN_PASSWORD = os.environ.get("R7_ADMIN_PASSWORD", "SuperAdmin2025!")

DECISION_ICONS = {
    "PUBLISH": "✅",
    "REVIEW_REQUIRED": "⚠️ ",
    "REGENERATE": "🔄",
    "REJECT": "❌",
}


def discover_drafts() -> list[tuple[str, int, dict, Path]]:
    """Find all editorial-draft.json files under DRAFTS_DIR."""
    out: list[tuple[str, int, dict, Path]] = []
    for path_str in sorted(glob.glob(f"{DRAFTS_DIR}/*/editorial-draft.json")):
        path = Path(path_str)
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"  ⚠️  skip {path}: {exc}", file=sys.stderr)
            continue
        meta = data.get("_meta") or {}
        mid = meta.get("marque_id")
        alias = meta.get("brand_alias") or path.parent.name
        if not isinstance(mid, int) or mid <= 0:
            print(f"  ⚠️  skip {path}: missing/invalid marque_id", file=sys.stderr)
            continue
        out.append((alias, mid, data, path))
    return out


def login() -> requests.Session:
    """Create an authenticated session with the admin backend."""
    sess = requests.Session()
    resp = sess.post(
        f"{BASE_URL}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    try:
        resp.raise_for_status()
    except requests.HTTPError:
        print(
            f"❌ Login failed ({resp.status_code}): {resp.text[:200]}",
            file=sys.stderr,
        )
        sys.exit(2)
    body = resp.json() if resp.content else {}
    if not body.get("success"):
        print(f"❌ Login not successful: {body}", file=sys.stderr)
        sys.exit(2)
    return sess


def curate_one(
    sess: requests.Session,
    alias: str,
    mid: int,
    data: dict,
    skip_enrich: bool,
    dry_run: bool,
) -> dict | None:
    """PUT one draft. Returns enrichment result dict or None on failure."""
    payload = {
        "faq": data.get("faq", []) or [],
        "common_issues": data.get("common_issues", []) or [],
        "maintenance_tips": data.get("maintenance_tips", []) or [],
        "curated_by": data.get("curated_by", "curate-r7-batch"),
    }
    url = f"{BASE_URL}/api/admin/r7/editorial/{mid}"
    if skip_enrich:
        url += "?skipEnrich=true"

    counts = (
        f"faq={len(payload['faq'])} "
        f"issues={len(payload['common_issues'])} "
        f"maint={len(payload['maintenance_tips'])}"
    )
    if dry_run:
        print(f"  [DRY-RUN] {alias:<15} (id={mid:>3}): {counts}")
        return None

    resp = sess.put(url, json=payload, timeout=60)
    if resp.status_code != 200:
        print(
            f"  ❌ {alias:<15} (id={mid:>3}): HTTP {resp.status_code} "
            f"{resp.text[:160]}"
        )
        return None
    body = resp.json() if resp.content else {}
    enrich = body.get("enrichment") or {}
    if not enrich and not skip_enrich:
        # Upsert OK but enricher skipped/failed — still considered partial OK
        print(f"  ⚠️  {alias:<15} (id={mid:>3}): upsert ok, no enrichment")
    return enrich


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Batch curate R7 editorial via admin API from disk drafts.",
    )
    parser.add_argument("--brand", type=str, help="Single brand alias (ex: peugeot)")
    parser.add_argument(
        "--all", action="store_true", help="Apply every draft found on disk"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be PUT, no network I/O",
    )
    parser.add_argument(
        "--skip-enrich",
        action="store_true",
        help="?skipEnrich=true → no auto-trigger enrichSingle",
    )
    args = parser.parse_args()

    if not args.brand and not args.all:
        parser.error("Need --brand or --all")

    drafts = discover_drafts()
    if args.brand:
        drafts = [d for d in drafts if d[0] == args.brand]
        if not drafts:
            print(f"❌ No draft found for brand '{args.brand}'", file=sys.stderr)
            print(f"   Expected: {DRAFTS_DIR}/{args.brand}/editorial-draft.json")
            sys.exit(2)

    print(f"=== curate-r7-batch — {len(drafts)} brand(s) to apply ===")
    print(f"Base URL : {BASE_URL}")
    if args.dry_run:
        print("[DRY-RUN]")
    if args.skip_enrich:
        print("[SKIP-ENRICH] auto-enrichSingle disabled")
    print()

    sess = None if args.dry_run else login()

    stats = {"PUBLISH": 0, "REVIEW_REQUIRED": 0, "REGENERATE": 0, "REJECT": 0}
    http_fail = 0
    no_enrich = 0

    for alias, mid, data, _ in drafts:
        enrich = curate_one(
            sess, alias, mid, data, args.skip_enrich, args.dry_run
        )
        if args.dry_run:
            continue
        if enrich is None:
            http_fail += 1
            continue
        dec = enrich.get("seoDecision")
        score = enrich.get("diversityScore", 0) or 0
        if dec in stats:
            stats[dec] += 1
            icon = DECISION_ICONS.get(dec, "?")
            print(
                f"  {icon} {alias:<15} (id={mid:>3}): "
                f"score={score:.2f} {dec}"
            )
        else:
            no_enrich += 1

    if args.dry_run:
        return

    print()
    print("=== SUMMARY ===")
    total = sum(stats.values())
    print(f"  Total applied : {total}")
    for dec, count in stats.items():
        if count:
            print(f"  {DECISION_ICONS.get(dec, '?')} {dec}: {count}")
    if no_enrich:
        print(f"  ⚠️  upsert-only (no enrichment): {no_enrich}")
    if http_fail:
        print(f"  ❌ HTTP failures: {http_fail}")


if __name__ == "__main__":
    main()
