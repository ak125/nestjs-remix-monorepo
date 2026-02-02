-- ============================================================================
-- MIGRATION: Create __quote_requests and __quotes tables
-- ============================================================================
-- Migrates QuoteService from in-memory Maps to Supabase persistence
-- Prevents data loss on server restart and enables horizontal scaling
--
-- Date: 2026-02-02
-- ============================================================================

-- ============================================================================
-- Enums for quote statuses
-- ============================================================================
CREATE TYPE quote_request_status_enum AS ENUM (
    'pending',
    'in_review',
    'quoted',
    'accepted',
    'rejected',
    'expired'
);

CREATE TYPE quote_request_priority_enum AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);

CREATE TYPE quote_status_enum AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired'
);

-- ============================================================================
-- Table: __quote_requests
-- ============================================================================
-- Stores customer quote requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS __quote_requests (
    qr_id TEXT PRIMARY KEY,
    qr_customer_name TEXT NOT NULL,
    qr_customer_email TEXT NOT NULL,
    qr_customer_phone TEXT,
    qr_company_name TEXT,
    qr_project_description TEXT NOT NULL,
    -- Products stored as JSONB array
    qr_required_products JSONB NOT NULL DEFAULT '[]'::JSONB,
    qr_estimated_budget TEXT,
    qr_preferred_delivery_date TIMESTAMPTZ,
    qr_status quote_request_status_enum NOT NULL DEFAULT 'pending',
    qr_priority quote_request_priority_enum NOT NULL DEFAULT 'normal',
    qr_attachments TEXT[] DEFAULT '{}',
    qr_notes TEXT,
    qr_assigned_to TEXT,
    -- Reference to the quote if one was created
    qr_quote_id TEXT,
    -- Timestamps
    qr_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    qr_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON __quote_requests(qr_status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_priority ON __quote_requests(qr_priority);
CREATE INDEX IF NOT EXISTS idx_quote_requests_assigned_to ON __quote_requests(qr_assigned_to);
CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON __quote_requests(qr_created_at DESC);

COMMENT ON TABLE __quote_requests IS 'Customer quote requests - migrated from in-memory Map';

-- ============================================================================
-- Table: __quotes
-- ============================================================================
-- Stores quotes created in response to quote requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS __quotes (
    qt_id TEXT PRIMARY KEY,
    qt_quote_request_id TEXT NOT NULL REFERENCES __quote_requests(qr_id) ON DELETE CASCADE,
    -- Quoted items stored as JSONB array
    qt_quoted_items JSONB NOT NULL DEFAULT '[]'::JSONB,
    qt_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qt_taxes NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qt_shipping NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qt_discount NUMERIC(12, 2),
    qt_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qt_valid_until TIMESTAMPTZ NOT NULL,
    qt_terms TEXT NOT NULL DEFAULT '',
    qt_created_by TEXT NOT NULL,
    qt_status quote_status_enum NOT NULL DEFAULT 'draft',
    -- Timestamps
    qt_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_request_id ON __quotes(qt_quote_request_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON __quotes(qt_status);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON __quotes(qt_created_at DESC);

COMMENT ON TABLE __quotes IS 'Quotes created for quote requests - migrated from in-memory Map';

-- ============================================================================
-- Trigger: Update qr_updated_at on modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_quote_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.qr_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_quote_requests_updated_at
    BEFORE UPDATE ON __quote_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_quote_requests_updated_at();

-- ============================================================================
-- RPC: Get quote statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_quote_stats(
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
    WITH filtered_requests AS (
        SELECT *
        FROM __quote_requests
        WHERE (p_start_date IS NULL OR qr_created_at >= p_start_date)
          AND (p_end_date IS NULL OR qr_created_at <= p_end_date)
    ),
    filtered_quotes AS (
        SELECT *
        FROM __quotes
        WHERE (p_start_date IS NULL OR qt_created_at >= p_start_date)
          AND (p_end_date IS NULL OR qt_created_at <= p_end_date)
    ),
    stats AS (
        SELECT
            (SELECT COUNT(*) FROM filtered_requests) as total_requests,
            (SELECT COUNT(*) FROM filtered_quotes) as total_quotes,
            (SELECT COUNT(*) FROM filtered_quotes WHERE qt_status = 'accepted') as accepted_quotes,
            (SELECT COUNT(*) FROM filtered_quotes WHERE qt_status = 'rejected') as rejected_quotes,
            (SELECT COUNT(*) FROM filtered_requests WHERE qr_status = 'pending') as pending_requests,
            COALESCE(
                (SELECT SUM(qt_total) FROM filtered_quotes WHERE qt_status = 'accepted'),
                0
            ) as total_quote_value
    )
    SELECT json_build_object(
        'totalRequests', (SELECT total_requests FROM stats),
        'totalQuotes', (SELECT total_quotes FROM stats),
        'acceptedQuotes', (SELECT accepted_quotes FROM stats),
        'rejectedQuotes', (SELECT rejected_quotes FROM stats),
        'pendingRequests', (SELECT pending_requests FROM stats),
        'conversionRate', CASE
            WHEN (SELECT total_quotes FROM stats) > 0
            THEN ROUND(((SELECT accepted_quotes FROM stats)::numeric / (SELECT total_quotes FROM stats) * 100), 2)
            ELSE 0
        END,
        'totalQuoteValue', (SELECT total_quote_value FROM stats),
        'averageQuoteValue', CASE
            WHEN (SELECT accepted_quotes FROM stats) > 0
            THEN ROUND((SELECT total_quote_value FROM stats)::numeric / (SELECT accepted_quotes FROM stats), 2)
            ELSE 0
        END
    ) INTO v_result;

    RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_quote_stats IS 'Returns aggregated quote statistics for a given period';

-- ============================================================================
-- Permissions
-- ============================================================================
GRANT ALL ON TABLE __quote_requests TO service_role;
GRANT ALL ON TABLE __quotes TO service_role;
GRANT EXECUTE ON FUNCTION get_quote_stats TO service_role;

-- ============================================================================
-- Row Level Security (P4.3 - RLS Policy Audit)
-- ============================================================================
-- Enable RLS on __quote_requests to protect customer data
ALTER TABLE __quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE __quote_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON __quote_requests
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "deny_anon_access" ON __quote_requests
    FOR ALL
    TO anon
    USING (false);

-- Enable RLS on __quotes to protect quote data
ALTER TABLE __quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE __quotes FORCE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON __quotes
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "deny_anon_access" ON __quotes
    FOR ALL
    TO anon
    USING (false);
