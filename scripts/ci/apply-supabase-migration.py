#!/usr/bin/env python3
"""
Mini migration engine for Supabase / vanilla Postgres.

Industry-standard pattern (Flyway / Sqitch / dbmate / golang-migrate forward-only).
Replaces the Supabase Management REST API path that depended on a stale PAT
and was vendor-coupled to `supabase_migrations.schema_migrations`.

Architecture
============

- Driver           : ``psycopg[binary]`` (single persistent connection).
- Connection input : ``DATABASE_URL`` env var (libpq URI).
- Tracking table   : ``infra.schema_migrations`` (owned by this project).
- Concurrency      : ``pg_try_advisory_lock(88442211)`` — fail-fast.
- Transactionality : default is BEGIN/COMMIT wrap; opt-out via header marker
                     ``-- @non_transactional`` (e.g. CREATE INDEX CONCURRENTLY).
- Idempotency      : SHA-256 of file bytes stored; mismatch = HARD FAIL (drift).
- State machine    : applying → applied | failed. Crash-safe.
- Forward-only     : ``.down.sql`` files are ignored by the runner. Corrections
                     ship as a new migration with a later version.

CLI
===

    python3 apply-supabase-migration.py --self-test
    python3 apply-supabase-migration.py --status
    python3 apply-supabase-migration.py --dry-run
    python3 apply-supabase-migration.py [--limit N]

Env vars consumed
=================

- ``DATABASE_URL``  required at runtime (not for ``--self-test``).
- ``GITHUB_RUN_ID`` optional (recorded as ``runner``).
- ``GITHUB_SHA``    optional (recorded as ``git_sha``).
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# Imported lazily inside ``connect()`` so ``--self-test`` works without psycopg.
psycopg = None  # populated by _import_psycopg()


# ── Constants ────────────────────────────────────────────────────────────────

LOCK_KEY = 88442211  # immutable project-wide advisory lock key
MIGRATIONS_DIR = Path("backend/supabase/migrations")
MIGRATION_FILE_RE = re.compile(r"^(\d{8}|\d{14})_([a-z0-9_]+)\.sql$")
NON_TX_MARKER_RE = re.compile(r"^\s*--\s*@non_transactional\s*$", re.MULTILINE)
NON_TX_MARKER_HEADER_LINES = 20

BOOTSTRAP_SQL = """
CREATE SCHEMA IF NOT EXISTS infra;

CREATE TABLE IF NOT EXISTS infra.schema_migrations (
  version        TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  checksum       TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'applied'
                 CHECK (status IN ('applying', 'applied', 'failed')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at     TIMESTAMPTZ,
  execution_ms   INTEGER,
  runner         TEXT,
  git_sha        TEXT,
  error_message  TEXT
);

GRANT SELECT, INSERT ON infra.schema_migrations TO service_role;
GRANT UPDATE (status, applied_at, execution_ms, error_message)
  ON infra.schema_migrations TO service_role;
"""


# ── Domain types ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class LocalMigration:
    version: str
    name: str
    path: Path
    checksum: str
    non_transactional: bool


@dataclass(frozen=True)
class RemoteMigration:
    version: str
    name: str
    checksum: str
    status: str  # 'applying' | 'applied' | 'failed'
    applied_at: str | None
    runner: str | None


# ── Helpers ──────────────────────────────────────────────────────────────────


def fail(code: int, msg: str) -> "None":
    sys.stderr.write(f"[apply-supabase-migration] {msg}\n")
    sys.exit(code)


def _import_psycopg() -> "None":
    global psycopg
    if psycopg is None:
        import psycopg as _pg  # type: ignore

        psycopg = _pg


def is_non_transactional_header(sql: str) -> bool:
    """Detect the explicit ``-- @non_transactional`` marker in the file header.

    Why a marker (not a regex SQL parser): comment / dollar-quote / PL/pgSQL
    bodies fool regex-based detection of ``CREATE INDEX CONCURRENTLY``,
    leading to false positives or negatives. The marker is deterministic,
    reviewable, and compatible with every Postgres dialect.
    """
    head = "\n".join(sql.splitlines()[:NON_TX_MARKER_HEADER_LINES])
    return bool(NON_TX_MARKER_RE.search(head))


def parse_local_migrations() -> list[LocalMigration]:
    if not MIGRATIONS_DIR.is_dir():
        fail(2, f"migrations directory not found: {MIGRATIONS_DIR}")
    items: list[LocalMigration] = []
    for entry in sorted(MIGRATIONS_DIR.iterdir()):
        if not entry.is_file() or entry.suffix != ".sql":
            continue
        if entry.name.endswith(".down.sql"):
            continue  # forward-only canon
        match = MIGRATION_FILE_RE.match(entry.name)
        if not match:
            sys.stderr.write(
                f"[warn] skipping non-matching filename: {entry.name}\n"
            )
            continue
        version, name = match.group(1), match.group(2)
        sql_bytes = entry.read_bytes()
        checksum = hashlib.sha256(sql_bytes).hexdigest()
        sql_text = sql_bytes.decode("utf-8")
        items.append(
            LocalMigration(
                version=version,
                name=name,
                path=entry,
                checksum=checksum,
                non_transactional=is_non_transactional_header(sql_text),
            )
        )
    return items


def enforce_ordering_and_uniqueness(items: list[LocalMigration]) -> "None":
    versions = [m.version for m in items]
    if versions != sorted(versions):
        for i in range(1, len(versions)):
            if versions[i] < versions[i - 1]:
                fail(
                    3,
                    "Migrations must be in lexicographic order. Out-of-order: "
                    f"{versions[i - 1]!r} then {versions[i]!r}.",
                )
    seen: dict[str, int] = {}
    for v in versions:
        seen[v] = seen.get(v, 0) + 1
    dupes = sorted(v for v, count in seen.items() if count > 1)
    if dupes:
        fail(
            3,
            f"Duplicate version prefixes detected: {dupes}. "
            "Rename one of them with a later timestamp.",
        )


# ── Database operations ──────────────────────────────────────────────────────


def connect():
    _import_psycopg()
    url = os.environ.get("DATABASE_URL")
    if not url:
        fail(2, "DATABASE_URL env var missing.")
    return psycopg.connect(url, autocommit=True)


def acquire_lock(conn) -> "None":
    with conn.cursor() as cur:
        cur.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_KEY,))
        acquired = cur.fetchone()[0]
    if not acquired:
        fail(
            4,
            f"Another migration run is in progress "
            f"(pg_advisory_lock {LOCK_KEY} held). "
            "Wait for it to finish or check the Actions tab. "
            "CI fails fast rather than blocking the runner.",
        )


def release_lock(conn) -> "None":
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_unlock(%s)", (LOCK_KEY,))
    except Exception as e:
        sys.stderr.write(f"[warn] pg_advisory_unlock failed: {e}\n")


def bootstrap(conn) -> "None":
    with conn.cursor() as cur:
        cur.execute(BOOTSTRAP_SQL)


def fetch_remote(conn) -> dict[str, RemoteMigration]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT version, name, checksum, status,
                   applied_at::text, runner
            FROM infra.schema_migrations
            """
        )
        rows = cur.fetchall()
    return {
        row[0]: RemoteMigration(
            version=row[0],
            name=row[1],
            checksum=row[2],
            status=row[3],
            applied_at=row[4],
            runner=row[5],
        )
        for row in rows
    }


def insert_applied_tx(
    cur, mig: LocalMigration, execution_ms: int, runner: str, git_sha: str
) -> "None":
    cur.execute(
        """
        INSERT INTO infra.schema_migrations
            (version, name, checksum, status, applied_at,
             execution_ms, runner, git_sha)
        VALUES (%s, %s, %s, 'applied', NOW(), %s, %s, %s)
        """,
        (mig.version, mig.name, mig.checksum, execution_ms, runner, git_sha),
    )


def insert_applying(
    cur, mig: LocalMigration, runner: str, git_sha: str
) -> "None":
    cur.execute(
        """
        INSERT INTO infra.schema_migrations
            (version, name, checksum, status, runner, git_sha)
        VALUES (%s, %s, %s, 'applying', %s, %s)
        """,
        (mig.version, mig.name, mig.checksum, runner, git_sha),
    )


def mark_applied(cur, version: str, execution_ms: int) -> "None":
    cur.execute(
        """
        UPDATE infra.schema_migrations
        SET status = 'applied',
            applied_at = NOW(),
            execution_ms = %s
        WHERE version = %s AND status = 'applying'
        """,
        (execution_ms, version),
    )


def mark_failed(cur, version: str, error: str) -> "None":
    cur.execute(
        """
        UPDATE infra.schema_migrations
        SET status = 'failed', error_message = %s
        WHERE version = %s
        """,
        (error[:2000], version),
    )


def apply_migration(
    conn, mig: LocalMigration, runner: str, git_sha: str
) -> int:
    """Apply one migration. Returns elapsed ms. Raises on failure."""
    sql = mig.path.read_text(encoding="utf-8")
    start = time.monotonic()

    if mig.non_transactional:
        # Two-phase tracking : insert 'applying' row, run migration in
        # autocommit, then UPDATE to 'applied'. Crash leaves a visible row
        # the next run will refuse to overwrite (Case D in the verify flow).
        conn.autocommit = True
        with conn.cursor() as cur:
            insert_applying(cur, mig, runner, git_sha)
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
        except Exception as e:
            try:
                with conn.cursor() as cur:
                    mark_failed(cur, mig.version, str(e))
            except Exception as inner:
                sys.stderr.write(f"[warn] mark_failed also raised: {inner}\n")
            raise
        elapsed_ms = int((time.monotonic() - start) * 1000)
        with conn.cursor() as cur:
            mark_applied(cur, mig.version, elapsed_ms)
        return elapsed_ms

    # Transactional path : atomic apply + insert.
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            elapsed_ms = int((time.monotonic() - start) * 1000)
            insert_applied_tx(cur, mig, elapsed_ms, runner, git_sha)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.autocommit = True
    return elapsed_ms


# ── Status / plan ────────────────────────────────────────────────────────────


def classify(
    local: list[LocalMigration], remote: dict[str, RemoteMigration]
):
    """Return (rows, summary) for the ``--status`` table.

    ``rows`` is a list of ``(version, name, status, applied_at, runner)``.
    ``summary`` is a counter dict.
    """
    rows: list[tuple[str, str, str, str, str]] = []
    summary = {
        "applied": 0,
        "pending": 0,
        "drift": 0,
        "orphan": 0,
        "applying": 0,
        "failed": 0,
    }
    local_versions = {m.version for m in local}

    for mig in local:
        r = remote.get(mig.version)
        if r is None:
            state = "pending"
        elif r.status == "applying":
            state = "applying"
        elif r.status == "failed":
            state = "failed"
        elif r.checksum != mig.checksum:
            state = "drift"
        else:
            state = "applied"
        summary[state] += 1
        rows.append(
            (
                mig.version,
                mig.name,
                state,
                (r.applied_at if r else "") or "—",
                (r.runner if r else "") or "—",
            )
        )

    for version, r in sorted(remote.items()):
        if version not in local_versions:
            summary["orphan"] += 1
            rows.append(
                (
                    version,
                    r.name,
                    "orphan",
                    r.applied_at or "—",
                    r.runner or "—",
                )
            )

    return rows, summary


def print_status(rows, summary) -> int:
    name_w = max((len(r[1]) for r in rows), default=4)
    runner_w = max((len(r[4]) for r in rows), default=6)
    fmt = f"{{:<14}} {{:<{name_w}}}  {{:<9}} {{:<24}} {{:<{runner_w}}}"
    print(fmt.format("VERSION", "NAME", "STATUS", "APPLIED_AT", "RUNNER"))
    print(fmt.format("-" * 14, "-" * name_w, "-" * 9, "-" * 24, "-" * runner_w))
    for row in rows:
        print(fmt.format(*row))
    print()
    print(
        f"Summary : {summary['applied']} applied, {summary['pending']} pending, "
        f"{summary['drift']} drift, {summary['orphan']} orphan, "
        f"{summary['applying']} applying, {summary['failed']} failed"
    )
    # Exit non-zero on drift / applying / failed; orphans are warnings only.
    blocker = summary["drift"] + summary["applying"] + summary["failed"]
    return 1 if blocker > 0 else 0


def write_step_summary(lines) -> "None":
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        for line in lines:
            fh.write(line + "\n")


# ── Self-tests ───────────────────────────────────────────────────────────────


def run_self_test() -> int:
    # 1. Filename regex --------------------------------------------------
    ok = [
        ("20260518_seo_admin_job_table.sql", "20260518", "seo_admin_job_table"),
        ("20260518110000_seo_admin_job_table.sql", "20260518110000",
         "seo_admin_job_table"),
        ("20260101000000_a.sql", "20260101000000", "a"),
    ]
    for fn, vers, name in ok:
        m = MIGRATION_FILE_RE.match(fn)
        assert m, f"should match {fn!r}"
        assert m.group(1) == vers and m.group(2) == name, fn

    bad = [
        "README.md",
        "no_timestamp.sql",
        "1234_too_short_prefix.sql",            # 4 digits
        "202601011_odd_digits.sql",             # 9 digits
        "20260518_Bad-Name.sql",                # uppercase + dash
        "20260518_name with space.sql",         # space
    ]
    for fn in bad:
        assert not MIGRATION_FILE_RE.match(fn), f"should not match {fn!r}"

    # 2. Non-tx marker --------------------------------------------------
    yes_header = "-- @non_transactional\n\nCREATE INDEX CONCURRENTLY i ON t(c);\n"
    assert is_non_transactional_header(yes_header)

    yes_with_blanks = "\n\n--    @non_transactional   \n-- rest\nSELECT 1;\n"
    assert is_non_transactional_header(yes_with_blanks)

    no_below_header = "\n".join(
        ["-- header line"] * (NON_TX_MARKER_HEADER_LINES + 2)
        + ["-- @non_transactional", "SELECT 1;"]
    )
    assert not is_non_transactional_header(no_below_header), (
        "marker below header lines must be ignored"
    )

    no_inline = "SELECT 1; -- @non_transactional inside an inline comment\n"
    assert not is_non_transactional_header(no_inline), (
        "inline (non-line-start) marker must not trigger"
    )

    no_string = "INSERT INTO t VALUES ('-- @non_transactional');\n"
    assert not is_non_transactional_header(no_string)

    # 3. Ordering / uniqueness ------------------------------------------
    good = [
        LocalMigration("20260101", "a", Path("/tmp/a"), "h1", False),
        LocalMigration("20260102", "b", Path("/tmp/b"), "h2", False),
    ]
    enforce_ordering_and_uniqueness(good)

    dup = [
        LocalMigration("20260101", "a", Path("/tmp/a"), "h1", False),
        LocalMigration("20260101", "b", Path("/tmp/b"), "h2", False),
    ]
    try:
        enforce_ordering_and_uniqueness(dup)
        raise AssertionError("duplicate not detected")
    except SystemExit as e:
        assert e.code == 3

    out_of_order = [
        LocalMigration("20260102", "b", Path("/tmp/b"), "h2", False),
        LocalMigration("20260101", "a", Path("/tmp/a"), "h1", False),
    ]
    try:
        enforce_ordering_and_uniqueness(out_of_order)
        raise AssertionError("out-of-order not detected")
    except SystemExit as e:
        assert e.code == 3

    # 4. Checksum reproducibility ---------------------------------------
    payload = b"BEGIN; CREATE TABLE t(); COMMIT;\n"
    h1 = hashlib.sha256(payload).hexdigest()
    h2 = hashlib.sha256(payload).hexdigest()
    assert h1 == h2 and len(h1) == 64

    # 5. Classifier -----------------------------------------------------
    local = [
        LocalMigration("20260101", "a", Path("/tmp/a"), "h1", False),
        LocalMigration("20260102", "b", Path("/tmp/b"), "h2", False),
        LocalMigration("20260103", "c", Path("/tmp/c"), "h3", False),
    ]
    remote = {
        "20260101": RemoteMigration("20260101", "a", "h1", "applied",
                                    "2026-05-01T00:00:00Z", "gh:1"),
        "20260102": RemoteMigration("20260102", "b", "DIFFERENT", "applied",
                                    "2026-05-02T00:00:00Z", "gh:1"),
        "20260099": RemoteMigration("20260099", "old", "h0", "applied",
                                    "2025-12-01T00:00:00Z", "gh:0"),
    }
    rows, summary = classify(local, remote)
    assert summary["applied"] == 1, summary
    assert summary["pending"] == 1, summary
    assert summary["drift"] == 1, summary
    assert summary["orphan"] == 1, summary
    assert summary["applying"] == 0 and summary["failed"] == 0

    # 6. Classifier — applying + failed ---------------------------------
    remote2 = {
        "20260101": RemoteMigration("20260101", "a", "h1", "applying",
                                    None, "gh:1"),
        "20260102": RemoteMigration("20260102", "b", "h2", "failed",
                                    None, "gh:1"),
    }
    _, sum2 = classify(local[:2], remote2)
    assert sum2["applying"] == 1 and sum2["failed"] == 1, sum2

    print("OK — all self-tests passed.")
    return 0


# ── Main ─────────────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--self-test", action="store_true",
        help="Run in-process unit tests and exit (no DB connection).",
    )
    parser.add_argument(
        "--status", action="store_true",
        help="Print the migration state table and exit. Read-only on the data.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show the apply plan without writing.",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Apply at most N migrations this run (staged rollouts).",
    )
    args = parser.parse_args(argv)

    if args.self_test:
        return run_self_test()

    local = parse_local_migrations()
    enforce_ordering_and_uniqueness(local)
    if not local:
        print("No migration files found under backend/supabase/migrations/.")
        return 0

    conn = connect()
    try:
        acquire_lock(conn)
        bootstrap(conn)
        remote = fetch_remote(conn)

        rows, summary = classify(local, remote)

        if args.status:
            return print_status(rows, summary)

        # Refuse to proceed when blockers exist.
        if summary["drift"] or summary["applying"] or summary["failed"]:
            print_status(rows, summary)
            fail(
                5,
                f"Blockers present (drift={summary['drift']}, "
                f"applying={summary['applying']}, "
                f"failed={summary['failed']}). Resolve before applying.",
            )

        pending = [m for m in local if m.version not in remote]
        if args.limit is not None:
            pending = pending[: max(0, args.limit)]

        # GitHub Step Summary (always)
        plan_lines = ["## Migration plan", ""]
        plan_lines.append("| Status | Version | Name | Mode |")
        plan_lines.append("| --- | --- | --- | --- |")
        for m in local:
            if m.version in remote:
                state = "✅ applied"
            elif m in pending:
                state = "⏳ pending"
            else:
                state = "⏸️ deferred (limit)"
            mode = "non-transactional" if m.non_transactional else "transactional"
            plan_lines.append(
                f"| {state} | `{m.version}` | `{m.name}` | {mode} |"
            )
        write_step_summary(plan_lines)

        if not pending:
            print("Nothing to apply — remote is up to date.")
            return 0

        if args.dry_run:
            print("Dry-run — no migration will be applied.")
            for m in pending:
                mode = "non-tx" if m.non_transactional else "tx"
                print(f"  would apply {m.version}_{m.name} ({mode})")
            return 0

        runner = f"gh-actions:{os.environ.get('GITHUB_RUN_ID', 'local')}"
        git_sha = os.environ.get("GITHUB_SHA", "")

        applied: list[tuple[str, int]] = []
        for m in pending:
            mode = "non-tx" if m.non_transactional else "tx"
            print(
                f"Applying {m.version}_{m.name} ({mode}) ... ",
                end="",
                flush=True,
            )
            ms = apply_migration(conn, m, runner, git_sha)
            print(f"OK in {ms}ms")
            applied.append((f"{m.version}_{m.name}", ms))

        write_step_summary(
            ["", "### Applied this run", ""]
            + [f"- `{name}` ({ms}ms)" for name, ms in applied]
        )
        print(f"Done — {len(applied)} migration(s) applied.")
        return 0
    finally:
        release_lock(conn)
        conn.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
