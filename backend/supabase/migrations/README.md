# Supabase migrations

This directory holds every schema migration for the canonical Supabase
project. They are applied by the workflow
`.github/workflows/apply-supabase-migrations.yml` (manual trigger),
which runs the engine `scripts/ci/apply-supabase-migration.py`.

## Naming convention

```
YYYYMMDD_name_in_snake_case.sql                 # 8-digit version (date only)
YYYYMMDDHHMMSS_name_in_snake_case.sql           # 14-digit version (timestamp)
```

Filename regex: `^(\d{8}|\d{14})_([a-z0-9_]+)\.sql$`. The runner skips
anything else (with a warning) and refuses out-of-order or duplicate
version prefixes.

`.down.sql` files are **ignored** by the runner — see "Forward-only" below.

## Forward-only policy (canonical)

This project applies migrations in **one direction only**. The engine
ignores `.down.sql` siblings — they exist solely as documentation for
manual operator intervention in emergencies (e.g. wiping a broken
deploy on a staging branch).

To correct a previous migration, ship a **new migration** with a later
version that performs the correction (additive change). The tracking
table `infra.schema_migrations` is append-only (no `DELETE` grant) to
enforce this discipline.

Reference: same pattern used by Flyway, Sqitch, dbmate, golang-migrate
(forward-only mode), Prisma Migrate (`deploy` command).

## Idempotency

Every migration must be safe to **re-run as a no-op**. Use:

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE OR REPLACE FUNCTION`
- `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER`
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

The engine stores a SHA-256 checksum of each file's bytes the first
time it applies. A later run with the **same version but different
bytes** is a **HARD FAIL** (`drift` state). Append-only edits only.

## Non-transactional migrations

A handful of PostgreSQL commands refuse to run inside a transaction
block:

- `CREATE INDEX CONCURRENTLY`
- `DROP INDEX CONCURRENTLY`
- `REINDEX … CONCURRENTLY`
- `VACUUM`
- `REFRESH MATERIALIZED VIEW CONCURRENTLY`
- `ALTER SYSTEM`

For those, add an **explicit header marker** in the first 20 lines:

```sql
-- @non_transactional
--
-- Rationale : CREATE INDEX CONCURRENTLY ne tolère pas BEGIN/COMMIT.
SET statement_timeout = '5min';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_foo ON public.bar (col);
```

The engine switches to autocommit, inserts a row with
`status='applying'`, runs the SQL, then flips the row to
`status='applied'`. If the SQL crashes mid-run the row stays in
`'applying'` and the next workflow run **HARD FAILs** until a human
investigates.

Why a marker and not a regex SQL parser : comment / dollar-quote /
PL/pgSQL bodies fool regex-based detection of `CONCURRENTLY`. The
marker is deterministic, reviewable, and dialect-agnostic.

## CLI cheatsheet

```bash
# Status table (read-only, exits non-zero on drift / applying / failed)
python3 scripts/ci/apply-supabase-migration.py --status

# Dry-run apply (no writes)
python3 scripts/ci/apply-supabase-migration.py --dry-run

# Apply
python3 scripts/ci/apply-supabase-migration.py

# Apply at most N migrations (staged rollout)
python3 scripts/ci/apply-supabase-migration.py --limit 1

# Self-tests (no DB connection)
python3 scripts/ci/apply-supabase-migration.py --self-test
```

`DATABASE_URL` must be set in env for the non-`--self-test` modes.

## Tracking table

```sql
CREATE SCHEMA IF NOT EXISTS infra;

CREATE TABLE infra.schema_migrations (
  id             TEXT PRIMARY KEY,                       -- filename stem, e.g. "20260518_seo_admin_job_table"
  checksum       TEXT NOT NULL,                          -- sha256(file bytes)
  status         TEXT NOT NULL DEFAULT 'applied'
                 CHECK (status IN ('applying', 'applied', 'failed')),
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at     TIMESTAMPTZ,
  execution_ms   INTEGER,
  runner         TEXT,                                   -- ex: gh-actions:25965...
  git_sha        TEXT,
  error_message  TEXT
);

GRANT SELECT, INSERT ON infra.schema_migrations TO service_role;
GRANT UPDATE (status, applied_at, execution_ms, error_message)
  ON infra.schema_migrations TO service_role;
-- No DELETE grant : append-only ledger.
```

Why our own schema and not `supabase_migrations.schema_migrations` :
the `supabase_migrations.*` schema is a Supabase **internal** that may
mutate without notice (added columns, renamed fields, semantic shifts).
Vendor coupling avoided.

## Concurrency

The engine acquires `pg_try_advisory_lock(88442211)` at start. If
another runner already holds it the workflow **fails fast** with a
clear message rather than blocking the runner. The lock is
session-scoped — auto-released on disconnect or crash.
