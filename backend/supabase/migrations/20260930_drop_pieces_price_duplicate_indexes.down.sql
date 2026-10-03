-- Rollback: 20260930_drop_pieces_price_duplicate_indexes
-- Recrée les 2 index retirés, définitions relevées par `pg_get_indexdef` le 2026-09-30
-- à 13:47Z, avant le retrait. L'engine est forward-only : ce fichier se lance à la
-- main, hors transaction (CONCURRENTLY).
-- CONCURRENTLY : pas de verrou bloquant les écritures sur `pieces_price`, au prix de
-- deux balayages. Timeouts à 0 : un GUC omis hérite des 60 s du rôle `postgres`.
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer.
SET lock_timeout = 0;
SET statement_timeout = 0;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_piece_id
  ON public.pieces_price USING btree (pri_piece_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pieces_price_pri_pm_id
  ON public.pieces_price USING btree (pri_pm_id);
