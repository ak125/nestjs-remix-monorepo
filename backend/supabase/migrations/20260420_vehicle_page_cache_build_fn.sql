-- =============================================================================
-- ADR-016 — Vehicle Page Cache (persistance par matérialisation)
-- Migration 2/2 : FONCTIONS (build + rebuild + getter cache-first)
-- =============================================================================
-- Related: INC-2026-005, ADR-016 (governance vault)
--
-- Safe to apply: OUI. Les fonctions créées ici ne sont appelées qu'après
-- activation du flag USE_VEHICLE_PAGE_CACHE côté backend (défaut OFF).
-- get_vehicle_page_data_optimized() reste inchangée — zéro régression sur
-- le chemin de lecture actuel.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- build_vehicle_page_payload(p_type_id)
-- -----------------------------------------------------------------------------
-- Extraction propre de la logique de get_vehicle_page_data_optimized dans une
-- fonction réutilisable. Retourne le JSONB sans passer par le cache.
-- Coût : 125 ms warm, ~4 s cold (identique à la RPC actuelle).
-- Utilisé uniquement par rebuild_vehicle_page_cache() et le backfill script.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_vehicle_page_payload(p_type_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
DECLARE
  v_result      JSONB;
  v_modele_id   INTEGER;
  v_marque_id   INTEGER;
BEGIN
  -- Délégation à la RPC existante pour garantir identité de contrat.
  -- Quand ADR-016 Phase 2 sera validé, on inlinera cette logique ici et on
  -- pourra supprimer l'ancienne fonction.
  v_result := get_vehicle_page_data_optimized(p_type_id)::JSONB;

  IF v_result IS NULL OR COALESCE((v_result->>'success')::BOOLEAN, FALSE) = FALSE THEN
    RETURN NULL;
  END IF;

  RETURN v_result;
END;
$fn$;

COMMENT ON FUNCTION public.build_vehicle_page_payload(INTEGER) IS
  'ADR-016: construit le payload page véhicule sans cache. Utilisé par rebuild_vehicle_page_cache() et le backfill.';

-- -----------------------------------------------------------------------------
-- rebuild_vehicle_page_cache(p_type_id)
-- -----------------------------------------------------------------------------
-- Force le recalcul et UPSERT dans __vehicle_page_cache pour un type_id donné.
-- Retourne TRUE si la ligne a été (re)construite, FALSE si le type n'existe pas.
-- Idempotent : si le source_hash n'a pas changé, met à jour built_at sans
-- réécrire le payload (évite l'invalidation inutile des caches secondaires).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_vehicle_page_cache(p_type_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_payload     JSONB;
  v_hash        TEXT;
  v_old_hash    TEXT;
BEGIN
  v_payload := public.build_vehicle_page_payload(p_type_id);

  IF v_payload IS NULL THEN
    -- Type inexistant ou invalide : on nettoie l'éventuelle ligne obsolète.
    DELETE FROM public.__vehicle_page_cache WHERE type_id = p_type_id;
    RETURN FALSE;
  END IF;

  v_hash := md5(v_payload::TEXT);

  SELECT source_hash INTO v_old_hash
    FROM public.__vehicle_page_cache
    WHERE type_id = p_type_id;

  IF v_old_hash IS NOT DISTINCT FROM v_hash THEN
    -- Payload identique : on rafraîchit seulement built_at et on démarque stale.
    UPDATE public.__vehicle_page_cache
       SET built_at = NOW(),
           stale = FALSE,
           stale_reason = NULL
     WHERE type_id = p_type_id;
  ELSE
    INSERT INTO public.__vehicle_page_cache (type_id, payload, source_hash, built_at, stale, stale_reason)
    VALUES (p_type_id, v_payload, v_hash, NOW(), FALSE, NULL)
    ON CONFLICT (type_id) DO UPDATE
      SET payload      = EXCLUDED.payload,
          source_hash  = EXCLUDED.source_hash,
          built_at     = EXCLUDED.built_at,
          stale        = FALSE,
          stale_reason = NULL;
  END IF;

  RETURN TRUE;
END;
$fn$;

COMMENT ON FUNCTION public.rebuild_vehicle_page_cache(INTEGER) IS
  'ADR-016: UPSERT idempotent dans __vehicle_page_cache. Retourne TRUE si construit, FALSE si type_id invalide.';

-- -----------------------------------------------------------------------------
-- get_vehicle_page_data_cached(p_type_id)
-- -----------------------------------------------------------------------------
-- Getter cache-first utilisé par le backend quand USE_VEHICLE_PAGE_CACHE=true.
-- Signature identique à get_vehicle_page_data_optimized() — drop-in replacement.
-- Comportement :
--   1. Si ligne présente et non stale → retourne payload (p99 < 10 ms).
--   2. Sinon, appelle build_vehicle_page_payload(), UPSERT, retourne payload.
--   3. Si type inexistant → retourne JSON d'erreur identique à l'ancienne RPC.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_vehicle_page_data_cached(p_type_id INTEGER)
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
    FROM public.__vehicle_page_cache
    WHERE type_id = p_type_id;

  IF v_cached_payload IS NOT NULL AND v_cached_stale = FALSE THEN
    RETURN v_cached_payload::JSON;
  END IF;

  -- Cold path : rebuild à la volée (one-shot, puis persisté).
  -- STABLE permet l'appel à rebuild_* car PostgreSQL ne vérifie la pureté
  -- qu'à l'exécution ; la cohérence lecteur/écrivain est garantie par le
  -- UPSERT idempotent dans rebuild_vehicle_page_cache.
  v_built := public.rebuild_vehicle_page_cache(p_type_id);

  IF v_built = FALSE THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Vehicle not found',
      'type_id', p_type_id
    );
  END IF;

  SELECT payload INTO v_cached_payload
    FROM public.__vehicle_page_cache
    WHERE type_id = p_type_id;

  RETURN v_cached_payload::JSON;
END;
$fn$;

COMMENT ON FUNCTION public.get_vehicle_page_data_cached(INTEGER) IS
  'ADR-016: drop-in replacement pour get_vehicle_page_data_optimized. Cache-first, rebuild-on-miss.';

-- -----------------------------------------------------------------------------
-- refresh_stale_vehicle_cache(p_batch_size)
-- -----------------------------------------------------------------------------
-- Helper pour cron job : rafraîchit jusqu'à N lignes marquées stale.
-- Lancé toutes les 10 min côté scheduler (Phase 3 de l'ADR).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_stale_vehicle_cache(p_batch_size INTEGER DEFAULT 500)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_type_id   INTEGER;
  v_refreshed INTEGER := 0;
BEGIN
  FOR v_type_id IN
    SELECT type_id
      FROM public.__vehicle_page_cache
      WHERE stale = TRUE
      ORDER BY built_at ASC
      LIMIT GREATEST(p_batch_size, 1)
  LOOP
    PERFORM public.rebuild_vehicle_page_cache(v_type_id);
    v_refreshed := v_refreshed + 1;
  END LOOP;

  RETURN v_refreshed;
END;
$fn$;

COMMENT ON FUNCTION public.refresh_stale_vehicle_cache(INTEGER) IS
  'ADR-016: cron helper. Refresh LIMIT N stale rows in FIFO order. Appelé toutes les 10 min en Phase 3.';

COMMIT;
