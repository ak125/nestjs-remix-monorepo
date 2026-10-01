-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois.
--
-- Migration: retirer 7 index strictement dupliqués (hors zones STOP et interdites)
--
-- Détecteur : l'advisor de performance Supabase `duplicate_index` (lint 0009), le
-- seul détecteur de doublons de ce projet — aucun second détecteur n'est créé ici.
-- Le 2026-09-29, il remonte 18 groupes. Cette migration en traite 7, retenus par un
-- critère unique, vérifié en lecture seule le 2026-09-29 vers 12:55Z :
--
--   1. définition identique au jumeau conservé : même table, même colonne, btree,
--      sans prédicat ni expression, ni l'un ni l'autre UNIQUE ;
--   2. l'index retiré n'a servi à AUCUN parcours (`idx_scan = 0`), alors que le
--      jumeau, lui, sert. Les compteurs courent depuis le démarrage de l'instance
--      re-provisionnée par l'upgrade PG 17.6 (`pg_postmaster_start_time()` =
--      2026-09-17 01:14Z, `stats_reset` nul) : douze jours de trafic réel ;
--   3. valide et prêt, ni identité de réplication ni CLUSTER, aucune dépendance
--      `pg_depend` en dehors de sa table, cité par aucun corps de fonction, aucune
--      vue, aucun job pg_cron, aucun fichier du dépôt.
--
-- Deux index de même définition offrent au planificateur exactement les mêmes chemins
-- d'accès : retirer l'un laisse l'autre servir le même plan. Preuve par masquage
-- (hypopg, dans la seule session de mesure, 2026-09-29 ~13:05Z) : une requête
-- d'égalité sur chacune des 7 colonnes, planifiée avec puis sans les 7 index
-- (`hypopg_hide_index`), donne le même plan nœud pour nœud (Index Only Scan, même
-- condition). Seule différence, sur `pieces_criteria` : le nom du jumeau. Les deux y
-- sont interchangeables pour le planificateur, qui les départage au coût (265 Mo
-- contre 270 Mo) ; la charge réelle, elle, n'a parcouru que `idx_pc_cri_id` (874
-- parcours, le dernier à 13:03Z). On retire donc l'autre, selon le critère 2 —
-- l'inverse de ce que proposait l'audit du 2026-09-07 §4.1.
--
--   index retiré                   table            taille   jumeau conservé (parcours)
--   idx_pieces_criteria_cri_id     pieces_criteria  265 MB   idx_pc_cri_id           (874)
--   idx_auto_type_type_marque_id   auto_type        1072 kB  idx_at_marque_id        (5)
--   idx_auto_type_type_modele_id   auto_type        1152 kB  idx_at_modele_id        (92 478)
--   idx_auto_type_type_tmf_id      auto_type        1096 kB  idx_at_tmf_id           (3)
--   idx___blog_advice_ba_pg_id     __blog_advice    16 kB    idx_blog_advice_pg_id   (363 315)
--   idx___seo_gamme_sg_pg_id       __seo_gamme      16 kB    idx_seo_gamme_pg_id     (249)
--   idx_catalog_gamme_mc_pg_id     catalog_gamme    16 kB    idx_catalog_gamme_pg_id (4 928)
--
-- Gain : ≈ 268 Mo, et surtout une mise à jour d'index de moins à chaque écriture sur
-- `pieces_criteria` (≈ 17,9 M lignes, 1,7 Go de heap).
--
-- Zone protégée : `pieces_criteria` et `auto_type` étaient exclus de toute proposition
-- de DROP par la consigne owner du 2026-09-15 (audit d'hygiène §4). Leur inclusion
-- ici est une décision owner explicite du 2026-09-29 (« go 7 index »).
--
-- HORS PÉRIMÈTRE — les 11 groupes que l'advisor gardera, et pourquoi :
--   - `pieces_price` ×2 : zone STOP prix, GO nominatif de l'owner requis ;
--   - `pieces_media_img` : zone interdite, jamais touchée ;
--   - `_archive.__agentic_*` ×6 : schéma archivé, à décider en bloc, pas index par index ;
--   - `auto_type_motor_code` (clé primaire / `auto_type_motor_code_uniq`) : l'index
--     unique sert (64 524 parcours), le retirer déplacerait des plans vers la clé ;
--   - `rm_rebuild_queue` : les deux index portent des CONTRAINTES, ce n'est pas un
--     DROP INDEX mais un DROP CONSTRAINT, décision distincte.
-- Les doublons qu'un index ordinaire forme avec une clé primaire ou un index unique
-- ne sont pas signalés par l'advisor ; ceux dont l'index ordinaire sert (ex.
-- `idx_pieces_id`, 129 Mo) déplaceraient des plans : ils restent hors de ce lot.
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne relit pas la heap, mais il attend la
-- fin des transactions qui voient la table ; ces attentes comptent contre
-- lock_timeout. Il ne bloque ni les lectures ni les écritures. Le job CI borne le run.
-- `IF EXISTS` rend le fichier rejouable : un DROP CONCURRENTLY interrompu laisse un
-- index INVALIDE, qu'une seconde exécution retire.
--
-- Effet de bord attendu : chaque DROP déclenche l'event trigger `pgrst_drop_watch`
-- (`sql_drop`), qui recharge le cache de schéma de PostgREST — 7 rechargements, sans
-- changement de l'API exposée (un index n'y figure pas).
--
-- Retour arrière : `20260929_drop_exact_duplicate_indexes.down.sql` recrée les 7
-- index à l'identique (CONCURRENTLY). L'engine est forward-only : ce fichier se lance
-- à la main.
--
-- Vérification après application (lecture seule) :
--   SELECT n, to_regclass('public.' || n) FROM unnest(ARRAY[
--     'idx_pieces_criteria_cri_id','idx_auto_type_type_marque_id',
--     'idx_auto_type_type_modele_id','idx_auto_type_type_tmf_id',
--     'idx___blog_advice_ba_pg_id','idx___seo_gamme_sg_pg_id',
--     'idx_catalog_gamme_mc_pg_id']) AS n;            -- attendu : 7 × NULL
--   SELECT n, to_regclass('public.' || n) FROM unnest(ARRAY[
--     'idx_pc_cri_id','idx_at_marque_id','idx_at_modele_id','idx_at_tmf_id',
--     'idx_blog_advice_pg_id','idx_seo_gamme_pg_id',
--     'idx_catalog_gamme_pg_id']) AS n;               -- attendu : 7 jumeaux présents
--   Advisor performance `duplicate_index` : 18 → 11.
SET lock_timeout = 0;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_criteria_cri_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_type_marque_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_type_modele_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_type_tmf_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_advice_ba_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___seo_gamme_sg_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_catalog_gamme_mc_pg_id;
