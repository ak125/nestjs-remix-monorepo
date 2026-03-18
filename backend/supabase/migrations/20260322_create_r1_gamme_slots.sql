-- Migration: Separate R1 rendering slots from __seo_gamme_purchase_guide
-- Reason: __seo_gamme_purchase_guide became a catch-all with 16 writers and 2 owner roles.
--         This migration extracts R1_ROUTER-owned fields into a dedicated table.
-- Safety: Non-destructive — original columns remain in sgpg until backend/frontend migrated.
-- Note: r1s_pg_id is VARCHAR to match sgpg_pg_id type (legacy design, pg_id is INTEGER in pieces_gamme).

-- Step 1: Create the R1 slots table
CREATE TABLE IF NOT EXISTS __seo_r1_gamme_slots (
  r1s_pg_id       VARCHAR PRIMARY KEY,

  -- R1 content slots (rendering elements for /pieces/{gamme})
  r1s_h1_override           VARCHAR,
  r1s_hero_subtitle         TEXT,
  r1s_selector_microcopy    TEXT[],
  r1s_micro_seo_block       TEXT,
  r1s_compatibilities_intro  TEXT,
  r1s_equipementiers_line   TEXT,
  r1s_family_cross_sell_intro TEXT,
  r1s_interest_nuggets      JSONB,
  r1s_serp_variants         JSONB,
  r1s_intent_lock           JSONB,
  r1s_safe_table_rows       JSONB,

  -- R1 buy arguments (4 slots)
  r1s_arg1_title   VARCHAR,
  r1s_arg1_content TEXT,
  r1s_arg1_icon    VARCHAR DEFAULT 'check-circle',
  r1s_arg2_title   VARCHAR,
  r1s_arg2_content TEXT,
  r1s_arg2_icon    VARCHAR DEFAULT 'shield-check',
  r1s_arg3_title   VARCHAR,
  r1s_arg3_content TEXT,
  r1s_arg3_icon    VARCHAR DEFAULT 'currency-euro',
  r1s_arg4_title   VARCHAR,
  r1s_arg4_content TEXT,
  r1s_arg4_icon    VARCHAR DEFAULT 'cube',

  -- R1 FAQ (separate from R6 FAQ — both start as copy of sgpg_faq)
  r1s_faq          JSONB,

  -- R1 gatekeeper output (quality metadata)
  r1s_gatekeeper_score   INTEGER,
  r1s_gatekeeper_flags   TEXT[],
  r1s_gatekeeper_checks  JSONB,

  -- Timestamps
  r1s_updated_at  TIMESTAMPTZ DEFAULT NOW(),
  r1s_created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Copy existing data from __seo_gamme_purchase_guide
INSERT INTO __seo_r1_gamme_slots (
  r1s_pg_id,
  r1s_h1_override, r1s_hero_subtitle, r1s_selector_microcopy,
  r1s_micro_seo_block, r1s_compatibilities_intro, r1s_equipementiers_line,
  r1s_family_cross_sell_intro, r1s_interest_nuggets, r1s_serp_variants,
  r1s_intent_lock, r1s_safe_table_rows,
  r1s_arg1_title, r1s_arg1_content, r1s_arg1_icon,
  r1s_arg2_title, r1s_arg2_content, r1s_arg2_icon,
  r1s_arg3_title, r1s_arg3_content, r1s_arg3_icon,
  r1s_arg4_title, r1s_arg4_content, r1s_arg4_icon,
  r1s_faq,
  r1s_gatekeeper_score, r1s_gatekeeper_flags, r1s_gatekeeper_checks
)
SELECT
  sgpg_pg_id,
  sgpg_h1_override, sgpg_hero_subtitle, sgpg_selector_microcopy,
  sgpg_micro_seo_block, sgpg_compatibilities_intro, sgpg_equipementiers_line,
  sgpg_family_cross_sell_intro, sgpg_interest_nuggets, sgpg_serp_variants,
  sgpg_intent_lock, sgpg_safe_table_rows,
  sgpg_arg1_title, sgpg_arg1_content, sgpg_arg1_icon,
  sgpg_arg2_title, sgpg_arg2_content, sgpg_arg2_icon,
  sgpg_arg3_title, sgpg_arg3_content, sgpg_arg3_icon,
  sgpg_arg4_title, sgpg_arg4_content, sgpg_arg4_icon,
  sgpg_faq,
  sgpg_gatekeeper_score, sgpg_gatekeeper_flags, sgpg_gatekeeper_checks
FROM __seo_gamme_purchase_guide
ON CONFLICT (r1s_pg_id) DO NOTHING;

-- Step 3: Index for common queries
CREATE INDEX IF NOT EXISTS idx_r1_gamme_slots_updated
  ON __seo_r1_gamme_slots (r1s_updated_at DESC);

-- Step 4: Enable RLS (match existing pattern)
ALTER TABLE __seo_r1_gamme_slots ENABLE ROW LEVEL SECURITY;

-- Step 5: Add comment
COMMENT ON TABLE __seo_r1_gamme_slots IS
  'R1_ROUTER rendering slots for /pieces/{gamme} pages. Separated from __seo_gamme_purchase_guide (2026-03-17). Owner: R1_ROUTER exclusively.';

-- NOTE: Original sgpg_* R1 columns are NOT dropped yet.
-- They will be dropped in a follow-up migration after backend + frontend migration is validated.
-- This ensures zero-downtime and safe rollback.
