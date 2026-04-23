#!/usr/bin/env python3
"""
Rebuild __seo_type_vlevel from __seo_keywords — canon replacement for
scripts/seo/recalculate_vlevel.py (broken: referenced archived __seo_keywords_clean).

Canon SQL source: governance-vault/ledger/audit-trail/
  2026-04-23-seo-kw-pipeline-cable-frein-main.md §5

Pipeline position:
  1. scripts/insert-missing-keywords.ts --recalc → populates __seo_keywords.v_level
  2. THIS SCRIPT → propagates V2/V3/V4/V5 from __seo_keywords into __seo_type_vlevel
  3. Redis cache invalidation vlevel:{pg_id}:*

Why psycopg2 + port 5432:
  - MCP apply_migration wraps in BEGIN/COMMIT (canon SQL uses no CONCURRENTLY, ok)
  - MCP execute_sql = pooler statement_timeout ≤ 60s (single-gamme UPSERT fits, safer direct)
  - Keeps parity with scripts/db/adr017-create-index-concurrently.py pattern

Usage:
  python3 scripts/seo/rebuild-type-vlevel.py <pg_id> [--dry-run] [--skip-redis]

Exit codes:
  0  success
  2  missing env / bad args
  3  DB error
  4  no keywords with v_level for pg_id (expected dependency on step 1)
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parents[2] / "backend" / ".env"
load_dotenv(ENV_PATH)

PROJECT_REF = "cxpojprgwgubzjyqzmoq"

# Canon UPSERT — verbatim from audit-trail §5 (governance-vault).
# Any edit MUST be mirrored in that doc (single source of truth).
UPSERT_SQL = """
INSERT INTO __seo_type_vlevel (pg_id, type_id, v_level, source, model, energy, confidence, updated_at)
SELECT DISTINCT ON (sk.pg_id, sk.type_id)
  sk.pg_id, sk.type_id, sk.v_level,
  CASE sk.v_level
    WHEN 'V2' THEN 'champion' WHEN 'V3' THEN 'variant'
    WHEN 'V4' THEN 'catalog'  WHEN 'V5' THEN 'sibling'
  END,
  sk.model,
  NULLIF(sk.energy, 'unknown'),
  CASE WHEN sk.volume > 0 THEN 0.90 ELSE NULL END,
  now()
FROM __seo_keywords sk
WHERE sk.pg_id = %(pg_id)s
  AND sk.type_id IS NOT NULL
  AND sk.v_level IN ('V2','V3','V4','V5')
ORDER BY sk.pg_id, sk.type_id,
  CASE sk.v_level WHEN 'V2' THEN 1 WHEN 'V3' THEN 2 WHEN 'V4' THEN 3 WHEN 'V5' THEN 4 END,
  sk.volume DESC
ON CONFLICT (pg_id, type_id) DO UPDATE SET
  v_level    = EXCLUDED.v_level,
  source     = EXCLUDED.source,
  model      = EXCLUDED.model,
  energy     = EXCLUDED.energy,
  confidence = EXCLUDED.confidence,
  updated_at = EXCLUDED.updated_at
"""

PRE_CHECK_SQL = """
SELECT
  COUNT(*) FILTER (WHERE v_level = 'V2') AS v2,
  COUNT(*) FILTER (WHERE v_level = 'V3') AS v3,
  COUNT(*) FILTER (WHERE v_level = 'V4') AS v4,
  COUNT(*) FILTER (WHERE v_level = 'V5') AS v5,
  COUNT(*) FILTER (WHERE v_level IS NULL) AS no_level,
  COUNT(DISTINCT type_id) FILTER (WHERE v_level IN ('V2','V3','V4','V5')) AS distinct_type_ids
FROM __seo_keywords
WHERE pg_id = %(pg_id)s
  AND type_id IS NOT NULL
"""

POST_CHECK_SQL = """
SELECT
  COUNT(*) FILTER (WHERE v_level = 'V2') AS v2,
  COUNT(*) FILTER (WHERE v_level = 'V3') AS v3,
  COUNT(*) FILTER (WHERE v_level = 'V4') AS v4,
  COUNT(*) FILTER (WHERE v_level = 'V5') AS v5,
  COUNT(*) AS total,
  AVG(confidence) FILTER (WHERE confidence IS NOT NULL) AS avg_conf,
  MAX(updated_at) AS newest
FROM __seo_type_vlevel
WHERE pg_id = %(pg_id)s
"""

ORPHAN_CHECK_SQL = """
SELECT COUNT(*)
FROM __seo_keywords sk
LEFT JOIN __seo_type_vlevel tv
  ON tv.pg_id = sk.pg_id AND tv.type_id = sk.type_id
WHERE sk.pg_id = %(pg_id)s
  AND sk.type_id IS NOT NULL
  AND sk.v_level IN ('V2','V3','V4','V5')
  AND tv.pg_id IS NULL
"""


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
        f"application_name=rebuild-type-vlevel"
    )


def rebuild(pg_id: int, dry_run: bool) -> dict:
    conn = psycopg2.connect(build_dsn())
    try:
        with conn.cursor() as cur:
            cur.execute(PRE_CHECK_SQL, {"pg_id": pg_id})
            pre = cur.fetchone()
            if pre is None:
                log(f"pre-check returned no rows for pg_id={pg_id}")
                sys.exit(3)
            v2, v3, v4, v5, no_level, distinct_type_ids = pre
            log(
                f"__seo_keywords pg_id={pg_id}: V2={v2} V3={v3} V4={v4} V5={v5} "
                f"(no_level={no_level}, distinct type_ids={distinct_type_ids})"
            )
            classified = v2 + v3 + v4 + v5
            if classified == 0:
                log(
                    f"[FAIL] pg_id={pg_id} has 0 keywords with v_level set — "
                    f"run `scripts/insert-missing-keywords.ts --recalc` first"
                )
                sys.exit(4)

            if dry_run:
                log(
                    f"[DRY-RUN] would UPSERT {distinct_type_ids} row(s) into __seo_type_vlevel "
                    f"(one per distinct type_id; {classified} classified KW dedup'd via DISTINCT ON)"
                )
                conn.rollback()
                return {
                    "dry_run": True,
                    "would_upsert": distinct_type_ids,
                    "classified_kw": classified,
                }

            log(f"UPSERT → __seo_type_vlevel (scope pg_id={pg_id})")
            cur.execute(UPSERT_SQL, {"pg_id": pg_id})
            affected = cur.rowcount
            log(f"  affected rows: {affected}")

            cur.execute(ORPHAN_CHECK_SQL, {"pg_id": pg_id})
            orphans = cur.fetchone()[0]
            if orphans != 0:
                log(f"[WARN] {orphans} keywords without matching __seo_type_vlevel row")

            cur.execute(POST_CHECK_SQL, {"pg_id": pg_id})
            post = cur.fetchone()
            pv2, pv3, pv4, pv5, total, avg_conf, newest = post
            log(
                f"__seo_type_vlevel pg_id={pg_id}: V2={pv2} V3={pv3} V4={pv4} V5={pv5} "
                f"total={total} avg_confidence={avg_conf or 0:.2f} newest={newest}"
            )

        conn.commit()
        return {
            "dry_run": False,
            "affected": affected,
            "orphans_remaining": orphans,
            "total_rows": total,
            "distribution": {"V2": pv2, "V3": pv3, "V4": pv4, "V5": pv5},
            "avg_confidence": float(avg_conf) if avg_conf is not None else None,
            "newest": str(newest) if newest is not None else None,
        }
    except Exception as err:
        conn.rollback()
        log(f"[FATAL] DB error: {err}")
        raise
    finally:
        conn.close()


def invalidate_redis(pg_id: int) -> int:
    """Delete vlevel:{pg_id}:* keys. Returns count deleted, or -1 if skipped."""
    redis_url = os.environ.get("REDIS_URL")
    if not redis_url:
        log("[SKIP] REDIS_URL not set — cache invalidation skipped")
        return -1
    try:
        import redis  # type: ignore
    except ImportError:
        log("[SKIP] redis-py not installed (pip install redis) — cache invalidation skipped")
        return -1

    client = redis.from_url(redis_url, socket_timeout=5)
    pattern = f"vlevel:{pg_id}:*"
    deleted = 0
    try:
        for key in client.scan_iter(match=pattern, count=500):
            client.delete(key)
            deleted += 1
        log(f"invalidated {deleted} Redis key(s) matching {pattern}")
    except Exception as err:
        log(f"[WARN] Redis invalidation failed ({err}) — non-blocking")
        return -1
    finally:
        try:
            client.close()
        except Exception:
            pass
    return deleted


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Rebuild __seo_type_vlevel from __seo_keywords (canon replacement for recalculate_vlevel.py)"
    )
    ap.add_argument("pg_id", type=int, help="gamme pg_id")
    ap.add_argument("--dry-run", action="store_true", help="show counts, no write")
    ap.add_argument("--skip-redis", action="store_true", help="skip Redis cache invalidation")
    args = ap.parse_args()

    log(
        f"rebuild-type-vlevel pg_id={args.pg_id} "
        f"(dry_run={args.dry_run}, skip_redis={args.skip_redis})"
    )
    result = rebuild(args.pg_id, dry_run=args.dry_run)

    if args.dry_run:
        log("[DONE] dry-run (no write, no cache invalidation)")
        return 0

    if not args.skip_redis:
        invalidate_redis(args.pg_id)

    log(
        f"[DONE] pg_id={args.pg_id} "
        f"V2={result['distribution']['V2']} V3={result['distribution']['V3']} "
        f"V4={result['distribution']['V4']} V5={result['distribution']['V5']} "
        f"total={result['total_rows']}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
