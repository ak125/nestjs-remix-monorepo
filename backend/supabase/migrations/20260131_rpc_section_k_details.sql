-- RPC Section K: get_vlevel_section_k_missing
-- Returns missing type_ids (expected V4 but not in actual V4)
-- Used for drill-down when status = NON_CONFORME

CREATE OR REPLACE FUNCTION get_vlevel_section_k_missing(p_pg_id INTEGER)
RETURNS TABLE (
  pg_id INTEGER,
  type_id TEXT,
  modele_name TEXT,
  type_name TEXT,
  type_fuel TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  catalog_types AS (
    SELECT cgc.cgc_type_id AS tid
    FROM __cross_gamme_car_new cgc
    WHERE cgc.cgc_pg_id::int = p_pg_id
      AND EXISTS (SELECT 1 FROM auto_type at WHERE at.type_id = cgc.cgc_type_id)
  ),
  covered_v2v3_types AS (
    SELECT m.type_id AS tid
    FROM __seo_keyword_type_mapping m
    JOIN __seo_keywords k ON k.id = m.keyword_id
    WHERE k.pg_id = p_pg_id
      AND k.type = 'vehicle'
      AND k.v_level IN ('V2', 'V3')
      AND m.confidence >= 0.9
  ),
  expected_v4_types AS (
    SELECT tid FROM catalog_types
    EXCEPT
    SELECT tid FROM covered_v2v3_types
  ),
  actual_v4_types AS (
    SELECT m.type_id AS tid
    FROM __seo_keyword_type_mapping m
    JOIN __seo_keywords k ON k.id = m.keyword_id
    WHERE k.pg_id = p_pg_id
      AND k.type = 'vehicle'
      AND k.v_level = 'V4'
      AND m.confidence >= 0.9
  ),
  missing_types AS (
    SELECT e.tid
    FROM expected_v4_types e
    WHERE NOT EXISTS (SELECT 1 FROM actual_v4_types a WHERE a.tid = e.tid)
  )
  SELECT
    p_pg_id AS pg_id,
    m.tid::text AS type_id,
    COALESCE(am.modele_name, 'Inconnu')::text AS modele_name,
    COALESCE(at.type_name, 'Inconnu')::text AS type_name,
    COALESCE(at.type_fuel, 'Inconnu')::text AS type_fuel
  FROM missing_types m
  LEFT JOIN auto_type at ON at.type_id = m.tid
  LEFT JOIN auto_modele am ON at.type_modele_id::int = am.modele_id
  ORDER BY modele_name, type_name
  LIMIT 500;
END;
$$;

COMMENT ON FUNCTION get_vlevel_section_k_missing IS 'Returns missing type_ids for Section K drill-down';


-- RPC Section K: get_vlevel_section_k_extras
-- Returns extra type_ids (in actual V4 but not expected)

CREATE OR REPLACE FUNCTION get_vlevel_section_k_extras(p_pg_id INTEGER)
RETURNS TABLE (
  pg_id INTEGER,
  type_id TEXT,
  keyword_id BIGINT,
  keyword TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH
  catalog_types AS (
    SELECT cgc.cgc_type_id AS tid
    FROM __cross_gamme_car_new cgc
    WHERE cgc.cgc_pg_id::int = p_pg_id
      AND EXISTS (SELECT 1 FROM auto_type at WHERE at.type_id = cgc.cgc_type_id)
  ),
  covered_v2v3_types AS (
    SELECT m.type_id AS tid
    FROM __seo_keyword_type_mapping m
    JOIN __seo_keywords k ON k.id = m.keyword_id
    WHERE k.pg_id = p_pg_id
      AND k.type = 'vehicle'
      AND k.v_level IN ('V2', 'V3')
      AND m.confidence >= 0.9
  ),
  expected_v4_types AS (
    SELECT tid FROM catalog_types
    EXCEPT
    SELECT tid FROM covered_v2v3_types
  ),
  actual_v4_with_keyword AS (
    SELECT DISTINCT m.type_id AS tid, k.id AS kid, k.keyword AS kw
    FROM __seo_keyword_type_mapping m
    JOIN __seo_keywords k ON k.id = m.keyword_id
    WHERE k.pg_id = p_pg_id
      AND k.type = 'vehicle'
      AND k.v_level = 'V4'
      AND m.confidence >= 0.9
  ),
  extras_types AS (
    SELECT a.tid, a.kid, a.kw
    FROM actual_v4_with_keyword a
    WHERE NOT EXISTS (SELECT 1 FROM expected_v4_types e WHERE e.tid = a.tid)
  )
  SELECT
    p_pg_id AS pg_id,
    e.tid::text AS type_id,
    e.kid AS keyword_id,
    e.kw::text AS keyword
  FROM extras_types e
  ORDER BY keyword
  LIMIT 500;
END;
$$;

COMMENT ON FUNCTION get_vlevel_section_k_extras IS 'Returns extra type_ids for Section K drill-down';
