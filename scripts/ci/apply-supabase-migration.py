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
    python3 apply-supabase-migration.py --lint-markers FILE.sql [FILE.sql ...]
    python3 apply-supabase-migration.py --status
    python3 apply-supabase-migration.py --status --max-pending-age-days 30 \
                                        --no-bootstrap
    python3 apply-supabase-migration.py --dry-run
    python3 apply-supabase-migration.py [--limit N]
    python3 apply-supabase-migration.py --only 20260529_xtr_msg_crm_indexes

Env vars consumed
=================

- ``DATABASE_URL``  required at runtime (not for ``--self-test``).
- ``GITHUB_RUN_ID`` optional (recorded as ``runner``).
- ``GITHUB_SHA``    optional (recorded as ``git_sha``).
"""

from __future__ import annotations

import argparse
import datetime
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

# A5 (plan massdoc 2026-09-02) — reconciliation marker <-> statements.
# Supabase CLI marker : NOT understood by this engine (the file would be
# wrapped in BEGIN/COMMIT). Rejected explicitly so the mistake is loud.
LEGACY_SUPABASE_NO_TX_RE = re.compile(
    r"^\s*--\s*supabase:\s*no-transaction\b", re.MULTILINE
)
# Per-file squawk silence of the rule that exists precisely for this case
# (`assume_in_transaction = true` in .squawk.toml). Silencing it without the
# marker means the squawk rule was right and the engine will hit 25001.
SQUAWK_IGNORE_CONCURRENT_RE = re.compile(
    r"^\s*--\s*squawk-ignore-file\s+ban-concurrent-index-creation-in-transaction\b",
    re.MULTILINE,
)
# Commands that refuse to run inside a transaction block — the README list.
# Matched at the START of a comment-stripped statement produced by
# split_sql_statements(), so comments, strings and dollar-quoted bodies can
# never produce a hit (the exact reason a regex over the raw file is banned).
NON_TX_STATEMENT_RE = re.compile(
    r"^(?:"
    r"CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b"
    r"|DROP\s+INDEX\s+CONCURRENTLY\b"
    r"|REINDEX\b.*?\bCONCURRENTLY\b"
    r"|VACUUM\b"
    r"|REFRESH\s+MATERIALIZED\s+VIEW\s+CONCURRENTLY\b"
    r"|ALTER\s+SYSTEM\b"
    r")",
    re.IGNORECASE | re.DOTALL,
)

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

-- Audit trail for --reapply : why a row was rewritten. Additive and idempotent,
-- so it lands on ledgers created before this column existed.
ALTER TABLE infra.schema_migrations ADD COLUMN IF NOT EXISTS note TEXT;

GRANT SELECT, INSERT ON infra.schema_migrations TO service_role;
GRANT UPDATE (status, applied_at, execution_ms, error_message, note)
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


def split_sql_statements(sql: str) -> list[str]:
    """Split a SQL script into top-level statements on semicolons.

    Respects Postgres lexical structure so a ``;`` inside a string, quoted
    identifier, comment, or dollar-quoted block does NOT split a statement:

      - line comments       ``-- ... <newline>``
      - block comments      ``/* ... */`` (nestable, per Postgres)
      - single-quoted text  ``'...'`` with ``''`` escaping
      - quoted identifiers  ``"..."`` with ``""`` escaping
      - dollar-quoted text  ``$tag$ ... $tag$`` (tag optional, e.g. ``$$``)

    Why this exists: the non-transactional apply path must send each statement
    to the server in its OWN ``execute()``. Postgres wraps a multi-statement
    simple-query string in an implicit transaction even under autocommit, which
    makes ``CREATE INDEX CONCURRENTLY`` fail with SQLSTATE 25001. Sending one
    statement per round-trip keeps each command outside any transaction.

    Leading comments stay attached to the following statement (Postgres ignores
    them); fragments that are only comments / whitespace are dropped. Standard-
    conforming strings are assumed (PG default since 9.1) — backslash escapes
    inside ``E'...'`` are not special-cased (rare in DDL migrations).
    """
    statements: list[str] = []
    buf: list[str] = []
    i, n = 0, len(sql)
    while i < n:
        two = sql[i:i + 2]
        # ── line comment ──
        if two == "--":
            j = sql.find("\n", i)
            j = n if j == -1 else j
            buf.append(sql[i:j])
            i = j
            continue
        # ── block comment (nestable) ──
        if two == "/*":
            depth = 1
            buf.append(two)
            i += 2
            while i < n and depth > 0:
                t = sql[i:i + 2]
                if t == "/*":
                    depth += 1
                    buf.append(t)
                    i += 2
                elif t == "*/":
                    depth -= 1
                    buf.append(t)
                    i += 2
                else:
                    buf.append(sql[i])
                    i += 1
            continue
        c = sql[i]
        # ── single-quoted string / quoted identifier (same '' / "" escape) ──
        if c in ("'", '"'):
            quote = c
            buf.append(c)
            i += 1
            while i < n:
                if sql[i] == quote:
                    if i + 1 < n and sql[i + 1] == quote:  # doubled escape
                        buf.append(quote * 2)
                        i += 2
                        continue
                    buf.append(quote)
                    i += 1
                    break
                buf.append(sql[i])
                i += 1
            continue
        # ── dollar-quoted string ──
        if c == "$":
            m = re.match(r"\$([A-Za-z_][A-Za-z0-9_]*)?\$", sql[i:])
            if m:
                tag = m.group(0)
                end = sql.find(tag, i + len(tag))
                if end == -1:  # unterminated — keep the rest verbatim
                    buf.append(sql[i:])
                    i = n
                    continue
                buf.append(sql[i:end + len(tag)])
                i = end + len(tag)
                continue
            buf.append(c)
            i += 1
            continue
        # ── statement terminator ──
        if c == ";":
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue
        buf.append(c)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)

    def _has_executable_sql(stmt: str) -> bool:
        stripped = re.sub(r"/\*.*?\*/", "", stmt, flags=re.DOTALL)
        stripped = re.sub(r"--[^\n]*", "", stripped)
        return bool(stripped.strip())

    return [s for s in statements if _has_executable_sql(s)]


def _executable_text(stmt: str) -> str:
    """Statement text without comments (the splitter keeps leading comments
    attached to the statement that follows them)."""
    text = re.sub(r"/\*.*?\*/", "", stmt, flags=re.DOTALL)
    text = re.sub(r"--[^\n]*", "", text)
    return text.strip()


def non_transactional_statements(sql: str) -> list[str]:
    """Return a short preview of every statement that refuses BEGIN/COMMIT."""
    hits: list[str] = []
    for stmt in split_sql_statements(sql):
        text = _executable_text(stmt)
        if NON_TX_STATEMENT_RE.match(text):
            hits.append(" ".join(text.split())[:80])
    return hits


def reconcile_non_transactional(sql: str) -> list[str]:
    """A5 gate — reconcile the ``-- @non_transactional`` header marker with
    the statements of a migration, in BOTH directions.

    Returns a list of human-readable violations (empty = consistent) :

    * a non-transactional statement without the marker — the engine would
      wrap the file in BEGIN/COMMIT and Postgres rejects it (SQLSTATE 25001) ;
    * the marker without any such statement — every statement would run in
      autocommit, losing atomicity for nothing ;
    * the Supabase CLI marker ``-- supabase: no-transaction`` — silently
      ignored by this engine (incident 20260529_xtr_msg_crm_indexes) ;
    * ``squawk-ignore-file ban-concurrent-index-creation-in-transaction``
      without the marker — the squawk rule was right.

    squawk keeps its own responsibility ; this reconciles the two existing
    guards instead of adding a third detector (guardrails.md, passes 2-4).
    """
    has_marker = is_non_transactional_header(sql)
    needs = non_transactional_statements(sql)
    violations: list[str] = []
    if LEGACY_SUPABASE_NO_TX_RE.search(sql):
        violations.append(
            "uses `-- supabase: no-transaction` (Supabase CLI marker) — not "
            "understood by this engine; put `-- @non_transactional` in the "
            f"first {NON_TX_MARKER_HEADER_LINES} lines instead"
        )
    if needs and not has_marker:
        violations.append(
            f"{len(needs)} non-transactional statement(s) (first: "
            f"`{needs[0]}`) without the `-- @non_transactional` header "
            "marker — the engine would wrap the file in BEGIN/COMMIT and "
            "Postgres would reject it (SQLSTATE 25001)"
        )
    if has_marker and not needs:
        violations.append(
            "`-- @non_transactional` marker but no statement needs it — "
            "every statement would run in autocommit, losing atomicity for "
            "nothing; drop the marker"
        )
    if SQUAWK_IGNORE_CONCURRENT_RE.search(sql) and not has_marker:
        violations.append(
            "silences squawk `ban-concurrent-index-creation-in-transaction` "
            "without `-- @non_transactional` — the squawk rule was right: add "
            "the marker (and keep the ignore) or drop the ignore"
        )
    return violations


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


# ── Session hygiene between migrations ──────────────────────────────────────
#
# The engine reuses ONE connection for the whole run. A migration that issues a
# plain `SET x = y` (as opposed to `SET LOCAL`) changes the SESSION, and a plain
# SET survives COMMIT — so the setting leaks into every migration applied after
# it, in file order.
#
# This is not hypothetical. `20260513_default_privileges_data_api_post_oct30.sql`
# sets `lock_timeout = '1s'` and `statement_timeout = '5s'`. The next migrations
# in lexicographic order include `20260529_xtr_msg_crm_indexes.sql`, whose
# CREATE INDEX CONCURRENTLY is documented at 5-20 minutes per index. Under a
# leaked 5s timeout it would be killed, leave the index INVALID — which
# `CREATE INDEX CONCURRENTLY IF NOT EXISTS` then silently treats as a no-op on
# every later attempt — and write a `failed` ledger row that blocks all runs.

# split_sql_statements keeps the comments that precede a statement attached to
# it, so a bare `^\s*SET` match silently misses any SET introduced by a comment
# line — which is how the real 20260513 file is written. Strip that lead-in
# first; the self-test below pins this exact case.
LEADING_NOISE_RE = re.compile(r"\A(?:\s+|--[^\n]*(?:\n|\Z)|/\*.*?\*/)+", re.DOTALL)

SESSION_SET_RE = re.compile(
    r"^\s*SET\s+(?:SESSION\s+)?"
    r"(?!LOCAL\b|TRANSACTION\b|CONSTRAINTS\b)"
    r"([A-Za-z_][\w.]*)",
    re.IGNORECASE,
)


def bare_session_sets(sql: str) -> "list[str]":
    """Names of settings a migration changes for the SESSION, not the transaction.

    Uses the engine's own statement lexer, so semicolons inside strings, dollar
    quotes and comments do not produce false hits. `SET LOCAL` is transaction
    scoped and therefore harmless; `SET TRANSACTION` / `SET CONSTRAINTS` are not
    settings at all.
    """
    names = []
    for stmt in split_sql_statements(sql):
        m = SESSION_SET_RE.match(LEADING_NOISE_RE.sub("", stmt))
        if m and m.group(1).lower() not in names:
            names.append(m.group(1).lower())
    return names


def reset_session(conn) -> "None":
    """Restore session settings to their startup defaults.

    RESET ALL restores what each parameter would have been with no SET issued:
    compiled-in default, postgresql.conf, connection options, per-role and
    per-database settings — so libpq `options=` in DATABASE_URL are preserved.
    Advisory locks are not settings, so the engine's own
    pg_try_advisory_lock(88442211) survives untouched.
    """
    prev = conn.autocommit
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("RESET ALL")
    finally:
        conn.autocommit = prev


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
            # Send each statement in its OWN execute(). A multi-statement
            # simple-query string is wrapped by Postgres in an implicit
            # transaction even under autocommit, which makes CREATE INDEX
            # CONCURRENTLY (and other non-transactional commands) fail with
            # SQLSTATE 25001. One statement per round-trip avoids that.
            with conn.cursor() as cur:
                for statement in split_sql_statements(sql):
                    cur.execute(statement)
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


# ── Ledger freshness ─────────────────────────────────────────────────────────
#
# `pending` is deliberately NOT a blocker: between a merge and the apply run a
# file is legitimately pending for a few days. What is not legitimate is a file
# that stays pending for months — it means either the apply never happened, or
# it happened out-of-band and this ledger no longer describes the database.
# Both are the same operational defect: the ledger stopped being true, and
# nothing said so. Blockers alone cannot catch it (they stay at zero), which is
# why a scheduled `--status` without this check would be green-but-wrong.
#
# Why 30 days, and not a number picked out of the air:
#   - the observed cadence of this runner, baseline rows excluded, is
#     p50 = 1 day, p95 = 3 days, max = 4 days over its genuine applies;
#   - 30 days is the freshness horizon already governed by
#     `.spec/00-canon/repository-registry/automation-reality.yaml`, which
#     requires runtime_evidence ≤30j before an automation may be called ACTIVE.
# 30 is therefore ~10x the observed p95 *and* this repo's existing definition of
# "recent enough to still be true". The threshold is passed in by the caller;
# 0 disables the check, so every pre-existing caller keeps its behaviour.


def migration_date(migration_id: str) -> "datetime.date | None":
    """Calendar date encoded in a migration id, or None if it is not a real day.

    MIGRATION_FILE_RE guarantees the leading digits (`YYYYMMDD` or
    `YYYYMMDDHHMMSS`); it does not guarantee they form a date that exists.
    """
    try:
        return datetime.date(
            int(migration_id[0:4]), int(migration_id[4:6]), int(migration_id[6:8])
        )
    except ValueError:
        return None


def stale_pending(
    local_ids, remote_ids, max_age_days: int, today: "datetime.date"
) -> "list[tuple[str, int | None]]":
    """Pending ids older than `max_age_days`, oldest first.

    Pure: no database, no wall clock — `today` is injected so the self-tests are
    deterministic. An id whose date is impossible is reported with age None
    rather than raising: a malformed filename is a genuine defect, but it must
    not take the freshness probe down with it and mask the backlog.
    """
    if max_age_days <= 0:
        return []
    out: "list[tuple[str, int | None]]" = []
    for mid in local_ids:
        if mid in remote_ids:
            continue
        day = migration_date(mid)
        if day is None:
            out.append((mid, None))
            continue
        age = (today - day).days
        if age > max_age_days:
            out.append((mid, age))
    # Malformed dates first, then genuinely oldest first.
    out.sort(key=lambda t: (t[1] is not None, -(t[1] or 0)))
    return out


def status_step_summary(rows, summary) -> "list[str]":
    """Markdown block for $GITHUB_STEP_SUMMARY under --status.

    print_status() writes to stdout only. The morning digest's Signal 7 sends the
    reader straight to this job summary, so it has to carry the counters and name
    the blocking rows — a summary holding only the freshness table is silent about
    the very drift that turned the run red, and empty when the run is green.
    """
    lines = [
        "## Migration ledger status",
        "",
        "| applied | pending | drift | orphan | applying | failed |",
        "| ---: | ---: | ---: | ---: | ---: | ---: |",
        "| {applied} | {pending} | {drift} | {orphan} | {applying} | {failed} |".format(
            **summary
        ),
        "",
    ]
    blockers = [(i, st) for i, st, _, _ in rows if st in ("drift", "applying", "failed")]
    if blockers:
        lines += [
            f"### Blockers ({len(blockers)})",
            "",
            "These stop every apply **and every dry-run** (exit 5) until resolved.",
            "",
            "| ID | State |",
            "| --- | --- |",
        ]
        lines += [f"| `{i}` | {st} |" for i, st in blockers]
        lines.append("")
    return lines


def report_stale_pending(stale, max_age_days: int) -> int:
    """Print the stale backlog and mirror it to the step summary. 1 if any."""
    if not stale:
        print(
            f"Ledger freshness : OK — nothing pending for more than "
            f"{max_age_days} days."
        )
        return 0
    print()
    print(
        f"Ledger freshness : {len(stale)} migration(s) pending for more than "
        f"{max_age_days} days — the ledger no longer describes the database."
    )
    lines = [
        "## Ledger freshness",
        "",
        f"{len(stale)} migration(s) pending longer than {max_age_days} days. "
        "Either the apply never happened, or it happened out-of-band and "
        "`infra.schema_migrations` is now fiction.",
        "",
        "| ID | Pending since |",
        "| --- | --- |",
    ]
    for mid, age in stale:
        age_txt = f"{age} days" if age is not None else "unparsable date in filename"
        print(f"  {mid}  {age_txt}")
        lines.append(f"| `{mid}` | {age_txt} |")
    write_step_summary(lines)
    return 1


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

    # 2b. Reconciliation marker <-> non-transactional statements (A5) ----
    # Both directions : a statement that refuses BEGIN/COMMIT requires the
    # marker (else SQLSTATE 25001 at apply time) ; the marker requires such a
    # statement (else every statement runs in autocommit, losing atomicity
    # for nothing). Legacy `-- supabase: no-transaction` (Supabase CLI) is
    # NOT understood by this engine and must be rejected explicitly.
    ok_pair = (
        "-- @non_transactional\n"
        "SET lock_timeout = '5s';\n"
        "CREATE INDEX CONCURRENTLY IF NOT EXISTS i ON t (c);\n"
    )
    assert reconcile_non_transactional(ok_pair) == []

    plain = (
        "ALTER TABLE t ADD COLUMN IF NOT EXISTS c int;\n"
        "CREATE INDEX IF NOT EXISTS i ON t (c);\n"
    )
    assert reconcile_non_transactional(plain) == []

    missing = "-- header\nCREATE INDEX CONCURRENTLY i ON t (c);\n"
    v = reconcile_non_transactional(missing)
    assert len(v) == 1 and "25001" in v[0], v

    useless = "-- @non_transactional\nCREATE INDEX i ON t (c);\n"
    v = reconcile_non_transactional(useless)
    assert len(v) == 1 and "atomicity" in v[0], v

    legacy = (
        "-- supabase: no-transaction\n"
        "CREATE INDEX CONCURRENTLY i ON t (c);\n"
    )
    v = reconcile_non_transactional(legacy)
    assert any("supabase: no-transaction" in m for m in v), v
    assert any("25001" in m for m in v), v

    silenced = (
        "-- squawk-ignore-file ban-concurrent-index-creation-in-transaction\n"
        "CREATE INDEX i ON t (c);\n"
    )
    v = reconcile_non_transactional(silenced)
    assert len(v) == 1 and "squawk" in v[0], v

    # CONCURRENTLY inside a comment or a dollar-quoted body does NOT need
    # the marker — this is the exact case where regex-on-file lies.
    fooled = (
        "-- CREATE INDEX CONCURRENTLY mentioned in a comment\n"
        "CREATE FUNCTION f() RETURNS void AS $$\n"
        "BEGIN\n"
        "  EXECUTE 'CREATE INDEX CONCURRENTLY i ON t (c)';\n"
        "END;\n"
        "$$ LANGUAGE plpgsql;\n"
    )
    assert reconcile_non_transactional(fooled) == [], (
        reconcile_non_transactional(fooled)
    )

    # Every command of the README list is recognised, in both directions.
    for stmt in (
        "DROP INDEX CONCURRENTLY IF EXISTS i;",
        "REINDEX INDEX CONCURRENTLY i;",
        "VACUUM ANALYZE t;",
        "REFRESH MATERIALIZED VIEW CONCURRENTLY mv;",
        "ALTER SYSTEM SET work_mem = '16MB';",
    ):
        assert reconcile_non_transactional(stmt) != [], stmt
        assert reconcile_non_transactional("-- @non_transactional\n" + stmt) == [], stmt

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

    # 8. SQL statement splitter (non-transactional apply path) ----------
    # Simple multi-statement split.
    assert split_sql_statements("SELECT 1; SELECT 2;") == ["SELECT 1", "SELECT 2"]
    # Trailing statement without terminator is kept.
    assert split_sql_statements("SELECT 1;\nSELECT 2") == ["SELECT 1", "SELECT 2"]
    # CONCURRENTLY-style file : SET + 2 indexes = 3 statements, leading
    # comment stays attached to the first.
    concurrent = (
        "-- @non_transactional\n"
        "set lock_timeout = '2s';\n"
        "CREATE INDEX CONCURRENTLY i1 ON t (a);\n"
        "CREATE INDEX CONCURRENTLY i2 ON t (b);\n"
    )
    parts = split_sql_statements(concurrent)
    assert len(parts) == 3, parts
    assert parts[0].startswith("-- @non_transactional"), parts[0]
    assert "set lock_timeout" in parts[0]
    assert parts[1] == "CREATE INDEX CONCURRENTLY i1 ON t (a)", parts[1]
    assert parts[2] == "CREATE INDEX CONCURRENTLY i2 ON t (b)", parts[2]
    # Semicolon inside a single-quoted string must NOT split.
    assert split_sql_statements("INSERT INTO t VALUES ('a;b');") == [
        "INSERT INTO t VALUES ('a;b')"
    ]
    # Doubled-quote escape inside a string.
    assert split_sql_statements("SELECT 'it''s; ok';") == ["SELECT 'it''s; ok'"]
    # Semicolon inside a quoted identifier must NOT split.
    assert split_sql_statements('CREATE TABLE "we;ird" (a int);') == [
        'CREATE TABLE "we;ird" (a int)'
    ]
    # Semicolon inside a dollar-quoted function body must NOT split.
    dollar = (
        "CREATE FUNCTION f() RETURNS int AS $$\n"
        "BEGIN\n  RETURN 1; -- inner ;\nEND;\n$$ LANGUAGE plpgsql;\n"
        "SELECT f();"
    )
    dparts = split_sql_statements(dollar)
    assert len(dparts) == 2, dparts
    assert dparts[0].startswith("CREATE FUNCTION f()") and "$$" in dparts[0]
    assert dparts[1] == "SELECT f()", dparts[1]
    # Tagged dollar-quote.
    tagged = "SELECT $tag$ a; b $tag$; SELECT 2;"
    assert split_sql_statements(tagged) == ["SELECT $tag$ a; b $tag$", "SELECT 2"]
    # Semicolon inside a line comment must NOT split; comment-only tail dropped.
    assert split_sql_statements("SELECT 1; -- a; b\n") == ["SELECT 1"]
    # Semicolon inside a block comment must NOT split.
    assert split_sql_statements("SELECT 1 /* x; y */; SELECT 2;") == [
        "SELECT 1 /* x; y */",
        "SELECT 2",
    ]
    # Comment-only / whitespace-only input yields no statements.
    assert split_sql_statements("-- just a comment\n") == []
    assert split_sql_statements("  ;  ;\n") == []
    assert split_sql_statements("") == []

    # 5. Ledger freshness ------------------------------------------------
    assert migration_date("20260429_x") == datetime.date(2026, 4, 29)
    assert migration_date("20260429120000_x") == datetime.date(2026, 4, 29)
    assert migration_date("20261332_impossible_day") is None

    today = datetime.date(2026, 9, 3)
    ids = ["20260429_old", "20260801_borderline", "20260901_recent"]

    # Applied files are never reported, however old they are.
    assert stale_pending(ids, set(ids), 30, today) == []
    # All pending: only those past the threshold, oldest first.
    assert stale_pending(ids, set(), 30, today) == [
        ("20260429_old", 127),
        ("20260801_borderline", 33),
    ], stale_pending(ids, set(), 30, today)
    # A single applied id drops out; the rest still reports.
    assert stale_pending(ids, {"20260429_old"}, 30, today) == [
        ("20260801_borderline", 33)
    ]
    # Threshold is exclusive — exactly 30 days old is not yet stale.
    assert stale_pending(["20260804_exact"], set(), 30, today) == []
    assert stale_pending(["20260803_one_over"], set(), 30, today) == [
        ("20260803_one_over", 31)
    ]
    # 0 disables the check outright, so existing callers are unaffected.
    assert stale_pending(ids, set(), 0, today) == []
    # A malformed date surfaces as a finding, first, instead of crashing.
    assert stale_pending(["20260429_old", "20261332_bad"], set(), 30, today) == [
        ("20261332_bad", None),
        ("20260429_old", 127),
    ]
    # Status summary always carries the counters, and names blockers when present.
    _sum = {"applied": 243, "pending": 57, "drift": 1,
            "orphan": 0, "applying": 0, "failed": 0}
    _rows = [
        ("20260429_diag", "drift", "2026-05-16", "baseline"),
        ("20260901_ok", "applied", "2026-09-01", "gh-actions:1"),
        ("20260902_new", "pending", "—", "—"),
    ]
    _md = "\n".join(status_step_summary(_rows, _sum))
    assert "| 243 | 57 | 1 | 0 | 0 | 0 |" in _md, _md
    assert "### Blockers (1)" in _md and "`20260429_diag` | drift" in _md, _md
    assert "20260901_ok" not in _md and "20260902_new" not in _md, _md
    # No blocker -> counters still emitted, no Blockers section.
    _clean = "\n".join(status_step_summary(
        [("20260901_ok", "applied", "2026-09-01", "gh-actions:1")],
        {"applied": 1, "pending": 0, "drift": 0,
         "orphan": 0, "applying": 0, "failed": 0}))
    assert "| 1 | 0 | 0 | 0 | 0 | 0 |" in _clean and "Blockers" not in _clean, _clean
    # 6. Session-level SET detection --------------------------------------
    assert bare_session_sets("SET statement_timeout = '5s';") == ["statement_timeout"]
    assert bare_session_sets("SET SESSION lock_timeout = '1s';") == ["lock_timeout"]
    # SET LOCAL is transaction-scoped: never reported.
    assert bare_session_sets("SET LOCAL statement_timeout = '5s';") == []
    # Not settings at all.
    assert bare_session_sets("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;") == []
    assert bare_session_sets("SET CONSTRAINTS ALL DEFERRED;") == []
    # Case-insensitive, de-duplicated, order preserved.
    assert bare_session_sets(
        "set lock_timeout='1s'; SET statement_timeout='5s'; SET lock_timeout='2s';"
    ) == ["lock_timeout", "statement_timeout"]
    # A SET introduced by a comment line IS still a session SET (regression:
    # split_sql_statements keeps the lead-in comment attached to the statement).
    assert bare_session_sets("-- pin timeouts\nSET lock_timeout = '1s';") == [
        "lock_timeout"
    ]
    assert bare_session_sets("/* block */ SET statement_timeout = '5s';") == [
        "statement_timeout"
    ]
    # A SET inside a string or a comment must NOT count (lexer-backed).
    assert bare_session_sets("SELECT 'SET statement_timeout = 1';") == []
    assert bare_session_sets("-- SET statement_timeout = 1\nSELECT 1;") == []
    # The real file that motivated this guard, if present in the checkout.
    _leaky = MIGRATIONS_DIR / "20260513_default_privileges_data_api_post_oct30.sql"
    if _leaky.exists():
        _found = bare_session_sets(_leaky.read_text(encoding="utf-8"))
        assert "statement_timeout" in _found and "lock_timeout" in _found, _found

    # Reporting contract: empty backlog is success, any backlog is failure.
    assert report_stale_pending([], 30) == 0
    assert report_stale_pending([("20260429_old", 127)], 30) == 1

    # 7. Re-apply safety — ALLOW-LIST, not deny-list ----------------------
    # Proven-idempotent forms pass.
    assert not_replayable("SET lock_timeout = '5s';") == []
    assert not_replayable("CREATE TABLE IF NOT EXISTS t (a int);") == []
    assert not_replayable("CREATE UNIQUE INDEX IF NOT EXISTS i ON t(a);") == []
    assert not_replayable("CREATE OR REPLACE VIEW v AS SELECT 1;") == []
    assert not_replayable("COMMENT ON VIEW v IS 'x';") == []
    assert not_replayable("GRANT SELECT ON t TO r;") == []
    assert not_replayable("INSERT INTO t (a) VALUES (1) ON CONFLICT DO NOTHING;") == []
    # Everything else is refused BY NAME, including the forms a deny-list missed.
    assert not_replayable("INSERT INTO t (a) VALUES (1);") != []
    assert not_replayable("TRUNCATE t;") != []
    assert not_replayable("UPDATE t SET a = 1;") != []
    assert not_replayable("CREATE TABLE t (a int);") != []
    assert not_replayable("ALTER TABLE t ADD COLUMN b int;") != []
    # The inverted-polarity bug this replaced: IF EXISTS protects the FIRST run,
    # not the replay. On a replay the table exists and is full.
    assert not_replayable("DROP TABLE IF EXISTS t;") != []
    assert not_replayable("DROP TABLE t;") != []
    # Transaction control ends our transaction — refused, which also closes the
    # "the SQL committed but the ledger did not" hole.
    assert not_replayable("BEGIN; SELECT 1; COMMIT;") != []
    assert not_replayable("SAVEPOINT s;") != []
    # DO blocks: assertions replay, writers do not.
    assert not_replayable(
        "DO $$ DECLARE n INT; BEGIN SELECT count(*) INTO n FROM t; "
        "IF n < 1 THEN RAISE EXCEPTION 'empty'; END IF; END $$;"
    ) == []
    assert not_replayable("DO $$ BEGIN INSERT INTO t VALUES (1); END $$;") != []
    # Lexer-backed: dead text in a block comment or a string is not a statement.
    assert not_replayable("/* disabled\nDROP TABLE t;\n*/\nSELECT 1;") == []
    assert not_replayable("SELECT 'DROP TABLE t';") == []

    _lm = LocalMigration(id="x", path=Path("x.sql"), checksum="bbb",
                         non_transactional=False)
    _rm = RemoteMigration(id="x", checksum="aaa", status="applied",
                          applied_at="2026-05-16", runner="baseline")
    _ok_sql = "CREATE OR REPLACE VIEW v AS SELECT 1;"
    assert reapply_precheck(_lm, _rm, _ok_sql) is None
    assert "not recorded" in reapply_precheck(_lm, None, _ok_sql)
    assert "not 'applied'" in reapply_precheck(
        _lm, RemoteMigration("x", "aaa", "failed", None, None), _ok_sql)
    assert "not in drift" in reapply_precheck(
        _lm, RemoteMigration("x", "bbb", "applied", None, None), _ok_sql)
    assert "non_transactional" in reapply_precheck(
        LocalMigration("x", Path("x.sql"), "bbb", True), _rm, _ok_sql)
    assert "not replayable" in reapply_precheck(_lm, _rm, "DROP TABLE IF EXISTS t;")

    # The two real files that pin both directions of this gate.
    _target = MIGRATIONS_DIR / "20260429_diag_maintenance_via_kg.sql"
    if _target.exists():
        _r = not_replayable(_target.read_text(encoding="utf-8"))
        assert _r == [], _r          # must stay repairable
    _destructive = (MIGRATIONS_DIR
                    / "20260104_purchase_guide_v2_client_content.sql")
    if _destructive.exists():
        _r = not_replayable(_destructive.read_text(encoding="utf-8"))
        assert any("DROP TABLE IF EXISTS" in x for x in _r), _r

    # 8. --only selection --------------------------------------------------
    _mk = lambda i, c="c": LocalMigration(id=i, path=Path(i + ".sql"),
                                          checksum=c, non_transactional=False)
    _local = [_mk("20260101_a"), _mk("20260202_b"), _mk("20260303_c"),
              _mk("20260404_d")]
    _remote = {"20260202_b": RemoteMigration("20260202_b", "c", "applied",
                                             "2026-02-02", "gh-actions:1")}

    # Names exactly one file; steps over the pending ones that sort earlier.
    _sel, _skip, _err = select_only(_local, _remote, "20260404_d")
    assert _err == [] and [m.id for m in _sel] == ["20260404_d"], (_sel, _err)
    assert _skip == ["20260101_a", "20260303_c"], _skip   # 20260202_b is applied

    # Typed order does not matter : the engine's file order wins.
    _sel, _skip, _err = select_only(_local, _remote, "20260404_d,20260101_a")
    assert [m.id for m in _sel] == ["20260101_a", "20260404_d"], _sel
    assert _skip == ["20260303_c"], _skip

    # Duplicates and whitespace are tolerated.
    _sel, _, _err = select_only(_local, _remote, " 20260101_a , 20260101_a ")
    assert _err == [] and [m.id for m in _sel] == ["20260101_a"]

    # Nothing selected earlier than the last one -> nothing stepped over.
    _sel, _skip, _err = select_only(_local, _remote, "20260101_a")
    assert _skip == [], _skip

    # Refusals name the offender, and select nothing at all.
    _sel, _, _err = select_only(_local, _remote, "20260101_a,20260909_ghost")
    assert _sel == [] and any("20260909_ghost" in e and "no such file" in e
                              for e in _err), _err
    _sel, _, _err = select_only(_local, _remote, "20260202_b")
    assert _sel == [] and any("not pending" in e and "applied" in e
                              for e in _err), _err
    assert select_only(_local, _remote, "")[2] != []
    assert select_only(_local, _remote, " , ")[2] != []

    print("OK — all self-tests passed.")
    return 0


# ── Selecting WHAT to apply ─────────────────────────────────────────────────
#
# `--limit N` applies the first N pending migrations in file order. That is a
# positional hack, not a selection : to reach one file you must accept every file
# before it. Measured on this repo today — applying `20260529_xtr_msg_crm_indexes`
# needs `--limit 13`, which also applies twelve migrations nobody asked for,
# including one that creates three tables and one that leaves a 5s
# statement_timeout on the session.
#
# `--only ID[,ID...]` names what runs. Nothing else runs. This is the primitive
# every mature migration tool has (Flyway `target`, Sqitch `deploy --to`), and
# its absence is what made the apply queue head-blocked : an undecided migration
# at the front held back every migration behind it.
#
# Stepping over earlier pending migrations is a real risk the engine cannot
# evaluate — it does not know dependencies. So it never does it silently : the
# skipped ids are printed and written to the job summary, and `--dry-run` shows
# them before anything runs.


def select_only(local, remote, only_csv: str):
    """(selected, skipped_earlier, errors) for --only. Pure : no database.

    `selected` comes back in the engine's canonical file order, whatever order
    the operator typed. `skipped_earlier` lists pending migrations that sort
    before the last selected one and are NOT selected — what this run steps over.
    """
    wanted, seen = [], set()
    for raw in only_csv.split(","):
        mid = raw.strip()
        if mid and mid not in seen:
            seen.add(mid)
            wanted.append(mid)

    if not wanted:
        return [], [], ["--only was given no migration id"]

    by_id = {m.id: m for m in local}
    errors = []
    for mid in wanted:
        if mid not in by_id:
            errors.append(f"{mid}: no such file under {MIGRATIONS_DIR}/")
        elif mid in remote:
            errors.append(
                f"{mid}: already recorded in the ledger "
                f"(status={remote[mid].status}) — not pending"
            )
    if errors:
        return [], [], errors

    selected = [m for m in local if m.id in seen]
    last_idx = local.index(selected[-1])
    skipped = [
        m.id
        for idx, m in enumerate(local)
        if idx < last_idx and m.id not in seen and m.id not in remote
    ]
    return selected, skipped, []


# ── Re-apply a drifted migration ────────────────────────────────────────────
#
# A `drift` row means the ledger records checksum A while the file now holds
# checksum B. The engine refuses every apply and dry-run until that is resolved,
# and it has no way out : `checksum` is not in the column-scoped UPDATE grant,
# and there is no DELETE grant (append-only ledger).
#
# The tempting fix — rewrite the checksum — makes the row *claim* the new bytes
# were applied. That is an assertion, not a fact, and it silently ratifies a row
# that may never have been true. Real case: 20260429_diag_maintenance_via_kg was
# swept into `applied` by the 2026-05-16 bulk baseline, while PR #1084 states the
# original migration "was never applied".
#
# So instead of asserting, re-execute. After a --reapply the row is true because
# the bytes just ran, not because someone said so. That is only safe for a file
# that can run twice, which is checked mechanically below rather than promised in
# a header comment.

# The gate is an ALLOW-LIST, not a deny-list. A deny-list of a few dangerous
# forms approved 301 of this repo's 303 migrations — including
# `20260104_purchase_guide_v2_client_content.sql`, whose line 9 is
# `DROP TABLE IF EXISTS __seo_gamme_purchase_guide` (241 live rows, 3.7 MB today).
# `IF EXISTS` protects the FIRST run against a missing table; on a replay months
# later the table exists and is full, and the DROP would commit inside the very
# transaction that stamps the ledger row `applied`.
#
# So: every top-level statement must be a form that is *proven* to survive a
# second execution. Anything else is refused by name. Widening this list is a
# deliberate act, not an oversight.

_ALLOWED = (
    re.compile(r"^(SET|RESET)\s", re.I),
    re.compile(r"^SELECT\s", re.I),
    re.compile(r"^CREATE\b[\s\S]{0,80}?\bIF\s+NOT\s+EXISTS\b", re.I),
    re.compile(r"^CREATE\s+OR\s+REPLACE\s+(FUNCTION|VIEW|PROCEDURE|TRIGGER|RULE)\b", re.I),
    re.compile(r"^COMMENT\s+ON\s", re.I),
    re.compile(r"^(GRANT|REVOKE)\s", re.I),
)
_INSERT_RE = re.compile(r"^INSERT\s+INTO\s+([A-Za-z_][\w.\"]*)", re.I)
_INSERT_GUARD_RE = re.compile(r"ON\s+CONFLICT|WHERE\s+NOT\s+EXISTS", re.I)
_DO_RE = re.compile(r"^DO\s", re.I)
_DOLLAR_BODY_RE = re.compile(r"\$([A-Za-z_]*)\$(.*?)\$\1\$", re.S)
# Verbs that write. `BEGIN`/`END` are PL/pgSQL block delimiters inside a DO and
# are deliberately absent — only writes disqualify an assertion block.
_WRITE_VERB_RE = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|CALL|COPY|MERGE)\b",
    re.I,
)


def _do_block_is_read_only(stmt: str) -> bool:
    """True when a DO block only reads and raises.

    20260429 uses two of them as post-conditions (`SELECT COUNT(*) INTO ...`
    then `RAISE EXCEPTION` when the invariant fails). Those replay safely; a DO
    that writes does not, and this cannot tell the difference by intent — only
    by looking for write verbs in the body.
    """
    bodies = _DOLLAR_BODY_RE.findall(stmt)
    if not bodies:
        return False
    return not any(_WRITE_VERB_RE.search(body) for _, body in bodies)


def not_replayable(sql: str) -> "list[str]":
    """Statements that are not proven safe to execute a second time.

    Empty list = every statement is on the allow-list. Lexer-backed, so a
    statement quoted inside a string, a dollar-quoted body or a block comment is
    not counted — 20260429 keeps a whole disabled INSERT inside a /* ... */ block
    for traceability, and a grep-based check calls that a duplication hazard when
    it is dead text.
    """
    reasons = []
    for stmt in split_sql_statements(sql):
        clean = LEADING_NOISE_RE.sub("", stmt).strip()
        if not clean:
            continue
        if any(rx.match(clean) for rx in _ALLOWED):
            continue
        ins = _INSERT_RE.match(clean)
        if ins:
            if _INSERT_GUARD_RE.search(clean):
                continue
            reasons.append(
                f"INSERT INTO {ins.group(1)} without ON CONFLICT / WHERE NOT "
                "EXISTS — a second run would duplicate rows"
            )
            continue
        if _DO_RE.match(clean):
            if _do_block_is_read_only(clean):
                continue
            reasons.append("DO block that writes — not provably replayable")
            continue
        head = " ".join(clean.split()[:6])[:72]
        reasons.append(f"not on the replay allow-list: `{head}`")
    return reasons


def reapply_precheck(mig, row, sql) -> "str | None":
    """Why `mig` cannot be re-applied, or None when it can.

    Pure : no database. `row` is the RemoteMigration or None.
    """
    if row is None:
        return "not recorded in the ledger — a normal apply covers this"
    if row.status != "applied":
        return f"ledger status is '{row.status}', not 'applied' — resolve that first"
    if row.checksum == mig.checksum:
        return "not in drift — the ledger already matches the file"
    if mig.non_transactional:
        return (
            "marked @non_transactional — re-apply only supports the "
            "transactional path, where the SQL and the ledger row commit together"
        )
    blockers = not_replayable(sql)
    if blockers:
        shown = " ; ".join(blockers[:4])
        more = f" (+{len(blockers) - 4} more)" if len(blockers) > 4 else ""
        return "not replayable: " + shown + more
    return None


def _assert_in_transaction(conn, when: str) -> "None":
    """Fail loudly if our transaction is no longer open.

    A migration containing a top-level COMMIT would end the transaction psycopg
    opened, so the SQL would already be durable while the ledger row is not —
    and the rollback path would then print "rolled back" over work that is not
    coming back. The allow-list refuses such files, but this is the cheap
    verification that the promise held.
    """
    from psycopg.pq import TransactionStatus

    st = conn.info.transaction_status
    if st != TransactionStatus.INTRANS:
        raise RuntimeError(
            f"transaction is no longer open {when} (status={st!r}). The migration "
            "SQL closed it — its effects may already be durable. The ledger row "
            "was NOT written; inspect the database before retrying."
        )


def run_reapply(conn, local, remote, target_id: str, runner: str, git_sha: str) -> int:
    mig = next((m for m in local if m.id == target_id), None)
    if mig is None:
        fail(8, f"{target_id}: no such file under {MIGRATIONS_DIR}/.")

    sql = mig.path.read_text(encoding="utf-8")
    row = remote.get(target_id)
    why = reapply_precheck(mig, row, sql)
    if why:
        fail(8, f"{target_id}: {why}.")

    # The columns this rewrites are NOT in the service_role grant : only the table
    # owner can. Say so plainly instead of surfacing a bare 42501 mid-transaction.
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT current_user,
                   has_column_privilege('infra.schema_migrations', 'checksum', 'UPDATE'),
                   has_column_privilege('infra.schema_migrations', 'runner', 'UPDATE'),
                   has_column_privilege('infra.schema_migrations', 'git_sha', 'UPDATE')
            """
        )
        who, c_ok, r_ok, g_ok = cur.fetchone()
    if not (c_ok and r_ok and g_ok):
        fail(
            9,
            f"role '{who}' cannot UPDATE checksum/runner/git_sha on "
            "infra.schema_migrations (column-scoped grant). Re-apply needs the "
            "table owner — the DATABASE_URL the engine bootstraps with.",
        )

    print(f"Re-applying {target_id}")
    print(f"  ledger checksum : {row.checksum}")
    print(f"  file checksum   : {mig.checksum}")
    print(f"  recorded by     : {row.runner or '—'} at {row.applied_at or '—'}")
    print(f"  statements      : {len(split_sql_statements(sql))}")

    note = (
        f"reapplied over a stale record: was checksum={row.checksum} "
        f"runner={row.runner or '—'} applied_at={row.applied_at or '—'}"
    )
    reset_session(conn)
    start = time.monotonic()
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            elapsed_ms = int((time.monotonic() - start) * 1000)
            # Belt and braces on top of the allow-list : if the file managed to
            # close our transaction anyway, the ledger row must NOT be written
            # and we must not print "rolled back" over work that already
            # committed. Checked before touching the ledger, and again before
            # committing.
            _assert_in_transaction(conn, "after running the migration SQL")
            # Guarded on the OLD checksum : if anything moved under us, 0 rows
            # match and we abort instead of reporting a silent success.
            cur.execute(
                """
                UPDATE infra.schema_migrations
                   SET checksum = %s, status = 'applied', applied_at = NOW(),
                       execution_ms = %s, runner = %s, git_sha = %s, note = %s
                 WHERE id = %s AND checksum = %s
                """,
                (mig.checksum, elapsed_ms, runner, git_sha, note,
                 target_id, row.checksum),
            )
            if cur.rowcount != 1:
                raise RuntimeError(
                    f"ledger row for {target_id} changed during re-apply "
                    f"({cur.rowcount} rows matched, expected 1) — rolled back"
                )
        _assert_in_transaction(conn, "before committing the ledger row")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.autocommit = True

    print(f"OK in {elapsed_ms}ms — ledger now records {mig.checksum}")
    write_step_summary(
        ["## Re-applied", "",
         f"`{target_id}` re-executed and re-recorded in {elapsed_ms}ms.", "",
         f"- previous checksum : `{row.checksum}`",
         f"- new checksum      : `{mig.checksum}`",
         f"- previous record   : {row.runner or '—'} at {row.applied_at or '—'}",
         ""]
    )
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


def run_lint_markers(paths: list[str]) -> int:
    """A5 gate on explicit files (CI *Migration Safety*, changed files only ;
    no DB connection). ``.down.sql`` files are skipped : forward-only engine,
    excluded from squawk as well — same scope contract."""
    problems = 0
    checked = 0
    for raw in paths:
        p = Path(raw)
        if p.name.endswith(".down.sql"):
            print(f"  skip {p} (.down.sql: forward-only engine, squawk-excluded)")
            continue
        if not p.is_file():
            fail(2, f"--lint-markers: file not found: {p}")
        checked += 1
        for msg in reconcile_non_transactional(p.read_text(encoding="utf-8")):
            problems += 1
            print(f"::error file={p}::{msg}")
    if problems:
        print(
            f"FAIL — {problems} @non_transactional mismatch(es) in "
            f"{checked} file(s)."
        )
        return 1
    print(f"OK — @non_transactional reconciled on {checked} file(s).")
    return 0


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--self-test", action="store_true",
        help="Run in-process unit tests and exit (no DB connection).",
    )
    parser.add_argument(
        "--lint-markers", nargs="+", metavar="SQL_FILE", default=None,
        help=(
            "Reconcile the `-- @non_transactional` header marker with the "
            "statements of the given migration files, both directions, and "
            "exit non-zero on any mismatch. No DB connection. `.down.sql` "
            "files are skipped."
        ),
    )
    parser.add_argument(
        "--status", action="store_true",
        help="Print the migration state table and exit. Read-only on the data.",
    )
    parser.add_argument(
        "--reapply", type=str, default="", metavar="ID",
        help=(
            "Re-execute ONE migration whose ledger row is in drift, then rewrite "
            "that row from the run. Refuses unless the row is a drifted "
            "'applied', the file is transactional, and it contains no statement "
            "that would misbehave on a second run. Needs the table owner."
        ),
    )
    parser.add_argument(
        "--no-bootstrap", action="store_true",
        help=(
            "Skip the ledger DDL/GRANT bootstrap. Only valid with --status : it "
            "makes the run genuinely read-only, so a scheduled probe cannot "
            "silently re-apply GRANTs over a deliberate REVOKE. A missing ledger "
            "then fails loudly instead of being created by a status check."
        ),
    )
    parser.add_argument(
        "--max-pending-age-days", type=int, default=0, metavar="N",
        help=(
            "With --status: exit non-zero when a migration has been pending "
            "for more than N days. 0 (default) disables the check and keeps "
            "the historical behaviour. See the 'Ledger freshness' section in "
            "this file for why the scheduled probe uses 30."
        ),
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show the apply plan without writing.",
    )
    parser.add_argument(
        "--only", type=str, default="", metavar="ID[,ID...]",
        help=(
            "Apply exactly these pending migrations and nothing else, in file "
            "order. Refuses an unknown id or one already in the ledger. Prints "
            "the earlier pending migrations it steps over — the engine does not "
            "know dependencies, so that judgement stays with you."
        ),
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

    # Mode autonome, comme --self-test : sort avant toute connexion.
    if args.lint_markers:
        return run_lint_markers(args.lint_markers)

    if args.only and (args.limit is not None or args.baseline or args.status
                      or args.reapply):
        fail(
            2,
            "--only is exclusive : it cannot be combined with --limit, "
            "--baseline, --status or --reapply.",
        )

    if args.no_bootstrap and (not args.status or args.reapply or args.baseline):
        fail(
            2,
            "--no-bootstrap is only valid with a bare --status : every write path "
            "needs the ledger DDL to exist.",
        )

    local = parse_local_migrations()
    enforce_ordering(local)
    if not local:
        print("No migration files found under backend/supabase/migrations/.")
        return 0

    conn = connect()
    try:
        acquire_lock(conn)
        if args.no_bootstrap:
            # Genuinely read-only path. bootstrap() is idempotent DDL, but it also
            # re-runs GRANT on infra.schema_migrations : a nightly cron calling it
            # would quietly undo a deliberate REVOKE. And a status probe has no
            # business creating the ledger it is meant to observe.
            try:
                remote = fetch_remote(conn)
            except Exception as exc:  # noqa: BLE001 — re-raised unless it is 42P01
                if getattr(exc, "sqlstate", None) == "42P01":
                    fail(
                        6,
                        "infra.schema_migrations is absent. Run the engine once "
                        "WITHOUT --no-bootstrap to create it.",
                    )
                raise
        else:
            bootstrap(conn)
            remote = fetch_remote(conn)

        rows, summary = classify(local, remote)

        # Identity of THIS run, needed by every write mode below.
        runner = f"gh-actions:{os.environ.get('GITHUB_RUN_ID', 'local')}"
        git_sha = os.environ.get("GITHUB_SHA", "")

        if args.reapply:
            return run_reapply(
                conn, local, remote, args.reapply, runner, git_sha
            )

        if args.baseline:
            return run_baseline(conn, local, remote, args.exclude)

        if args.status:
            rc = print_status(rows, summary)
            write_step_summary(status_step_summary(rows, summary))
            if args.max_pending_age_days > 0:
                rc = max(rc, report_stale_pending(
                    stale_pending(
                        [m.id for m in local],
                        remote,
                        args.max_pending_age_days,
                        datetime.date.today(),
                    ),
                    args.max_pending_age_days,
                ))
            return rc

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
        skipped_earlier: list[str] = []
        if args.only:
            pending, skipped_earlier, errors = select_only(
                local, remote, args.only
            )
            if errors:
                for e in errors:
                    sys.stderr.write(f"[apply-supabase-migration] {e}\n")
                fail(10, "--only refused — nothing was applied.")
        elif args.limit is not None:
            pending = pending[: max(0, args.limit)]

        # A5 gate — refuse to apply (or dry-run) a pending migration whose
        # header marker contradicts its statements, BEFORE touching anything.
        # Pending = not yet at the ledger = bytes still editable : the fix is
        # in the file, never a checksum override.
        #
        # Portée volontaire : `pending` — donc ce que --only a sélectionné, pas
        # la file entière. Nommer une migration ne dispense pas de la garde,
        # mais enjamber un fichier fautif ne bloque pas non plus un run qui ne
        # l'exécute pas.
        mismatches = [
            (m.id, msg)
            for m in pending
            for msg in reconcile_non_transactional(
                m.path.read_text(encoding="utf-8")
            )
        ]
        if mismatches:
            for mid, msg in mismatches:
                print(f"::error::{mid}: {msg}")
            fail(
                7,
                f"{len(mismatches)} @non_transactional mismatch(es) in pending "
                "migrations — fix the file(s) (see --lint-markers).",
            )

        # GitHub Step Summary — built once, written once.
        plan_lines = ["## Migration plan", ""]
        plan_lines.append("| Status | ID | Mode |")
        plan_lines.append("| --- | --- | --- |")
        for m in local:
            if m.id in remote:
                state = "✅ applied"
            elif m in pending:
                state = "⏳ pending"
            elif args.only:
                state = "⏸️ not selected (--only)"
            else:
                state = "⏸️ deferred (limit)"
            mode = "non-transactional" if m.non_transactional else "transactional"
            plan_lines.append(f"| {state} | `{m.id}` | {mode} |")

        if skipped_earlier:
            print()
            print(
                f"NOTE — this run steps over {len(skipped_earlier)} pending "
                "migration(s) that sort earlier. The engine cannot check "
                "dependencies; that judgement is yours:"
            )
            for mid in skipped_earlier:
                print(f"  skipped  {mid}")
            plan_lines += [
                "",
                f"### Stepped over ({len(skipped_earlier)})",
                "",
                "Pending migrations that sort earlier and are NOT part of this run.",
                "",
                "| ID |",
                "| --- |",
            ] + [f"| `{mid}` |" for mid in skipped_earlier] + [""]

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

        applied: list[tuple[str, int]] = []
        for m in pending:
            mode = "non-tx" if m.non_transactional else "tx"
            print(
                f"Applying {m.id} ({mode}) ... ",
                end="",
                flush=True,
            )
            # Start every migration from a clean session, whatever the previous
            # one left behind. Before, not after : this also protects the first
            # migration from anything bootstrap() or the connection left set.
            reset_session(conn)
            leaked = bare_session_sets(m.path.read_text(encoding="utf-8"))
            ms = apply_migration(conn, m, runner, git_sha)
            print(f"OK in {ms}ms")
            if leaked:
                print(
                    f"  note: {m.id} sets session-level {', '.join(leaked)} — "
                    "reset before the next migration"
                )
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
