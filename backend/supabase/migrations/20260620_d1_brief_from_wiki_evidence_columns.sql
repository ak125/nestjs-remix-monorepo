-- ADR-059/086/090 D1 — colonnes audit provenance pour le brief WIKI-driven (SeoBriefService).
--
-- Additif, idempotent, NON auto-appliqué (deployment.md axe 4 : owner-reviewed `apply_migration`).
-- Aucune contrainte NOT NULL stricte (DEFAULT only → lignes existantes lisent le défaut, pas de rewrite),
-- aucun backfill, aucun lock long, aucun DROP/TRUNCATE. Réversible (bloc rollback en pied).
--
-- Ces colonnes ne sont écrites QUE par le chemin `brief_source='wiki_evidence'` (flag SEO_BRIEF_WIKI_ENABLED ON,
-- qui requiert cette migration appliquée au préalable). Chemin keyword-first inchangé → comportement actuel intact.

-- Timeouts bornés (squawk require-timeout-settings ; convention migrations récentes).
SET lock_timeout = '5s';
SET statement_timeout = '15s';

-- Types : text / bigint (squawk prefer-text-field + prefer-bigint-over-int — best practice PG17).
ALTER TABLE public.__seo_page_brief
  ADD COLUMN IF NOT EXISTS brief_source text DEFAULT 'keyword',
  ADD COLUMN IF NOT EXISTS substance_count bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS substance_elements jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_source_mix jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS demand_signal jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.__seo_page_brief.brief_source IS
  'keyword (legacy keyword-first) | wiki_evidence (D1 SeoBriefService, projection WIKI). Audit de provenance du brief.';
COMMENT ON COLUMN public.__seo_page_brief.substance_count IS
  'Nombre d''éléments propriétaires (truth_level db_owned|sourced AVEC source_id) — gate substance D1 (FLOOR).';
COMMENT ON COLUMN public.__seo_page_brief.substance_elements IS
  'Audit [{text,source_id,truth_level,field}] : chaque élément du brief WIKI mappé à sa preuve (EVIDENCE_BOUND).';
COMMENT ON COLUMN public.__seo_page_brief.evidence_source_mix IS
  'Répartition par truth_level {db_owned,sourced,inferred,editorial} (SOURCE_MIX : jamais 100% éditorial).';
COMMENT ON COLUMN public.__seo_page_brief.demand_signal IS
  'Signal de demande GSC (WARN-only, JAMAIS un gate ; sous-capture ~4x). {bucket, ...} ou {}.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (manuel) :
-- ALTER TABLE public.__seo_page_brief
--   DROP COLUMN IF EXISTS brief_source,
--   DROP COLUMN IF EXISTS substance_count,
--   DROP COLUMN IF EXISTS substance_elements,
--   DROP COLUMN IF EXISTS evidence_source_mix,
--   DROP COLUMN IF EXISTS demand_signal;
