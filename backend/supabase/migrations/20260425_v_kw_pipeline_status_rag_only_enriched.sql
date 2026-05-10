-- 2026-04-25: v_kw_pipeline_status — ajout branch RAG_ONLY_ENRICHED
-- ----------------------------------------------------------------------------
-- Contexte : la view v_kw_pipeline_status retournait NO_CSV en premier dans
-- le CASE, masquant le fait que beaucoup de gammes sont entièrement enrichies
-- via RAG (R1+R3+R4+R6 KP validated + content présent) sans avoir reçu
-- d'import Google Ads KP — soit parce que volume search trop faible (gammes
-- niche : composants ABS, accessoires rares), soit parce que CSV pas encore
-- exporté.
--
-- Découverte : 147 / 232 gammes G1/G2 (63%) sont dans cet état. Le BLOCK
-- artificiel "NO_CSV" cachait cette majorité fonctionnelle.
--
-- Fix : ajouter un branch RAG_ONLY_ENRICHED PRIORITAIRE qui détecte les
-- gammes "raw_count IS NULL ET tous KP/content présents". Skill /gamme-qa
-- Phase 8 doit accepter ce stage comme PASS (mise à jour parallèle dans
-- governance-vault).
--
-- Idempotent : CREATE OR REPLACE VIEW.
--
-- Tests :
--   pg=415 agregat-de-freinage : NO_CSV → RAG_ONLY_ENRICHED (canon)
--   147 gammes basculent vers RAG_ONLY_ENRICHED post-migration
--   Freinage 13/13 canon (12 FULLY + 1 RAG_ONLY)

CREATE OR REPLACE VIEW v_kw_pipeline_status AS
WITH canonical_gammes AS (
  SELECT pg.pg_id, pg.pg_alias, pg.pg_name
  FROM pieces_gamme pg
  JOIN __pg_gammes cg ON cg.id = pg.pg_id
),
raw_kw AS (
  SELECT pg_id, count(*) AS raw_count
  FROM __seo_keywords WHERE pg_id IS NOT NULL GROUP BY pg_id
),
classified AS (
  SELECT pg_id,
    count(*) AS classified_count,
    count(*) FILTER (WHERE role = 'R1') AS r1_kw,
    count(*) FILTER (WHERE role = 'R3') AS r3_kw,
    count(*) FILTER (WHERE role = 'R4') AS r4_kw,
    count(*) FILTER (WHERE role = 'R6') AS r6_kw
  FROM __seo_keyword_results WHERE pg_id IS NOT NULL GROUP BY pg_id
),
kp_r1 AS (SELECT DISTINCT rkp_pg_id AS pg_id FROM __seo_r1_keyword_plan WHERE rkp_status = ANY(ARRAY['validated','active','ready','complete'])),
kp_r3 AS (SELECT DISTINCT skp_pg_id AS pg_id FROM __seo_r3_keyword_plan WHERE skp_status = ANY(ARRAY['validated','active','ready','complete'])),
kp_r4 AS (SELECT DISTINCT r4kp_pg_id AS pg_id FROM __seo_r4_keyword_plan WHERE r4kp_status = ANY(ARRAY['validated','active','ready','complete'])),
kp_r6 AS (SELECT DISTINCT r6kp_pg_id::integer AS pg_id FROM __seo_r6_keyword_plan WHERE r6kp_status = ANY(ARRAY['validated','active','ready','complete'])),
content_r1 AS (SELECT DISTINCT r1s_pg_id::integer AS pg_id FROM __seo_r1_gamme_slots),
content_r3 AS (SELECT DISTINCT sgc_pg_id::integer AS pg_id FROM __seo_gamme_conseil),
content_r4 AS (SELECT DISTINCT pg_id FROM __seo_reference WHERE is_published = true),
content_r6 AS (SELECT DISTINCT sgpg_pg_id::integer AS pg_id FROM __seo_gamme_purchase_guide)
SELECT g.pg_id, g.pg_alias, g.pg_name,
  COALESCE(rk.raw_count, 0::bigint) AS raw_count,
  COALESCE(c.classified_count, 0::bigint) AS classified_count,
  COALESCE(c.r1_kw, 0::bigint) AS r1_kw,
  COALESCE(c.r3_kw, 0::bigint) AS r3_kw,
  COALESCE(c.r4_kw, 0::bigint) AS r4_kw,
  COALESCE(c.r6_kw, 0::bigint) AS r6_kw,
  (kp_r1.pg_id IS NOT NULL) AS kp_r1_ready,
  (kp_r3.pg_id IS NOT NULL) AS kp_r3_ready,
  (kp_r4.pg_id IS NOT NULL) AS kp_r4_ready,
  (kp_r6.pg_id IS NOT NULL) AS kp_r6_ready,
  (content_r1.pg_id IS NOT NULL) AS content_r1_exists,
  (content_r3.pg_id IS NOT NULL) AS content_r3_exists,
  (content_r4.pg_id IS NOT NULL) AS content_r4_exists,
  (content_r6.pg_id IS NOT NULL) AS content_r6_exists,
  CASE
    -- RAG_ONLY_ENRICHED : gamme niche ou pré-canon entièrement enrichie via
    -- RAG (KP validated + content présent partout) mais sans Google Ads KW.
    -- Canon légitime, équivalent fonctionnel à FULLY_ENRICHED pour QA Phase 8.
    WHEN rk.raw_count IS NULL
      AND kp_r1.pg_id IS NOT NULL
      AND kp_r3.pg_id IS NOT NULL
      AND kp_r6.pg_id IS NOT NULL
      AND content_r1.pg_id IS NOT NULL
      AND content_r3.pg_id IS NOT NULL
      AND content_r4.pg_id IS NOT NULL
      AND content_r6.pg_id IS NOT NULL
      THEN 'RAG_ONLY_ENRICHED'
    WHEN rk.raw_count IS NULL THEN 'NO_CSV'
    WHEN c.classified_count IS NULL THEN 'CSV_IMPORTED_NOT_CLASSIFIED'
    WHEN kp_r1.pg_id IS NULL OR kp_r3.pg_id IS NULL OR kp_r6.pg_id IS NULL THEN 'KP_INCOMPLETE'
    WHEN content_r1.pg_id IS NULL OR content_r3.pg_id IS NULL OR content_r4.pg_id IS NULL OR content_r6.pg_id IS NULL THEN 'CONTENT_INCOMPLETE'
    ELSE 'FULLY_ENRICHED'
  END AS pipeline_stage
FROM canonical_gammes g
LEFT JOIN raw_kw rk ON rk.pg_id = g.pg_id
LEFT JOIN classified c ON c.pg_id = g.pg_id
LEFT JOIN kp_r1 ON kp_r1.pg_id = g.pg_id
LEFT JOIN kp_r3 ON kp_r3.pg_id = g.pg_id
LEFT JOIN kp_r4 ON kp_r4.pg_id = g.pg_id
LEFT JOIN kp_r6 ON kp_r6.pg_id = g.pg_id
LEFT JOIN content_r1 ON content_r1.pg_id = g.pg_id
LEFT JOIN content_r3 ON content_r3.pg_id = g.pg_id
LEFT JOIN content_r4 ON content_r4.pg_id = g.pg_id
LEFT JOIN content_r6 ON content_r6.pg_id = g.pg_id;

COMMENT ON VIEW v_kw_pipeline_status IS
  'Pipeline stage canonical view. RAG_ONLY_ENRICHED branch added 2026-04-25 to recognize niche/pre-canon gammes fully RAG-enriched without Google Ads KW (legitimate, non-blocking).';
