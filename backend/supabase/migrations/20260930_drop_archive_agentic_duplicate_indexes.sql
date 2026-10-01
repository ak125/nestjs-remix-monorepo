-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois.
--
-- Migration: retirer les 6 index dupliqués des tables archivées `_archive.__agentic_*`
--
-- Détecteur : l'advisor de performance Supabase `duplicate_index` (lint 0009), le
-- seul détecteur de doublons de ce projet. Après #1619 et #1623, il remonte 9 groupes ;
-- 6 d'entre eux sont ici. #1619 les avait écartés pour les traiter ensemble plutôt
-- qu'index par index : ce fichier les traite tous les six, et rien d'autre.
--
-- Les tables `__agentic_*` ont été créées par 20260312_agentic_engine_tables.sql, qui
-- déclare un index par colonne de jointure, nommé `idx_agentic_<table>_<col>_id`. Un
-- second index de même définition, nommé sans le suffixe `_id`, existe sur chacune de
-- ces colonnes sans qu'aucun fichier du dépôt ne le crée. On garde l'index déclaré par
-- le dépôt et on retire le jumeau non déclaré.
--
-- Critère (celui de #1619), vérifié en lecture seule le 2026-09-30 vers 14:50Z :
--   1. définition identique au jumeau conservé dans `pg_index` : même colonne, btree,
--      même classe d'opérateurs et collation, sans prédicat ni expression, ni l'un ni
--      l'autre UNIQUE ;
--   2. 0 parcours, pour l'index retiré comme pour le jumeau, depuis le démarrage de
--      l'instance re-provisionnée (`pg_postmaster_start_time()` = 2026-09-17 01:14Z,
--      `stats_reset` nul). Les tables n'ont reçu aucune écriture sur la période
--      (n_tup_ins/upd/del = 0) : schéma archivé ;
--   3. aucune attache : pas de contrainte, aucune entrée `pg_depend`, cité par aucun
--      corps de fonction, aucune vue, aucun job pg_cron, aucun fichier du dépôt.
--
--   index retiré                    table                           jumeau conservé
--   idx_agentic_branches_run        _archive.__agentic_branches      idx_agentic_branches_run_id
--   idx_agentic_checkpoints_run     _archive.__agentic_checkpoints   idx_agentic_checkpoints_run_id
--   idx_agentic_evidence_run        _archive.__agentic_evidence      idx_agentic_evidence_run_id
--   idx_agentic_gate_results_run    _archive.__agentic_gate_results  idx_agentic_gate_results_run_id
--   idx_agentic_steps_branch        _archive.__agentic_steps         idx_agentic_steps_branch_id
--   idx_agentic_steps_run           _archive.__agentic_steps         idx_agentic_steps_run_id
--
-- Gain : 6 × 16 kB. L'intérêt est ailleurs : l'advisor cesse de signaler ces 6 groupes,
-- et le signal restant ne porte plus que sur des cas qui demandent une décision.
--
-- HORS PÉRIMÈTRE : le sort des tables `_archive.__agentic_*` elles-mêmes (conservation
-- ou suppression après export). C'est une décision de données, distincte, que ce
-- fichier ne préjuge pas : les 6 jumeaux conservés continuent de servir toute
-- requête de jointure qu'on y lancerait.
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne bloque ni les lectures ni les
-- écritures. `IF EXISTS` rend le fichier rejouable : un DROP CONCURRENTLY interrompu
-- laisse un index INVALIDE, qu'une seconde exécution retire.
--
-- Effet de bord attendu : 6 rechargements du cache de schéma PostgREST (event trigger
-- `pgrst_drop_watch`), sans changement de l'API exposée.
--
-- Retour arrière : `20260930_drop_archive_agentic_duplicate_indexes.down.sql` recrée
-- les 6 index à l'identique (CONCURRENTLY), à lancer à la main (engine forward-only).
--
-- Vérification après application (lecture seule) :
--   SELECT n, to_regclass('_archive.' || n) FROM unnest(ARRAY[
--     'idx_agentic_branches_run','idx_agentic_checkpoints_run','idx_agentic_evidence_run',
--     'idx_agentic_gate_results_run','idx_agentic_steps_branch','idx_agentic_steps_run']) AS n;
--     -- attendu : 6 × NULL
--   SELECT n, to_regclass('_archive.' || n) FROM unnest(ARRAY[
--     'idx_agentic_branches_run_id','idx_agentic_checkpoints_run_id','idx_agentic_evidence_run_id',
--     'idx_agentic_gate_results_run_id','idx_agentic_steps_branch_id','idx_agentic_steps_run_id']) AS n;
--     -- attendu : 6 jumeaux présents
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS _archive.idx_agentic_branches_run;

DROP INDEX CONCURRENTLY IF EXISTS _archive.idx_agentic_checkpoints_run;

DROP INDEX CONCURRENTLY IF EXISTS _archive.idx_agentic_evidence_run;

DROP INDEX CONCURRENTLY IF EXISTS _archive.idx_agentic_gate_results_run;

DROP INDEX CONCURRENTLY IF EXISTS _archive.idx_agentic_steps_branch;

DROP INDEX CONCURRENTLY IF EXISTS _archive.idx_agentic_steps_run;
