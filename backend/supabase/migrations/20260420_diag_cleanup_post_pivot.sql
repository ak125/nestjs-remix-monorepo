-- ============================================================================
-- Migration : 20260420_diag_cleanup_post_pivot
-- But : Nettoyer la dette technique laissee par le pivot delegation RAG
--   (incident INC-2026-003 — voir ledger/incidents/2026/2026-04-18_*)
--
-- Apres le pivot (commit f9d76bd4), le code ne lit plus :
--   - __diag_symptom.synonyms
--   - __diag_symptom.dtc_codes
--   - __diag_maintenance_operation.synonyms
--   - RPC search_diag_symptoms()
--   - RPC search_diag_maintenance()
--
-- La recherche est deleguee a /api/rag/search (embeddings Weaviate).
-- Ce fichier supprime les colonnes/RPC orphelines.
--
-- PRE-REQUIS :
--   - Backend en prod execute bien commit f9d76bd4+ (pivot RAG)
--   - DB Supabase desaturation (actuellement timeouts RPC gamme)
--   - Smoke test RAG delegation vert en DEV
--
-- CONSERVE (utile) :
--   - __diag_system.icon_slug + color_token (UI)
--   - Extension pg_trgm (utilisee ailleurs)
--   - Extension unaccent + immutable_unaccent() (utilisables par autres services)
-- ============================================================================

BEGIN;

-- 1. Drop RPC obsoletes
DROP FUNCTION IF EXISTS search_diag_symptoms(text, integer);
DROP FUNCTION IF EXISTS search_diag_maintenance(text, integer);

-- 2. Drop index specifiques aux colonnes supprimees
DROP INDEX IF EXISTS __diag_symptom_dtc_gin;
DROP INDEX IF EXISTS __diag_symptom_synonyms_gin;
DROP INDEX IF EXISTS __diag_maintenance_synonyms_gin;
DROP INDEX IF EXISTS __diag_symptom_label_trgm;
DROP INDEX IF EXISTS __diag_maintenance_operation_label_trgm;

-- 3. Drop colonnes orphelines
ALTER TABLE __diag_symptom
  DROP COLUMN IF EXISTS synonyms,
  DROP COLUMN IF EXISTS dtc_codes;

ALTER TABLE __diag_maintenance_operation
  DROP COLUMN IF EXISTS synonyms;

-- 4. Update commentaires pour refleter l'etat final
COMMENT ON TABLE __diag_symptom IS
  'Symptomes diagnostiques. Recherche deleguee a /api/rag/search (pivot 2026-04-18).';
COMMENT ON TABLE __diag_maintenance_operation IS
  'Operations entretien preventif. Recherche deleguee a /api/rag/search (pivot 2026-04-18).';

COMMIT;
