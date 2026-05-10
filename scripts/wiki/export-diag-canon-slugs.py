#!/usr/bin/env python3
"""export-diag-canon-slugs.py — ADR-033 §"Phase 3" nightly export of canon
__diag_symptom slugs from production DB to automecanik-wiki/exports/.

Uses Supabase REST API (PostgREST) via stdlib urllib.request — no external
deps, no `SUPABASE_DB_PASSWORD` secret to provision (reuses existing
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` already in monorepo CI secrets).

Output : deterministic JSON (sorted keys, 2-space indent, trailing newline)
to make idempotence trivial — workflow only commits if content actually
differs from current wiki HEAD.

**Plan humble-cuddling-scott P3 (closing)** — ce script émet uniquement les
DEUX artefacts de DONNÉES (data only). Le JSON Schema dérivé est généré par
un step TS dédié en aval (`scripts/wiki/print-diag-canon-jsonschema.ts`),
qui dérive depuis le canon Zod TS source-of-truth
`backend/src/config/diag-canon.schema.ts` via la lib `zod-to-json-schema`.

Cette séparation supprime un précédent bricolage où la forme était codée
deux fois (Python `build_flat_schema()` + Zod TS) — single SoT respecté.

1. `automecanik-wiki/exports/diag-canon-slugs.json` (legacy array format,
   conservé en cohabitation pour PR-C historique + tooling existant). Sera
   déprécié post-migration via deprecate-before-rename.

2. `automecanik-wiki/exports/diag-canon.json` (flat map cible, P3) :

   {
     "version": "1.0.0",
     "generated_at": "2026-05-01T02:00:00Z",
     "systems": ["freinage", "filtration", ...],
     "symptoms": {"brake_noise_metallic": "freinage", ...}
   }

   Structure plate (Principe 1 — schema-first, lisible, scalable 62-65
   symptômes). Consommé par validateur composite (validate-gamme-
   diagnostic-relations.py P3) qui peut détecter `system_slug_unknown` et
   `symptom_system_mismatch` en O(1) lookup.

Le 3e artefact `diag-canon.schema.json` est produit par le workflow
`.github/workflows/diag-canon-slugs-export.yml` via un step
`npx tsx scripts/wiki/print-diag-canon-jsonschema.ts` après ce script Python.

Consommateurs :
  - validate-gamme-diagnostic-relations.py (P3 — flat map cible)
  - PR-C validator legacy (consomme diag-canon-slugs.json — transition)
  - wiki-readiness-check.py C3 (vérifie freshness < 7j)

Usage :
  python3 scripts/wiki/export-diag-canon-slugs.py --output-dir /tmp/exports
  python3 scripts/wiki/export-diag-canon-slugs.py --output /tmp/x.json (legacy)
  python3 scripts/wiki/export-diag-canon-slugs.py --output-dir /tmp/x --dry-run

Exit :
  0 — export(s) written
  1 — HTTP/parse error
  2 — config error (missing env var)

Refs :
  - ADR-033 §"Phase 3" vault PR #108 commit 77085ef
  - Plan humble-cuddling-scott §P3 (flat map + composite FK validator)
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
from datetime import datetime, timezone
from pathlib import Path

CANON_VERSION = "1.0.0"


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


def build_flat_map(rows: list[dict], generated_at: str) -> dict:
    """Plan humble-cuddling-scott P3 — flat map cible (Principe 1)."""
    systems = sorted({r["system_slug"] for r in rows if r.get("system_slug")})
    symptoms: dict[str, str] = {}
    for r in rows:
        sym = r.get("symptom_slug")
        sys_slug = r.get("system_slug")
        if sym and sys_slug:
            symptoms[sym] = sys_slug
    return {
        "version": CANON_VERSION,
        "generated_at": generated_at,
        "systems": systems,
        "symptoms": dict(sorted(symptoms.items())),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--output-dir", help="Directory to write data export files (P3 cible: legacy + flat map). The JSON Schema is generated by a downstream TS step (`npx tsx scripts/wiki/print-diag-canon-jsonschema.ts`).")
    g.add_argument("--output", help="Legacy: path for diag-canon-slugs.json (kept for compat, deprecated)")
    ap.add_argument("--dry-run", action="store_true", help="Fetch + log row count, do NOT write file(s)")
    args = ap.parse_args()

    supabase_url, service_role_key = get_supabase_config()
    rows = fetch_canon_slugs(supabase_url, service_role_key)
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    legacy_payload = serialize_canonical(rows)
    flat_map = build_flat_map(rows, generated_at)
    flat_payload = json.dumps(flat_map, indent=2, sort_keys=True, ensure_ascii=False) + "\n"

    if args.dry_run:
        print(f"[dry-run] {len(rows)} symptoms — would write 2 data files (legacy + flat map). Schema is generated by TS step downstream.")
        print(f"[dry-run] flat map sample: systems={len(flat_map['systems'])}, symptoms={len(flat_map['symptoms'])}")
        if rows:
            print(f"[dry-run] first row sample: {rows[0]}")
        return 0

    if args.output_dir:
        out_dir = Path(args.output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        legacy_path = out_dir / "diag-canon-slugs.json"
        flat_path = out_dir / "diag-canon.json"
    else:
        # Legacy single-output mode (kept for backward compat with PR-D workflow).
        # Emits only the legacy array format. New consumers should use --output-dir.
        legacy_path = Path(args.output)
        flat_path = None

    legacy_path.parent.mkdir(parents=True, exist_ok=True)
    legacy_path.write_text(legacy_payload, encoding="utf-8")
    print(f"[write] {legacy_path} ({len(legacy_payload)} bytes, {len(rows)} symptoms) [legacy]")

    if flat_path is not None:
        flat_path.write_text(flat_payload, encoding="utf-8")
        print(f"[write] {flat_path} ({len(flat_payload)} bytes, {len(flat_map['systems'])} systems, {len(flat_map['symptoms'])} symptoms) [flat map P3]")

    return 0


if __name__ == "__main__":
    sys.exit(main())
