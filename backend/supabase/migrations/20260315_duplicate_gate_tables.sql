-- Migration: Duplicate Gate Tables for R2_PRODUCT and R8_VEHICLE
-- Anti-duplicate scoring, fingerprints, neighbors, and publication decisions
-- Date: 2026-03-15

-- ── Table 1: Surface fingerprints ──

CREATE TABLE IF NOT EXISTS __seo_surface_fingerprints (
  id bigserial PRIMARY KEY,
  canonical_role text NOT NULL,
  entity_id text NOT NULL,
  pg_id bigint NULL,
  slug text NOT NULL,
  content_fingerprint text NOT NULL,
  product_set_signature text NULL,
  vehicle_scope_signature text NULL,
  faq_signature text NULL,
  category_signature text NULL,
  vehicle_identity_signature text NULL,
  engine_family_signature text NULL,
  maintenance_signature text NULL,
  catalog_context_signature text NULL,
  word_count integer NULL,
  char_count integer NULL,
  char_count_no_spaces integer NULL,
  section_count integer NULL,
  heading_count integer NULL,
  internal_link_count integer NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Table 2: Duplicate scores + neighbors ──

CREATE TABLE IF NOT EXISTS __seo_surface_duplicate_scores (
  id bigserial PRIMARY KEY,
  canonical_role text NOT NULL,
  entity_id text NOT NULL,
  pg_id bigint NULL,
  slug text NOT NULL,
  content_similarity_score numeric(5,2) NOT NULL,
  product_set_uniqueness_score numeric(5,2) NULL,
  compatibility_delta_score numeric(5,2) NULL,
  catalog_structure_delta_score numeric(5,2) NULL,
  transactional_specificity_score numeric(5,2) NULL,
  vehicle_identity_delta_score numeric(5,2) NULL,
  engine_family_delta_score numeric(5,2) NULL,
  maintenance_delta_score numeric(5,2) NULL,
  catalog_context_delta_score numeric(5,2) NULL,
  route_slug_uniqueness_score numeric(5,2) NOT NULL,
  global_duplicate_resistance_score numeric(5,2) NOT NULL,
  nearest_neighbors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Table 3: Duplicate decisions ──

CREATE TABLE IF NOT EXISTS __seo_surface_duplicate_decisions (
  id bigserial PRIMARY KEY,
  canonical_role text NOT NULL,
  entity_id text NOT NULL,
  pg_id bigint NULL,
  slug text NOT NULL,
  duplicate_status text NOT NULL,
  indexing_allowed boolean NOT NULL DEFAULT false,
  publication_allowed boolean NOT NULL DEFAULT false,
  review_required boolean NOT NULL DEFAULT false,
  blocking_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  warning_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──

CREATE INDEX IF NOT EXISTS idx_surface_fp_role_entity
  ON __seo_surface_fingerprints (canonical_role, entity_id);

CREATE INDEX IF NOT EXISTS idx_surface_dup_scores_role_entity
  ON __seo_surface_duplicate_scores (canonical_role, entity_id);

CREATE INDEX IF NOT EXISTS idx_surface_dup_decisions_role_status
  ON __seo_surface_duplicate_decisions (canonical_role, duplicate_status);

CREATE INDEX IF NOT EXISTS idx_surface_dup_decisions_publication
  ON __seo_surface_duplicate_decisions (publication_allowed)
  WHERE publication_allowed = true;

-- ── Comments ──

COMMENT ON TABLE __seo_surface_fingerprints IS 'Anti-duplicate: SHA-256 fingerprints per surface for R2/R8 dedup';
COMMENT ON TABLE __seo_surface_duplicate_scores IS 'Anti-duplicate: 6-dimension scoring with nearest neighbors';
COMMENT ON TABLE __seo_surface_duplicate_decisions IS 'Anti-duplicate: PASS/REVIEW/BLOCK gate for publication';
