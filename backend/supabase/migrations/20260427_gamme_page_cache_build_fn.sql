-- =============================================================================
-- ADR-024 — R1 Gamme Page Cache (persistance par matérialisation)
-- Migration 2/2 : FONCTIONS (build + rebuild + getter cache-first + cron helper)
-- =============================================================================
-- Related: ADR-024 (governance vault), parité ADR-016 (vehicle_page_cache)
--
-- Safe to apply: OUI. Les fonctions créées ici NE SONT PAS APPELÉES par le
-- backend tant que la Phase 5 (cleanup, refactor controller) n'a pas été
-- exécutée. get_gamme_page_data_optimized() reste inchangée. Phase 1 ne
-- modifie aucun chemin de lecture actuel.
--
-- Phase 1 = scaffolding. Le payload matérialisé contient ce que retourne la
-- RPC actuelle (aggregated_data sans enrichment SSR). La Phase 2 étendra
-- soit la RPC pour inclure l'enrichment, soit ajoutera une table
-- __seo_r1_related_blocks_cache pour éliminer le filesystem RAG read.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- build_gamme_page_payload(p_pg_id)
-- -----------------------------------------------------------------------------
-- Wrapper autour de la RPC existante get_gamme_page_data_optimized.
-- Retourne le JSONB sans passer par le cache.
-- Coût : ~75 ms warm, plusieurs secondes cold (identique à la RPC actuelle).
-- Utilisé uniquement par rebuild_gamme_page_cache() et le backfill script.
--
-- Validation : si page_info est null ou pg_alias est vide, la gamme est
-- invalide / hors catalogue → retourne NULL pour signaler l'absence (pattern
-- parité avec build_vehicle_page_payload qui retourne NULL si success=false).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_gamme_page_payload(p_pg_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
DECLARE
  v_result    JSONB;
  v_page_info JSONB;
  v_pg_alias  TEXT;
  v_pg_level  TEXT;
BEGIN
  -- Délégation à la RPC existante pour garantir identité de contrat.
  -- Quand ADR-024 Phase 2 sera validé, on étendra cette fonction pour inclure
  -- l'enrichment (image_prompts, buying_guide, related_blocks) actuellement
  -- en code applicatif — supprimant ainsi les 4 requêtes séquentielles dans
  -- gamme-response-builder.service.ts.
  v_result := public.get_gamme_page_data_optimized(p_pg_id)::JSONB;

  IF v_result IS NULL THEN
    RETURN NULL;
  END IF;

  v_page_info := v_result->'page_info';
  IF v_page_info IS NULL OR jsonb_typeof(v_page_info) = 'null' THEN
    -- Gamme inexistante ou page_info absent du payload.
    RETURN NULL;
  END IF;

  v_pg_alias := v_page_info->>'pg_alias';
  v_pg_level := v_page_info->>'pg_level';

  -- Gamme hors catalogue : pg_level=0/NULL ET pg_alias vide
  -- (cohérent avec gamme-rpc.service.ts:185 dans le backend).
  IF (v_pg_level IS NULL OR v_pg_level = '' OR v_pg_level = '0')
     AND (v_pg_alias IS NULL OR v_pg_alias = '') THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.build_gamme_page_payload(INTEGER) IS
  'ADR-024: construit le payload page gamme R1 sans cache (wrapper sur get_gamme_page_data_optimized). Utilisé par rebuild_gamme_page_cache() et le backfill. Phase 1.';

-- -----------------------------------------------------------------------------
-- rebuild_gamme_page_cache(p_pg_id)
-- -----------------------------------------------------------------------------
-- Force le recalcul et UPSERT dans __gamme_page_cache pour un pg_id donné.
-- Retourne TRUE si la ligne a été (re)construite, FALSE si la gamme n'existe
-- pas ou est hors catalogue. Idempotent : si le source_hash n'a pas changé,
-- met à jour built_at sans réécrire le payload.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_gamme_page_cache(p_pg_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_payload  JSONB;
  v_hash     TEXT;
  v_old_hash TEXT;
BEGIN
  v_payload := public.build_gamme_page_payload(p_pg_id);

  IF v_payload IS NULL THEN
    -- Gamme inexistante / hors catalogue : on nettoie l'éventuelle ligne obsolète.
    DELETE FROM public.__gamme_page_cache WHERE pg_id = p_pg_id;
    RETURN FALSE;
  END IF;

  v_hash := md5(v_payload::TEXT);

  SELECT source_hash INTO v_old_hash
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  IF v_old_hash IS NOT DISTINCT FROM v_hash THEN
    -- Payload identique : on rafraîchit seulement built_at et on démarque stale.
    UPDATE public.__gamme_page_cache
       SET built_at = NOW(),
           stale = FALSE,
           stale_reason = NULL
     WHERE pg_id = p_pg_id;
  ELSE
    INSERT INTO public.__gamme_page_cache (pg_id, payload, source_hash, built_at, stale, stale_reason)
    VALUES (p_pg_id, v_payload, v_hash, NOW(), FALSE, NULL)
    ON CONFLICT (pg_id) DO UPDATE
      SET payload      = EXCLUDED.payload,
          source_hash  = EXCLUDED.source_hash,
          built_at     = EXCLUDED.built_at,
          stale        = FALSE,
          stale_reason = NULL;
  END IF;

  RETURN TRUE;
END;
$fn$;

COMMENT ON FUNCTION public.rebuild_gamme_page_cache(INTEGER) IS
  'ADR-024: UPSERT idempotent dans __gamme_page_cache. Retourne TRUE si construit, FALSE si pg_id invalide/hors catalogue. Phase 1.';

-- -----------------------------------------------------------------------------
-- get_gamme_page_data_cached(p_pg_id)
-- -----------------------------------------------------------------------------
-- Getter cache-first.
-- Comportement :
--   1. Si ligne présente et non stale → retourne payload depuis le cache (~5 ms).
--   2. Sinon, appelle build_gamme_page_payload(), UPSERT, retourne payload.
--   3. Si gamme inexistante/hors catalogue → retourne NULL.
--
-- Phase 1 : pas encore appelé par le backend (le controller continue d'appeler
-- get_gamme_page_data_optimized via la couche service). En Phase 5 cleanup,
-- le backend basculera sur cette fonction.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_gamme_page_data_cached(p_pg_id INTEGER)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
DECLARE
  v_cached_payload JSONB;
  v_cached_stale   BOOLEAN;
  v_built          BOOLEAN;
BEGIN
  SELECT payload, stale
    INTO v_cached_payload, v_cached_stale
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  IF v_cached_payload IS NOT NULL AND v_cached_stale = FALSE THEN
    RETURN v_cached_payload::JSON;
  END IF;

  -- Cold path : rebuild à la volée (one-shot, puis persisté).
  v_built := public.rebuild_gamme_page_cache(p_pg_id);

  IF v_built = FALSE THEN
    RETURN NULL;
  END IF;

  SELECT payload INTO v_cached_payload
    FROM public.__gamme_page_cache
    WHERE pg_id = p_pg_id;

  RETURN v_cached_payload::JSON;
END;
$fn$;

COMMENT ON FUNCTION public.get_gamme_page_data_cached(INTEGER) IS
  'ADR-024: drop-in replacement futur pour get_gamme_page_data_optimized. Cache-first, rebuild-on-miss. Phase 1 (non appelée par le backend tant que Phase 5 non livrée).';

-- -----------------------------------------------------------------------------
-- refresh_stale_gamme_cache(p_batch_size)
-- -----------------------------------------------------------------------------
-- Helper pour cron job : rafraîchit jusqu'à N lignes marquées stale.
-- Sera lancé toutes les 10 min côté scheduler en Phase 4 (invalidation).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_stale_gamme_cache(p_batch_size INTEGER DEFAULT 100)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_pg_id     INTEGER;
  v_refreshed INTEGER := 0;
BEGIN
  FOR v_pg_id IN
    SELECT pg_id
      FROM public.__gamme_page_cache
      WHERE stale = TRUE
      ORDER BY built_at ASC
      LIMIT GREATEST(p_batch_size, 1)
  LOOP
    PERFORM public.rebuild_gamme_page_cache(v_pg_id);
    v_refreshed := v_refreshed + 1;
  END LOOP;

  RETURN v_refreshed;
END;
$fn$;

COMMENT ON FUNCTION public.refresh_stale_gamme_cache(INTEGER) IS
  'ADR-024: cron helper. Refresh LIMIT N stale rows in FIFO order. Sera appelé toutes les 10 min en Phase 4. Phase 1.';

COMMIT;
