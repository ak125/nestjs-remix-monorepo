-- Migration: features sémantiques R3_guide dans get_page_quality_features()
-- Date: 2026-06-11
-- Contexte: salvage pré-purge RAG — portage des heuristiques D1/D2/D3 +
--   GENERIC_WITHOUT_ACTION du quality-gates legacy buying-guide
--   (backend/src/modules/admin/services/buying-guide/buying-guide-quality-gates.service.ts,
--   checkAntiWikiGate lignes 175-278) vers la strate moderne quality-scoring v2.2.
--   Le QualityScoringEngineService ne voit pas les textes : toute heuristique texte
--   se calcule ici côté SQL et arrive comme feature quantitative.
--
-- Règles portées (seuils appliqués côté engine, scoring-profiles.config.ts) :
--   D1  GUIDANCE_COPIES_LABEL   : guidance d'un critère == label (+ '.') → copie
--   D2  ANTI_MISTAKES_NOT_ERRORS: items anti_mistakes commençant par une action
--                                 positive (remplacement/entretien/nettoyage/
--                                 controle/verification + variantes accentuées)
--   D3  USE_CASES_NOT_PROFILES  : aucun use_case ne contient un marqueur de profil
--                                 conducteur (conduite/usage/route/urbain/ville/
--                                 sport/montagne/autoroute/city/highway)
--   GWA GENERIC_WITHOUT_ACTION  : phrases génériques présentes (GENERIC_PHRASES ×8)
--                                 sans aucun verbe d'action (ACTION_MARKERS ×13)
--
-- ADDITIF : 7 colonnes ajoutées EN FIN de RETURNS TABLE — aucune colonne existante
-- retirée, renommée ou réordonnée. Corps repris verbatim de la définition courante
-- (post-migration 20260611_fix_..._jsonb_array_length_guard, #937).
--
-- DROP FUNCTION IF EXISTS requis : PostgreSQL refuse CREATE OR REPLACE quand le
-- type de retour change (42P13) — ajouter une colonne à RETURNS TABLE = changer le
-- type de retour. Précédent repo : 20260225_add_pg_img_to_seo_reference_rpc.sql.
-- Non destructif (fonction read-only, zéro donnée) et idempotent (IF EXISTS + recreate).
--
-- STABLE read-only correct ici (la fonction ne fait que lire ; les RPC write
-- doivent être VOLATILE — cf. reference_postgrest_stable_function_write_readonly).
--
-- Squawk : pas de BEGIN/COMMIT explicite (assume_in_transaction) + timeouts requis
-- (require-timeout-settings, convention repo 2s/5s — DDL léger, swap de définition).
set lock_timeout = '2s';
set statement_timeout = '5s';

-- 0) Helper type-guardé (idempotent, repris de 20260611_fix_... pour rendre cette
--    migration auto-suffisante si appliquée isolément).
CREATE OR REPLACE FUNCTION public.safe_jsonb_array_length(x jsonb)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT CASE WHEN jsonb_typeof(x) = 'array' THEN jsonb_array_length(x) ELSE 0 END;
$fn$;

-- 1) Recreate additive de get_page_quality_features().
DROP FUNCTION IF EXISTS public.get_page_quality_features();

CREATE OR REPLACE FUNCTION public.get_page_quality_features()
RETURNS TABLE(
  pg_id integer,
  pg_alias text,
  pg_name text,
  guide_exists boolean,
  guide_how_to_choose_length integer,
  guide_selection_criteria_length integer,
  guide_anti_mistakes_count integer,
  guide_decision_tree_length integer,
  guide_faq_count integer,
  guide_symptoms_count integer,
  guide_source_verified boolean,
  guide_is_draft boolean,
  guide_intro_role_length integer,
  guide_risk_explanation_length integer,
  guide_arg_count integer,
  guide_updated_at timestamp with time zone,
  seo_exists boolean,
  seo_title_length integer,
  seo_desc_length integer,
  seo_h1_length integer,
  seo_content_length integer,
  ref_exists boolean,
  ref_definition_length integer,
  ref_role_mecanique_length integer,
  ref_composition_count integer,
  ref_confusions_count integer,
  ref_symptomes_count integer,
  ref_content_html_length integer,
  ref_has_schema_json boolean,
  ref_has_canonical boolean,
  ref_related_refs_count integer,
  ref_blog_slugs_count integer,
  ref_regles_metier_count integer,
  ref_title_length integer,
  ref_meta_desc_length integer,
  ref_updated_at timestamp with time zone,
  conseil_exists boolean,
  conseil_total_sections integer,
  conseil_rich_sections integer,
  conseil_has_s1 boolean,
  conseil_has_s2 boolean,
  conseil_has_s3 boolean,
  conseil_has_s4_depose boolean,
  conseil_has_s4_repose boolean,
  conseil_has_s5 boolean,
  conseil_has_s6 boolean,
  conseil_has_s7 boolean,
  conseil_has_s8 boolean,
  conseil_total_content_length integer,
  rag_content_length integer,
  rag_truth_level text,
  pipeline_quality_score integer,
  pipeline_hard_gate_results jsonb,
  pipeline_completed_at timestamp with time zone,
  has_pg_img boolean,
  has_pg_pic boolean,
  has_pg_wall boolean,
  has_blog_advice boolean,
  blog_advice_content_length integer,
  -- ── Ajout 2026-06-11 : sémantique R3_guide (D1/D2/D3 + GENERIC_WITHOUT_ACTION,
  --    portage buying-guide-quality-gates — salvage pré-purge RAG) ──
  guide_criteria_count integer,
  guide_guidance_copies_label_count integer,
  guide_positive_starter_count integer,
  guide_use_cases_count integer,
  guide_profile_marker_count integer,
  guide_generic_phrase_count integer,
  guide_action_marker_count integer
)
LANGUAGE sql
STABLE
AS $function$
WITH
gamme_base AS (
  SELECT pg_id, pg_alias::text, pg_name::text,
         (pg_img IS NOT NULL AND pg_img <> '') AS has_img,
         (pg_pic IS NOT NULL AND pg_pic <> '') AS has_pic,
         (pg_wall IS NOT NULL AND pg_wall <> '') AS has_wall
  FROM pieces_gamme
  WHERE pg_display = '1' AND pg_level::integer IN (1, 2)
),
purchase_guide AS (
  SELECT
    sgpg_pg_id::integer AS pg_id,
    true AS guide_exists,
    COALESCE(length(sgpg_how_to_choose), 0)                             AS how_to_choose_length,
    COALESCE(length(sgpg_selection_criteria::text), 0)                   AS selection_criteria_length,
    COALESCE(array_length(sgpg_anti_mistakes, 1), 0)                    AS anti_mistakes_count,
    COALESCE(length(sgpg_decision_tree::text), 0)                       AS decision_tree_length,
    COALESCE(public.safe_jsonb_array_length(COALESCE(sgpg_faq, '[]'::jsonb)), 0)    AS faq_count,
    COALESCE(array_length(sgpg_symptoms, 1), 0)                         AS symptoms_count,
    COALESCE(sgpg_source_verified, false)                               AS source_verified,
    COALESCE(sgpg_is_draft, false)                                      AS is_draft,
    COALESCE(length(sgpg_intro_role), 0)                                AS intro_role_length,
    COALESCE(length(sgpg_risk_explanation), 0)                          AS risk_explanation_length,
    (CASE WHEN length(sgpg_arg1_content) > 10 THEN 1 ELSE 0 END
   + CASE WHEN length(sgpg_arg2_content) > 10 THEN 1 ELSE 0 END
   + CASE WHEN length(sgpg_arg3_content) > 10 THEN 1 ELSE 0 END
   + CASE WHEN length(sgpg_arg4_content) > 10 THEN 1 ELSE 0 END)       AS arg_count,
    sgpg_updated_at::timestamptz                                        AS updated_at
  FROM __seo_gamme_purchase_guide
),
-- Sémantique R3_guide — portage SQL des heuristiques texte du quality-gates
-- legacy buying-guide (D1/D2/D3 + GENERIC_WITHOUT_ACTION). Type-guardé via
-- jsonb_typeof : un jsonb non-array (object/scalar) ne lève jamais 22023.
guide_semantics AS (
  SELECT
    g.sgpg_pg_id::integer AS pg_id,
    -- D1 — nombre de critères (longueur du tableau selection_criteria)
    public.safe_jsonb_array_length(COALESCE(g.sgpg_selection_criteria, '[]'::jsonb)) AS criteria_count,
    -- D1 — critères dont guidance == label (ou label + '.') = copie sans valeur
    (CASE WHEN jsonb_typeof(g.sgpg_selection_criteria) = 'array' THEN (
        SELECT count(*)::integer
        FROM jsonb_array_elements(g.sgpg_selection_criteria) AS c
        WHERE btrim(c->>'guidance') = btrim(c->>'label')
           OR btrim(c->>'guidance') = btrim(c->>'label') || '.'
      ) ELSE 0 END) AS guidance_copies_label_count,
    -- D2 — anti_mistakes commençant par une action positive (préfixes legacy
    -- non accentués + variantes accentuées, convention ACTION_MARKERS(_NORMALIZED))
    (SELECT count(*)::integer
       FROM unnest(COALESCE(g.sgpg_anti_mistakes, ARRAY[]::text[])) AS m
      WHERE lower(m) LIKE ANY (ARRAY[
        'remplacement%', 'entretien%', 'nettoyage%',
        'controle%', 'contrôle%', 'verification%', 'vérification%'
      ])) AS positive_starter_count,
    -- D3 — nombre de use_cases
    public.safe_jsonb_array_length(COALESCE(g.sgpg_use_cases, '[]'::jsonb)) AS use_cases_count,
    -- D3 — use_cases dont id/label contient un marqueur de profil conducteur
    (CASE WHEN jsonb_typeof(g.sgpg_use_cases) = 'array' THEN (
        SELECT count(*)::integer
        FROM jsonb_array_elements(g.sgpg_use_cases) AS uc
        WHERE lower(COALESCE(uc->>'id', '') || ' ' || COALESCE(uc->>'label', '')) LIKE ANY (ARRAY[
          '%conduite%', '%usage%', '%route%', '%urbain%', '%ville%',
          '%sport%', '%montagne%', '%autoroute%', '%city%', '%highway%'
        ])
      ) ELSE 0 END) AS profile_marker_count,
    -- GWA — nombre de phrases génériques distinctes présentes (GENERIC_PHRASES ×8)
    (SELECT count(*)::integer
       FROM unnest(ARRAY[
         'rôle essentiel', 'entretien régulier', 'pièce importante',
         'bon fonctionnement', 'il est recommandé', 'il est conseillé',
         'en bon état', 'pièce indispensable'
       ]) AS ph
      WHERE t.txt LIKE '%' || ph || '%') AS generic_phrase_count,
    -- GWA — nombre de verbes d'action distincts présents (ACTION_MARKERS ×13)
    (SELECT count(*)::integer
       FROM unnest(ARRAY[
         'vérifier', 'contrôler', 'choisir', 'comparer', 'identifier',
         'confirmer', 'mesurer', 'valider', 'respecter', 'remplacer',
         'éviter', 'filtrer', 'sélectionner'
       ]) AS am
      WHERE t.txt LIKE '%' || am || '%') AS action_marker_count
  FROM __seo_gamme_purchase_guide g
  CROSS JOIN LATERAL (
    SELECT lower(concat_ws(' ',
      g.sgpg_intro_role, g.sgpg_how_to_choose, g.sgpg_risk_explanation,
      array_to_string(COALESCE(g.sgpg_anti_mistakes, ARRAY[]::text[]), ' '),
      g.sgpg_selection_criteria::text, g.sgpg_decision_tree::text,
      g.sgpg_faq::text, g.sgpg_use_cases::text,
      g.sgpg_arg1_content, g.sgpg_arg2_content, g.sgpg_arg3_content, g.sgpg_arg4_content
    )) AS txt
  ) t
),
seo_meta AS (
  SELECT
    sg_pg_id::integer AS pg_id,
    true AS seo_exists,
    COALESCE(length(sg_title), 0)   AS title_length,
    COALESCE(length(sg_descrip), 0) AS desc_length,
    COALESCE(length(sg_h1), 0)      AS h1_length,
    COALESCE(length(sg_content), 0) AS content_length
  FROM __seo_gamme
),
reference_data AS (
  SELECT
    pg_id,
    true AS ref_exists,
    COALESCE(length(definition), 0)                    AS definition_length,
    COALESCE(length(role_mecanique), 0)                AS role_mecanique_length,
    COALESCE(array_length(composition, 1), 0)          AS composition_count,
    COALESCE(array_length(confusions_courantes, 1), 0) AS confusions_count,
    COALESCE(array_length(symptomes_associes, 1), 0)   AS symptomes_count,
    COALESCE(length(content_html), 0)                  AS content_html_length,
    (schema_json IS NOT NULL)                          AS has_schema_json,
    (canonical_url IS NOT NULL AND canonical_url <> '') AS has_canonical,
    COALESCE(array_length(related_references, 1), 0)   AS related_refs_count,
    COALESCE(array_length(blog_slugs, 1), 0)           AS blog_slugs_count,
    COALESCE(array_length(regles_metier, 1), 0)        AS regles_metier_count,
    COALESCE(length(title), 0)                         AS ref_title_length,
    COALESCE(length(meta_description), 0)              AS ref_meta_desc_length,
    updated_at                                         AS ref_updated_at
  FROM __seo_reference
  WHERE is_published = true
),
conseil_agg AS (
  SELECT
    sgc_pg_id::integer AS pg_id,
    true AS conseil_exists,
    count(*)::integer AS total_sections,
    count(*) FILTER (WHERE length(sgc_content) >= 200)::integer AS rich_sections,
    bool_or(sgc_section_type = 'S1') AS has_s1,
    bool_or(sgc_section_type = 'S2') AS has_s2,
    bool_or(sgc_section_type = 'S3') AS has_s3,
    bool_or(sgc_section_type = 'S4_DEPOSE') AS has_s4_depose,
    bool_or(sgc_section_type = 'S4_REPOSE') AS has_s4_repose,
    bool_or(sgc_section_type = 'S5') AS has_s5,
    bool_or(sgc_section_type = 'S6') AS has_s6,
    bool_or(sgc_section_type = 'S7') AS has_s7,
    bool_or(sgc_section_type = 'S8') AS has_s8,
    COALESCE(sum(length(sgc_content)), 0)::integer AS total_content_length
  FROM __seo_gamme_conseil
  WHERE sgc_section_type <> 'META'
  GROUP BY sgc_pg_id
),
rag_data AS (
  SELECT DISTINCT ON (replace(replace(source, 'gammes/', ''), '.md', ''))
    replace(replace(source, 'gammes/', ''), '.md', '') AS pg_alias,
    COALESCE(length(content), 0)::integer AS rag_content_length,
    truth_level AS rag_truth_level
  FROM __rag_knowledge
  WHERE source LIKE 'gammes/%'
  ORDER BY replace(replace(source, 'gammes/', ''), '.md', ''), length(content) DESC
),
pipeline_data AS (
  SELECT DISTINCT ON (pg_alias)
    pg_alias::text,
    quality_score::integer AS pipeline_quality_score,
    hard_gate_results AS pipeline_hard_gate_results,
    completed_at AS pipeline_completed_at
  FROM __rag_content_refresh_log
  WHERE quality_score IS NOT NULL
  ORDER BY pg_alias, completed_at DESC
),
blog_advice AS (
  SELECT
    ba_pg_id::integer AS pg_id,
    true AS has_advice,
    COALESCE(length(ba_content), 0)::integer AS content_length
  FROM __blog_advice
)
SELECT
  g.pg_id,
  g.pg_alias,
  g.pg_name,
  COALESCE(pgu.guide_exists, false),
  COALESCE(pgu.how_to_choose_length, 0),
  COALESCE(pgu.selection_criteria_length, 0),
  COALESCE(pgu.anti_mistakes_count, 0),
  COALESCE(pgu.decision_tree_length, 0),
  COALESCE(pgu.faq_count, 0),
  COALESCE(pgu.symptoms_count, 0),
  COALESCE(pgu.source_verified, false),
  COALESCE(pgu.is_draft, false),
  COALESCE(pgu.intro_role_length, 0),
  COALESCE(pgu.risk_explanation_length, 0),
  COALESCE(pgu.arg_count, 0),
  pgu.updated_at,
  COALESCE(sm.seo_exists, false),
  COALESCE(sm.title_length, 0),
  COALESCE(sm.desc_length, 0),
  COALESCE(sm.h1_length, 0),
  COALESCE(sm.content_length, 0),
  COALESCE(rd.ref_exists, false),
  COALESCE(rd.definition_length, 0),
  COALESCE(rd.role_mecanique_length, 0),
  COALESCE(rd.composition_count, 0),
  COALESCE(rd.confusions_count, 0),
  COALESCE(rd.symptomes_count, 0),
  COALESCE(rd.content_html_length, 0),
  COALESCE(rd.has_schema_json, false),
  COALESCE(rd.has_canonical, false),
  COALESCE(rd.related_refs_count, 0),
  COALESCE(rd.blog_slugs_count, 0),
  COALESCE(rd.regles_metier_count, 0),
  COALESCE(rd.ref_title_length, 0),
  COALESCE(rd.ref_meta_desc_length, 0),
  rd.ref_updated_at,
  COALESCE(ca.conseil_exists, false),
  COALESCE(ca.total_sections, 0),
  COALESCE(ca.rich_sections, 0),
  COALESCE(ca.has_s1, false),
  COALESCE(ca.has_s2, false),
  COALESCE(ca.has_s3, false),
  COALESCE(ca.has_s4_depose, false),
  COALESCE(ca.has_s4_repose, false),
  COALESCE(ca.has_s5, false),
  COALESCE(ca.has_s6, false),
  COALESCE(ca.has_s7, false),
  COALESCE(ca.has_s8, false),
  COALESCE(ca.total_content_length, 0),
  COALESCE(rk.rag_content_length, 0),
  rk.rag_truth_level,
  COALESCE(pl.pipeline_quality_score, 0),
  pl.pipeline_hard_gate_results,
  pl.pipeline_completed_at,
  g.has_img,
  g.has_pic,
  g.has_wall,
  COALESCE(ba.has_advice, false),
  COALESCE(ba.content_length, 0),
  COALESCE(gs.criteria_count, 0),
  COALESCE(gs.guidance_copies_label_count, 0),
  COALESCE(gs.positive_starter_count, 0),
  COALESCE(gs.use_cases_count, 0),
  COALESCE(gs.profile_marker_count, 0),
  COALESCE(gs.generic_phrase_count, 0),
  COALESCE(gs.action_marker_count, 0)
FROM gamme_base g
LEFT JOIN purchase_guide pgu ON pgu.pg_id = g.pg_id
LEFT JOIN seo_meta sm ON sm.pg_id = g.pg_id
LEFT JOIN reference_data rd ON rd.pg_id = g.pg_id
LEFT JOIN conseil_agg ca ON ca.pg_id = g.pg_id
LEFT JOIN rag_data rk ON rk.pg_alias = g.pg_alias
LEFT JOIN pipeline_data pl ON pl.pg_alias = g.pg_alias
LEFT JOIN blog_advice ba ON ba.pg_id = g.pg_id
LEFT JOIN guide_semantics gs ON gs.pg_id = g.pg_id
ORDER BY g.pg_alias;
$function$;

COMMENT ON FUNCTION public.get_page_quality_features() IS
  'Features qualité par gamme pour QualityScoringEngineService (v2.2). 2026-06-11 : +7 colonnes sémantiques R3_guide (guide_criteria_count, guide_guidance_copies_label_count, guide_positive_starter_count, guide_use_cases_count, guide_profile_marker_count, guide_generic_phrase_count, guide_action_marker_count) — portage D1/D2/D3 + GENERIC_WITHOUT_ACTION du quality-gates legacy buying-guide, salvage pré-purge RAG. Additive : colonnes existantes inchangées.';
