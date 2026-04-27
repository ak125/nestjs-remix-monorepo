-- =============================================================================
-- ADR-024 — R1 Gamme Page Cache (persistance par matérialisation)
-- Migration 1/2 : SCHEMA (inerte, ne modifie aucune RPC existante)
-- =============================================================================
-- Related: ADR-024 (governance vault), parité ADR-016 (vehicle_page_cache)
--
-- Safe to apply: OUI. Cette migration ne touche pas
-- get_gamme_page_data_optimized() ni aucun code appelant. La table reste
-- inutilisée tant que les fonctions de la migration 2/2 ne sont pas
-- appelées par le backend. Phase 1 = scaffolding pur.
--
-- Schéma byte-pour-byte identique à __vehicle_page_cache (ADR-016) sauf que
-- la PK est `pg_id` au lieu de `type_id`. Cohérence architecture R1 ↔ R8.
-- =============================================================================

BEGIN;

-- Table de cache persistant, 1 ligne par pg_id (gamme).
-- Cible : ~238 gammes G1/G2 indexées (pieces_gamme.pg_level IN ('1','2')).
-- Taille estimée : 238 × ~50 KB JSON ≈ 12 MB.
CREATE TABLE IF NOT EXISTS public.__gamme_page_cache (
  pg_id        INTEGER      PRIMARY KEY,
  payload      JSONB        NOT NULL,
  source_hash  TEXT         NOT NULL,
  built_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  stale        BOOLEAN      NOT NULL DEFAULT FALSE,
  stale_reason TEXT
);

COMMENT ON TABLE  public.__gamme_page_cache IS
  'ADR-024: cache matérialisé du payload page gamme R1. Source de vérité rapide pour /pieces/{slug}-{pg_id}.html. Parité ADR-016 (__vehicle_page_cache).';
COMMENT ON COLUMN public.__gamme_page_cache.payload      IS 'JSONB identique à la sortie de get_gamme_page_data_optimized() — Phase 1 ne contient que aggregated_data, l''enrichment SSR sera ajouté en Phase 2';
COMMENT ON COLUMN public.__gamme_page_cache.source_hash  IS 'md5(inputs) pour invalidation ciblée et détection de no-op';
COMMENT ON COLUMN public.__gamme_page_cache.built_at     IS 'Horodatage de la dernière matérialisation';
COMMENT ON COLUMN public.__gamme_page_cache.stale        IS 'TRUE = ligne obsolète à rebuild (via trigger ou cron)';
COMMENT ON COLUMN public.__gamme_page_cache.stale_reason IS 'Optionnel: raison de l''invalidation (ex: seo_gamme_update, image_prompts_change, manual)';

-- Index partiel pour retrouver rapidement les lignes à rebuild (FIFO sur built_at).
CREATE INDEX IF NOT EXISTS idx_gpc_stale
  ON public.__gamme_page_cache (built_at)
  WHERE stale = TRUE;

-- Index sur built_at pour dashboards (âge du cache).
CREATE INDEX IF NOT EXISTS idx_gpc_built_at
  ON public.__gamme_page_cache (built_at DESC);

-- RLS: lecture service_role uniquement (aucun accès client direct).
-- Cohérent avec la politique appliquée à __vehicle_page_cache (ADR-021).
ALTER TABLE public.__gamme_page_cache ENABLE ROW LEVEL SECURITY;

-- APPROVED: Idempotent DROP POLICY IF EXISTS pour rendre la migration ré-appliquable.
-- Pattern identique à 20260420_vehicle_page_cache_schema.sql (ADR-016 mergée).
-- La policy est immédiatement recréée juste après par CREATE POLICY (ligne suivante).
-- Aucun risque de bypass RLS — la table reste ENABLE ROW LEVEL SECURITY entre les deux statements.
DROP POLICY IF EXISTS gpc_service_role_all ON public.__gamme_page_cache;
CREATE POLICY gpc_service_role_all
  ON public.__gamme_page_cache
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

COMMIT;
