-- =============================================================================
-- ADR-024 Phase 2 — R1 Related Blocks Cache (sortir le RAG filesystem read du SSR)
-- Migration : schema + cache-first getter
-- =============================================================================
-- Related: ADR-024 (governance vault), parité ADR-016 (vehicle_page_cache).
--
-- Safe to apply: OUI. Cette migration ne touche AUCUN code applicatif existant.
-- Le service R1RelatedResourcesService continue d'être appelé par
-- gamme-response-builder.service.ts à chaque hit R1, lisant le RAG
-- filesystem comme avant. Cette table reste vide et inutilisée tant que :
--   1. Le seed script `scripts/seo/seed-r1-related-blocks.ts` n'est pas lancé
--      (le populate les 238 gammes G1/G2 depuis le RAG, en offline)
--   2. La Phase 5 cleanup ne refactore pas le service pour lire la table
--      au lieu de relire le RAG à chaque hit
--
-- Schema parité __gamme_page_cache (ADR-024 Phase 1) :
--   pg_id PK, payload JSONB, source_hash TEXT, built_at, stale, stale_reason
-- =============================================================================

BEGIN;

-- Table de cache persistant des blocs related R1, 1 ligne par pg_id (gamme).
-- Cible : ~238 gammes G1/G2 (pieces_gamme.pg_level IN ('1','2')).
-- Taille estimée : 238 × ~3 KB JSON ≈ 0.7 MB (max 3 blocs × 3 items × ~300 B).
CREATE TABLE IF NOT EXISTS public.__seo_r1_related_blocks_cache (
  pg_id        INTEGER      PRIMARY KEY,
  payload      JSONB        NOT NULL,
  source_hash  TEXT         NOT NULL,
  built_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  stale        BOOLEAN      NOT NULL DEFAULT FALSE,
  stale_reason TEXT
);

COMMENT ON TABLE  public.__seo_r1_related_blocks_cache IS
  'ADR-024 Phase 2: cache materialise des blocs maillage contextuel R1 (avoid-confusion + buying-guide + compatible-parts). Replique r1-related-resources.service.ts hors du chemin SSR. Source de verite RAG eligere offline.';
COMMENT ON COLUMN public.__seo_r1_related_blocks_cache.payload      IS 'JSONB shape: { blocks: R1RelatedBlock[] } (max 3 blocs, max 3 items chacun)';
COMMENT ON COLUMN public.__seo_r1_related_blocks_cache.source_hash  IS 'md5(rag_data + db_state) pour invalidation ciblee et detection no-op';
COMMENT ON COLUMN public.__seo_r1_related_blocks_cache.built_at     IS 'Horodatage de la derniere materialisation (seed script ou trigger)';
COMMENT ON COLUMN public.__seo_r1_related_blocks_cache.stale        IS 'TRUE = ligne obsolete a rebuild';
COMMENT ON COLUMN public.__seo_r1_related_blocks_cache.stale_reason IS 'Optionnel: raison de l invalidation (ex: rag_change, pieces_gamme_update, manual)';

-- Index partiel pour cron refresh-stale (FIFO sur built_at).
CREATE INDEX IF NOT EXISTS idx_r1rb_stale
  ON public.__seo_r1_related_blocks_cache (built_at)
  WHERE stale = TRUE;

CREATE INDEX IF NOT EXISTS idx_r1rb_built_at
  ON public.__seo_r1_related_blocks_cache (built_at DESC);

-- RLS service_role only (cohérent ADR-021).
ALTER TABLE public.__seo_r1_related_blocks_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS r1rb_service_role_all ON public.__seo_r1_related_blocks_cache; -- APPROVED: idempotent DROP+CREATE POLICY pattern (ADR-016 parity, no RLS bypass)
CREATE POLICY r1rb_service_role_all
  ON public.__seo_r1_related_blocks_cache
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- get_r1_related_blocks_cached(p_pg_id)
-- ----------------------------------------------------------------------------
-- Getter cache-first. Retourne le payload JSONB si la ligne existe et n'est
-- pas stale, sinon NULL. Phase 2 = pas de rebuild on-miss en SQL : le seed
-- est explicit (script offline ou trigger). Le code applicatif fallback sur
-- la logique TS R1RelatedResourcesService si NULL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_r1_related_blocks_cached(p_pg_id INTEGER)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $fn$
  SELECT payload
    FROM public.__seo_r1_related_blocks_cache
    WHERE pg_id = p_pg_id AND stale = FALSE
$fn$;

COMMENT ON FUNCTION public.get_r1_related_blocks_cached(INTEGER) IS
  'ADR-024 Phase 2: cache-only lookup pour blocs related R1. Retourne NULL si miss/stale, le code applicatif fallback sur logique TS. Phase 5 retirera ce fallback.';

COMMIT;
