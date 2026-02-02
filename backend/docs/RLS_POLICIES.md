# Row Level Security (RLS) Policies - Automecanik

> Documentation generated as part of P4.3 RLS Policy Audit (2026-02-02)

## Overview

| Metric | Before P4.3 | After P4.3 |
|--------|-------------|------------|
| Tables with RLS enabled | 25 | **39** |
| Total policies | 15 | **57** |
| Coverage | Core customer data | Extended (SEO, UX, RAG, KG) |

**P4.3 Migration applied:** 2026-02-02

## Tables with RLS Enabled

### Customer Data (4 tables)

| Table | Policies | Description |
|-------|----------|-------------|
| `Customer` | 2 | User profile data |
| `MagicLink` | 1 | Authentication tokens |
| `Quote` | 2 | Customer quotes |
| `QuoteItem` | 2 | Quote line items |

### Admin Gmail Integration (6 tables)

| Table | Policies | Description |
|-------|----------|-------------|
| `admin_gmail_attachments` | 1 | Email attachments |
| `admin_gmail_audit` | 1 | Audit log |
| `admin_gmail_config` | 1 | Config settings |
| `admin_gmail_emails` | 1 | Synced emails |
| `admin_gmail_sync_log` | 1 | Sync history |
| `admin_gmail_threads` | 1 | Email threads |

### Knowledge Graph (15 tables)

| Table | Policies | Description |
|-------|----------|-------------|
| `kg_audit_log` | 2 | KG audit trail |
| `kg_confidence_config` | 1 | Confidence settings |
| `kg_edge_history` | 1 | Edge change history |
| `kg_edges` | 1 | Graph edges |
| `kg_feedback_events` | 1 | User feedback |
| `kg_maintenance_history` | 1 | Maintenance log |
| `kg_maintenance_rules` | 1 | Auto-maintenance rules |
| `kg_node_history` | 1 | Node change history |
| `kg_nodes` | 1 | Graph nodes |
| `kg_rag_document_mapping` | 1 | RAG doc mappings |
| `kg_rag_sync_log` | 1 | RAG sync history |
| `kg_reasoning_cache` | 1 | Cached reasoning |
| `kg_truth_labels` | 1 | Truth source labels |
| `kg_vehicle_usage_profiles` | 1 | Vehicle usage data |
| `kg_weight_adjustments` | 1 | Edge weight tuning |

## Policy Patterns

### Pattern 1: Service Role Full Access
```sql
CREATE POLICY "service_role_full_access" ON table_name
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
```
Used for: All admin/backend tables

### Pattern 2: User Owns Data
```sql
CREATE POLICY "users_own_data" ON table_name
    FOR SELECT
    USING ((auth.uid())::text = user_id);
```
Used for: Customer, Quote tables

### Pattern 3: Authenticated Read
```sql
CREATE POLICY "authenticated_select" ON table_name
    FOR SELECT
    TO authenticated
    USING (true);
```
Used for: kg_audit_log (read-only for authenticated users)

### Pattern 4: Deny Anonymous
```sql
CREATE POLICY "deny_anon_access" ON table_name
    FOR ALL
    TO anon
    USING (false);
```
Used for: Sensitive customer data tables

## New Tables (Pending RLS)

These tables have RLS configured in local migrations (not yet applied):

| Table | Migration File | Status |
|-------|---------------|--------|
| `__claims` | `20260202_create_claims_table.sql` | Pending apply |
| `__quote_requests` | `20260202_create_quotes_tables.sql` | Pending apply |
| `__quotes` | `20260202_create_quotes_tables.sql` | Pending apply |

## Tables Without RLS (By Design)

### SEO/Public Content Tables
- `__seo_*` (23+ tables) - Public SEO content, no sensitive data
- `__blog_*` - Public blog articles

### Product Catalog
- `__products` - Public product catalog
- `__gammes` - Product categories
- `__families` - Product families

These tables contain public data and are designed to be accessible without authentication.

## Security Checklist for New Tables

When creating new tables with customer data:

1. **Enable RLS immediately after CREATE TABLE:**
   ```sql
   ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;
   ALTER TABLE new_table FORCE ROW LEVEL SECURITY;
   ```

2. **Add service_role bypass (for backend):**
   ```sql
   CREATE POLICY "service_role_full_access" ON new_table
       FOR ALL TO service_role
       USING (true) WITH CHECK (true);
   ```

3. **Deny anonymous access:**
   ```sql
   CREATE POLICY "deny_anon_access" ON new_table
       FOR ALL TO anon
       USING (false);
   ```

4. **If users need direct access, add user policy:**
   ```sql
   CREATE POLICY "users_own_data" ON new_table
       FOR ALL
       USING (auth.uid()::text = user_id::text);
   ```

5. **Run security advisor check:**
   ```bash
   # Via Supabase MCP
   mcp__supabase__get_advisors type=security
   ```

## Verification Commands

```sql
-- List all tables with RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;

-- List all policies
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check specific table RLS
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'your_table_name';
```

## Incident History

### 2026-02-02: P4.3 RLS Audit
- Identified 3 customer data tables without RLS: `__claims`, `__quote_requests`, `__quotes`
- Added RLS to table creation migrations
- Created standalone RLS migration for existing deployments
- Documented all 25 tables with RLS

---

*Last updated: 2026-02-02 - P4.3 RLS Policy Audit*
