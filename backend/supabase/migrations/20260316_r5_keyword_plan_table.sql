-- Migration: R5 Diagnostic Keyword Plan Table
-- Date: 2026-03-16

CREATE TABLE IF NOT EXISTS __seo_r5_keyword_plan (
  id SERIAL PRIMARY KEY,
  rkp_pg_id INTEGER NOT NULL,
  rkp_pg_alias TEXT NOT NULL,
  rkp_status TEXT DEFAULT 'draft' CHECK (rkp_status IN ('draft', 'validated', 'rejected', 'stale')),
  rkp_intent_map JSONB DEFAULT '{}'::jsonb,
  rkp_section_terms JSONB DEFAULT '{}'::jsonb,
  rkp_observable_map JSONB DEFAULT '[]'::jsonb,
  rkp_hypothesis_map JSONB DEFAULT '[]'::jsonb,
  rkp_caution_level TEXT CHECK (rkp_caution_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  rkp_quality_score NUMERIC(5,2),
  rkp_safety_gate TEXT CHECK (rkp_safety_gate IN ('PASS', 'FAIL', 'NOT_APPLICABLE')),
  rkp_created_at TIMESTAMPTZ DEFAULT now(),
  rkp_updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_r5_kp_pg_id UNIQUE (rkp_pg_id)
);

CREATE INDEX IF NOT EXISTS idx_r5_kp_pg_id ON __seo_r5_keyword_plan (rkp_pg_id);
CREATE INDEX IF NOT EXISTS idx_r5_kp_status ON __seo_r5_keyword_plan (rkp_status);

COMMENT ON TABLE __seo_r5_keyword_plan IS 'R5 Diagnostic keyword plan — symptom-first, evidence-based, with safety gate for critical parts';
