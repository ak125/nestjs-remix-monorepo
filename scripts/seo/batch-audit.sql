-- ============================================================
-- DASHBOARD SQL RAPIDE — Triage SEO 221 gammes
-- Usage : copier-coller dans MCP Supabase execute_sql
-- Projet : cxpojprgwgubzjyqzmoq
-- ============================================================

-- 1. VUE GLOBALE : toutes les gammes avec etat sections + sources
SELECT
  pg.pg_id,
  pg.pg_alias,
  pg.pg_name,
  COUNT(sgc.sgc_section_type) AS sections,
  ROUND(AVG(sgc.sgc_quality_score)) AS avg_score,
  MIN(sgc.sgc_quality_score) AS min_score,
  SUM(CASE WHEN sgc.sgc_sources IS NULL THEN 1 ELSE 0 END) AS no_sources,
  SUM(CASE WHEN sgc.sgc_quality_score < 70 THEN 1 ELSE 0 END) AS weak_sections,
  BOOL_OR(sgc.sgc_section_type = 'S6') AS has_s6,
  CASE
    WHEN COUNT(sgc.sgc_section_type) < 4 THEN 'CREER 4+ sections'
    WHEN NOT BOOL_OR(sgc.sgc_section_type = 'S6') THEN 'CREER S6'
    WHEN MIN(sgc.sgc_quality_score) < 60 THEN 'AMELIORER sections faibles'
    WHEN SUM(CASE WHEN sgc.sgc_sources IS NULL THEN 1 ELSE 0 END) > 0 THEN 'AJOUTER sources'
    ELSE 'OK'
  END AS action
FROM pieces_gamme pg
JOIN __seo_gamme_purchase_guide spg ON spg.pg_id = pg.pg_id::text
LEFT JOIN __seo_gamme_conseil sgc ON sgc.sgc_pg_id = pg.pg_id::text
WHERE pg.pg_display = '1' AND pg.pg_level IN ('1','2')
GROUP BY pg.pg_id, pg.pg_alias, pg.pg_name
ORDER BY avg_score ASC NULLS FIRST, sections ASC
LIMIT 50;

-- ============================================================
-- 2. RESUME GLOBAL
-- ============================================================
-- SELECT
--   COUNT(*) AS total_gammes,
--   SUM(CASE WHEN section_count >= 7 AND avg_score >= 85 AND no_sources = 0 THEN 1 ELSE 0 END) AS saines,
--   SUM(CASE WHEN section_count < 4 THEN 1 ELSE 0 END) AS tres_incompletes,
--   SUM(CASE WHEN no_sources > 0 THEN 1 ELSE 0 END) AS sans_sources
-- FROM (
--   SELECT
--     pg.pg_id,
--     COUNT(sgc.sgc_section_type) AS section_count,
--     ROUND(AVG(sgc.sgc_quality_score)) AS avg_score,
--     SUM(CASE WHEN sgc.sgc_sources IS NULL THEN 1 ELSE 0 END) AS no_sources
--   FROM pieces_gamme pg
--   JOIN __seo_gamme_purchase_guide spg ON spg.pg_id = pg.pg_id::text
--   LEFT JOIN __seo_gamme_conseil sgc ON sgc.sgc_pg_id = pg.pg_id::text
--   WHERE pg.pg_display = '1' AND pg.pg_level IN ('1','2')
--   GROUP BY pg.pg_id
-- ) sub;

-- ============================================================
-- 3. DETAIL SECTIONS POUR 1 GAMME (remplacer {pg_id})
-- ============================================================
-- SELECT
--   sgc_section_type,
--   sgc_quality_score,
--   LENGTH(sgc_content) AS content_len,
--   sgc_sources IS NOT NULL AS has_sources,
--   sgc_order
-- FROM __seo_gamme_conseil
-- WHERE sgc_pg_id = '{pg_id}'
-- ORDER BY sgc_order;
