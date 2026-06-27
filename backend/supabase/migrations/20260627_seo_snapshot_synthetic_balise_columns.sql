-- =============================================================================
-- Migration : __seo_snapshot_synthetic — colonnes balise (meta-desc + OG) + ids
-- Date      : 2026-06-27
-- Severity  : LOW (additif pur, colonnes NULLABLE, zéro réécriture de table)
-- Spec      : plan balises R0→R8, D-0 (baseline crawl HTML R8/R2, SyntheticCrawler étendu)
-- =============================================================================
--
-- PURPOSE
-- -------
-- Étend la table d'observation du SyntheticCrawler (L1 control plane) pour
-- capturer les BALISES réellement émises au-delà de title/h1/canonical/robots :
--   * meta-description (+ flag présence),
--   * bloc Open Graph (og:title / og:description / og:image / og:url + flag),
--   * ids catalogue (pg_id / type_id / modele_id) reportés en mode seed-list R8
--     (NULL pour le crawl sitemap échantillonné, qui n'a que l'URL).
-- Ces colonnes alimentent les 5 taux baseline D-0
-- (scripts/qa/seo-snapshot-baseline-rates.py).
--
-- IDEMPOTENCE / SÛRETÉ
-- --------------------
--   * ADD COLUMN IF NOT EXISTS — ré-exécution = no-op.
--   * Toutes NULLABLE, aucun DEFAULT volatil → métadonnée pure, pas de réécriture
--     ni de lock long (instantané en PG 11+).
--   * __seo_snapshot_synthetic est PARTITIONNÉE BY RANGE(created_at) : un ADD
--     COLUMN sur le parent se propage automatiquement à toutes les partitions
--     enfants (J..J+14) — aucune action par-partition requise.
--   * Transaction gérée par le runner (.squawk.toml : assume_in_transaction=true)
--     → pas de BEGIN/COMMIT explicite.
--
-- ROLLBACK (documentation seule — NON exécuté)
-- --------------------------------------------
--   ALTER TABLE public.__seo_snapshot_synthetic
--     DROP COLUMN IF EXISTS pg_id, DROP COLUMN IF EXISTS type_id,
--     DROP COLUMN IF EXISTS modele_id, DROP COLUMN IF EXISTS meta_description,
--     DROP COLUMN IF EXISTS has_meta_description, DROP COLUMN IF EXISTS og_title,
--     DROP COLUMN IF EXISTS og_description, DROP COLUMN IF EXISTS og_image,
--     DROP COLUMN IF EXISTS og_url, DROP COLUMN IF EXISTS has_og;
-- =============================================================================

SET LOCAL lock_timeout      = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE public.__seo_snapshot_synthetic
  ADD COLUMN IF NOT EXISTS pg_id                BIGINT,
  ADD COLUMN IF NOT EXISTS type_id              BIGINT,
  ADD COLUMN IF NOT EXISTS modele_id            BIGINT,
  ADD COLUMN IF NOT EXISTS meta_description     TEXT,
  ADD COLUMN IF NOT EXISTS has_meta_description BOOLEAN,
  ADD COLUMN IF NOT EXISTS og_title             TEXT,
  ADD COLUMN IF NOT EXISTS og_description       TEXT,
  ADD COLUMN IF NOT EXISTS og_image             TEXT,
  ADD COLUMN IF NOT EXISTS og_url               TEXT,
  ADD COLUMN IF NOT EXISTS has_og               BOOLEAN;

-- =============================================================================
-- End of migration.
-- =============================================================================
