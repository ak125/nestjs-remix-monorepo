-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois
--   (gate A5 `--lint-markers`). La première instruction qui lève arrête le fichier et
--   marque la migration `failed` : le bloc de pré-conditions, placé avant tout DROP,
--   est donc réellement bloquant.
--
-- Migration: retirer 13 index ordinaires doublés par un index unique identique
-- (lot 3/3 : catalogue protégé)
--
-- Restes de la conversion MySQL : chaque colonne déjà couverte par la clé primaire (ou
-- une contrainte UNIQUE) a reçu en plus un index ordinaire de MÊME définition. Sur 85
-- paires relevées le 2026-10-03, 74 sont de vrais doublons dans `public`, répartis en
-- 3 lots, un par zone, pour qu'un GO porte sur une zone et une seule :
--   lot 1 `20261003_drop_indexes_shadowed_by_unique_content`  — 37 index, hors STOP ;
--   lot 2 `20261003_drop_indexes_shadowed_by_unique_commerce` — 24 index, zone STOP ;
--   lot 3 `20261003_drop_indexes_shadowed_by_unique_catalog`  — 13 index, zone protégée.
-- Hors lots (11) : 1 index du schéma `auth` (géré par Supabase), 9 de `_archive`
-- (schéma archivé, à décider en bloc) et `idx_metrics_experiment_date`, dont l'ordre
-- de tri (`indoption`) diffère de celui de `crawl_budget_metrics_experiment_id_date_key` :
-- ce n'est pas un doublon.
--
-- ZONE PROTÉGÉE — tables du catalogue (`pieces*`, `auto_type*`, `catalog_*`,
-- `am_2022_suppliers`), exclues de toute proposition de DROP par la consigne owner
-- du 2026-09-15 (audit d'hygiène §4). Ce fichier ne s'applique qu'après une décision
-- owner explicite portant sur CETTE liste de 13 index, comme pour #1619. Il ne touche
-- ni une ligne ni une colonne : seulement des index secondaires non uniques, chacun
-- doublé par la clé primaire de même définition, qui reste en place.
--
-- `idx_pieces_id` (128,8 Mo) était laissé hors de #1619 au motif que retirer un
-- index qui sert « déplacerait des plans ». La preuve 2 mesure ce déplacement : le
-- plan garde sa forme et ne change que de nom d'index. `pieces_pkey` est plus gros
-- (157,3 Mo) ; le planificateur le choisit tout de même pour les mêmes requêtes, un
-- accès par clé ne lisant qu'une feuille par valeur. Aucun parcours ne l'a lu depuis
-- le 2026-09-17 : ses pages seront froides dans le cache juste après le retrait.
--
-- PREUVE — structurelle. Elle ne repose pas sur l'absence d'usage : aucune fenêtre
-- d'observation ni aucun compteur figé n'est exigé.
--   1. Même définition. Pour chaque paire, `pg_get_indexdef` de l'index retiré et de
--      l'index unique conservé sont identiques au nom et au mot UNIQUE près : même
--      table, mêmes colonnes dans le même ordre, mêmes classes d'opérateurs, collations
--      et ordres de tri, btree, sans prédicat ni expression ni colonne INCLUDE.
--      Relevé le 2026-10-03 à 08:05Z ; la pré-condition §0 le revérifie à l'application.
--   2. Mêmes plans. Deux index de même définition offrent au planificateur les mêmes
--      chemins d'accès. Preuve par masquage (`hypopg_hide_index`, dans la seule session
--      de mesure, 2026-10-03 vers 08:00Z) sur les index de ce lot qui servent : une
--      requête d'égalité et une requête `= ANY`, planifiées (GENERIC_PLAN) avec puis
--      sans l'index ordinaire, donnent le même plan nœud pour nœud. Quand un index y
--      figure, seul son nom change, et c'est celui du jumeau unique.
--   3. Rien ne le nomme. L'index retiré ne porte ni contrainte, ni dépendance
--      `pg_depend`, ni identité de réplication, ni CLUSTER. Aucun corps de fonction,
--      job pg_cron, commentaire, ni fichier du dépôt (hors sa migration de création) ne
--      le cite ; l'instance n'a pas `pg_hint_plan`.
--   Ses parcours se reportent donc sur le jumeau, au même plan.
--
-- Index retirés (parcours depuis le démarrage de l'instance, 2026-09-17 01:14Z,
-- relevés le 2026-10-03 à 08:05Z) :
--
--   table                  index retiré                        taille     parcours  jumeau conservé (parcours)
--   am_2022_suppliers      idx_am_2022_suppliers_sup_id         72 ko            0  am_2022_suppliers_pkey (0)
--   auto_type              idx_auto_type_type_id               3,2 Mo      703 749  auto_type_pkey (2 684 677)
--   auto_type_motor_fuel   idx_auto_type_motor_fuel_tmf_id      16 ko            2  auto_type_motor_fuel_pkey (0)
--   catalog_family         idx_catalog_family_mf_id             16 ko        5 828  catalog_family_pkey (0)
--   catalog_gamme          idx_catalog_gamme_mc_id              16 ko            0  catalog_gamme_pkey (0)
--   pieces                 idx_pieces_id                     128,8 Mo      234 907  pieces_pkey (0)
--   pieces_criteria_group  idx_pieces_criteria_group_cri_id    176 ko            0  pieces_criteria_group_pkey (0)
--   pieces_details         idx_pieces_details_pd_piece_id       16 ko            0  pieces_details_pkey (0)
--   pieces_gamme           idx_pieces_gamme_pg_id              432 ko   24 825 462  pieces_gamme_pkey (0)
--   pieces_gamme_cross     idx_pieces_gamme_cross_pgc_id        64 ko            0  pieces_gamme_cross_pkey (0)
--   pieces_marque          idx_pieces_marque_pm_id              40 ko  126 149 528  pieces_marque_pkey (0)
--   pieces_ref_brand       idx_pieces_ref_brand_prb_id         240 ko        1 612  pieces_ref_brand_pkey (0)
--   pieces_status          idx_pieces_status_pst_id             16 ko            0  pieces_status_pkey (0)
--
-- Gain : 133,1 Mo (139 550 720 octets), 13 index de moins à maintenir à chaque
-- écriture. Index qui servaient, dont les parcours passent au jumeau : 7.
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne relit pas la heap, mais il attend la
-- fin des transactions qui voient la table ; ces attentes comptent contre
-- lock_timeout. Il ne bloque ni les lectures ni les écritures. Le job CI borne le run.
-- `IF EXISTS` rend le fichier rejouable : un DROP CONCURRENTLY interrompu laisse un
-- index INVALIDE, qu'une seconde exécution retire.
--
-- Effet de bord attendu : chaque DROP déclenche l'event trigger `pgrst_drop_watch`
-- (`sql_drop`), qui recharge le cache de schéma de PostgREST — 13 rechargements, sans
-- changement de l'API exposée (un index n'y figure pas).
--
-- Retour arrière : `20261003_drop_indexes_shadowed_by_unique_catalog.down.sql`
-- recrée les 13 index à l'identique (CONCURRENTLY). L'engine est forward-only : ce
-- fichier se lance à la main.
SET lock_timeout = 0;
SET statement_timeout = 0;

-- -----------------------------------------------------------------------------
-- §0 — PRÉ-CONDITIONS FAIL-CLOSED (lecture de catalogue uniquement)
-- -----------------------------------------------------------------------------
-- Pour chaque paire [table, index retiré, jumeau unique conservé], si l'index retiré
-- est encore là (absent = déjà retiré, rejeu) :
--   * le jumeau existe sur la même table, est unique, immédiat, valide, prêt et vivant ;
--   * l'index retiré n'est ni unique, ni primaire, ni d'exclusion, ni identité de
--     réplication, ni CLUSTER, ne porte aucune contrainte et n'a aucun objet dépendant ;
--   * les deux définitions (`pg_get_indexdef`) sont identiques au nom et à UNIQUE près.
-- Un seul écart = ABORT avant tout DROP : la preuve 1 ne tient plus pour cette paire.
DO $precheck$
DECLARE
  v_pair  text[];
  v_tbl   oid;
  v_plain oid;
  v_twin  oid;
  v_pdef  text;
  v_tdef  text;
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ['am_2022_suppliers', 'idx_am_2022_suppliers_sup_id', 'am_2022_suppliers_pkey'],
    ['auto_type', 'idx_auto_type_type_id', 'auto_type_pkey'],
    ['auto_type_motor_fuel', 'idx_auto_type_motor_fuel_tmf_id', 'auto_type_motor_fuel_pkey'],
    ['catalog_family', 'idx_catalog_family_mf_id', 'catalog_family_pkey'],
    ['catalog_gamme', 'idx_catalog_gamme_mc_id', 'catalog_gamme_pkey'],
    ['pieces', 'idx_pieces_id', 'pieces_pkey'],
    ['pieces_criteria_group', 'idx_pieces_criteria_group_cri_id', 'pieces_criteria_group_pkey'],
    ['pieces_details', 'idx_pieces_details_pd_piece_id', 'pieces_details_pkey'],
    ['pieces_gamme', 'idx_pieces_gamme_pg_id', 'pieces_gamme_pkey'],
    ['pieces_gamme_cross', 'idx_pieces_gamme_cross_pgc_id', 'pieces_gamme_cross_pkey'],
    ['pieces_marque', 'idx_pieces_marque_pm_id', 'pieces_marque_pkey'],
    ['pieces_ref_brand', 'idx_pieces_ref_brand_prb_id', 'pieces_ref_brand_pkey'],
    ['pieces_status', 'idx_pieces_status_pst_id', 'pieces_status_pkey']
  ] LOOP
    v_plain := to_regclass('public.' || v_pair[2]);
    CONTINUE WHEN v_plain IS NULL;  -- déjà retiré (rejeu après interruption)

    v_tbl  := to_regclass('public.' || v_pair[1]);
    v_twin := to_regclass('public.' || v_pair[3]);

    IF v_tbl IS NULL OR v_twin IS NULL OR NOT EXISTS (
      SELECT 1
        FROM pg_index u
       WHERE u.indexrelid = v_twin
         AND u.indrelid = v_tbl
         AND u.indisunique
         AND u.indimmediate
         AND u.indisvalid
         AND u.indisready
         AND u.indislive
    ) THEN
      RAISE EXCEPTION 'ABORT: jumeau public.% absent, non unique ou non valide sur public.% — public.% conservé',
        v_pair[3], v_pair[1], v_pair[2];
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM pg_index i
       WHERE i.indexrelid = v_plain
         AND i.indrelid = v_tbl
         AND NOT i.indisunique
         AND NOT i.indisprimary
         AND NOT i.indisexclusion
         AND NOT i.indisreplident
         AND NOT i.indisclustered
    ) THEN
      RAISE EXCEPTION 'ABORT: public.% n''est plus un index ordinaire de public.% (table, unicité, réplication ou CLUSTER)',
        v_pair[2], v_pair[1];
    END IF;

    v_pdef := pg_get_indexdef(v_plain);
    v_tdef := pg_get_indexdef(v_twin);
    IF v_pdef !~ '^CREATE INDEX \S+ ON '
       OR v_tdef !~ '^CREATE UNIQUE INDEX \S+ ON '
       OR regexp_replace(v_pdef, '^CREATE INDEX \S+ ON ', '')
          <> regexp_replace(v_tdef, '^CREATE UNIQUE INDEX \S+ ON ', '')
    THEN
      RAISE EXCEPTION 'ABORT: public.% et public.% n''ont plus la même définition (% | %)',
        v_pair[2], v_pair[3], v_pdef, v_tdef;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = v_plain) THEN
      RAISE EXCEPTION 'ABORT: public.% porte une contrainte', v_pair[2];
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_depend d
       WHERE d.refclassid = 'pg_class'::regclass
         AND d.refobjid = v_plain
    ) THEN
      RAISE EXCEPTION 'ABORT: un objet dépend de public.%', v_pair[2];
    END IF;
  END LOOP;
END
$precheck$;

-- -----------------------------------------------------------------------------
-- §1 — RETRAIT DES 13 INDEX (un DROP par instruction, en autocommit)
-- -----------------------------------------------------------------------------

DROP INDEX CONCURRENTLY IF EXISTS public.idx_am_2022_suppliers_sup_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_type_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_auto_type_motor_fuel_tmf_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_catalog_family_mf_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_catalog_gamme_mc_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_criteria_group_cri_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_details_pd_piece_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_gamme_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_gamme_cross_pgc_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_marque_pm_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_ref_brand_prb_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_pieces_status_pst_id;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les 13 index ont disparu ; chaque jumeau unique est toujours là, valide et prêt.
DO $postcheck$
DECLARE
  v_pair text[];
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ['am_2022_suppliers', 'idx_am_2022_suppliers_sup_id', 'am_2022_suppliers_pkey'],
    ['auto_type', 'idx_auto_type_type_id', 'auto_type_pkey'],
    ['auto_type_motor_fuel', 'idx_auto_type_motor_fuel_tmf_id', 'auto_type_motor_fuel_pkey'],
    ['catalog_family', 'idx_catalog_family_mf_id', 'catalog_family_pkey'],
    ['catalog_gamme', 'idx_catalog_gamme_mc_id', 'catalog_gamme_pkey'],
    ['pieces', 'idx_pieces_id', 'pieces_pkey'],
    ['pieces_criteria_group', 'idx_pieces_criteria_group_cri_id', 'pieces_criteria_group_pkey'],
    ['pieces_details', 'idx_pieces_details_pd_piece_id', 'pieces_details_pkey'],
    ['pieces_gamme', 'idx_pieces_gamme_pg_id', 'pieces_gamme_pkey'],
    ['pieces_gamme_cross', 'idx_pieces_gamme_cross_pgc_id', 'pieces_gamme_cross_pkey'],
    ['pieces_marque', 'idx_pieces_marque_pm_id', 'pieces_marque_pkey'],
    ['pieces_ref_brand', 'idx_pieces_ref_brand_prb_id', 'pieces_ref_brand_pkey'],
    ['pieces_status', 'idx_pieces_status_pst_id', 'pieces_status_pkey']
  ] LOOP
    IF to_regclass('public.' || v_pair[2]) IS NOT NULL THEN
      RAISE EXCEPTION 'postcheck: public.% toujours présent', v_pair[2];
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM pg_index u
       WHERE u.indexrelid = to_regclass('public.' || v_pair[3])
         AND u.indrelid = to_regclass('public.' || v_pair[1])
         AND u.indisunique
         AND u.indisvalid
         AND u.indisready
    ) THEN
      RAISE EXCEPTION 'postcheck: jumeau public.% absent ou invalide', v_pair[3];
    END IF;
  END LOOP;
END
$postcheck$;

-- =============================================================================
-- Vérification après application (lecture seule, catalogue uniquement)
-- =============================================================================
--   SELECT n, to_regclass('public.' || n) FROM unnest(ARRAY[
--     'idx_am_2022_suppliers_sup_id', 'idx_auto_type_type_id',
--     'idx_auto_type_motor_fuel_tmf_id', 'idx_catalog_family_mf_id',
--     'idx_catalog_gamme_mc_id', 'idx_pieces_id',
--     'idx_pieces_criteria_group_cri_id', 'idx_pieces_details_pd_piece_id',
--     'idx_pieces_gamme_pg_id', 'idx_pieces_gamme_cross_pgc_id',
--     'idx_pieces_marque_pm_id', 'idx_pieces_ref_brand_prb_id',
--     'idx_pieces_status_pst_id'
--   ]) AS n;                                         -- attendu : 13 × NULL
-- =============================================================================
