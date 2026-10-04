-- @non_transactional
--   DROP INDEX CONCURRENTLY est interdit DANS une transaction : le marqueur ci-dessus
--   fait exécuter ce fichier en autocommit par l'engine, une instruction à la fois
--   (gate A5 `--lint-markers`). La première instruction qui lève arrête le fichier et
--   marque la migration `failed` : le bloc de pré-conditions, placé avant tout DROP,
--   est donc réellement bloquant.
--
-- Migration: retirer 37 index ordinaires doublés par un index unique identique
-- (lot 1/3 : contenu, SEO, blog, sitemap, menus)
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
-- ZONE : tables de contenu, SEO, blog, sitemap, menus, diagnostic / graphe de
-- connaissances, caches et clés naturelles. Hors zones STOP : aucune ligne, aucune
-- colonne, aucune URL ni balise ne change, seulement des index. Les pages servies
-- gardent le même plan (preuve 2 ci-dessous).
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
--   table                       index retiré                          taille     parcours  jumeau conservé (parcours)
--   ___footer_menu              idx____footer_menu_fm_id               16 ko            0  ___footer_menu_pkey (0)
--   ___header_menu              idx____header_menu_hm_id               16 ko            0  ___header_menu_pkey (0)
--   ___meta_tags_ariane         idx____meta_tags_ariane_mta_id         16 ko            0  ___meta_tags_ariane_pkey (0)
--   __blog_advice               idx___blog_advice_ba_id                16 ko      356 277  __blog_advice_pkey (0)
--   __blog_advice_cross         idx___blog_advice_cross_bac_id         16 ko            0  __blog_advice_cross_pkey (0)
--   __blog_advice_h2            idx___blog_advice_h2_ba2_id            40 ko            0  __blog_advice_h2_pkey (0)
--   __blog_advice_h3            idx___blog_advice_h3_ba3_id            16 ko      335 406  __blog_advice_h3_pkey (0)
--   __blog_guide                idx___blog_guide_bg_id                 16 ko           87  __blog_guide_pkey (0)
--   __blog_guide_h2             idx___blog_guide_h2_bg2_id             88 ko            0  __blog_guide_h2_pkey (0)
--   __blog_guide_h3             idx___blog_guide_h3_bg3_id             40 ko        6 505  __blog_guide_h3_pkey (0)
--   __blog_meta_tags_ariane     idx___blog_meta_tags_ariane_mta_id     16 ko            0  __blog_meta_tags_ariane_pkey (0)
--   __diag_symptoms             idx_diag_symptoms_code                 16 ko            0  __diag_symptoms_ds_code_key (0)
--   __seo_gamme_conseil         idx_sgc_pg_section                    144 ko            0  uq_conseil_pg_section (223)
--   __seo_gamme_purchase_guide  idx_purchase_guide_pg_id               16 ko       17 542  unique_pg_id (0)
--   __seo_observable            idx_seo_observable_slug                96 ko        2 289  __seo_observable_slug_key (0)
--   __seo_r2_page_snapshot      idx_r2_snapshot_version_sha             8 ko            0  __seo_r2_page_snapshot_version_sha_key (0)
--   __seo_r4_keyword_plan       idx_r4kp_pg_id                         16 ko            0  __seo_r4_keyword_plan_r4kp_pg_id_key (0)
--   __seo_r5_keyword_plan       idx_r5_kp_pg_id                        16 ko            0  uq_r5_kp_pg_id (0)
--   __seo_r8_keyword_plan       idx_r8_kp_type                         16 ko            0  __seo_r8_keyword_plan_type_id_key (0)
--   __seo_r8_snapshot_store     idx_r8_snapshot_version_sha             8 ko            0  __seo_r8_snapshot_store_version_sha_key (0)
--   __seo_reference             idx_seo_reference_slug                 40 ko       11 368  __seo_reference_slug_key (0)
--   __seo_research_brief        idx_srb_pg                             16 ko            0  __seo_research_brief_pg_id_key (0)
--   __seo_role_content          idx_rc_pg_role                          8 ko            0  __seo_role_content_pg_id_page_role_key (0)
--   __seo_type_switch           idx___seo_type_switch_sts_id           16 ko      147 846  __seo_type_switch_pkey (0)
--   __sitemap_blog              idx___sitemap_blog_map_id              16 ko            0  __sitemap_blog_pkey (0)
--   __sitemap_marque            idx___sitemap_marque_map_id            16 ko            0  __sitemap_marque_pkey (0)
--   __sitemap_motorisation      idx___sitemap_motorisation_map_id     472 ko            0  __sitemap_motorisation_pkey (0)
--   __sitemap_p_xml             idx___sitemap_p_xml_map_id             80 ko            0  __sitemap_p_xml_pkey (0)
--   __sitemap_search_link       idx___sitemap_search_link_map_id       16 ko            0  __sitemap_search_link_pkey (0)
--   __video_audio_cache         idx_video_audio_cache_key              16 ko            0  __video_audio_cache_cache_key_key (0)
--   gamme_seo_metrics           idx_gamme_seo_pg_id                    16 ko        1 564  gamme_seo_metrics_pg_id_key (0)
--   kg_engine_families          idx_kg_engine_families_code            16 ko            0  kg_engine_families_family_code_key (0)
--   kg_rag_mapping              idx_kg_rag_mapping_rag                  8 ko            0  kg_rag_mapping_rag_file_path_rag_item_id_key (0)
--   kg_reasoning_cache          idx_kg_cache_hash                      16 ko            0  kg_reasoning_cache_query_hash_key (0)
--   natural_key_article         idx_nk_article_bf                       8 ko            0  natural_key_article_business_fingerprint_key (0)
--   natural_key_brand           idx_nk_brand_bf                         8 ko            0  natural_key_brand_business_fingerprint_key (0)
--   natural_key_vehicle         idx_nk_vehicle_bf                       8 ko            0  natural_key_vehicle_business_fingerprint_key (0)
--
-- Gain : 1,4 Mo (1 441 792 octets), 37 index de moins à maintenir à chaque
-- écriture. Index qui servaient, dont les parcours passent au jumeau : 9.
--
-- Timeouts EXPLICITES à 0 : un GUC omis hérite des 60 s du rôle `postgres` (incident
-- 20260529, PR #1395). DROP INDEX CONCURRENTLY ne relit pas la heap, mais il attend la
-- fin des transactions qui voient la table ; ces attentes comptent contre
-- lock_timeout. Il ne bloque ni les lectures ni les écritures. Le job CI borne le run.
-- `IF EXISTS` rend le fichier rejouable : un DROP CONCURRENTLY interrompu laisse un
-- index INVALIDE, qu'une seconde exécution retire.
--
-- Effet de bord attendu : chaque DROP déclenche l'event trigger `pgrst_drop_watch`
-- (`sql_drop`), qui recharge le cache de schéma de PostgREST — 37 rechargements, sans
-- changement de l'API exposée (un index n'y figure pas).
--
-- Retour arrière : `20261003_drop_indexes_shadowed_by_unique_content.down.sql`
-- recrée les 37 index à l'identique (CONCURRENTLY). L'engine est forward-only : ce
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
    ['___footer_menu', 'idx____footer_menu_fm_id', '___footer_menu_pkey'],
    ['___header_menu', 'idx____header_menu_hm_id', '___header_menu_pkey'],
    ['___meta_tags_ariane', 'idx____meta_tags_ariane_mta_id', '___meta_tags_ariane_pkey'],
    ['__blog_advice', 'idx___blog_advice_ba_id', '__blog_advice_pkey'],
    ['__blog_advice_cross', 'idx___blog_advice_cross_bac_id', '__blog_advice_cross_pkey'],
    ['__blog_advice_h2', 'idx___blog_advice_h2_ba2_id', '__blog_advice_h2_pkey'],
    ['__blog_advice_h3', 'idx___blog_advice_h3_ba3_id', '__blog_advice_h3_pkey'],
    ['__blog_guide', 'idx___blog_guide_bg_id', '__blog_guide_pkey'],
    ['__blog_guide_h2', 'idx___blog_guide_h2_bg2_id', '__blog_guide_h2_pkey'],
    ['__blog_guide_h3', 'idx___blog_guide_h3_bg3_id', '__blog_guide_h3_pkey'],
    ['__blog_meta_tags_ariane', 'idx___blog_meta_tags_ariane_mta_id', '__blog_meta_tags_ariane_pkey'],
    ['__diag_symptoms', 'idx_diag_symptoms_code', '__diag_symptoms_ds_code_key'],
    ['__seo_gamme_conseil', 'idx_sgc_pg_section', 'uq_conseil_pg_section'],
    ['__seo_gamme_purchase_guide', 'idx_purchase_guide_pg_id', 'unique_pg_id'],
    ['__seo_observable', 'idx_seo_observable_slug', '__seo_observable_slug_key'],
    ['__seo_r2_page_snapshot', 'idx_r2_snapshot_version_sha', '__seo_r2_page_snapshot_version_sha_key'],
    ['__seo_r4_keyword_plan', 'idx_r4kp_pg_id', '__seo_r4_keyword_plan_r4kp_pg_id_key'],
    ['__seo_r5_keyword_plan', 'idx_r5_kp_pg_id', 'uq_r5_kp_pg_id'],
    ['__seo_r8_keyword_plan', 'idx_r8_kp_type', '__seo_r8_keyword_plan_type_id_key'],
    ['__seo_r8_snapshot_store', 'idx_r8_snapshot_version_sha', '__seo_r8_snapshot_store_version_sha_key'],
    ['__seo_reference', 'idx_seo_reference_slug', '__seo_reference_slug_key'],
    ['__seo_research_brief', 'idx_srb_pg', '__seo_research_brief_pg_id_key'],
    ['__seo_role_content', 'idx_rc_pg_role', '__seo_role_content_pg_id_page_role_key'],
    ['__seo_type_switch', 'idx___seo_type_switch_sts_id', '__seo_type_switch_pkey'],
    ['__sitemap_blog', 'idx___sitemap_blog_map_id', '__sitemap_blog_pkey'],
    ['__sitemap_marque', 'idx___sitemap_marque_map_id', '__sitemap_marque_pkey'],
    ['__sitemap_motorisation', 'idx___sitemap_motorisation_map_id', '__sitemap_motorisation_pkey'],
    ['__sitemap_p_xml', 'idx___sitemap_p_xml_map_id', '__sitemap_p_xml_pkey'],
    ['__sitemap_search_link', 'idx___sitemap_search_link_map_id', '__sitemap_search_link_pkey'],
    ['__video_audio_cache', 'idx_video_audio_cache_key', '__video_audio_cache_cache_key_key'],
    ['gamme_seo_metrics', 'idx_gamme_seo_pg_id', 'gamme_seo_metrics_pg_id_key'],
    ['kg_engine_families', 'idx_kg_engine_families_code', 'kg_engine_families_family_code_key'],
    ['kg_rag_mapping', 'idx_kg_rag_mapping_rag', 'kg_rag_mapping_rag_file_path_rag_item_id_key'],
    ['kg_reasoning_cache', 'idx_kg_cache_hash', 'kg_reasoning_cache_query_hash_key'],
    ['natural_key_article', 'idx_nk_article_bf', 'natural_key_article_business_fingerprint_key'],
    ['natural_key_brand', 'idx_nk_brand_bf', 'natural_key_brand_business_fingerprint_key'],
    ['natural_key_vehicle', 'idx_nk_vehicle_bf', 'natural_key_vehicle_business_fingerprint_key']
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
-- §1 — RETRAIT DES 37 INDEX (un DROP par instruction, en autocommit)
-- -----------------------------------------------------------------------------

DROP INDEX CONCURRENTLY IF EXISTS public.idx____footer_menu_fm_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____header_menu_hm_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx____meta_tags_ariane_mta_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_advice_ba_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_advice_cross_bac_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_advice_h2_ba2_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_advice_h3_ba3_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_guide_bg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_guide_h2_bg2_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_guide_h3_bg3_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___blog_meta_tags_ariane_mta_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_diag_symptoms_code;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_sgc_pg_section;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_purchase_guide_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_seo_observable_slug;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_r2_snapshot_version_sha;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_r4kp_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_r5_kp_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_r8_kp_type;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_r8_snapshot_version_sha;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_seo_reference_slug;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_srb_pg;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_rc_pg_role;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___seo_type_switch_sts_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___sitemap_blog_map_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___sitemap_marque_map_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___sitemap_motorisation_map_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___sitemap_p_xml_map_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx___sitemap_search_link_map_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_video_audio_cache_key;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_gamme_seo_pg_id;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_kg_engine_families_code;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_kg_rag_mapping_rag;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_kg_cache_hash;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_nk_article_bf;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_nk_brand_bf;

DROP INDEX CONCURRENTLY IF EXISTS public.idx_nk_vehicle_bf;

-- -----------------------------------------------------------------------------
-- §2 — POST-CONDITIONS FAIL-CLOSED
-- -----------------------------------------------------------------------------
-- Les 37 index ont disparu ; chaque jumeau unique est toujours là, valide et prêt.
DO $postcheck$
DECLARE
  v_pair text[];
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ['___footer_menu', 'idx____footer_menu_fm_id', '___footer_menu_pkey'],
    ['___header_menu', 'idx____header_menu_hm_id', '___header_menu_pkey'],
    ['___meta_tags_ariane', 'idx____meta_tags_ariane_mta_id', '___meta_tags_ariane_pkey'],
    ['__blog_advice', 'idx___blog_advice_ba_id', '__blog_advice_pkey'],
    ['__blog_advice_cross', 'idx___blog_advice_cross_bac_id', '__blog_advice_cross_pkey'],
    ['__blog_advice_h2', 'idx___blog_advice_h2_ba2_id', '__blog_advice_h2_pkey'],
    ['__blog_advice_h3', 'idx___blog_advice_h3_ba3_id', '__blog_advice_h3_pkey'],
    ['__blog_guide', 'idx___blog_guide_bg_id', '__blog_guide_pkey'],
    ['__blog_guide_h2', 'idx___blog_guide_h2_bg2_id', '__blog_guide_h2_pkey'],
    ['__blog_guide_h3', 'idx___blog_guide_h3_bg3_id', '__blog_guide_h3_pkey'],
    ['__blog_meta_tags_ariane', 'idx___blog_meta_tags_ariane_mta_id', '__blog_meta_tags_ariane_pkey'],
    ['__diag_symptoms', 'idx_diag_symptoms_code', '__diag_symptoms_ds_code_key'],
    ['__seo_gamme_conseil', 'idx_sgc_pg_section', 'uq_conseil_pg_section'],
    ['__seo_gamme_purchase_guide', 'idx_purchase_guide_pg_id', 'unique_pg_id'],
    ['__seo_observable', 'idx_seo_observable_slug', '__seo_observable_slug_key'],
    ['__seo_r2_page_snapshot', 'idx_r2_snapshot_version_sha', '__seo_r2_page_snapshot_version_sha_key'],
    ['__seo_r4_keyword_plan', 'idx_r4kp_pg_id', '__seo_r4_keyword_plan_r4kp_pg_id_key'],
    ['__seo_r5_keyword_plan', 'idx_r5_kp_pg_id', 'uq_r5_kp_pg_id'],
    ['__seo_r8_keyword_plan', 'idx_r8_kp_type', '__seo_r8_keyword_plan_type_id_key'],
    ['__seo_r8_snapshot_store', 'idx_r8_snapshot_version_sha', '__seo_r8_snapshot_store_version_sha_key'],
    ['__seo_reference', 'idx_seo_reference_slug', '__seo_reference_slug_key'],
    ['__seo_research_brief', 'idx_srb_pg', '__seo_research_brief_pg_id_key'],
    ['__seo_role_content', 'idx_rc_pg_role', '__seo_role_content_pg_id_page_role_key'],
    ['__seo_type_switch', 'idx___seo_type_switch_sts_id', '__seo_type_switch_pkey'],
    ['__sitemap_blog', 'idx___sitemap_blog_map_id', '__sitemap_blog_pkey'],
    ['__sitemap_marque', 'idx___sitemap_marque_map_id', '__sitemap_marque_pkey'],
    ['__sitemap_motorisation', 'idx___sitemap_motorisation_map_id', '__sitemap_motorisation_pkey'],
    ['__sitemap_p_xml', 'idx___sitemap_p_xml_map_id', '__sitemap_p_xml_pkey'],
    ['__sitemap_search_link', 'idx___sitemap_search_link_map_id', '__sitemap_search_link_pkey'],
    ['__video_audio_cache', 'idx_video_audio_cache_key', '__video_audio_cache_cache_key_key'],
    ['gamme_seo_metrics', 'idx_gamme_seo_pg_id', 'gamme_seo_metrics_pg_id_key'],
    ['kg_engine_families', 'idx_kg_engine_families_code', 'kg_engine_families_family_code_key'],
    ['kg_rag_mapping', 'idx_kg_rag_mapping_rag', 'kg_rag_mapping_rag_file_path_rag_item_id_key'],
    ['kg_reasoning_cache', 'idx_kg_cache_hash', 'kg_reasoning_cache_query_hash_key'],
    ['natural_key_article', 'idx_nk_article_bf', 'natural_key_article_business_fingerprint_key'],
    ['natural_key_brand', 'idx_nk_brand_bf', 'natural_key_brand_business_fingerprint_key'],
    ['natural_key_vehicle', 'idx_nk_vehicle_bf', 'natural_key_vehicle_business_fingerprint_key']
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
--     'idx____footer_menu_fm_id', 'idx____header_menu_hm_id',
--     'idx____meta_tags_ariane_mta_id', 'idx___blog_advice_ba_id',
--     'idx___blog_advice_cross_bac_id', 'idx___blog_advice_h2_ba2_id',
--     'idx___blog_advice_h3_ba3_id', 'idx___blog_guide_bg_id',
--     'idx___blog_guide_h2_bg2_id', 'idx___blog_guide_h3_bg3_id',
--     'idx___blog_meta_tags_ariane_mta_id', 'idx_diag_symptoms_code',
--     'idx_sgc_pg_section', 'idx_purchase_guide_pg_id',
--     'idx_seo_observable_slug', 'idx_r2_snapshot_version_sha',
--     'idx_r4kp_pg_id', 'idx_r5_kp_pg_id',
--     'idx_r8_kp_type', 'idx_r8_snapshot_version_sha',
--     'idx_seo_reference_slug', 'idx_srb_pg',
--     'idx_rc_pg_role', 'idx___seo_type_switch_sts_id',
--     'idx___sitemap_blog_map_id', 'idx___sitemap_marque_map_id',
--     'idx___sitemap_motorisation_map_id', 'idx___sitemap_p_xml_map_id',
--     'idx___sitemap_search_link_map_id', 'idx_video_audio_cache_key',
--     'idx_gamme_seo_pg_id', 'idx_kg_engine_families_code',
--     'idx_kg_rag_mapping_rag', 'idx_kg_cache_hash',
--     'idx_nk_article_bf', 'idx_nk_brand_bf',
--     'idx_nk_vehicle_bf'
--   ]) AS n;                                         -- attendu : 37 × NULL
-- =============================================================================
