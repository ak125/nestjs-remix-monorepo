-- squawk-ignore-file prefer-bigint-over-int
-- squawk-ignore-file require-timeout-settings
-- (require-timeout-settings: 3 brand-new tables + 2 indexes on them — no lock
--  contention on existing data, so explicit lock/statement timeouts add nothing.
--  prefer-bigint: all int columns are hard-bounded — piece_id mirrors the canonical pieces.piece_id
--  int4 — same type required for joins/index; reliability_score/confidence are CHECK
--  0-100; delay_days/state_counter/default_ttl_minutes/projection_version/latency_ms
--  are small counters. No int4 overflow possible; bigint would drift from the key type.)
-- =====================================================
-- Supplier Availability Truth V1 — schema (Tasks 8/10)
-- Date: 2026-05-20
-- Refs: /home/deploy/.claude/plans/suite-a-pb-de-precious-ritchie.md
--       docs/superpowers/specs/2026-05-20-supplier-truth-audit.md
-- =====================================================
--
-- Operational-truth layer for part availability. Keyed on the existing canonical
-- piece_id (int). Three layers:
--   - supplier_inventory_snapshots : Layer 2, APPEND-ONLY (insert only, never update/delete)
--   - supplier_truth_projection    : Layer 3, 1 canonical row per piece_id (funnel reads ONLY this)
--   - supplier_runtime_profile     : minimal per-supplier operational profile (reliability/quarantine/ttl)
--
-- Service-role only (RLS enabled, no anon policy) — follows the __seo_* convention.
-- Does NOT touch SEO/URLs, payment, or piece_display.
-- =====================================================

-- ---------- Layer 2: append-only raw snapshots ----------
CREATE TABLE IF NOT EXISTS supplier_inventory_snapshots (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id          text NOT NULL,                 -- ___xtr_supplier.spl_id
  piece_id             integer,                        -- resolved canonical key (nullable = unresolved)
  raw_ref              text NOT NULL,                  -- ref as the supplier returned it
  normalized_ref       text NOT NULL,                  -- via normalizeOemRef()
  available            boolean NOT NULL,
  delay_days           integer,
  parse_error          boolean NOT NULL DEFAULT false,
  latency_ms           integer,
  fetched_at           timestamptz NOT NULL DEFAULT now(),
  source_verified_at   timestamptz,                    -- portal's own last-sync, when exposed
  freshness_provenance text NOT NULL DEFAULT 'CONNECTOR_FETCHED'
                         CHECK (freshness_provenance IN ('PORTAL_REPORTED','CONNECTOR_FETCHED','ESTIMATED')),
  price_buy_ht         numeric,                         -- V2 tarif; null in V1
  raw                  jsonb
);
CREATE INDEX IF NOT EXISTS idx_sis_piece_fetched
  ON supplier_inventory_snapshots (piece_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_sis_supplier_fetched
  ON supplier_inventory_snapshots (supplier_id, fetched_at DESC);

-- ---------- Layer 3: canonical projection (the ONLY thing the funnel reads) ----------
CREATE TABLE IF NOT EXISTS supplier_truth_projection (
  piece_id              integer PRIMARY KEY,
  state                 text NOT NULL
                          CHECK (state IN ('VERIFIED_AVAILABLE','SUPPLIER_PENDING','BACKORDER',
                                           'DEGRADED','STALE','UNKNOWN',
                                           'HARD_CONFLICT','SOFT_CONFLICT','DEGRADED_CONSENSUS')),
  confidence            integer NOT NULL DEFAULT 0 CHECK (confidence BETWEEN 0 AND 100),
  delay_days            integer,
  source_supplier       text,
  conflict_kind         text NOT NULL DEFAULT 'NONE'
                          CHECK (conflict_kind IN ('NONE','SOFT_CONFLICT','HARD_CONFLICT','DEGRADED_CONSENSUS')),
  state_since           timestamptz NOT NULL DEFAULT now(),
  state_counter         integer NOT NULL DEFAULT 0,
  projected_at          timestamptz NOT NULL DEFAULT now(),
  -- structured provenance (deterministic, not free text)
  projection_reason_code text,
  projection_metadata    jsonb,
  projection_inputs_hash text,
  projection_version     integer NOT NULL DEFAULT 1
);

-- ---------- Minimal per-supplier operational profile ----------
CREATE TABLE IF NOT EXISTS supplier_runtime_profile (
  supplier_id        text PRIMARY KEY,                 -- ___xtr_supplier.spl_id
  reliability_score  integer CHECK (reliability_score BETWEEN 0 AND 100), -- nullable = cold start
  mismatch_rate      numeric NOT NULL DEFAULT 0,        -- needs fulfillment-outcome feed (else neutral)
  parse_error_rate   numeric NOT NULL DEFAULT 0,
  timeout_rate       numeric NOT NULL DEFAULT 0,
  unresolved_rate    numeric NOT NULL DEFAULT 0,
  default_ttl_minutes integer,
  connector_state    text NOT NULL DEFAULT 'ACTIVE'
                       CHECK (connector_state IN ('ACTIVE','QUARANTINED','RECOVERING')),
  quarantined_since  timestamptz,
  recovery_after     timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ---------- RLS: service-role only (no anon policy; service_role bypasses RLS) ----------
ALTER TABLE supplier_inventory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_truth_projection   ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_runtime_profile    ENABLE ROW LEVEL SECURITY;

-- ---------- KPI views (V1: SQL only; OTEL/time-series deferred V2) ----------
-- Coverage + state distribution over the projection.
CREATE OR REPLACE VIEW v_supplier_truth_state_distribution AS
SELECT state, COUNT(*) AS pieces,
       ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1) AS pct
FROM supplier_truth_projection
GROUP BY state;

-- Stale ratio = projections older than 24h vs total (pipeline health).
CREATE OR REPLACE VIEW v_supplier_truth_stale_ratio AS
SELECT
  COUNT(*) FILTER (WHERE projected_at < now() - interval '24 hours')::numeric
    / NULLIF(COUNT(*), 0) AS stale_ratio,
  COUNT(*) AS total_projected
FROM supplier_truth_projection;

-- NOTE: false_available_rate / mismatch_rate / unresolved_rate views depend on the
-- fulfillment-outcome feed (order cancellation reason) — added with the outcomes loop.
