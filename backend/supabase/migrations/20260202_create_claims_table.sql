-- ============================================================================
-- MIGRATION: Create __claims table for customer claims persistence
-- ============================================================================
-- Migrates ClaimService from in-memory Map to Supabase persistence
-- Prevents data loss on server restart and enables horizontal scaling
--
-- Date: 2026-02-02
-- ============================================================================

-- ============================================================================
-- Enums for claim types and statuses
-- ============================================================================
CREATE TYPE claim_type_enum AS ENUM (
    'defective_product',
    'wrong_product',
    'missing_product',
    'delivery_issue',
    'billing_issue',
    'service_complaint',
    'other'
);

CREATE TYPE claim_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

CREATE TYPE claim_status_enum AS ENUM (
    'open',
    'investigating',
    'pending_customer',
    'pending_supplier',
    'resolved',
    'closed',
    'rejected'
);

CREATE TYPE claim_resolution_type_enum AS ENUM (
    'refund',
    'replacement',
    'repair',
    'credit',
    'compensation',
    'explanation',
    'other'
);

-- ============================================================================
-- Table: __claims
-- ============================================================================
-- Stores customer claims with full timeline history
-- ============================================================================
CREATE TABLE IF NOT EXISTS __claims (
    clm_id TEXT PRIMARY KEY,
    clm_customer_id TEXT NOT NULL,
    clm_customer_name TEXT NOT NULL,
    clm_customer_email TEXT NOT NULL,
    clm_customer_phone TEXT,
    clm_order_id TEXT,
    clm_product_id TEXT,
    clm_type claim_type_enum NOT NULL,
    clm_priority claim_priority_enum NOT NULL DEFAULT 'normal',
    clm_status claim_status_enum NOT NULL DEFAULT 'open',
    clm_title TEXT NOT NULL,
    clm_description TEXT NOT NULL,
    clm_expected_resolution TEXT NOT NULL,
    clm_attachments TEXT[] DEFAULT '{}',
    clm_assigned_to TEXT,
    -- Resolution stored as JSONB for flexibility
    clm_resolution JSONB,
    -- Timeline is an array of entries stored as JSONB
    clm_timeline JSONB NOT NULL DEFAULT '[]'::JSONB,
    -- Satisfaction rating
    clm_satisfaction JSONB,
    -- Timestamps
    clm_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clm_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    clm_resolved_at TIMESTAMPTZ,
    clm_escalated_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_claims_customer_id ON __claims(clm_customer_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON __claims(clm_status);
CREATE INDEX IF NOT EXISTS idx_claims_type ON __claims(clm_type);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON __claims(clm_priority);
CREATE INDEX IF NOT EXISTS idx_claims_assigned_to ON __claims(clm_assigned_to);
CREATE INDEX IF NOT EXISTS idx_claims_order_id ON __claims(clm_order_id);
CREATE INDEX IF NOT EXISTS idx_claims_created_at ON __claims(clm_created_at DESC);

COMMENT ON TABLE __claims IS 'Customer claims with full timeline history - migrated from in-memory Map';

-- ============================================================================
-- Trigger: Update clm_updated_at on modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.clm_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_claims_updated_at
    BEFORE UPDATE ON __claims
    FOR EACH ROW
    EXECUTE FUNCTION update_claims_updated_at();

-- ============================================================================
-- RPC: Get claim statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_claim_stats(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH filtered_claims AS (
        SELECT *
        FROM __claims
        WHERE (p_start_date IS NULL OR clm_created_at >= p_start_date)
          AND (p_end_date IS NULL OR clm_created_at <= p_end_date)
    ),
    stats AS (
        SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE clm_status NOT IN ('resolved', 'closed', 'rejected')) as open,
            COUNT(*) FILTER (WHERE clm_status IN ('resolved', 'closed')) as resolved,
            COALESCE(
                AVG(
                    EXTRACT(EPOCH FROM (clm_resolved_at - clm_created_at)) / 3600
                ) FILTER (WHERE clm_resolved_at IS NOT NULL),
                0
            ) as avg_resolution_hours,
            COALESCE(
                AVG((clm_satisfaction->>'rating')::numeric) FILTER (WHERE clm_satisfaction IS NOT NULL),
                0
            ) as satisfaction_rating
        FROM filtered_claims
    ),
    type_breakdown AS (
        SELECT jsonb_object_agg(clm_type::text, cnt)
        FROM (
            SELECT clm_type, COUNT(*) as cnt
            FROM filtered_claims
            GROUP BY clm_type
        ) t
    ),
    priority_breakdown AS (
        SELECT jsonb_object_agg(clm_priority::text, cnt)
        FROM (
            SELECT clm_priority, COUNT(*) as cnt
            FROM filtered_claims
            GROUP BY clm_priority
        ) t
    ),
    resolution_breakdown AS (
        SELECT jsonb_object_agg(res_type, cnt)
        FROM (
            SELECT clm_resolution->>'type' as res_type, COUNT(*) as cnt
            FROM filtered_claims
            WHERE clm_resolution IS NOT NULL
            GROUP BY clm_resolution->>'type'
        ) t
    )
    SELECT json_build_object(
        'total', (SELECT total FROM stats),
        'open', (SELECT open FROM stats),
        'resolved', (SELECT resolved FROM stats),
        'averageResolutionTime', ROUND((SELECT avg_resolution_hours FROM stats)::numeric, 2),
        'satisfactionRating', ROUND((SELECT satisfaction_rating FROM stats)::numeric, 2),
        'typeBreakdown', COALESCE((SELECT * FROM type_breakdown), '{}'::jsonb),
        'priorityBreakdown', COALESCE((SELECT * FROM priority_breakdown), '{}'::jsonb),
        'resolutionTypeBreakdown', COALESCE((SELECT * FROM resolution_breakdown), '{}'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_claim_stats IS 'Returns aggregated claim statistics for a given period';

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT ALL ON TABLE __claims TO service_role;
GRANT EXECUTE ON FUNCTION get_claim_stats TO service_role;

-- ============================================================================
-- Row Level Security (P4.3 - RLS Policy Audit)
-- ============================================================================
-- Enable RLS to protect customer data
ALTER TABLE __claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE __claims FORCE ROW LEVEL SECURITY;

-- Service role (backend) has full access
CREATE POLICY "service_role_full_access" ON __claims
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Deny anonymous access explicitly
CREATE POLICY "deny_anon_access" ON __claims
    FOR ALL
    TO anon
    USING (false);
