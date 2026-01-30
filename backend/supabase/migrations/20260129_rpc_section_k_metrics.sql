-- RPC Section K: get_vlevel_section_k_metrics (optimized)
-- Calcule les métriques Section K pour une ou toutes les gammes
-- STATUS = (missing=0 AND extras=0) → CONFORME

CREATE OR REPLACE FUNCTION get_vlevel_section_k_metrics(p_pg_id INTEGER DEFAULT NULL)
RETURNS TABLE (
  pg_id INTEGER,
  gamme_name TEXT,
  catalog_valid BIGINT,
  covered_v2v3 BIGINT,
  expected_v4 BIGINT,
  actual_v4 BIGINT,
  missing BIGINT,
  extras BIGINT,
  status TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH gammes AS (
    SELECT DISTINCT cgc.cgc_pg_id::int AS pid, pg.pg_name AS gname
    FROM __cross_gamme_car_new cgc
    JOIN pieces_gamme pg ON cgc.cgc_pg_id::int = pg.pg_id
    WHERE p_pg_id IS NULL OR cgc.cgc_pg_id::int = p_pg_id
  ),

  -- T-A: Catalog type_ids (only those with valid auto_type)
  catalog_types AS (
    SELECT cgc.cgc_pg_id::int AS pid, cgc.cgc_type_id::bigint AS type_id
    FROM __cross_gamme_car_new cgc
    WHERE EXISTS (SELECT 1 FROM auto_type at WHERE at.type_id::text = cgc.cgc_type_id)
      AND (p_pg_id IS NULL OR cgc.cgc_pg_id::int = p_pg_id)
  ),
  catalog_per_gamme AS (
    SELECT pid, COUNT(DISTINCT type_id) AS cnt
    FROM catalog_types
    GROUP BY pid
  ),

  -- T-B: Covered V2+V3 type_ids via mapping (confidence >= 0.9)
  covered_v2v3_types AS (
    SELECT k.pg_id::int AS pid, m.type_id::bigint AS type_id
    FROM __seo_keyword_type_mapping m
    JOIN __seo_keywords k ON k.id = m.keyword_id
    WHERE k.type = 'vehicle'
      AND k.v_level IN ('V2', 'V3')
      AND m.confidence >= 0.9
      AND (p_pg_id IS NULL OR k.pg_id = p_pg_id)
  ),
  covered_per_gamme AS (
    SELECT pid, COUNT(DISTINCT type_id) AS cnt
    FROM covered_v2v3_types
    GROUP BY pid
  ),

  -- T-D: Actual V4 type_ids
  actual_v4_types AS (
    SELECT k.pg_id::int AS pid, m.type_id::bigint AS type_id
    FROM __seo_keyword_type_mapping m
    JOIN __seo_keywords k ON k.id = m.keyword_id
    WHERE k.type = 'vehicle'
      AND k.v_level = 'V4'
      AND m.confidence >= 0.9
      AND (p_pg_id IS NULL OR k.pg_id = p_pg_id)
  ),
  actual_v4_per_gamme AS (
    SELECT pid, COUNT(DISTINCT type_id) AS cnt
    FROM actual_v4_types
    GROUP BY pid
  ),

  -- T-C: Expected V4 = catalog EXCEPT covered (using type_id with proper cast)
  expected_v4_types AS (
    SELECT pid, type_id FROM catalog_types
    EXCEPT
    SELECT pid, type_id FROM covered_v2v3_types
  ),

  -- T-E: Missing = expected_v4 EXCEPT actual_v4
  missing_per_gamme AS (
    SELECT e.pid, COUNT(DISTINCT e.type_id) AS cnt
    FROM expected_v4_types e
    LEFT JOIN actual_v4_types a ON e.pid = a.pid AND e.type_id = a.type_id
    WHERE a.type_id IS NULL
    GROUP BY e.pid
  ),

  -- T-F: Extras = actual_v4 EXCEPT expected_v4
  extras_per_gamme AS (
    SELECT a.pid, COUNT(DISTINCT a.type_id) AS cnt
    FROM actual_v4_types a
    LEFT JOIN expected_v4_types e ON a.pid = e.pid AND a.type_id = e.type_id
    WHERE e.type_id IS NULL
    GROUP BY a.pid
  )

  SELECT
    g.pid,
    g.gname,
    COALESCE(c.cnt, 0)::bigint AS catalog_valid,
    COALESCE(cov.cnt, 0)::bigint AS covered_v2v3,
    (COALESCE(c.cnt, 0) - COALESCE(cov.cnt, 0))::bigint AS expected_v4,
    COALESCE(v4.cnt, 0)::bigint AS actual_v4,
    COALESCE(miss.cnt, 0)::bigint AS missing,
    COALESCE(ext.cnt, 0)::bigint AS extras,
    CASE
      WHEN COALESCE(miss.cnt, 0) = 0 AND COALESCE(ext.cnt, 0) = 0 THEN 'CONFORME'
      ELSE 'NON_CONFORME'
    END AS status
  FROM gammes g
  LEFT JOIN catalog_per_gamme c ON g.pid = c.pid
  LEFT JOIN covered_per_gamme cov ON g.pid = cov.pid
  LEFT JOIN actual_v4_per_gamme v4 ON g.pid = v4.pid
  LEFT JOIN missing_per_gamme miss ON g.pid = miss.pid
  LEFT JOIN extras_per_gamme ext ON g.pid = ext.pid
  ORDER BY g.pid;
END;
$$;

COMMENT ON FUNCTION get_vlevel_section_k_metrics IS 'Section K conformity metrics: STATUS = (missing=0 AND extras=0)';
