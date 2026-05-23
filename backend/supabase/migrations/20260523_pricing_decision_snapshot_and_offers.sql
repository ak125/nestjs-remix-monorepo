-- =====================================================
-- Pricing Control Plane V1 — H1/H2 forensic & multi-supplier observatories
-- Date: 2026-05-23
-- Refs: plan pricing-control-plane-v1 (hardenings H1 + H2 — post owner review)
-- Type: ADDITIVE, append-only observatories. Read V1 = aucune (runtime unchanged).
-- =====================================================
--
-- H1 — pricing_decision_snapshot : audit trace per pricing decision (commit,
--      rollback, replay, qualifying dry-run, published simulation). Stores the
--      *reasoning* (rule_id, candidates, selection_reason, floor/cap, durations)
--      that pieces_price_history doesn't carry. Versioned reasoning_json (1.0.0).
--      Partitioned monthly by computed_at. GIN(reasoning_json) on hot partitions.
--      Retention: 24 months (drop partition + optional parquet export).
--
-- H2 — supplier_offer_snapshot : per-supplier observation timeline (price +
--      availability) fed by SupplierConnector implementations. Future-proofs
--      the 1-piece = N-offers reality without coupling runtime to it (V1 reads
--      from pieces_price only — supplier_offer is observatory).
--      Partitioned monthly by observed_at. No GIN. Anti-mutation trigger.
--      Retention: 18 months.
--
-- "Aucune nouvelle couche runtime" : ni H1 ni H2 ne sont lues par le storefront
-- ou par les services pricing au commit. Annexes lecture-zero-V1.
-- =====================================================

-- ----------------------------------------------------------------------------
-- H1.a — Decision type enum (separates forensic by nature).
-- Idempotent via DO block (CREATE TYPE has no IF NOT EXISTS prior to PG 14+).
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE pricing_decision_type AS ENUM (
    'DRY_RUN',          -- exécution sans écriture pieces_price (conservée si qualifying)
    'COMMIT',           -- commit chunked vers pieces_price
    'REPLAY',           -- re-exécution depuis supplier_import_raw (idempotence audit)
    'SIMULATION',       -- simulate() qualifiant (flag opt-in, volume contrôlé)
    'ROLLBACK_RESTORE'  -- restauration ligne via pieces_price_history (LIFO)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- H1 — pricing_decision_snapshot (partitioned monthly by computed_at).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_decision_snapshot (
  decision_id              UUID NOT NULL DEFAULT gen_random_uuid(),
  decision_type            pricing_decision_type NOT NULL,
  piece_id_i               INTEGER NOT NULL,
  supplier_id              TEXT NOT NULL,
  brand_pm_id              TEXT,
  -- SoT canonique du ruleset ; MIROIR strict dans reasoning_json.strategy_version
  -- (check d'égalité côté service au write, no silent acceptance d'un drift).
  strategy_version         TEXT NOT NULL,
  rule_id                  BIGINT,                                       -- pricing_rules.id (null si no_match)
  achat_ht_cents           BIGINT NOT NULL,
  target_margin_pct        NUMERIC(6,2),                                 -- avant floor/cap
  applied_margin_pct       NUMERIC(6,2),                                 -- après floor/cap (sérialisé 2-décimales pour decision_hash)
  floor_applied            BOOLEAN NOT NULL DEFAULT FALSE,
  cap_applied              BOOLEAN NOT NULL DEFAULT FALSE,
  computed_sell_ht_cents   BIGINT,
  computed_sell_ttc_cents  BIGINT,
  -- Strict, versioned JSON (schema_version='1.0.0' obligatoire ; clés fermées).
  -- Validé Zod côté service ; rejet si version inconnue ou clé extra.
  reasoning_json           JSONB NOT NULL,
  -- SHA256(canonical_json({piece_id_i, supplier_id, achat_ht_cents,
  --                         applied_margin_pct (string 2-dec), rule_id,
  --                         strategy_version, reasoning_schema_version})).
  -- Replay-detection : deux exécutions du même RAW produisent le même hash.
  decision_hash            TEXT NOT NULL,
  batch_id                 UUID REFERENCES price_import_batches (batch_id),
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (decision_id, computed_at)
) PARTITION BY RANGE (computed_at);

COMMENT ON TABLE pricing_decision_snapshot IS
  'H1 — Audit trace per pricing decision (commit/rollback/replay/dry-run/simulation). Append-only, partitioned monthly, GIN per-partition on reasoning_json. Zero runtime consumer V1.';

-- Pre-create 3 monthly partitions + default (same pattern as pieces_price_history).
CREATE TABLE IF NOT EXISTS pricing_decision_snapshot_2026_05
  PARTITION OF pricing_decision_snapshot FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS pricing_decision_snapshot_2026_06
  PARTITION OF pricing_decision_snapshot FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS pricing_decision_snapshot_2026_07
  PARTITION OF pricing_decision_snapshot FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS pricing_decision_snapshot_default
  PARTITION OF pricing_decision_snapshot DEFAULT;

-- B-tree indexes on the parent — Postgres propagates B-tree to all current +
-- future partitions automatically.
CREATE INDEX IF NOT EXISTS idx_pds_type_time
  ON pricing_decision_snapshot (decision_type, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pds_piece_time
  ON pricing_decision_snapshot (piece_id_i, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_pds_batch
  ON pricing_decision_snapshot (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pds_hash
  ON pricing_decision_snapshot (decision_hash);

-- GIN on reasoning_json — Postgres does NOT auto-propagate GIN definitions to
-- future partitions when declared on the parent; the maintenance function
-- (below) attaches a GIN index to each new monthly partition explicitly.
-- The initial GIN indexes are created on the existing partitions here.
CREATE INDEX IF NOT EXISTS idx_pds_2026_05_reasoning_gin
  ON pricing_decision_snapshot_2026_05 USING GIN (reasoning_json jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_pds_2026_06_reasoning_gin
  ON pricing_decision_snapshot_2026_06 USING GIN (reasoning_json jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_pds_2026_07_reasoning_gin
  ON pricing_decision_snapshot_2026_07 USING GIN (reasoning_json jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_pds_default_reasoning_gin
  ON pricing_decision_snapshot_default USING GIN (reasoning_json jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- H1 maintenance — ensure next monthly partition exists + create GIN per-partition.
-- Called by pg_cron (governed in a separate ops migration once cron is scheduled).
-- Pattern aligned with reference_partitioned_snapshot_tables_need_premake_cron.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION maintain_pricing_decision_snapshot_partitions()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_next_month DATE := date_trunc('month', now() + INTERVAL '1 month')::date;
  v_after      DATE := date_trunc('month', now() + INTERVAL '2 month')::date;
  v_part_name  TEXT := 'pricing_decision_snapshot_' || to_char(v_next_month, 'YYYY_MM');
  v_gin_name   TEXT := 'idx_pds_' || to_char(v_next_month, 'YYYY_MM') || '_reasoning_gin';
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF pricing_decision_snapshot FOR VALUES FROM (%L) TO (%L);',
    v_part_name, v_next_month, v_after
  );
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I USING GIN (reasoning_json jsonb_path_ops);',
    v_gin_name, v_part_name
  );
  RETURN format('ensured %s (+ GIN %s)', v_part_name, v_gin_name);
END $$;

COMMENT ON FUNCTION maintain_pricing_decision_snapshot_partitions IS
  'H1. Idempotently pre-creates the next monthly partition + per-partition GIN(reasoning_json). Schedule via pg_cron once monthly (e.g. on the 20th).';

-- ----------------------------------------------------------------------------
-- H2 — supplier_offer_snapshot (partitioned monthly by observed_at).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_offer_snapshot (
  offer_id            UUID NOT NULL DEFAULT gen_random_uuid(),
  piece_id_i          INTEGER NOT NULL,
  supplier_id         TEXT NOT NULL,                                     -- 'CAL', 'DistriCash', 'NED', …
  supplier_ref        TEXT NOT NULL,                                     -- ref fournisseur (peut différer de piece_ref)
  public_ht_cents     BIGINT,
  remise_pct          NUMERIC(6,2),
  achat_ht_cents      BIGINT,
  available           BOOLEAN,
  delay_days          INTEGER,
  parse_confidence    TEXT NOT NULL                                      -- HIGH_CONFIDENCE | AMBIGUOUS_MAPPING | EAN_FALLBACK | …
                      CHECK (parse_confidence IN ('HIGH_CONFIDENCE','AMBIGUOUS_MAPPING','FALLBACK_MATCH','EAN_FALLBACK','UNKNOWN')),
  source_verified_at  TIMESTAMPTZ,
  observed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, observed_at)
) PARTITION BY RANGE (observed_at);

COMMENT ON TABLE supplier_offer_snapshot IS
  'H2 — Per-supplier observation timeline. Append-only (anti-mutation trigger). Read V1 = none (pricing stays 1-piece-1-price). Future-proofs multi-supplier arbitrage without runtime coupling.';

CREATE TABLE IF NOT EXISTS supplier_offer_snapshot_2026_05
  PARTITION OF supplier_offer_snapshot FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS supplier_offer_snapshot_2026_06
  PARTITION OF supplier_offer_snapshot FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS supplier_offer_snapshot_2026_07
  PARTITION OF supplier_offer_snapshot FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS supplier_offer_snapshot_default
  PARTITION OF supplier_offer_snapshot DEFAULT;

CREATE INDEX IF NOT EXISTS idx_sos_piece_time
  ON supplier_offer_snapshot (piece_id_i, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_supplier_time
  ON supplier_offer_snapshot (supplier_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_ref
  ON supplier_offer_snapshot (supplier_ref);

-- ----------------------------------------------------------------------------
-- H2 anti-mutation trigger — append-only enforced at DB level.
-- UPDATE/DELETE on supplier_offer_snapshot is rejected (parent + all partitions
-- inherit triggers in PG 11+).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION supplier_offer_snapshot_reject_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'supplier_offer_snapshot is append-only (H2 invariant): % rejected', TG_OP
    USING ERRCODE = 'check_violation';
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_supplier_offer_snapshot_no_update
    BEFORE UPDATE ON supplier_offer_snapshot
    FOR EACH ROW
    EXECUTE FUNCTION supplier_offer_snapshot_reject_mutation();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_supplier_offer_snapshot_no_delete
    BEFORE DELETE ON supplier_offer_snapshot
    FOR EACH ROW
    EXECUTE FUNCTION supplier_offer_snapshot_reject_mutation();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- H2 maintenance — ensure next monthly partition exists.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION maintain_supplier_offer_snapshot_partitions()
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_next_month DATE := date_trunc('month', now() + INTERVAL '1 month')::date;
  v_after      DATE := date_trunc('month', now() + INTERVAL '2 month')::date;
  v_part_name  TEXT := 'supplier_offer_snapshot_' || to_char(v_next_month, 'YYYY_MM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF supplier_offer_snapshot FOR VALUES FROM (%L) TO (%L);',
    v_part_name, v_next_month, v_after
  );
  RETURN format('ensured %s', v_part_name);
END $$;

COMMENT ON FUNCTION maintain_supplier_offer_snapshot_partitions IS
  'H2. Idempotently pre-creates the next monthly partition. Schedule via pg_cron monthly.';
