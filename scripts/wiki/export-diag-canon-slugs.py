#!/usr/bin/env python3
"""export-diag-canon-slugs.py — ADR-033 §"Phase 3" nightly export of canon
__diag_symptom slugs from production DB to automecanik-wiki/exports/.

Queries Supabase Postgres directly (psycopg2, port 5432, non-pooler) for
deterministic results : sorted by symptom_slug, JSON serialization with
sorted keys + 2-space indent + final newline. This guarantees idempotence —
the workflow only commits if the JSON content actually differs from what's
already in the wiki repo.

The output file `automecanik-wiki/exports/diag-canon-slugs.json` is
consumed by :
  - PR-C validator (scripts/wiki/validate-gamme-diagnostic-relations.py)
    to validate `diagnostic_relations[].symptom_slug` FK
  - PR-E migration script (scripts/wiki/migrate-symptoms-to-relations.ts)
    to validate target slugs at migration time
  - Wiki repo's own _scripts/quality-gates.py (read-only consumer)

Schema of the output JSON :

  [
    {
      "symptom_slug": "brake_noise_metallic",
      "system_slug": "freinage",
      "label": "Grincement aigu au freinage",
      "urgency": "haute",
      "active": true
    },
    ...
  ]

Usage :
  python3 scripts/wiki/export-diag-canon-slugs.py --output /tmp/diag-canon-slugs.json
  python3 scripts/wiki/export-diag-canon-slugs.py --output /tmp/foo.json --dry-run

Exit :
  0 — export written
  1 — DB error
  2 — config error (missing env var)

Refs :
  - ADR-033 §"Phase 3" vault PR #108 commit 77085ef
  - canon DB convention : memory diag-symptom-db-convention.md
  - schema __diag_symptom : id, slug, system_id, label, description, signal_mode, urgency, active, created_at
  - schema __diag_system : id, slug, label, ...
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    sys.stderr.write("FATAL: psycopg2 required (pip install psycopg2-binary)\n")
    sys.exit(2)


# ── Configuration ────────────────────────────────────────────────────────────


def get_dsn() -> str:
    password = os.environ.get("SUPABASE_DB_PASSWORD")
    if not password:
        sys.stderr.write("FATAL: SUPABASE_DB_PASSWORD missing in env\n")
        sys.exit(2)
    project_ref = os.environ.get("SUPABASE_PROJECT_REF", "cxpojprgwgubzjyqzmoq")
    return (
        f"host=db.{project_ref}.supabase.co "
        f"port=5432 "
        f"dbname=postgres "
        f"user=postgres "
        f"password={password} "
        f"sslmode=require "
        f"application_name=adr-033-export-diag-canon-slugs"
    )


# ── Query ────────────────────────────────────────────────────────────────────


CANON_QUERY = """
SELECT
    s.slug AS symptom_slug,
    sys.slug AS system_slug,
    s.label,
    s.urgency,
    s.active
FROM public.__diag_symptom s
JOIN public.__diag_system sys ON sys.id = s.system_id
WHERE s.active = true
ORDER BY s.slug ASC
""".strip()


def fetch_canon_slugs() -> list[dict]:
    print("[connect] db.<project>.supabase.co:5432 (direct, non-pooler)")
    with psycopg2.connect(get_dsn(), connect_timeout=10) as conn:
        conn.autocommit = True
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(CANON_QUERY)
            rows = cur.fetchall()
    print(f"[fetch] {len(rows)} active __diag_symptom rows")
    return [dict(r) for r in rows]


# ── Serialization ────────────────────────────────────────────────────────────


def serialize_canonical(rows: list[dict]) -> str:
    """Deterministic JSON : sorted keys, indent 2, trailing newline.

    Sort by symptom_slug ASC at SQL level already, but also sort keys
    inside each row for stability across psycopg2 versions / json libs.
    """
    return json.dumps(rows, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


# ── Main ─────────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--output", required=True, help="Path to write JSON output (e.g. /tmp/diag-canon-slugs.json)")
    ap.add_argument("--dry-run", action="store_true", help="Connect + fetch + log row count, do NOT write file")
    args = ap.parse_args()

    try:
        rows = fetch_canon_slugs()
    except psycopg2.Error as e:
        sys.stderr.write(f"FATAL: DB error: {e}\n")
        return 1

    out = Path(args.output)
    serialized = serialize_canonical(rows)

    if args.dry_run:
        print(f"[dry-run] would write {len(serialized)} bytes to {out}")
        print(f"[dry-run] first row sample: {rows[0] if rows else '(none)'}")
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(serialized, encoding="utf-8")
    print(f"[write] {out} ({len(serialized)} bytes, {len(rows)} symptoms)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
