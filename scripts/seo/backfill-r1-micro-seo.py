#!/usr/bin/env python3
"""
Backfill r1s_micro_seo_block for __seo_r1_gamme_slots rows where the
content length is below the canonical Option B threshold (1500c min).

Mirror of `scripts/seo/backfill-r1-gatekeeper.py` — same psycopg2 + .env +
dry-run + resume-safe + sleep pattern. The actual content synthesis runs
inside `R1EnricherService.synthesizeMicroSeo` (richer 5-paragraph synth +
truncate cap 3000c, see commit feat/r1-enricher-micro-seo-1500c-canon),
invoked via the canonical pipeline endpoint :

    POST /api/internal/pipeline/execute
    { "roleId": "R1_ROUTER", "targetIds": [<pg_id>], "dryRun": false }

Strategy : re-enrich every R1 slot whose `r1s_micro_seo_block` is NULL or
shorter than `MIN_CHARS`. Resume-safe (each iteration re-queries the
under-dimensioned list) and idempotent (UPSERT pattern in the service).

Footprint at ship-time (audit 2026-05-07) :
  169 slots total, avg 221c, 132 < 300c, 31 in [300, 499], 6 in [700, 1499],
  0 ≥ 1500c. Expected backfill : 163 rows (or 169 if `--include-legacy-band`).

Usage:
  python3 scripts/seo/backfill-r1-micro-seo.py [--limit N] [--dry-run] [--sleep 2.0] [--include-legacy-band]

Required env (backend/.env):
  SUPABASE_DB_PASSWORD       Postgres password for direct DB queries
  INTERNAL_API_KEY           X-Internal-Key for /api/internal/pipeline/execute
  BACKFILL_API_BASE          (optional) defaults to http://localhost:3000
"""
from __future__ import annotations

import argparse
import json as jsonlib
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
API_BASE = os.environ.get("BACKFILL_API_BASE", "http://localhost:3000")
ENDPOINT = f"{API_BASE}/api/internal/pipeline/execute"
HEALTH_URL = f"{API_BASE}/health"

# Canon threshold — must match R1_MICRO_SEO_MIN_CHARS in r1-enricher.service.ts
MIN_CHARS = 1500
# Legacy band : rows in [700, 1499] are above the old threshold but below
# the new one. Excluded by default (the user explicitly scoped 163 rows in
# Option B), included with --include-legacy-band to canonicalise everything.
LEGACY_LOW_BOUND = 700


def log(msg: str) -> None:
    ts = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    sys.stderr.write(f"[{ts}] {msg}\n")
    sys.stderr.flush()


def build_dsn() -> str:
    pwd = os.environ.get("SUPABASE_DB_PASSWORD")
    if not pwd:
        sys.stderr.write("[FATAL] SUPABASE_DB_PASSWORD missing in env\n")
        sys.exit(2)
    return (
        f"host=db.{PROJECT_REF}.supabase.co port=5432 dbname=postgres "
        f"user=postgres password={pwd} sslmode=require "
        f"application_name=backfill-r1-micro-seo"
    )


def require_internal_key() -> str:
    key = os.environ.get("INTERNAL_API_KEY")
    if not key:
        sys.stderr.write("[FATAL] INTERNAL_API_KEY missing in env\n")
        sys.exit(2)
    return key


def health_check() -> None:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=5) as resp:
            body = jsonlib.loads(resp.read())
            if body.get("status") != "ok":
                log(f"[FATAL] backend health not OK: {body}")
                sys.exit(4)
    except Exception as err:
        log(f"[FATAL] backend health check failed ({err})")
        sys.exit(4)


def fetch_under_dim_pg_ids(conn, include_legacy_band: bool) -> list[tuple[str, int]]:
    """Return (pg_id, current_chars) for slots needing backfill, low-first."""
    upper = MIN_CHARS if include_legacy_band else LEGACY_LOW_BOUND
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT r1s_pg_id, char_length(COALESCE(r1s_micro_seo_block, ''))
            FROM __seo_r1_gamme_slots
            WHERE char_length(COALESCE(r1s_micro_seo_block, '')) < %s
            ORDER BY char_length(COALESCE(r1s_micro_seo_block, '')) ASC,
                     r1s_pg_id ASC
            """,
            (upper,),
        )
        return [(row[0], row[1]) for row in cur.fetchall()]


def fetch_row_chars(conn, pg_id: str) -> int | None:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT char_length(COALESCE(r1s_micro_seo_block, ''))
            FROM __seo_r1_gamme_slots
            WHERE r1s_pg_id = %s
            """,
            (pg_id,),
        )
        r = cur.fetchone()
        return r[0] if r else None


def enrich_one(pg_id: str, key: str) -> tuple[bool, str]:
    payload = jsonlib.dumps(
        {"roleId": "R1_ROUTER", "targetIds": [pg_id], "dryRun": False}
    ).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"X-Internal-Key": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = jsonlib.loads(resp.read())
            data = body.get("data", {})
            results = data.get("results", [])
            if not results:
                return (False, "no_result")
            r = results[0]
            if r.get("status") != "success":
                return (False, f"status:{r.get('status')}")
            inner = r.get("data", {})
            inner_status = inner.get("status")
            if inner_status == "enriched":
                slots = inner.get("slotsWritten", 0)
                score = inner.get("qualityScore")
                return (True, f"slots={slots} score={score}")
            if inner_status == "skipped":
                flags = inner.get("qualityFlags", [])
                return (False, f"skipped:{','.join(flags)[:60]}")
            return (False, f"inner_status:{inner_status}")
    except urllib.error.HTTPError as e:
        return (False, f"http_{e.code}")
    except urllib.error.URLError as e:
        return (False, f"url_error:{e.reason}")
    except Exception as e:
        return (False, f"error:{type(e).__name__}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Backfill r1s_micro_seo_block for under-dimensioned R1 slots"
    )
    ap.add_argument("--limit", type=int, default=0, help="cap iterations (0=all)")
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="list under-dim pg_ids with current chars, no writes",
    )
    ap.add_argument("--sleep", type=float, default=2.0, help="seconds between calls")
    ap.add_argument(
        "--include-legacy-band",
        action="store_true",
        help=(
            f"also re-enrich rows in [{LEGACY_LOW_BOUND}, {MIN_CHARS}) (legacy band, "
            "above old threshold but below Option B canon)"
        ),
    )
    args = ap.parse_args()

    log(
        f"backfill-r1-micro-seo start — api={API_BASE} sleep={args.sleep}s "
        f"limit={args.limit or 'all'} legacy_band={args.include_legacy_band} "
        f"min_chars={MIN_CHARS}"
    )

    if not args.dry_run:
        health_check()

    key = require_internal_key() if not args.dry_run else ""
    conn = psycopg2.connect(build_dsn())

    try:
        rows = fetch_under_dim_pg_ids(conn, args.include_legacy_band)
        log(f"found {len(rows)} row(s) with chars < target threshold")

        if args.dry_run:
            for pg_id, chars in rows[: args.limit] if args.limit else rows:
                print(f"{pg_id}\t{chars}")
            log(
                f"[DRY-RUN] done — {len(rows)} total, "
                f"listed {min(args.limit or len(rows), len(rows))}"
            )
            return 0

        target = rows[: args.limit] if args.limit else rows
        log(f"processing {len(target)} pg_id(s)")

        stats = {"ok": 0, "now_at_min": 0, "still_short": 0, "error": 0}
        for i, (pg_id, before_chars) in enumerate(target, 1):
            ok, detail = enrich_one(pg_id, key)
            if ok:
                stats["ok"] += 1
                after = fetch_row_chars(conn, pg_id)
                if after is not None and after >= MIN_CHARS:
                    stats["now_at_min"] += 1
                    log(
                        f"  [{i:3d}/{len(target)}] pg_id={pg_id:5s} "
                        f"{before_chars}→{after}c ✓ ({detail})"
                    )
                else:
                    stats["still_short"] += 1
                    log(
                        f"  [{i:3d}/{len(target)}] pg_id={pg_id:5s} "
                        f"{before_chars}→{after}c ⚠ STILL SHORT ({detail})"
                    )
            else:
                stats["error"] += 1
                log(f"  [{i:3d}/{len(target)}] pg_id={pg_id:5s} → FAIL ({detail})")

            if i < len(target):
                time.sleep(args.sleep)

        log(
            f"[DONE] ok={stats['ok']} now_at_min={stats['now_at_min']} "
            f"still_short={stats['still_short']} error={stats['error']}"
        )
        remaining = fetch_under_dim_pg_ids(conn, args.include_legacy_band)
        log(f"remaining under-dim after run: {len(remaining)}")
        return 0 if stats["error"] == 0 else 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
