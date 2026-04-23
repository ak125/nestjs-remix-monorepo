#!/usr/bin/env python3
"""
Backfill R6 gatekeeper verdict for __seo_gamme_purchase_guide rows where
sgpg_gatekeeper_score IS NULL.

Context: before PR #130 (feat/r6-gatekeeper-wiring, merged 2026-04-23),
BuyingGuideEnricherService did not persist sgpg_gatekeeper_{score,flags,checks}.
This left 235/241 rows with NULL gate fields even though content was enriched.

Strategy: re-run the enrich endpoint for each NULL row. The endpoint is
idempotent — merge-only text fields, anti-regression on arrays, content trigger
only nulls gatekeeper when content actually changes (IS DISTINCT FROM OLD).

Resume-safe: each iteration re-queries the NULL list, so interruption =
clean resume. If a row stays NULL after enrich (F1-gate blocked, RAG missing,
etc.), the script marks it as 'blocked' and continues.

Usage:
  python3 scripts/seo/backfill-r6-gatekeeper.py [--limit N] [--dry-run] [--sleep 2.0]

Exit codes:
  0  all NULL rows processed (or --dry-run complete)
  2  missing env
  3  DB error
  4  backend health check failed
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import psycopg2
import urllib.request
import urllib.error
import json as jsonlib

from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"
API_BASE = os.environ.get("BACKFILL_API_BASE", "http://localhost:3000")
ENDPOINT = f"{API_BASE}/api/internal/buying-guides/enrich"
HEALTH_URL = f"{API_BASE}/health"


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
        f"application_name=backfill-r6-gatekeeper"
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


def fetch_null_pg_ids(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT sgpg_pg_id
            FROM __seo_gamme_purchase_guide
            WHERE sgpg_gatekeeper_score IS NULL
            ORDER BY sgpg_pg_id
            """
        )
        return [row[0] for row in cur.fetchall()]


def fetch_row_score(conn, pg_id: str) -> tuple[int | None, list[str] | None]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT sgpg_gatekeeper_score, sgpg_gatekeeper_flags
            FROM __seo_gamme_purchase_guide
            WHERE sgpg_pg_id = %s
            """,
            (pg_id,),
        )
        r = cur.fetchone()
        return (r[0], r[1]) if r else (None, None)


def enrich_one(pg_id: str, key: str) -> tuple[bool, str]:
    payload = jsonlib.dumps({"pgIds": [pg_id], "dryRun": False}).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={"X-Internal-Key": key, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = jsonlib.loads(resp.read())
            results = body.get("results", [])
            if not results:
                return (False, "no_result")
            r = results[0]
            if r.get("updated") is False and r.get("skippedSections"):
                skipped = r["skippedSections"]
                if "F1_GATE_BLOCKED" in skipped:
                    return (False, "f1_gate_blocked")
                return (False, f"skipped:{','.join(skipped)[:60]}")
            sections_updated = r.get("sectionsUpdated", 0)
            return (True, f"sections={sections_updated}")
    except urllib.error.HTTPError as e:
        return (False, f"http_{e.code}")
    except urllib.error.URLError as e:
        return (False, f"url_error:{e.reason}")
    except Exception as e:
        return (False, f"error:{type(e).__name__}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Backfill sgpg_gatekeeper_* for NULL rows via enrich endpoint"
    )
    ap.add_argument("--limit", type=int, default=0, help="cap iterations (0=all)")
    ap.add_argument("--dry-run", action="store_true", help="list NULL pg_ids, no writes")
    ap.add_argument("--sleep", type=float, default=2.0, help="seconds between calls")
    args = ap.parse_args()

    log(f"backfill-r6-gatekeeper start — api={API_BASE} sleep={args.sleep}s limit={args.limit or 'all'}")

    if not args.dry_run:
        health_check()

    key = require_internal_key() if not args.dry_run else ""
    conn = psycopg2.connect(build_dsn())

    try:
        null_ids = fetch_null_pg_ids(conn)
        log(f"found {len(null_ids)} row(s) with sgpg_gatekeeper_score IS NULL")

        if args.dry_run:
            for pg_id in null_ids[: args.limit] if args.limit else null_ids:
                print(pg_id)
            log(f"[DRY-RUN] done — {len(null_ids)} total, listed {min(args.limit or len(null_ids), len(null_ids))}")
            return 0

        target = null_ids[: args.limit] if args.limit else null_ids
        log(f"processing {len(target)} pg_id(s)")

        stats = {"ok": 0, "now_scored": 0, "still_null": 0, "error": 0}
        for i, pg_id in enumerate(target, 1):
            ok, detail = enrich_one(pg_id, key)
            if ok:
                stats["ok"] += 1
                score, flags = fetch_row_score(conn, pg_id)
                if score is not None:
                    stats["now_scored"] += 1
                    nflags = len(flags) if flags else 0
                    log(f"  [{i:3d}/{len(target)}] pg_id={pg_id:5s} → score={score} flags={nflags} ({detail})")
                else:
                    stats["still_null"] += 1
                    log(f"  [{i:3d}/{len(target)}] pg_id={pg_id:5s} → STILL NULL ({detail})")
            else:
                stats["error"] += 1
                log(f"  [{i:3d}/{len(target)}] pg_id={pg_id:5s} → FAIL ({detail})")

            if i < len(target):
                time.sleep(args.sleep)

        log(
            f"[DONE] ok={stats['ok']} now_scored={stats['now_scored']} "
            f"still_null={stats['still_null']} error={stats['error']}"
        )
        remaining = fetch_null_pg_ids(conn)
        log(f"remaining NULL after run: {len(remaining)}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
