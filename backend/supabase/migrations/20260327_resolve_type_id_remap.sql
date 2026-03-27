-- Migration: RPC resolve_type_id_remap
-- Purpose: Resolve old TecDoc type_id (>= 100K) to new massdoc ID for 301 redirects
-- Context: 23,457 vehicles remapped from TecDoc KTYPNR (100001-801701) → massdoc (60000-83456)
-- Safety: Additive only, no schema changes. Rollback = DROP FUNCTION.

CREATE OR REPLACE FUNCTION public.resolve_type_id_remap(p_old_id INTEGER)
RETURNS TABLE(new_id INTEGER, type_alias TEXT, type_name TEXT,
              modele_alias TEXT, modele_id INTEGER,
              marque_alias TEXT, marque_id SMALLINT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT r.new_id, at.type_alias, at.type_name,
         am.modele_alias, am.modele_id,
         amarq.marque_alias, amarq.marque_id
  FROM tecdoc_map.type_id_remap r
  JOIN auto_type at ON at.type_id = r.new_id::text
  JOIN auto_modele am ON am.modele_id::text = at.type_modele_id
  JOIN auto_marque amarq ON amarq.marque_id = am.modele_marque_id
  WHERE r.old_id = p_old_id LIMIT 1;
$$;
