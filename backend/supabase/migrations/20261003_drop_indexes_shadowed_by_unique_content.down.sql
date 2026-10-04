-- Rollback: 20261003_drop_indexes_shadowed_by_unique_content
-- Recrée les 37 index ordinaires retirés, définitions relevées par `pg_get_indexdef` le
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

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____footer_menu_fm_id
  ON public.___footer_menu USING btree (fm_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____header_menu_hm_id
  ON public.___header_menu USING btree (hm_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx____meta_tags_ariane_mta_id
  ON public.___meta_tags_ariane USING btree (mta_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_advice_ba_id
  ON public.__blog_advice USING btree (ba_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_advice_cross_bac_id
  ON public.__blog_advice_cross USING btree (bac_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_advice_h2_ba2_id
  ON public.__blog_advice_h2 USING btree (ba2_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_advice_h3_ba3_id
  ON public.__blog_advice_h3 USING btree (ba3_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_guide_bg_id
  ON public.__blog_guide USING btree (bg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_guide_h2_bg2_id
  ON public.__blog_guide_h2 USING btree (bg2_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_guide_h3_bg3_id
  ON public.__blog_guide_h3 USING btree (bg3_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___blog_meta_tags_ariane_mta_id
  ON public.__blog_meta_tags_ariane USING btree (mta_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diag_symptoms_code
  ON public.__diag_symptoms USING btree (ds_code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sgc_pg_section
  ON public.__seo_gamme_conseil USING btree (sgc_pg_id, sgc_section_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_purchase_guide_pg_id
  ON public.__seo_gamme_purchase_guide USING btree (sgpg_pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_observable_slug
  ON public.__seo_observable USING btree (slug);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_r2_snapshot_version_sha
  ON public.__seo_r2_page_snapshot USING btree (version_sha);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_r4kp_pg_id
  ON public.__seo_r4_keyword_plan USING btree (r4kp_pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_r5_kp_pg_id
  ON public.__seo_r5_keyword_plan USING btree (rkp_pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_r8_kp_type
  ON public.__seo_r8_keyword_plan USING btree (type_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_r8_snapshot_version_sha
  ON public.__seo_r8_snapshot_store USING btree (version_sha);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_reference_slug
  ON public.__seo_reference USING btree (slug);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_srb_pg
  ON public.__seo_research_brief USING btree (pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rc_pg_role
  ON public.__seo_role_content USING btree (pg_id, page_role);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___seo_type_switch_sts_id
  ON public.__seo_type_switch USING btree (sts_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___sitemap_blog_map_id
  ON public.__sitemap_blog USING btree (map_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___sitemap_marque_map_id
  ON public.__sitemap_marque USING btree (map_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___sitemap_motorisation_map_id
  ON public.__sitemap_motorisation USING btree (map_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___sitemap_p_xml_map_id
  ON public.__sitemap_p_xml USING btree (map_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx___sitemap_search_link_map_id
  ON public.__sitemap_search_link USING btree (map_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_audio_cache_key
  ON public.__video_audio_cache USING btree (cache_key);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gamme_seo_pg_id
  ON public.gamme_seo_metrics USING btree (pg_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_engine_families_code
  ON public.kg_engine_families USING btree (family_code);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_rag_mapping_rag
  ON public.kg_rag_mapping USING btree (rag_file_path, rag_item_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kg_cache_hash
  ON public.kg_reasoning_cache USING btree (query_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nk_article_bf
  ON public.natural_key_article USING btree (business_fingerprint);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nk_brand_bf
  ON public.natural_key_brand USING btree (business_fingerprint);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nk_vehicle_bf
  ON public.natural_key_vehicle USING btree (business_fingerprint);

-- Contrôle (lecture seule) : 0 ligne attendue.
SELECT n AS index_absent_ou_invalide
  FROM unnest(ARRAY[
    'idx____footer_menu_fm_id', 'idx____header_menu_hm_id',
    'idx____meta_tags_ariane_mta_id', 'idx___blog_advice_ba_id',
    'idx___blog_advice_cross_bac_id', 'idx___blog_advice_h2_ba2_id',
    'idx___blog_advice_h3_ba3_id', 'idx___blog_guide_bg_id',
    'idx___blog_guide_h2_bg2_id', 'idx___blog_guide_h3_bg3_id',
    'idx___blog_meta_tags_ariane_mta_id', 'idx_diag_symptoms_code',
    'idx_sgc_pg_section', 'idx_purchase_guide_pg_id',
    'idx_seo_observable_slug', 'idx_r2_snapshot_version_sha',
    'idx_r4kp_pg_id', 'idx_r5_kp_pg_id',
    'idx_r8_kp_type', 'idx_r8_snapshot_version_sha',
    'idx_seo_reference_slug', 'idx_srb_pg',
    'idx_rc_pg_role', 'idx___seo_type_switch_sts_id',
    'idx___sitemap_blog_map_id', 'idx___sitemap_marque_map_id',
    'idx___sitemap_motorisation_map_id', 'idx___sitemap_p_xml_map_id',
    'idx___sitemap_search_link_map_id', 'idx_video_audio_cache_key',
    'idx_gamme_seo_pg_id', 'idx_kg_engine_families_code',
    'idx_kg_rag_mapping_rag', 'idx_kg_cache_hash',
    'idx_nk_article_bf', 'idx_nk_brand_bf',
    'idx_nk_vehicle_bf'
  ]) AS x(n)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_index i
    WHERE i.indexrelid = to_regclass('public.' || x.n)
      AND i.indisvalid AND i.indisready
 );
