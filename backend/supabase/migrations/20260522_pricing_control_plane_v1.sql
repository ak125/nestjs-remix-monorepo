-- =====================================================
-- Pricing Control Plane V1 — schema (L0 RAW · L0.5 Profiles · L3 Lifecycle · L4 Rules · L5a State · baseline)
-- Date: 2026-05-22
-- Refs: plan pricing-control-plane-v1
--       pieces_price (442K rows, shared prod) — colonnes pri_*_n (numeric) + text legacy
--       ___xtr_order_line (volumes ventes pour pondération impact CA)
--       backend/src/modules/pricing/** (L0.5/L1/L2/L4 services)
-- =====================================================
--
-- ADDITIF UNIQUEMENT. Idempotent (IF NOT EXISTS / guards). Forward-only.
-- N'APPLIQUE AUCUNE écriture de prix : crée seulement les tables/colonnes du
-- control plane. L'application à la DB partagée est un step gouverné séparé
-- (apply-supabase-migrations.yml), JAMAIS auto-au-merge.
--
-- États modélisés en TEXT + CHECK (pas ENUM) : additif sans contrainte de
-- transaction ALTER TYPE, extension future triviale.
-- Montants en cents = BIGINT (decimal-safe, aligné moteur L1). Snapshots
-- d'historique en NUMERIC (fidélité aux colonnes source pieces_price).
-- Index : CREATE INDEX plain (tables neuves vides — pas de CONCURRENTLY, cf.
-- limite moteur migration mono-statement).
-- =====================================================

-- ----------------------------------------------------------------------------
-- L0 — RAW immutable (append-only). Replay / diff parser / forensic.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_import_raw (
  id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id        TEXT        NOT NULL,
  source_file        TEXT,
  source_hash        TEXT        NOT NULL,
  raw_payload        TEXT,                 -- bytes/texte brut du fichier
  normalized_payload JSONB,                -- lignes normalisées (post-parse)
  parsed_payload     JSONB,                -- entrées canoniques (post-L0.5)
  row_count          INTEGER,
  imported_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE supplier_import_raw IS
  'L0 RAW append-only. Jamais UPDATE (immutabilité logique). DELETE réservé à la retention policy (24 mois).';
CREATE INDEX IF NOT EXISTS idx_supplier_import_raw_hash     ON supplier_import_raw (source_hash);
CREATE INDEX IF NOT EXISTS idx_supplier_import_raw_supplier ON supplier_import_raw (supplier_id, imported_at);

-- ----------------------------------------------------------------------------
-- L0.5 — Supplier price profiles (governed, versioned, immutable-by-version).
-- column_mapping = column→field + transform primitif whitelisté (anti-DSL,
-- validé applicativement par SupplierProfileService.validateProfile).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_price_profiles (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id    TEXT        NOT NULL,
  scope_level    TEXT        NOT NULL CHECK (scope_level IN ('SUPPLIER','BRAND','FAMILY','SUBFAMILY')),
  scope_code     TEXT,                 -- code_fam_nu / code_sfam_nu / NULL
  price_basis    TEXT        NOT NULL CHECK (price_basis IN ('NET','BRUT','PUBLIC','NET_GROSSISTE')),
  derivation     TEXT        NOT NULL CHECK (derivation IN ('DIRECT_NET','REMISE_ON_BRUT','REMISE_ON_PUBLIC','MARGE_ON_NET')),
  column_mapping JSONB       NOT NULL,
  key_field      TEXT        NOT NULL CHECK (key_field IN ('REF','EAN')),
  version        INTEGER     NOT NULL DEFAULT 1,
  effective_from TIMESTAMPTZ,
  effective_to   TIMESTAMPTZ,
  active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by     TEXT,
  change_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE supplier_price_profiles IS
  'L0.5. Quasi-source canonique → immutabilité logique : jamais UPDATE d''un profil actif, nouvelle version (effective_from/to).';
CREATE INDEX IF NOT EXISTS idx_supplier_price_profiles_lookup ON supplier_price_profiles (supplier_id, active);

-- ----------------------------------------------------------------------------
-- L4 — Pricing rules (degressive). Dimensions de matching STRICTEMENT limitées :
-- cost buckets + customer_type + supplier + category. Rien d'autre (anti-policy-opaque).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_rules (
  id                     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  min_cost_cents         BIGINT      NOT NULL,
  max_cost_cents         BIGINT,                       -- NULL = +∞
  margin_rate            NUMERIC     NOT NULL,         -- taux de marge %
  min_margin_amount_cents BIGINT     NOT NULL DEFAULT 0,
  max_margin_rate        NUMERIC,                      -- cap %, NULL = aucun
  customer_type          TEXT        CHECK (customer_type IN ('B2C','PRO')),  -- NULL = tous
  supplier_pm_id         TEXT,                         -- NULL = tous
  category_gamme_id      INTEGER,                      -- NULL = toutes
  priority               INTEGER     NOT NULL DEFAULT 0,
  active                 BOOLEAN     NOT NULL DEFAULT TRUE,
  effective_from         TIMESTAMPTZ,
  effective_to           TIMESTAMPTZ,
  rule_version           INTEGER     NOT NULL DEFAULT 1,
  created_by             TEXT,
  change_reason          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON pricing_rules (active, customer_type);

-- ----------------------------------------------------------------------------
-- L3 — Batch lifecycle (chunk lifecycle Option B + verrou mutex).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS price_import_batches (
  batch_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status           TEXT        NOT NULL DEFAULT 'UPLOADED'
                   CHECK (status IN ('UPLOADED','VALIDATED','DRY_RUN_OK','COMMITTING','COMMITTED','ROLLED_BACK','ROLLBACK_PARTIAL','FAILED')),
  supplier_id      TEXT,
  raw_id           BIGINT      REFERENCES supplier_import_raw (id),
  source_file      TEXT,
  source_file_hash TEXT,
  checksum         TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  committed_rows   INTEGER     NOT NULL DEFAULT 0,
  failed_rows      INTEGER     NOT NULL DEFAULT 0,
  operator         TEXT
);
CREATE INDEX IF NOT EXISTS idx_price_import_batches_status   ON price_import_batches (status);
CREATE INDEX IF NOT EXISTS idx_price_import_batches_hash     ON price_import_batches (source_file_hash);
CREATE INDEX IF NOT EXISTS idx_price_import_batches_supplier ON price_import_batches (supplier_id, started_at);
-- Mutex applicatif : un seul batch COMMITTING par fournisseur (verrou d'import).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_price_import_committing_per_supplier
  ON price_import_batches (supplier_id) WHERE status = 'COMMITTING';

CREATE TABLE IF NOT EXISTS price_import_batch_chunks (
  chunk_id  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id  UUID    NOT NULL REFERENCES price_import_batches (batch_id) ON DELETE CASCADE,
  seq       INTEGER NOT NULL,
  row_from  INTEGER,
  row_to    INTEGER,
  checksum  TEXT,
  status    TEXT    NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING','COMMITTING','COMMITTED','FAILED','ROLLED_BACK'))
);
CREATE INDEX IF NOT EXISTS idx_price_import_chunks_batch  ON price_import_batch_chunks (batch_id, seq);
CREATE INDEX IF NOT EXISTS idx_price_import_chunks_status ON price_import_batch_chunks (status);

-- ----------------------------------------------------------------------------
-- pieces_price_history — snapshot avant/après par ligne. PARTITIONNÉ RANGE(created_at).
-- Rollback LIFO + forensic. PK doit inclure la clé de partition.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pieces_price_history (
  id             BIGINT      GENERATED ALWAYS AS IDENTITY,
  batch_id       UUID        NOT NULL,
  chunk_id       UUID,
  pri_piece_id_i INTEGER     NOT NULL,
  pri_type       TEXT,
  old_gros_ht    NUMERIC, new_gros_ht    NUMERIC,
  old_remise     NUMERIC, new_remise     NUMERIC,
  old_achat_ht   NUMERIC, new_achat_ht   NUMERIC,
  old_marge      NUMERIC, new_marge      NUMERIC,
  old_vente_ht   NUMERIC, new_vente_ht   NUMERIC,
  old_vente_ttc  NUMERIC, new_vente_ttc  NUMERIC,
  old_dispo      TEXT,    new_dispo      TEXT,    -- activation (pri_dispo) snapshot, Step 1
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitions mensuelles initiales + DEFAULT catch-all (la maintenance crée les suivantes).
CREATE TABLE IF NOT EXISTS pieces_price_history_2026_05
  PARTITION OF pieces_price_history FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS pieces_price_history_2026_06
  PARTITION OF pieces_price_history FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS pieces_price_history_2026_07
  PARTITION OF pieces_price_history FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS pieces_price_history_default
  PARTITION OF pieces_price_history DEFAULT;

CREATE INDEX IF NOT EXISTS idx_pph_batch   ON pieces_price_history (batch_id);
CREATE INDEX IF NOT EXISTS idx_pph_chunk   ON pieces_price_history (chunk_id);
CREATE INDEX IF NOT EXISTS idx_pph_piece   ON pieces_price_history (pri_piece_id_i);
CREATE INDEX IF NOT EXISTS idx_pph_created ON pieces_price_history (created_at);

-- ----------------------------------------------------------------------------
-- catalog_pricing_baseline — snapshot pour la simulation (read-only).
-- Meta (version + status + lineage) + per-piece snapshot pondéré par les ventes.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS catalog_pricing_baseline_meta (
  baseline_version BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_batch_id  UUID,
  status           TEXT NOT NULL DEFAULT 'REBUILDING'
                   CHECK (status IN ('REBUILDING','READY','STALE','FAILED'))
);

CREATE TABLE IF NOT EXISTS catalog_pricing_baseline (
  baseline_version BIGINT  NOT NULL REFERENCES catalog_pricing_baseline_meta (baseline_version) ON DELETE CASCADE,
  pri_piece_id_i   INTEGER NOT NULL,
  achat_ht_cents   BIGINT,
  vente_ht_cents   BIGINT,
  vente_ttc_cents  BIGINT,
  gamme_id         INTEGER,
  pm_id            TEXT,
  qty_sold_12m     INTEGER NOT NULL DEFAULT 0,   -- pondération impact CA (___xtr_order_line)
  PRIMARY KEY (baseline_version, pri_piece_id_i)
);
CREATE INDEX IF NOT EXISTS idx_baseline_version ON catalog_pricing_baseline (baseline_version);

-- ----------------------------------------------------------------------------
-- L5a — Pricing state sur pieces_price (additif). MANUAL_OVERRIDE/FROZEN protégés.
-- ----------------------------------------------------------------------------
ALTER TABLE pieces_price ADD COLUMN IF NOT EXISTS pricing_state TEXT NOT NULL DEFAULT 'ACTIVE'
  CHECK (pricing_state IN ('ACTIVE','OUTLIER','DEGRADED','MANUAL_OVERRIDE','SUPPLIER_CONFLICT','IMPORT_ERROR','FROZEN','COMPETITOR_LOCKED'));
ALTER TABLE pieces_price ADD COLUMN IF NOT EXISTS pricing_state_reason  TEXT;
ALTER TABLE pieces_price ADD COLUMN IF NOT EXISTS pricing_updated_by    TEXT;
ALTER TABLE pieces_price ADD COLUMN IF NOT EXISTS pricing_updated_source TEXT;
COMMENT ON COLUMN pieces_price.pricing_state IS
  'L5a. Un import ne modifie JAMAIS une ligne MANUAL_OVERRIDE ou FROZEN.';
