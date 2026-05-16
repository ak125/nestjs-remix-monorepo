#!/usr/bin/env python3
"""
ADR-072 PR 2D-3 follow-up — Apply Supabase migrations via the Supabase
Management REST API.

No direct Postgres connection. No `supabase` CLI binary. The only
credential is `SUPABASE_ACCESS_TOKEN` (Personal Access Token, scoped via
the Supabase dashboard) — the same path the Supabase MCP server uses,
the same path the dashboard uses internally.

Why REST and not libpq :
  - We do not need (and should not handle) the database password.
  - The Management API records the migration in
    `supabase_migrations.schema_migrations` server-side, identical to
    `supabase db push`.
  - One transport, stdlib `urllib` only — no extra binary to install in
    the runner, no extra secret to mint.

Endpoints (https://api.supabase.com/api/v1) :
  GET  /v1/projects/{ref}/database/migrations
  POST /v1/projects/{ref}/database/migrations          (body: {name, query})

CLI :
  apply-supabase-migration.py --project-ref <ref> [--dry-run] [--limit N]
  apply-supabase-migration.py --self-test

The migrations directory is `backend/supabase/migrations`. Files match
`{14-digit timestamp}_{name}.sql` (Supabase naming convention). The
`{name}` part is what the API receives; the timestamp is the version
key the platform stores.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable

API_BASE = "https://api.supabase.com"
MIGRATIONS_DIR = Path("backend/supabase/migrations")
MIGRATION_FILE_RE = re.compile(r"^(\d{14})_(.+)\.sql$")
SUPABASE_URL_RE = re.compile(
    r"^https?://([a-z0-9-]+)\.supabase\.(co|in|net)/?$",
    re.IGNORECASE,
)


def extract_project_ref_from_url(supabase_url: str) -> str:
    match = SUPABASE_URL_RE.match(supabase_url.strip())
    if not match:
        fail(3, f"SUPABASE_URL is not a recognized Supabase project URL: {supabase_url!r}")
    return match.group(1)


def fail(code: int, msg: str) -> "None":
    sys.stderr.write(f"[apply-supabase-migration] {msg}\n")
    sys.exit(code)


def http_request(
    method: str,
    path: str,
    token: str,
    *,
    body: dict | None = None,
    timeout: int = 60,
) -> tuple[int, dict | list | None]:
    url = f"{API_BASE}{path}"
    data = None
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "User-Agent": "automecanik-apply-supabase-migration/1.0",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = resp.read().decode("utf-8") or "null"
            return resp.status, json.loads(payload)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace") if e.fp else ""
        sys.stderr.write(
            f"[apply-supabase-migration] HTTP {e.code} {method} {path} — {detail}\n"
        )
        return e.code, None
    except urllib.error.URLError as e:
        fail(5, f"network error contacting {url}: {e}")


def parse_local_migrations() -> list[tuple[str, str, Path]]:
    """Return [(version, name, path)] sorted ascending by version."""
    if not MIGRATIONS_DIR.is_dir():
        fail(2, f"migrations directory not found: {MIGRATIONS_DIR}")
    items: list[tuple[str, str, Path]] = []
    for entry in sorted(MIGRATIONS_DIR.iterdir()):
        if not entry.is_file() or entry.suffix != ".sql":
            continue
        if entry.name.endswith(".down.sql"):
            # down migrations are operator-only, never auto-applied
            continue
        match = MIGRATION_FILE_RE.match(entry.name)
        if not match:
            continue
        version, name = match.group(1), match.group(2)
        items.append((version, name, entry))
    return items


def fetch_remote_versions(project_ref: str, token: str) -> set[str]:
    status, payload = http_request(
        "GET", f"/v1/projects/{project_ref}/database/migrations", token
    )
    if status != 200 or not isinstance(payload, list):
        fail(
            6,
            f"failed to list remote migrations (status={status}). The PAT must "
            "have the `read:projects` scope.",
        )
    versions: set[str] = set()
    for entry in payload:
        if isinstance(entry, dict):
            v = entry.get("version") or entry.get("migration_version")
            if isinstance(v, str):
                versions.add(v)
    return versions


def apply_one(
    project_ref: str, token: str, version: str, name: str, sql: str
) -> bool:
    status, _ = http_request(
        "POST",
        f"/v1/projects/{project_ref}/database/migrations",
        token,
        body={"name": f"{version}_{name}", "query": sql},
    )
    return status in (200, 201)


def write_step_summary(lines: Iterable[str]) -> "None":
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if not summary:
        return
    with open(summary, "a", encoding="utf-8") as fh:
        for line in lines:
            fh.write(line + "\n")


def run_self_test() -> int:
    cases_ok = [
        ("20260518110000_seo_admin_job_table.sql", "20260518110000", "seo_admin_job_table"),
        ("20260101000000_a.sql", "20260101000000", "a"),
    ]
    for filename, want_version, want_name in cases_ok:
        m = MIGRATION_FILE_RE.match(filename)
        assert m, f"failed to match {filename!r}"
        assert m.group(1) == want_version
        assert m.group(2) == want_name

    cases_skip = ["README.md", "no_timestamp.sql"]
    for filename in cases_skip:
        m = MIGRATION_FILE_RE.match(filename)
        assert not m, f"should not match: {filename!r}"

    # Project-ref extraction from Supabase URL shape
    url_cases = [
        ("https://abcd1234.supabase.co", "abcd1234"),
        ("https://abcd1234.supabase.co/", "abcd1234"),
        ("HTTPS://abcd1234.supabase.co", "abcd1234"),
    ]
    for url, want in url_cases:
        assert extract_project_ref_from_url(url) == want, f"failed {url!r}"

    sys.stdout.write("OK — all self-tests passed.\n")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-ref", help="Supabase project ref slug.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List pending migrations without applying.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Apply at most N migrations (for staged rollouts).",
    )
    parser.add_argument(
        "--self-test", action="store_true", help="Run in-process self-tests and exit."
    )
    args = parser.parse_args(argv)

    if args.self_test:
        return run_self_test()

    project_ref = (
        args.project_ref
        or os.environ.get("SUPABASE_PROJECT_REF")
    )
    if not project_ref:
        # Fallback : extract from SUPABASE_URL (already a repo secret).
        supabase_url = os.environ.get("SUPABASE_URL")
        if not supabase_url:
            fail(
                2,
                "Cannot resolve project ref. Pass --project-ref, or set "
                "SUPABASE_PROJECT_REF, or set SUPABASE_URL.",
            )
        project_ref = extract_project_ref_from_url(supabase_url)
    token = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if not token:
        fail(2, "SUPABASE_ACCESS_TOKEN env var missing.")

    local = parse_local_migrations()
    remote = fetch_remote_versions(project_ref, token)

    pending = [(v, n, p) for (v, n, p) in local if v not in remote]
    sys.stdout.write(
        f"Local migrations: {len(local)} | already applied: {len(remote)} | "
        f"pending: {len(pending)}\n"
    )

    summary_lines = ["## Migration plan", ""]
    summary_lines.append("| Status | Version | Name |")
    summary_lines.append("| --- | --- | --- |")
    for v, n, _ in local:
        marker = "✅ applied" if v in remote else "⏳ pending"
        summary_lines.append(f"| {marker} | `{v}` | `{n}` |")
    write_step_summary(summary_lines)

    if not pending:
        sys.stdout.write("Nothing to apply — remote is up to date.\n")
        return 0

    if args.limit is not None:
        pending = pending[: max(0, args.limit)]

    if args.dry_run:
        sys.stdout.write("Dry-run — no migration will be applied.\n")
        for v, n, p in pending:
            sys.stdout.write(f"  would apply {v}_{n} ({p})\n")
        return 0

    applied: list[str] = []
    for v, n, p in pending:
        sql = p.read_text(encoding="utf-8")
        sys.stdout.write(f"Applying {v}_{n} ... ")
        sys.stdout.flush()
        if apply_one(project_ref, token, v, n, sql):
            sys.stdout.write("OK\n")
            applied.append(f"{v}_{n}")
        else:
            sys.stdout.write("FAILED\n")
            write_step_summary(
                ["", f"❌ FAILED on `{v}_{n}` — see HTTP log above."]
            )
            return 7

    write_step_summary(["", f"### Applied this run", "", *[f"- `{x}`" for x in applied]])
    sys.stdout.write(f"Done — {len(applied)} migration(s) applied.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
