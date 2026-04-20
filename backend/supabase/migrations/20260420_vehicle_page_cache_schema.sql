-- =============================================================================
-- ADR-016 — Vehicle Page Cache (persistance par matérialisation)
-- Migration 1/2 : SCHEMA (inerte, ne modifie aucune RPC existante)
-- =============================================================================
-- Related: INC-2026-005, ADR-016 (governance vault)
-- Safe to apply: OUI. Cette migration ne touche pas get_vehicle_page_data_optimized
-- ni aucun code appelant. La table reste inutilisée tant que le flag
-- USE_VEHICLE_PAGE_CACHE n'est pas activé côté backend.
-- =============================================================================

BEGIN;

-- Table de cache persistant, 1 ligne par type_id véhicule.
-- Taille estimée : 54 000 types × ~30 KB JSON ≈ 1,6 GB.
CREATE TABLE IF NOT EXISTS public.__vehicle_page_cache (
  type_id      INTEGER      PRIMARY KEY,
  payload      JSONB        NOT NULL,
  source_hash  TEXT         NOT NULL,
  built_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  stale        BOOLEAN      NOT NULL DEFAULT FALSE,
  stale_reason TEXT
);

COMMENT ON TABLE  public.__vehicle_page_cache IS
  'ADR-016: cache matérialisé du payload page véhicule. Source de vérité rapide pour /constructeurs/*/type.html et /pieces/*/type.html.';
COMMENT ON COLUMN public.__vehicle_page_cache.payload      IS 'JSONB identique à la sortie de get_vehicle_page_data_optimized()';
COMMENT ON COLUMN public.__vehicle_page_cache.source_hash  IS 'md5(inputs) pour invalidation ciblée et détection de no-op';
COMMENT ON COLUMN public.__vehicle_page_cache.built_at     IS 'Horodatage de la dernière matérialisation';
COMMENT ON COLUMN public.__vehicle_page_cache.stale        IS 'TRUE = ligne obsolète à rebuild (via trigger ou cron)';
COMMENT ON COLUMN public.__vehicle_page_cache.stale_reason IS 'Optionnel: raison de l''invalidation (ex: prt_insert, manual, tecdoc_sync)';

-- Index partiel pour retrouver rapidement les lignes à rebuild.
CREATE INDEX IF NOT EXISTS idx_vpc_stale
  ON public.__vehicle_page_cache (built_at)
  WHERE stale = TRUE;

-- Index sur built_at pour dashboards (âge du cache).
CREATE INDEX IF NOT EXISTS idx_vpc_built_at
  ON public.__vehicle_page_cache (built_at DESC);

-- RLS: lecture service_role uniquement (aucun accès client direct).
ALTER TABLE public.__vehicle_page_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vpc_service_role_all ON public.__vehicle_page_cache;
CREATE POLICY vpc_service_role_all
  ON public.__vehicle_page_cache
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMIT;
