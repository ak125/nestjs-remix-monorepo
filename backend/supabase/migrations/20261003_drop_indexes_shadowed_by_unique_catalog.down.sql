-- Rollback: 20261003_drop_indexes_shadowed_by_unique_catalog
-- Recrée les 13 index ordinaires retirés, définitions relevées par `pg_get_indexdef` le
-- 2026-10-03 à 08:05Z, avant le retrait. L'engine est forward-only : ce fichier se lance
-- à la main, hors transaction (CONCURRENTLY), une instruction à la fois.
-- CONCURRENTLY : pas de verrou bloquant les écritures, au prix de deux balayages de la
-- table par index. Timeouts à 0 : un GUC omis hérite des 60 s du rôle `postgres`
-- (incident 20260529, PR #1395). Chaque index recréé double à nouveau son jumeau unique,
-- qui n'a pas bougé : le retour arrière ne rend aucun plan, seulement l'index.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer. Le contrôle
-- final liste les index recréés absents ou invalides.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_am_2022_suppliers_sup_id
  ON public.am_2022_suppliers USING btree (sup_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_type_id
  ON public.auto_type USING btree (type_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_motor_fuel_tmf_id
  ON public.auto_type_motor_fuel USING btree (tmf_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_family_mf_id
  ON public.catalog_family USING btree (mf_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_gamme_mc_id
  ON public.catalog_gamme USING btree (mc_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_id
  ON public.pieces USING btree (piece_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_criteria_group_cri_id
  ON public.pieces_criteria_group USING btree (cri_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_details_pd_piece_id
  ON public.pieces_details USING btree (pd_piece_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_gamme_pg_id
  ON public.pieces_gamme USING btree (pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_gamme_cross_pgc_id
  ON public.pieces_gamme_cross USING btree (pgc_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_marque_pm_id
  ON public.pieces_marque USING btree (pm_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_ref_brand_prb_id
  ON public.pieces_ref_brand USING btree (prb_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_status_pst_id
  ON public.pieces_status USING btree (pst_id);

-- Contrôle (lecture seule) : 0 ligne attendue.
SELECT n AS index_absent_ou_invalide
  FROM unnest(ARRAY[
    'idx_am_2022_suppliers_sup_id', 'idx_auto_type_type_id',
    'idx_auto_type_motor_fuel_tmf_id', 'idx_catalog_family_mf_id',
    'idx_catalog_gamme_mc_id', 'idx_pieces_id',
    'idx_pieces_criteria_group_cri_id', 'idx_pieces_details_pd_piece_id',
    'idx_pieces_gamme_pg_id', 'idx_pieces_gamme_cross_pgc_id',
    'idx_pieces_marque_pm_id', 'idx_pieces_ref_brand_prb_id',
    'idx_pieces_status_pst_id'
  ]) AS x(n)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || x.n)
      AND i.indisvalid AND i.indisready
 );
