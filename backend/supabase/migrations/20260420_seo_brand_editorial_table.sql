-- =============================================================================
-- __seo_brand_editorial — FAQ, common_issues, maintenance_tips curated per brand
-- =============================================================================
-- Purpose : store hand-curated brand-specific content that cannot be reliably
-- derived from Wikidata or scraping. Populated via admin UI, consumed by
-- build-brand-rag.py when composing the canonical RAG .md files.
--
-- Schema : 1 row per marque_id, 3 JSONB columns matching brand-rag schema.
-- Source of truth : human editors via admin panel (not AI-generated).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.__seo_brand_editorial (
  marque_id      integer PRIMARY KEY REFERENCES public.auto_marque(marque_id) ON DELETE CASCADE,

  -- FAQ : [{q: string, a: string}] — brand-specific questions & answers
  faq            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Common issues : [{symptom, cause, fix_hint}] — known recurring problems
  common_issues  jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Maintenance tips : [{part, interval_km, interval_years, note}]
  maintenance_tips jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Governance
  curated_by     text,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),

  -- Lightweight integrity : each array must be valid JSON array
  CONSTRAINT chk_faq_array            CHECK (jsonb_typeof(faq) = 'array'),
  CONSTRAINT chk_common_issues_array  CHECK (jsonb_typeof(common_issues) = 'array'),
  CONSTRAINT chk_maintenance_array    CHECK (jsonb_typeof(maintenance_tips) = 'array')
);

COMMENT ON TABLE public.__seo_brand_editorial IS
  'Brand-specific editorial content (FAQ/issues/maintenance). Curated by humans, consumed by build-brand-rag.py to compose R7 RAG .md frontmatter.';

COMMENT ON COLUMN public.__seo_brand_editorial.faq IS
  '[{q: text, a: text}] — 5-15 brand-specific FAQ entries.';
COMMENT ON COLUMN public.__seo_brand_editorial.common_issues IS
  '[{symptom: text, cause?: text, fix_hint?: text}] — known recurring issues by model/engine.';
COMMENT ON COLUMN public.__seo_brand_editorial.maintenance_tips IS
  '[{part: text, interval_km?: int, interval_years?: int, note?: text}] — manufacturer intervals.';

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.__seo_brand_editorial_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seo_brand_editorial_updated_at ON public.__seo_brand_editorial;
CREATE TRIGGER trg_seo_brand_editorial_updated_at
  BEFORE UPDATE ON public.__seo_brand_editorial
  FOR EACH ROW EXECUTE FUNCTION public.__seo_brand_editorial_set_updated_at();

-- RLS : read public, write admin-only (enforced at controller layer via IsAdminGuard).
ALTER TABLE public.__seo_brand_editorial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "editorial_read_all" ON public.__seo_brand_editorial;
CREATE POLICY "editorial_read_all" ON public.__seo_brand_editorial
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "editorial_write_service_role" ON public.__seo_brand_editorial;
CREATE POLICY "editorial_write_service_role" ON public.__seo_brand_editorial
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.__seo_brand_editorial TO anon, authenticated;
GRANT ALL    ON public.__seo_brand_editorial TO service_role;
