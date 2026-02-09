# Database Migration Skill

Supabase migration patterns, RLS audit, schema validation. Guides safe DDL operations against the Supabase database.

## When to Activate
- Invoke with `/db-migration`
- When creating SQL migrations
- When modifying table schemas or RLS policies

## Migration File Location
- `backend/supabase/migrations/YYYYMMDD_description.sql`

## Pre-Migration Checklist

1. **Test SQL** in dev environment first (use `mcp__supabase__execute_sql`)
2. **Verify no breaking changes** to existing RPC functions
3. **Check RLS impact** on existing queries
4. **Verify key access patterns** — service_role (backend) vs anon (frontend)
5. **Run advisors after migration** — `mcp__supabase__get_advisors` for security + performance

## Safe Patterns

```sql
-- Always use IF NOT EXISTS / IF EXISTS
CREATE TABLE IF NOT EXISTS my_table (...);
CREATE INDEX IF NOT EXISTS idx_name ON my_table (column);
DROP TABLE IF EXISTS old_table;

-- Wrap multi-statement migrations
BEGIN;
  ALTER TABLE my_table ADD COLUMN new_col TEXT;
  CREATE INDEX idx_new ON my_table (new_col);
COMMIT;

-- Add comments explaining purpose
COMMENT ON TABLE my_table IS 'Description of table purpose';
```

## RLS Audit Patterns

- **Every new table MUST have RLS enabled:** `ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;`
- Verify policies cover: SELECT, INSERT, UPDATE, DELETE
- Backend uses `service_role` key (bypasses RLS)
- Frontend uses `anon` key (subject to RLS)
- After adding RLS, test with both keys

## MCP Tools Available

| Tool | Use |
|------|-----|
| `mcp__supabase__apply_migration` | DDL operations (CREATE, ALTER, DROP) |
| `mcp__supabase__execute_sql` | DML/queries (SELECT, INSERT, UPDATE) |
| `mcp__supabase__list_tables` | Verify schema after changes |
| `mcp__supabase__get_advisors` | Security + performance check |
| `mcp__supabase__list_migrations` | Check existing migrations |

## Anti-Patterns (BLOCK)

- `DROP TABLE` without backup/confirmation
- `ALTER TABLE` with data loss potential (dropping columns with data)
- Disabling RLS on tables with user data
- Running DDL directly via `execute_sql` (use `apply_migration` for audit trail)
- Missing `IF NOT EXISTS` on CREATE statements
- Forgetting to add RLS policies on new tables
