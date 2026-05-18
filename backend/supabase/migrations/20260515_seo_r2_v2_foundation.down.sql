-- =============================================================================
-- ADR-066 — R2 Content Composition v2 — Foundation tables — ROLLBACK
-- =============================================================================
--
-- Rollback de 20260515_seo_r2_v2_foundation.sql.
--
-- Ordre strict : tables enfants (FK) avant parents.
-- L'extension `vector` n'est PAS droppée (peut être utilisée par d'autres
-- features). Idempotent via IF EXISTS.
-- =============================================================================

-- assume_in_transaction = true. No BEGIN/COMMIT.
SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

DROP TRIGGER IF EXISTS trg_r2_pages_updated_at        ON public.__seo_r2_pages;
DROP TRIGGER IF EXISTS trg_r2_page_content_updated_at ON public.__seo_r2_page_content;
DROP FUNCTION IF EXISTS public.__seo_r2_set_updated_at();

DROP TABLE IF EXISTS public.__seo_r2_regeneration_queue   CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_qa_reviews           CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_page_versions        CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_eligibility_log      CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_composition_inputs   CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_embeddings           CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_signatures           CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_metrics              CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_page_content         CASCADE;
DROP TABLE IF EXISTS public.__seo_r2_pages                CASCADE;
-- No COMMIT — migration tool wraps.
