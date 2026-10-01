-- Rollback: 20260929_drop_exact_duplicate_indexes
-- Recrée les 7 index retirés, définitions relevées dans `pg_indexes` le 2026-09-29
-- avant le retrait. L'engine est forward-only : ce fichier se lance à la main, hors
-- transaction (CONCURRENTLY).
-- CONCURRENTLY : pas de verrou bloquant les écritures sur `pieces_criteria` (1,7 Go de
-- heap), au prix de deux balayages. Timeouts à 0 : un GUC omis hérite des 60 s du
-- rôle `postgres`, et le build de `pieces_criteria` les dépasserait.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_criteria_cri_id
  ON public.pieces_criteria USING btree (pc_cri_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_type_marque_id
  ON public.auto_type USING btree (type_marque_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_type_modele_id
  ON public.auto_type USING btree (type_modele_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_auto_type_type_tmf_id
  ON public.auto_type USING btree (type_tmf_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_advice_ba_pg_id
  ON public.__blog_advice USING btree (ba_pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___seo_gamme_sg_pg_id
  ON public.__seo_gamme USING btree (sg_pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_catalog_gamme_mc_pg_id
  ON public.catalog_gamme USING btree (mc_pg_id);
