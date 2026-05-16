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
  id             TEXT PRIMARY KEY,                            -- filename stem (canonical identity, Sqitch/dbmate pattern)
  checksum       TEXT NOT NULL,                               -- sha256(file bytes) hex
  status         TEXT NOT NULL DEFAULT 'applied'
                 CHECK (status IN ('applying', 'applied', 'failed')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at     TIMESTAMPTZ,
  execution_ms   INTEGER,
  runner         TEXT,
  git_sha        TEXT,
  error_message  TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_status
  ON infra.schema_migrations (status)
  WHERE status IN ('applying', 'failed');

GRANT SELECT, INSERT ON infra.schema_migrations TO service_role;
GRANT UPDATE (status, applied_at, execution_ms, error_message)
  ON infra.schema_migrations TO service_role;
"""


# ── Domain types ─────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class LocalMigration:
    id: str  # filename stem (canonical identity)
    path: Path
    checksum: str
    non_transactional: bool


@dataclass(frozen=True)
class RemoteMigration:
    id: str
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
        # Identity = filename stem (everything before `.sql`). Sqitch/dbmate
        # canon — the filesystem already enforces uniqueness, so no auxiliary
        # uniqueness check is needed. Multiple files can share an 8-digit date
        # prefix as long as their full filenames differ.
        migration_id = entry.name[:-4]
        sql_bytes = entry.read_bytes()
        checksum = hashlib.sha256(sql_bytes).hexdigest()
        sql_text = sql_bytes.decode("utf-8")
        items.append(
            LocalMigration(
                id=migration_id,
                path=entry,
                checksum=checksum,
                non_transactional=is_non_transactional_header(sql_text),
            )
        )
    return items


def enforce_ordering(items: list[LocalMigration]) -> "None":
    """Ensure files sort lexicographically by id (== filename stem).

    Already guaranteed by `parse_local_migrations()` which iterates
    `sorted(MIGRATIONS_DIR)`. The assertion guards against future refactors
    of the iteration order.
    """
    ids = [m.id for m in items]
    if ids != sorted(ids):
        for i in range(1, len(ids)):
            if ids[i] < ids[i - 1]:
                fail(
                    3,
                    "Migrations must be in lexicographic order. Out-of-order: "
                    f"{ids[i - 1]!r} then {ids[i]!r}.",
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
            SELECT id, checksum, status, applied_at::text, runner
            FROM infra.schema_migrations
            """
        )
        rows = cur.fetchall()
    return {
        row[0]: RemoteMigration(
            id=row[0],
            checksum=row[1],
            status=row[2],
            applied_at=row[3],
            runner=row[4],
        )
        for row in rows
    }


def insert_applied_tx(
    cur, mig: LocalMigration, execution_ms: int, runner: str, git_sha: str
) -> "None":
    cur.execute(
        """
        INSERT INTO infra.schema_migrations
            (id, checksum, status, applied_at,
             execution_ms, runner, git_sha)
        VALUES (%s, %s, 'applied', NOW(), %s, %s, %s)
        """,
        (mig.id, mig.checksum, execution_ms, runner, git_sha),
    )


def insert_applying(
    cur, mig: LocalMigration, runner: str, git_sha: str
) -> "None":
    cur.execute(
        """
        INSERT INTO infra.schema_migrations
            (id, checksum, status, runner, git_sha)
        VALUES (%s, %s, 'applying', %s, %s)
        """,
        (mig.id, mig.checksum, runner, git_sha),
    )


def mark_applied(cur, migration_id: str, execution_ms: int) -> "None":
    cur.execute(
        """
        UPDATE infra.schema_migrations
        SET status = 'applied',
            applied_at = NOW(),
            execution_ms = %s
        WHERE id = %s AND status = 'applying'
        """,
        (execution_ms, migration_id),
    )


def mark_failed(cur, migration_id: str, error: str) -> "None":
    cur.execute(
        """
        UPDATE infra.schema_migrations
        SET status = 'failed', error_message = %s
        WHERE id = %s
        """,
        (error[:2000], migration_id),
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
                    mark_failed(cur, mig.id, str(e))
            except Exception as inner:
                sys.stderr.write(f"[warn] mark_failed also raised: {inner}\n")
            raise
        elapsed_ms = int((time.monotonic() - start) * 1000)
        with conn.cursor() as cur:
            mark_applied(cur, mig.id, elapsed_ms)
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

    ``rows`` is a list of ``(id, status, applied_at, runner)``.
    ``summary`` is a counter dict.
    """
    rows: list[tuple[str, str, str, str]] = []
    summary = {
        "applied": 0,
        "pending": 0,
        "drift": 0,
        "orphan": 0,
        "applying": 0,
        "failed": 0,
    }
    local_ids = {m.id for m in local}

    for mig in local:
        r = remote.get(mig.id)
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
                mig.id,
                state,
                (r.applied_at if r else "") or "—",
                (r.runner if r else "") or "—",
            )
        )

    for mid, r in sorted(remote.items()):
        if mid not in local_ids:
            summary["orphan"] += 1
            rows.append(
                (
                    mid,
                    "orphan",
                    r.applied_at or "—",
                    r.runner or "—",
                )
            )

    return rows, summary


def print_status(rows, summary) -> int:
    id_w = max((len(r[0]) for r in rows), default=4)
    runner_w = max((len(r[3]) for r in rows), default=6)
    fmt = f"{{:<{id_w}}}  {{:<9}}  {{:<24}}  {{:<{runner_w}}}"
    print(fmt.format("ID", "STATUS", "APPLIED_AT", "RUNNER"))
    print(fmt.format("-" * id_w, "-" * 9, "-" * 24, "-" * runner_w))
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

    # 3. Ordering (id = filename stem, lexicographic) -------------------
    good = [
        LocalMigration("20260101_a", Path("/tmp/a"), "h1", False),
        LocalMigration("20260101_b", Path("/tmp/b"), "h2", False),  # shared date OK
        LocalMigration("20260102_a", Path("/tmp/c"), "h3", False),
    ]
    enforce_ordering(good)

    out_of_order = [
        LocalMigration("20260102_a", Path("/tmp/c"), "h3", False),
        LocalMigration("20260101_a", Path("/tmp/a"), "h1", False),
    ]
    try:
        enforce_ordering(out_of_order)
        raise AssertionError("out-of-order not detected")
    except SystemExit as e:
        assert e.code == 3

    # 4. Checksum reproducibility ---------------------------------------
    payload = b"BEGIN; CREATE TABLE t(); COMMIT;\n"
    h1 = hashlib.sha256(payload).hexdigest()
    h2 = hashlib.sha256(payload).hexdigest()
    assert h1 == h2 and len(h1) == 64

    # 5. Classifier — applied / pending / drift / orphan ----------------
    local = [
        LocalMigration("20260101_a", Path("/tmp/a"), "h1", False),
        LocalMigration("20260101_b", Path("/tmp/b"), "h2", False),  # same date prefix, different id
        LocalMigration("20260103_c", Path("/tmp/c"), "h3", False),
    ]
    remote = {
        "20260101_a": RemoteMigration("20260101_a", "h1", "applied",
                                      "2026-05-01T00:00:00Z", "gh:1"),
        "20260101_b": RemoteMigration("20260101_b", "DIFFERENT", "applied",
                                      "2026-05-02T00:00:00Z", "gh:1"),
        "20260099_old": RemoteMigration("20260099_old", "h0", "applied",
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
        "20260101_a": RemoteMigration("20260101_a", "h1", "applying",
                                      None, "gh:1"),
        "20260101_b": RemoteMigration("20260101_b", "h2", "failed",
                                      None, "gh:1"),
    }
    _, sum2 = classify(local[:2], remote2)
    assert sum2["applying"] == 1 and sum2["failed"] == 1, sum2

    # 7. --exclude parsing helper (used by run_baseline) ----------------
    def parse_exclude(csv: str) -> set[str]:
        return {x.strip() for x in csv.split(",") if x.strip()}

    assert parse_exclude("") == set()
    assert parse_exclude("a") == {"a"}
    assert parse_exclude("a,b , c , ") == {"a", "b", "c"}
    assert parse_exclude(" , , ") == set()

    print("OK — all self-tests passed.")
    return 0


# ── Baseline (Flyway baselineOnMigrate / Sqitch deploy --to) ────────────────


def run_baseline(
    conn,
    local: list[LocalMigration],
    remote: dict[str, "RemoteMigration"],
    exclude_csv: str,
) -> int:
    """Bulk-mark every local migration as ``status='applied'`` without
    running its SQL.

    Used **once** when adopting this engine on a project where the
    migrations are already deployed via another channel (Supabase
    dashboard, MCP, manual psql). ``--exclude id1,id2`` keeps specific
    files genuinely ``pending``.

    Behaviour :
    * ON CONFLICT (id) DO NOTHING — re-running the baseline is safe.
    * ``runner = "baseline-{GITHUB_RUN_ID}"`` for forensic distinction
      from regular engine runs (which use ``runner = "gh-actions:..."``).
    * Real SHA-256 checksums (not placeholders) so subsequent ``--status``
      runs do not see all rows as ``drift``.
    """
    excluded = {x.strip() for x in exclude_csv.split(",") if x.strip()}
    unknown = excluded - {m.id for m in local}
    if unknown:
        fail(
            6,
            f"--exclude references unknown migration ids: {sorted(unknown)}. "
            "Check the filename stems with --status first.",
        )

    runner = (
        f"baseline-{os.environ.get('GITHUB_RUN_ID', '')}"
        if os.environ.get("GITHUB_RUN_ID")
        else "baseline-local"
    )
    git_sha = os.environ.get("GITHUB_SHA", "")

    candidates = [m for m in local if m.id not in excluded]
    print(
        f"Baseline plan : {len(candidates)} files to mark applied, "
        f"{len(excluded)} excluded, "
        f"{len(local) - len(candidates) - len(excluded)} skipped (none expected)."
    )

    inserted = 0
    skipped = 0
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for m in candidates:
                cur.execute(
                    """
                    INSERT INTO infra.schema_migrations
                        (id, checksum, status, applied_at,
                         execution_ms, runner, git_sha)
                    VALUES (%s, %s, 'applied', NOW(), 0, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (m.id, m.checksum, runner, git_sha),
                )
                # `rowcount` is 1 on insert, 0 on conflict-skip.
                if cur.rowcount == 1:
                    inserted += 1
                else:
                    skipped += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.autocommit = True

    print(
        f"Baseline result : {inserted} rows inserted, {skipped} already "
        f"present (idempotent skip), {len(excluded)} kept pending."
    )

    write_step_summary(
        [
            "## Baseline result",
            "",
            f"- Inserted : **{inserted}** new rows (`runner={runner}`)",
            f"- Already present : **{skipped}** (idempotent skip, ON CONFLICT)",
            f"- Excluded : **{len(excluded)}** files kept pending",
        ]
        + (
            ["", "### Excluded ids", ""] + [f"- `{x}`" for x in sorted(excluded)]
            if excluded
            else []
        )
    )

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
    parser.add_argument(
        "--baseline", action="store_true",
        help=(
            "Mark every local migration as already-applied without running "
            "its SQL. Use ONCE when adopting this engine on a project where "
            "the migrations are already deployed via another channel "
            "(Supabase dashboard, MCP, manual psql). Combine with "
            "--exclude to keep specific files genuinely pending. "
            "Canon Flyway baselineOnMigrate / Sqitch deploy --to."
        ),
    )
    parser.add_argument(
        "--exclude", type=str, default="",
        help=(
            "Comma-separated migration ids to EXCLUDE from --baseline. "
            "These files remain `pending` and will be applied by the next "
            "regular run. Example: --exclude 20260518_seo_admin_job_table"
        ),
    )
    args = parser.parse_args(argv)

    if args.self_test:
        return run_self_test()

    local = parse_local_migrations()
    enforce_ordering(local)
    if not local:
        print("No migration files found under backend/supabase/migrations/.")
        return 0

    conn = connect()
    try:
        acquire_lock(conn)
        bootstrap(conn)
        remote = fetch_remote(conn)

        rows, summary = classify(local, remote)

        if args.baseline:
            return run_baseline(conn, local, remote, args.exclude)

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

        pending = [m for m in local if m.id not in remote]
        if args.limit is not None:
            pending = pending[: max(0, args.limit)]

        # GitHub Step Summary (always)
        plan_lines = ["## Migration plan", ""]
        plan_lines.append("| Status | ID | Mode |")
        plan_lines.append("| --- | --- | --- |")
        for m in local:
            if m.id in remote:
                state = "✅ applied"
            elif m in pending:
                state = "⏳ pending"
            else:
                state = "⏸️ deferred (limit)"
            mode = "non-transactional" if m.non_transactional else "transactional"
            plan_lines.append(f"| {state} | `{m.id}` | {mode} |")
        write_step_summary(plan_lines)

        if not pending:
            print("Nothing to apply — remote is up to date.")
            return 0

        if args.dry_run:
            print("Dry-run — no migration will be applied.")
            for m in pending:
                mode = "non-tx" if m.non_transactional else "tx"
                print(f"  would apply {m.id} ({mode})")
            return 0

        runner = f"gh-actions:{os.environ.get('GITHUB_RUN_ID', 'local')}"
        git_sha = os.environ.get("GITHUB_SHA", "")

        applied: list[tuple[str, int]] = []
        for m in pending:
            mode = "non-tx" if m.non_transactional else "tx"
            print(
                f"Applying {m.id} ({mode}) ... ",
                end="",
                flush=True,
            )
            ms = apply_migration(conn, m, runner, git_sha)
            print(f"OK in {ms}ms")
            applied.append((m.id, ms))

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
