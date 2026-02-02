-- ============================================================================
-- MIGRATION: P4.3 RLS Security Hardening
-- ============================================================================
-- Addresses security advisor findings:
-- 1. mcp_validation_log - Contains session_id (sensitive)
-- 2. SEO/UX tables exposed without RLS (less critical, public content)
-- 3. KG tables with RLS but no policies
--
-- Date: 2026-02-02
-- Phase: P4.3 RLS Policy Audit
-- ============================================================================

-- ============================================================================
-- CRITICAL: mcp_validation_log - Contains sensitive session_id
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'mcp_validation_log') THEN
        -- Enable RLS
        ALTER TABLE mcp_validation_log ENABLE ROW LEVEL SECURITY;
        ALTER TABLE mcp_validation_log FORCE ROW LEVEL SECURITY;

        -- Drop existing policies if any
        DROP POLICY IF EXISTS "service_role_full_access_mcp" ON mcp_validation_log;
        DROP POLICY IF EXISTS "deny_anon_access_mcp" ON mcp_validation_log;

        -- Service role has full access (backend)
        CREATE POLICY "service_role_full_access_mcp" ON mcp_validation_log
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        -- Deny anonymous access
        CREATE POLICY "deny_anon_access_mcp" ON mcp_validation_log
            FOR ALL
            TO anon
            USING (false);

        RAISE NOTICE 'RLS enabled on mcp_validation_log (contains session_id)';
    END IF;
END $$;

-- ============================================================================
-- Knowledge Graph tables - Add missing policies
-- These tables have RLS enabled but no policies, causing complete lockout
-- ============================================================================

DO $$
DECLARE
    kg_tables TEXT[] := ARRAY[
        'kg_confidence_config',
        'kg_edge_history',
        'kg_edges',
        'kg_feedback_events',
        'kg_maintenance_history',
        'kg_maintenance_rules',
        'kg_node_history',
        'kg_nodes',
        'kg_rag_document_mapping',
        'kg_rag_sync_log',
        'kg_reasoning_cache',
        'kg_truth_labels',
        'kg_vehicle_usage_profiles',
        'kg_weight_adjustments'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY kg_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            -- Create service_role policy if missing
            EXECUTE format('
                DROP POLICY IF EXISTS "service_role_full_access" ON %I;
                CREATE POLICY "service_role_full_access" ON %I
                    FOR ALL TO service_role
                    USING (true) WITH CHECK (true);
            ', t, t);

            RAISE NOTICE 'Added service_role policy to %', t;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- SEO Tables - These contain public content, but should have RLS for defense-in-depth
-- We'll allow authenticated read but restrict write to service_role
-- ============================================================================

DO $$
DECLARE
    seo_tables TEXT[] := ARRAY[
        '__seo_entity',
        '__seo_page',
        '__seo_index_status',
        '__seo_entity_health',
        '__seo_keywords',
        '__seo_sync_runs',
        '__seo_reference',
        '__seo_observable'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY seo_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

            -- Drop existing policies
            EXECUTE format('DROP POLICY IF EXISTS "public_read_seo" ON %I', t);
            EXECUTE format('DROP POLICY IF EXISTS "service_role_write_seo" ON %I', t);

            -- Allow public read (this is SEO content)
            EXECUTE format('
                CREATE POLICY "public_read_seo" ON %I
                    FOR SELECT
                    USING (true);
            ', t);

            -- Only service_role can write
            EXECUTE format('
                CREATE POLICY "service_role_write_seo" ON %I
                    FOR ALL TO service_role
                    USING (true) WITH CHECK (true);
            ', t);

            RAISE NOTICE 'RLS enabled on % (public read, service_role write)', t;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- UX Tables - Admin/internal data
-- ============================================================================

DO $$
DECLARE
    ux_tables TEXT[] := ARRAY[
        '__ux_captures',
        '__ux_debt',
        '__ux_design_systems',
        '__ux_perf_gates'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ux_tables
    LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
            EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);

            EXECUTE format('DROP POLICY IF EXISTS "service_role_full_ux" ON %I', t);
            EXECUTE format('DROP POLICY IF EXISTS "deny_anon_ux" ON %I', t);

            EXECUTE format('
                CREATE POLICY "service_role_full_ux" ON %I
                    FOR ALL TO service_role
                    USING (true) WITH CHECK (true);
            ', t);

            EXECUTE format('
                CREATE POLICY "deny_anon_ux" ON %I
                    FOR ALL TO anon
                    USING (false);
            ', t);

            RAISE NOTICE 'RLS enabled on % (service_role only)', t;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- RAG Knowledge - Internal knowledge base
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '__rag_knowledge') THEN
        ALTER TABLE __rag_knowledge ENABLE ROW LEVEL SECURITY;
        ALTER TABLE __rag_knowledge FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "service_role_full_rag" ON __rag_knowledge;
        DROP POLICY IF EXISTS "authenticated_read_rag" ON __rag_knowledge;

        CREATE POLICY "service_role_full_rag" ON __rag_knowledge
            FOR ALL TO service_role
            USING (true) WITH CHECK (true);

        -- Authenticated users can read (for AI features)
        CREATE POLICY "authenticated_read_rag" ON __rag_knowledge
            FOR SELECT TO authenticated
            USING (true);

        RAISE NOTICE 'RLS enabled on __rag_knowledge';
    END IF;
END $$;

-- ============================================================================
-- Audit Summary
-- ============================================================================
DO $$
DECLARE
    rls_count INTEGER;
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO rls_count
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true;

    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    RAISE NOTICE '=== P4.3 RLS Hardening Complete ===';
    RAISE NOTICE 'Tables with RLS: %', rls_count;
    RAISE NOTICE 'Total policies: %', policy_count;
END $$;
