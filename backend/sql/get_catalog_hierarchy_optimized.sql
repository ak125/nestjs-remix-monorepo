-- 🚀 Fonction SQL optimisée pour récupérer la hiérarchie complète du catalogue
-- Remplace 3 requêtes séparées + jointure en mémoire par 1 seule requête SQL

CREATE OR REPLACE FUNCTION get_catalog_hierarchy_optimized()
RETURNS TABLE (
  mf_id TEXT,
  mf_name TEXT,
  mf_sort INTEGER,
  mf_display TEXT,
  mf_image TEXT,
  mc_id TEXT,
  mc_mf_id TEXT,
  mc_mf_prime TEXT,
  mc_pg_id TEXT,
  mc_sort TEXT,
  pg_id INTEGER,
  pg_name TEXT,
  pg_alias TEXT,
  pg_img TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cf.mf_id::TEXT,
    cf.mf_name::TEXT,
    cf.mf_sort::INTEGER,
    cf.mf_display::TEXT,
    cf.mf_pic::TEXT,
    cg.mc_id::TEXT,
    cg.mc_mf_id::TEXT,
    cg.mc_mf_prime::TEXT,
    cg.mc_pg_id::TEXT,
    cg.mc_sort::TEXT,
    pg.pg_id::INTEGER,
    pg.pg_name::TEXT,
    pg.pg_alias::TEXT,
    pg.pg_img::TEXT
  FROM 
    catalog_family cf
  LEFT JOIN 
    catalog_gamme cg ON cg.mc_mf_prime = cf.mf_id::TEXT
  LEFT JOIN 
    pieces_gamme pg ON pg.pg_id::TEXT = cg.mc_pg_id
                    AND pg.pg_display = '1'
                    AND pg.pg_level = '1'
  WHERE 
    cf.mf_display = '1'
  ORDER BY 
    cf.mf_sort ASC,
    cg.mc_sort::INTEGER ASC;
END;
$$;
