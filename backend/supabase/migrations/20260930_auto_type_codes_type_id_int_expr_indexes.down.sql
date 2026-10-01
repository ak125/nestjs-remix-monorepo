-- Rollback: 20260930_auto_type_codes_type_id_int_expr_indexes
-- Retire les 2 index sur expression. `rm_get_page_complete_v2` retombe alors sur le
-- parcours complet des deux tables à chaque appel (l'état d'avant la migration), sans
-- erreur. Les statistiques produites par l'ANALYZE ne sont pas « annulables » et n'ont
-- pas à l'être : une statistique fraîche n'est jamais une régression.
-- L'engine est forward-only : ce fichier se lance à la main, hors transaction
-- (CONCURRENTLY). Timeouts à 0 : un GUC omis hérite des 60 s du rôle `postgres`.
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_motor_code_tmc_type_id_int_expr;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_number_code_tnc_type_id_int_expr;
