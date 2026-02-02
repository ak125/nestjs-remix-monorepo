-- ============================================================================
-- MIGRATION: P4.3 RLS Policy Audit - Customer Data Protection
-- ============================================================================
-- Adds Row Level Security to customer data tables to prevent unauthorized access
-- Tables: __claims, __quote_requests, __quotes
--
-- Security Model:
-- - Anonymous users (anon key): NO ACCESS
-- - Authenticated users: NO ACCESS (data accessed via backend service_role)
-- - Service role (backend): FULL ACCESS
-- - Admin users (level >= 7): FULL ACCESS via admin endpoints
--
-- Date: 2026-02-02
-- Phase: P4.3 RLS Policy Audit
-- ============================================================================

-- ============================================================================
-- Table: __claims - Customer complaints/claims
-- ============================================================================

-- Enable RLS (safe even if table doesn't exist yet - will apply when table is created)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '__claims') THEN
        ALTER TABLE __claims ENABLE ROW LEVEL SECURITY;

        -- Force RLS for table owner too (extra security)
        ALTER TABLE __claims FORCE ROW LEVEL SECURITY;

        -- Drop existing policies if any (for idempotency)
        DROP POLICY IF EXISTS "service_role_full_access_claims" ON __claims;
        DROP POLICY IF EXISTS "deny_anon_access_claims" ON __claims;
        DROP POLICY IF EXISTS "deny_authenticated_direct_claims" ON __claims;

        -- Policy 1: Service role has full access (backend)
        CREATE POLICY "service_role_full_access_claims" ON __claims
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        -- Policy 2: Explicitly deny anonymous access
        -- Note: With RLS enabled and no policy for anon, they're already denied
        -- But we add an explicit deny for clarity in policy list
        CREATE POLICY "deny_anon_access_claims" ON __claims
            FOR ALL
            TO anon
            USING (false);

        RAISE NOTICE 'RLS enabled on __claims with service_role bypass';
    ELSE
        RAISE NOTICE 'Table __claims does not exist yet - RLS will be applied after table creation';
    END IF;
END $$;

-- ============================================================================
-- Table: __quote_requests - Customer quote requests
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '__quote_requests') THEN
        ALTER TABLE __quote_requests ENABLE ROW LEVEL SECURITY;
        ALTER TABLE __quote_requests FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "service_role_full_access_quote_requests" ON __quote_requests;
        DROP POLICY IF EXISTS "deny_anon_access_quote_requests" ON __quote_requests;

        CREATE POLICY "service_role_full_access_quote_requests" ON __quote_requests
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        CREATE POLICY "deny_anon_access_quote_requests" ON __quote_requests
            FOR ALL
            TO anon
            USING (false);

        RAISE NOTICE 'RLS enabled on __quote_requests with service_role bypass';
    ELSE
        RAISE NOTICE 'Table __quote_requests does not exist yet';
    END IF;
END $$;

-- ============================================================================
-- Table: __quotes - Generated quotes
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '__quotes') THEN
        ALTER TABLE __quotes ENABLE ROW LEVEL SECURITY;
        ALTER TABLE __quotes FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "service_role_full_access_quotes" ON __quotes;
        DROP POLICY IF EXISTS "deny_anon_access_quotes" ON __quotes;

        CREATE POLICY "service_role_full_access_quotes" ON __quotes
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        CREATE POLICY "deny_anon_access_quotes" ON __quotes
            FOR ALL
            TO anon
            USING (false);

        RAISE NOTICE 'RLS enabled on __quotes with service_role bypass';
    ELSE
        RAISE NOTICE 'Table __quotes does not exist yet';
    END IF;
END $$;

-- ============================================================================
-- IMPORTANT: If tables are created later, RLS must be enabled manually
-- Add this to the table creation migrations:
--
-- ALTER TABLE __claims ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE __claims FORCE ROW LEVEL SECURITY;
-- (same for __quote_requests and __quotes)
-- ============================================================================

-- ============================================================================
-- Audit: Verify RLS status for all customer-facing tables
-- ============================================================================
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '=== RLS Status Audit ===';
    FOR rec IN
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE '__%'
        AND tablename NOT LIKE '__seo_%'
        AND tablename NOT LIKE '__blog_%'
        ORDER BY tablename
    LOOP
        RAISE NOTICE 'Table: % | RLS: %', rec.tablename, rec.rowsecurity;
    END LOOP;
END $$;
