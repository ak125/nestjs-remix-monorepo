set statement_timeout='240s';
select now() at time zone 'utc';
with t63 as (
select '__blog_advice.ba_content' as src, (regexp_matches("ba_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice" where "ba_content" like '%#LinkGamme%'
union all
select '__blog_advice.ba_content_type' as src, (regexp_matches("ba_content_type", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice" where "ba_content_type" like '%#LinkGamme%'
union all
select '__blog_advice.ba_descrip' as src, (regexp_matches("ba_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice" where "ba_descrip" like '%#LinkGamme%'
union all
select '__blog_advice.ba_preview' as src, (regexp_matches("ba_preview", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice" where "ba_preview" like '%#LinkGamme%'
union all
select '__blog_advice.ba_wall' as src, (regexp_matches("ba_wall", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice" where "ba_wall" like '%#LinkGamme%'
union all
select '__blog_advice_h2.ba2_content' as src, (regexp_matches("ba2_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice_h2" where "ba2_content" like '%#LinkGamme%'
union all
select '__blog_advice_h2.ba2_wall' as src, (regexp_matches("ba2_wall", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice_h2" where "ba2_wall" like '%#LinkGamme%'
union all
select '__blog_advice_h3.ba3_content' as src, (regexp_matches("ba3_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice_h3" where "ba3_content" like '%#LinkGamme%'
union all
select '__blog_advice_h3.ba3_wall' as src, (regexp_matches("ba3_wall", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_advice_h3" where "ba3_wall" like '%#LinkGamme%'
union all
select '__blog_guide.bg_content' as src, (regexp_matches("bg_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide" where "bg_content" like '%#LinkGamme%'
union all
select '__blog_guide.bg_descrip' as src, (regexp_matches("bg_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide" where "bg_descrip" like '%#LinkGamme%'
union all
select '__blog_guide.bg_preview' as src, (regexp_matches("bg_preview", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide" where "bg_preview" like '%#LinkGamme%'
union all
select '__blog_guide.bg_wall' as src, (regexp_matches("bg_wall", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide" where "bg_wall" like '%#LinkGamme%'
union all
select '__blog_guide_h2.bg2_content' as src, (regexp_matches("bg2_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide_h2" where "bg2_content" like '%#LinkGamme%'
union all
select '__blog_guide_h2.bg2_wall' as src, (regexp_matches("bg2_wall", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide_h2" where "bg2_wall" like '%#LinkGamme%'
union all
select '__blog_guide_h3.bg3_content' as src, (regexp_matches("bg3_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide_h3" where "bg3_content" like '%#LinkGamme%'
union all
select '__blog_guide_h3.bg3_wall' as src, (regexp_matches("bg3_wall", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_guide_h3" where "bg3_wall" like '%#LinkGamme%'
union all
select '__blog_meta_tags_ariane.mta_content' as src, (regexp_matches("mta_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_meta_tags_ariane" where "mta_content" like '%#LinkGamme%'
union all
select '__blog_meta_tags_ariane.mta_descrip' as src, (regexp_matches("mta_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_meta_tags_ariane" where "mta_descrip" like '%#LinkGamme%'
union all
select '__blog_seo_marque.bsm_content' as src, (regexp_matches("bsm_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_seo_marque" where "bsm_content" like '%#LinkGamme%'
union all
select '__blog_seo_marque.bsm_descrip' as src, (regexp_matches("bsm_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__blog_seo_marque" where "bsm_descrip" like '%#LinkGamme%'
union all
select '__seo_confusion_pairs.scp_content_hash' as src, (regexp_matches("scp_content_hash", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_confusion_pairs" where "scp_content_hash" like '%#LinkGamme%'
union all
select '__seo_content_block_versions.content_hash' as src, (regexp_matches("content_hash", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_content_block_versions" where "content_hash" like '%#LinkGamme%'
union all
select '__seo_content_events.value_text' as src, (regexp_matches("value_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_content_events" where "value_text" like '%#LinkGamme%'
union all
select '__seo_crawl_log.content_type' as src, (regexp_matches("content_type", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_crawl_log" where "content_type" like '%#LinkGamme%'
union all
select '__seo_diagnostic.intro' as src, (regexp_matches("intro", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_diagnostic" where "intro" like '%#LinkGamme%'
union all
select '__seo_entity_fact_versions.content_hash' as src, (regexp_matches("content_hash", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_entity_fact_versions" where "content_hash" like '%#LinkGamme%'
union all
select '__seo_equip_gamme.seg_content' as src, (regexp_matches("seg_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_equip_gamme" where "seg_content" like '%#LinkGamme%'
union all
select '__seo_family_gamme_car_switch.sfgcs_content' as src, (regexp_matches("sfgcs_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_family_gamme_car_switch" where "sfgcs_content" like '%#LinkGamme%'
union all
select '__seo_gamme.sg_content' as src, (regexp_matches("sg_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme" where "sg_content" like '%#LinkGamme%'
union all
select '__seo_gamme.sg_content_draft' as src, (regexp_matches("sg_content_draft", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme" where "sg_content_draft" like '%#LinkGamme%'
union all
select '__seo_gamme.sg_descrip' as src, (regexp_matches("sg_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme" where "sg_descrip" like '%#LinkGamme%'
union all
select '__seo_gamme.sg_descrip_draft' as src, (regexp_matches("sg_descrip_draft", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme" where "sg_descrip_draft" like '%#LinkGamme%'
union all
select '__seo_gamme_car.sgc_content' as src, (regexp_matches("sgc_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_car" where "sgc_content" like '%#LinkGamme%'
union all
select '__seo_gamme_car.sgc_descrip' as src, (regexp_matches("sgc_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_car" where "sgc_descrip" like '%#LinkGamme%'
union all
select '__seo_gamme_car.sgc_preview' as src, (regexp_matches("sgc_preview", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_car" where "sgc_preview" like '%#LinkGamme%'
union all
select '__seo_gamme_car_switch.sgcs_content' as src, (regexp_matches("sgcs_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_car_switch" where "sgcs_content" like '%#LinkGamme%'
union all
select '__seo_gamme_conseil.sgc_content' as src, (regexp_matches("sgc_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_conseil" where "sgc_content" like '%#LinkGamme%'
union all
select '__seo_gamme_info.sgi_content' as src, (regexp_matches("sgi_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_info" where "sgi_content" like '%#LinkGamme%'
union all
select '__seo_gamme_links.anchor_text' as src, (regexp_matches("anchor_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_links" where "anchor_text" like '%#LinkGamme%'
union all
select '__seo_gamme_links.context' as src, (regexp_matches("context", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_links" where "context" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_arg1_content' as src, (regexp_matches("sgpg_arg1_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_arg1_content" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_arg2_content' as src, (regexp_matches("sgpg_arg2_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_arg2_content" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_arg3_content' as src, (regexp_matches("sgpg_arg3_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_arg3_content" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_arg4_content' as src, (regexp_matches("sgpg_arg4_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_arg4_content" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_compatibilities_intro' as src, (regexp_matches("sgpg_compatibilities_intro", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_compatibilities_intro" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_family_cross_sell_intro' as src, (regexp_matches("sgpg_family_cross_sell_intro", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_family_cross_sell_intro" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_intro_role' as src, (regexp_matches("sgpg_intro_role", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_intro_role" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_intro_title' as src, (regexp_matches("sgpg_intro_title", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_intro_title" like '%#LinkGamme%'
union all
select '__seo_gamme_purchase_guide.sgpg_meta_description_override' as src, (regexp_matches("sgpg_meta_description_override", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gamme_purchase_guide" where "sgpg_meta_description_override" like '%#LinkGamme%'
union all
select '__seo_gsc_links_weekly.anchor_text' as src, (regexp_matches("anchor_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_gsc_links_weekly" where "anchor_text" like '%#LinkGamme%'
union all
select '__seo_internal_link.anchor_text' as src, (regexp_matches("anchor_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_internal_link" where "anchor_text" like '%#LinkGamme%'
union all
select '__seo_item_switch.sis_content' as src, (regexp_matches("sis_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_item_switch" where "sis_content" like '%#LinkGamme%'
union all
select '__seo_keywords.content_type' as src, (regexp_matches("content_type", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_keywords" where "content_type" like '%#LinkGamme%'
union all
select '__seo_marque.sm_content' as src, (regexp_matches("sm_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_marque" where "sm_content" like '%#LinkGamme%'
union all
select '__seo_marque.sm_descrip' as src, (regexp_matches("sm_descrip", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_marque" where "sm_descrip" like '%#LinkGamme%'
union all
select '__seo_observable.meta_description' as src, (regexp_matches("meta_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_observable" where "meta_description" like '%#LinkGamme%'
union all
select '__seo_observable.sign_description' as src, (regexp_matches("sign_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_observable" where "sign_description" like '%#LinkGamme%'
union all
select '__seo_observable.symptom_description' as src, (regexp_matches("symptom_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_observable" where "symptom_description" like '%#LinkGamme%'
union all
select '__seo_page.meta_description' as src, (regexp_matches("meta_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_page" where "meta_description" like '%#LinkGamme%'
union all
select '__seo_page_brief.content_type' as src, (regexp_matches("content_type", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_page_brief" where "content_type" like '%#LinkGamme%'
union all
select '__seo_r1_gamme_slots.r1s_arg1_content' as src, (regexp_matches("r1s_arg1_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_gamme_slots" where "r1s_arg1_content" like '%#LinkGamme%'
union all
select '__seo_r1_gamme_slots.r1s_arg2_content' as src, (regexp_matches("r1s_arg2_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_gamme_slots" where "r1s_arg2_content" like '%#LinkGamme%'
union all
select '__seo_r1_gamme_slots.r1s_arg3_content' as src, (regexp_matches("r1s_arg3_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_gamme_slots" where "r1s_arg3_content" like '%#LinkGamme%'
union all
select '__seo_r1_gamme_slots.r1s_arg4_content' as src, (regexp_matches("r1s_arg4_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_gamme_slots" where "r1s_arg4_content" like '%#LinkGamme%'
union all
select '__seo_r1_gamme_slots.r1s_compatibilities_intro' as src, (regexp_matches("r1s_compatibilities_intro", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_gamme_slots" where "r1s_compatibilities_intro" like '%#LinkGamme%'
union all
select '__seo_r1_gamme_slots.r1s_family_cross_sell_intro' as src, (regexp_matches("r1s_family_cross_sell_intro", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_gamme_slots" where "r1s_family_cross_sell_intro" like '%#LinkGamme%'
union all
select '__seo_r1_image_prompts.rip_alt_text' as src, (regexp_matches("rip_alt_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_image_prompts" where "rip_alt_text" like '%#LinkGamme%'
union all
select '__seo_r1_image_prompts.rip_prompt_text' as src, (regexp_matches("rip_prompt_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r1_image_prompts" where "rip_prompt_text" like '%#LinkGamme%'
union all
select '__seo_r2_embeddings.content_hash' as src, (regexp_matches("content_hash", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r2_embeddings" where "content_hash" like '%#LinkGamme%'
union all
select '__seo_r2_page_snapshot.r1_context_hash' as src, (regexp_matches("r1_context_hash", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r2_page_snapshot" where "r1_context_hash" like '%#LinkGamme%'
union all
select '__seo_r2_page_snapshot.rendered_html_compact' as src, (regexp_matches("rendered_html_compact", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r2_page_snapshot" where "rendered_html_compact" like '%#LinkGamme%'
union all
select '__seo_r2_pages.content_hash' as src, (regexp_matches("content_hash", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r2_pages" where "content_hash" like '%#LinkGamme%'
union all
select '__seo_r2_signatures.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r2_signatures" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r3_image_prompts.rip_alt_text' as src, (regexp_matches("rip_alt_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r3_image_prompts" where "rip_alt_text" like '%#LinkGamme%'
union all
select '__seo_r3_image_prompts.rip_prompt_text' as src, (regexp_matches("rip_prompt_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r3_image_prompts" where "rip_prompt_text" like '%#LinkGamme%'
union all
select '__seo_r6_image_prompts.rip_alt_text' as src, (regexp_matches("rip_alt_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r6_image_prompts" where "rip_alt_text" like '%#LinkGamme%'
union all
select '__seo_r6_image_prompts.rip_prompt_text' as src, (regexp_matches("rip_prompt_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r6_image_prompts" where "rip_prompt_text" like '%#LinkGamme%'
union all
select '__seo_r7_fingerprints.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_fingerprints" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r7_fingerprints.normalized_text_fingerprint' as src, (regexp_matches("normalized_text_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_fingerprints" where "normalized_text_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r7_page_versions.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_page_versions" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r7_page_versions.content_main' as src, (regexp_matches("content_main", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_page_versions" where "content_main" like '%#LinkGamme%'
union all
select '__seo_r7_pages.body' as src, (regexp_matches("body", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_pages" where "body" like '%#LinkGamme%'
union all
select '__seo_r7_pages.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_pages" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r7_pages.content_main' as src, (regexp_matches("content_main", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_pages" where "content_main" like '%#LinkGamme%'
union all
select '__seo_r7_pages.meta_description' as src, (regexp_matches("meta_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_pages" where "meta_description" like '%#LinkGamme%'
union all
select '__seo_r7_pages.normalized_text_fingerprint' as src, (regexp_matches("normalized_text_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r7_pages" where "normalized_text_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r8_fingerprints.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_fingerprints" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r8_fingerprints.normalized_text_fingerprint' as src, (regexp_matches("normalized_text_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_fingerprints" where "normalized_text_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r8_page_versions.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_page_versions" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r8_page_versions.content_main' as src, (regexp_matches("content_main", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_page_versions" where "content_main" like '%#LinkGamme%'
union all
select '__seo_r8_pages.body' as src, (regexp_matches("body", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_pages" where "body" like '%#LinkGamme%'
union all
select '__seo_r8_pages.content_fingerprint' as src, (regexp_matches("content_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_pages" where "content_fingerprint" like '%#LinkGamme%'
union all
select '__seo_r8_pages.content_main' as src, (regexp_matches("content_main", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_pages" where "content_main" like '%#LinkGamme%'
union all
select '__seo_r8_pages.meta_description' as src, (regexp_matches("meta_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_pages" where "meta_description" like '%#LinkGamme%'
union all
select '__seo_r8_pages.normalized_text_fingerprint' as src, (regexp_matches("normalized_text_fingerprint", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_r8_pages" where "normalized_text_fingerprint" like '%#LinkGamme%'
union all
select '__seo_reference.content_html' as src, (regexp_matches("content_html", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_reference" where "content_html" like '%#LinkGamme%'
union all
select '__seo_reference.meta_description' as src, (regexp_matches("meta_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_reference" where "meta_description" like '%#LinkGamme%'
union all
select '__seo_snapshot_synthetic.h1_text' as src, (regexp_matches("h1_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_snapshot_synthetic" where "h1_text" like '%#LinkGamme%'
union all
select '__seo_snapshot_synthetic.meta_description' as src, (regexp_matches("meta_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_snapshot_synthetic" where "meta_description" like '%#LinkGamme%'
union all
select '__seo_snapshot_synthetic.og_description' as src, (regexp_matches("og_description", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_snapshot_synthetic" where "og_description" like '%#LinkGamme%'
union all
select '__seo_snapshot_synthetic.title_text' as src, (regexp_matches("title_text", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_snapshot_synthetic" where "title_text" like '%#LinkGamme%'
union all
select '__seo_type_switch.sts_content' as src, (regexp_matches("sts_content", '#(LinkGamme(?:Car)?_[0-9]+)#', 'g'))[1] as tok from "__seo_type_switch" where "sts_content" like '%#LinkGamme%'
) select t.src, split_part(t.tok,'_',1) kind, split_part(t.tok,'_',2) tgt, coalesce(g.pg_alias,'?'), coalesce(g.pg_display,'?'), coalesce(g.pg_relfollow,'?'), coalesce(g.pg_level,'?'), count(*) from t63 t left join pieces_gamme g on g.pg_id = split_part(t.tok,'_',2)::int group by 1,2,3,4,5,6,7 order by 1,2,3;
select now() at time zone 'utc';
