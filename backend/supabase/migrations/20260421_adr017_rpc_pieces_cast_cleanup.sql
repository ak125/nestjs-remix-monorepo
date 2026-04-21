-- =============================================================================
-- ADR-017 — Nettoyage casts TEXT↔INTEGER dans les RPC `pieces_*`
-- =============================================================================
-- Related : INC-2026-005, ADR-017 (governance-vault)
--
-- Cette migration réécrit les RPC identifiées par l'audit pg_stat_statements
-- 2026-04-21 pour :
--   - utiliser `auto_type.type_id_i / type_modele_id_i / type_marque_id_i` (INTEGER)
--     au lieu de caster `::text` / `::integer` à chaque JOIN
--   - permettre au planner d'utiliser `idx_auto_type_type_id_i_unique` et
--     `idx_prt_pg_id_type_id` (ADR-017, créé via scripts/db/adr017-create-index-concurrently.py)
--
-- Safety :
--   - CREATE OR REPLACE FUNCTION, signatures inchangées (callers back-compatible)
--   - Rollback par git revert + re-migration
--   - Backfill _i vérifié à 100% (0 NULL, 0 divergence) avant application
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- RPC #1 : get_alternative_vehicles_for_gamme (top CPU 45%)
-- -----------------------------------------------------------------------------
-- Avant (baseline audit 2026-04-21) :
--   - 3 casts ::text/::integer qui bloquent les index
--   - Hash Join + Seq Scan auto_type
--   - Pour gamme populaire (307): cross-product 1M rows avant DISTINCT+ORDER+LIMIT
--   - Moyenne 10.5s (45% du CPU total DB)
--
-- Après :
--   - CTE DISTINCT-first : réduit 1M rows → ~22k distinct types AVANT les JOINs
--   - Jointures via colonnes `_i` INTEGER natives (aucun cast)
--   - Utilise idx_prt_pg_id_type_id (créé via scripts/db/adr017-create-index-concurrently.py)
--
-- Mesuré 2026-04-21 :
--   - Gamme vide (1001)     : 3172ms → 172ms  (-95%, cible <200ms ✅)
--   - Gamme populaire (307) : 10500ms → 395ms (-96%)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_alternative_vehicles_for_gamme(
  p_gamme_id         integer,
  p_exclude_type_id  integer,
  p_limit            integer DEFAULT 6
)
RETURNS TABLE(
  type_id      text,
  type_name    text,
  type_alias   text,
  modele_name  text,
  modele_alias text,
  modele_id    integer,
  marque_name  text,
  marque_alias text,
  marque_id    integer
)
LANGUAGE sql
STABLE
AS $fn$
  WITH distinct_types AS (
    -- Index Only Scan sur idx_prt_pg_id_type_id → 22k distinct types pour gamme populaire
    SELECT DISTINCT rtp_type_id
    FROM pieces_relation_type
    WHERE rtp_pg_id = p_gamme_id
      AND rtp_type_id <> p_exclude_type_id
  )
  SELECT
    at.type_id,
    at.type_name,
    at.type_alias,
    am.modele_name,
    am.modele_alias,
    am.modele_id,
    amq.marque_name,
    amq.marque_alias,
    amq.marque_id
  FROM distinct_types dt
  JOIN auto_type   at  ON at.type_id_i        = dt.rtp_type_id
  JOIN auto_modele am  ON am.modele_id        = at.type_modele_id_i
  JOIN auto_marque amq ON amq.marque_id       = at.type_marque_id_i
  ORDER BY amq.marque_name, am.modele_name, at.type_name
  LIMIT p_limit;
$fn$;

COMMENT ON FUNCTION public.get_alternative_vehicles_for_gamme(integer,integer,integer) IS
  'ADR-017 final: CTE DISTINCT-first sur idx_prt_pg_id_type_id, joins via colonnes _i INTEGER. p99 ~400ms vs 10.5s baseline.';

COMMIT;

-- -----------------------------------------------------------------------------
-- NOTE : L'index public.idx_prt_pg_id_type_id est créé séparément via
--   scripts/db/adr017-create-index-concurrently.py
-- parce que `CREATE INDEX CONCURRENTLY` ne peut pas tourner dans un bloc
-- transactionnel. Commande équivalente hors-tx :
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prt_pg_id_type_id
--     ON public.pieces_relation_type (rtp_pg_id, rtp_type_id);
-- -----------------------------------------------------------------------------

-- TODO (itérations suivantes de cette branche, mesurées avant apply) :
--   - rm_get_page_complete_v2        (23% CPU, 4 NULLIF)
--   - get_pieces_for_type_gamme_v3   (15% CPU, 17 NULLIF)
--   - get_pieces_for_type_gamme_v4   (20 NULLIF)
--   - get_pieces_for_type_gamme_v2   (7 NULLIF)
--   - get_pieces_for_type_gamme (v1) (12 NULLIF)
--   - get_listing_products_extended  (13 NULLIF)
--   - get_listing_products_extended_filtered (13 NULLIF)
--   - get_listing_products_for_build_v2 (6 NULLIF)
