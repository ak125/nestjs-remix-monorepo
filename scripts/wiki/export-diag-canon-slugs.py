#!/usr/bin/env python3
"""export-diag-canon-slugs.py — ADR-033 §"Phase 3" nightly export of canon
__diag_symptom slugs from production DB to automecanik-wiki/exports/.

Uses Supabase REST API (PostgREST) via stdlib urllib.request — no external
deps, no `SUPABASE_DB_PASSWORD` secret to provision (reuses existing
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` already in monorepo CI secrets).

Output : deterministic JSON (sorted keys, 2-space indent, trailing newline)
to make idempotence trivial — workflow only commits if content actually
differs from current wiki HEAD.

The output file `automecanik-wiki/exports/diag-canon-slugs.json` is
consumed by :
  - PR-C validator (scripts/wiki/validate-gamme-diagnostic-relations.py)
  - PR-E migration script (deferred — Partie 3 sync-from-rag)
  - Wiki repo's own _scripts/quality-gates.py (read-only consumer)

Schema of the output JSON :

  [
    {
      "active": true,
      "label": "Grincement aigu au freinage",
      "symptom_slug": "brake_noise_metallic",
      "system_slug": "freinage",
      "urgency": "haute"
    },
    ...
  ]

Usage :
  python3 scripts/wiki/export-diag-canon-slugs.py --output /tmp/diag-canon-slugs.json
  python3 scripts/wiki/export-diag-canon-slugs.py --output /tmp/foo.json --dry-run

Exit :
  0 — export written
  1 — HTTP/parse error
  2 — config error (missing env var)

Refs :
  - ADR-033 §"Phase 3" vault PR #108 commit 77085ef
  - canon DB convention : memory diag-symptom-db-convention.md
  - PostgREST embedded resource : __diag_symptom?select=...,__diag_system(slug)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def get_supabase_config() -> tuple[str, str]:
    """Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env. Both required.

    `.strip()` defensively against trailing whitespace/newlines — secrets
    set from a file or pasted via UI commonly carry a trailing `\\n` that
    `urllib.request` rejects with `InvalidURL: URL can't contain control
    characters` (run `25211636616` confirmed this failure mode).
    """
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url:
        sys.stderr.write("FATAL: SUPABASE_URL missing in env\n")
        sys.exit(2)
    if not key:
        sys.stderr.write("FATAL: SUPABASE_SERVICE_ROLE_KEY missing in env\n")
        sys.exit(2)
    return url, key


# PostgREST embedded resource : __diag_symptom?select=slug,...,__diag_system(slug)
# returns rows with system nested. We flatten in post-processing for the
# canonical output schema (system_slug at top level).
QUERY_PATH = (
    "/rest/v1/__diag_symptom"
    "?select=slug,label,urgency,active,__diag_system(slug)"
    "&active=eq.true"
    "&order=slug.asc"
)


def fetch_canon_slugs(supabase_url: str, service_role_key: str) -> list[dict]:
    """GET via PostgREST embedded resource. service_role bypasses RLS."""
    url = supabase_url + QUERY_PATH
    req = urllib.request.Request(
        url,
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    print(f"[fetch] GET {supabase_url}/rest/v1/__diag_symptom?...&order=slug.asc")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if hasattr(e, "read") else str(e)
        sys.stderr.write(f"FATAL: HTTP {e.code} {e.reason}: {body[:500]}\n")
        sys.exit(1)
    except urllib.error.URLError as e:
        sys.stderr.write(f"FATAL: network error: {e.reason}\n")
        sys.exit(1)

    raw = json.loads(payload)
    if not isinstance(raw, list):
        sys.stderr.write(f"FATAL: PostgREST returned non-array payload: {type(raw)}\n")
        sys.exit(1)

    # Flatten embedded __diag_system into system_slug at top level
    # + rename slug → symptom_slug for output schema clarity
    flattened = []
    for row in raw:
        sys_obj = row.get("__diag_system") or {}
        flattened.append({
            "active": row.get("active"),
            "label": row.get("label"),
            "symptom_slug": row.get("slug"),
            "system_slug": sys_obj.get("slug") if isinstance(sys_obj, dict) else None,
            "urgency": row.get("urgency"),
        })
    print(f"[fetch] {len(flattened)} active __diag_symptom rows")
    return flattened


def serialize_canonical(rows: list[dict]) -> str:
    """Deterministic JSON : sorted keys, indent 2, trailing newline."""
    return json.dumps(rows, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--output", required=True, help="Path to write JSON output")
    ap.add_argument("--dry-run", action="store_true", help="Fetch + log row count, do NOT write file")
    args = ap.parse_args()

    supabase_url, service_role_key = get_supabase_config()
    rows = fetch_canon_slugs(supabase_url, service_role_key)

    out = Path(args.output)
    serialized = serialize_canonical(rows)

    if args.dry_run:
        print(f"[dry-run] would write {len(serialized)} bytes to {out}")
        if rows:
            print(f"[dry-run] first row sample: {rows[0]}")
        return 0

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(serialized, encoding="utf-8")
    print(f"[write] {out} ({len(serialized)} bytes, {len(rows)} symptoms)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
