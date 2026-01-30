-- RPC: get_auto_types_batch
-- Date: 2026-01-29
-- Description: Enrichissement batch des vehicules a partir de type_ids
-- Usage: SELECT * FROM get_auto_types_batch(ARRAY[520, 521, 522]::bigint[])

CREATE OR REPLACE FUNCTION get_auto_types_batch(p_type_ids bigint[])
RETURNS TABLE(
  type_id bigint,
  make_name text,
  model_name text,
  model_generation text,
  engine text,
  power_hp int,
  year_from text,
  year_to text,
  fuel text,
  type_name text,
  type_liter text,
  type_body text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.type_id::bigint AS type_id,
    m.marque_name::text AS make_name,
    mo.modele_name::text AS model_name,
    COALESCE(mo.modele_ful_name, mo.modele_name)::text AS model_generation,
    COALESCE(
      NULLIF(t.type_engine, ''),
      -- Extraire le moteur depuis type_name si type_engine vide
      CASE
        WHEN t.type_name ~ '^\d+\.\d+' THEN regexp_replace(t.type_name, '^(\d+\.\d+[^\s]*\s*[^\s]*).*', '\1')
        ELSE t.type_name
      END
    )::text AS engine,
    t.type_power_ps::int AS power_hp,
    t.type_year_from::text AS year_from,
    t.type_year_to::text AS year_to,
    t.type_fuel::text AS fuel,
    t.type_name::text AS type_name,
    t.type_liter::text AS type_liter,
    t.type_body::text AS type_body
  FROM auto_type t
  JOIN auto_modele mo ON t.type_modele_id::text = mo.modele_id::text
  JOIN auto_marque m ON t.type_marque_id::text = m.marque_id::text
  WHERE t.type_id::bigint = ANY(p_type_ids)
    AND t.type_display = '1';
END;
$$;

-- Commentaire
COMMENT ON FUNCTION get_auto_types_batch(bigint[]) IS 'Retourne les informations enrichies pour un batch de type_ids (make, model, engine, power, years, fuel)';
