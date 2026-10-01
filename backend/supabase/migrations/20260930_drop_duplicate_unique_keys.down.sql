-- Rollback: 20260930_drop_duplicate_unique_keys
-- Recrée les 2 doublons retirés, définitions relevées le 2026-09-30 avant le retrait.
-- L'engine est forward-only : ce fichier se lance à la main, en autocommit (psql sans
-- -1), une instruction à la fois : CREATE INDEX CONCURRENTLY refuse une transaction.
--
-- auto_type_motor_code : la clé primaire reste portée par l'index promu ; on recrée à
-- côté un index unique de même définition sous l'ancien nom `_uniq`. On retrouve l'état
-- de départ (deux index uniques identiques, dont un porte la clé primaire) ; seuls les
-- OID des index diffèrent.
-- rm_rebuild_queue : index unique construit en CONCURRENTLY, puis rattaché comme
-- contrainte UNIQUE sous son nom d'origine (USING INDEX ne relit pas la table).
--
-- Un build interrompu laisse un index INVALIDE que `IF NOT EXISTS` sauterait en
-- silence : dans ce cas, `DROP INDEX CONCURRENTLY IF EXISTS` puis relancer.
SET lock_timeout = '2s';
SET statement_timeout = 0;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS auto_type_motor_code_uniq
  ON public.auto_type_motor_code USING btree (tmc_type_id, tmc_code);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS rm_rebuild_queue_rmrq_gamme_id_rmrq_vehicle_id_key
  ON public.rm_rebuild_queue USING btree (rmrq_gamme_id, rmrq_vehicle_id);

ALTER TABLE public.rm_rebuild_queue
  ADD CONSTRAINT rm_rebuild_queue_rmrq_gamme_id_rmrq_vehicle_id_key
  UNIQUE USING INDEX rm_rebuild_queue_rmrq_gamme_id_rmrq_vehicle_id_key;
