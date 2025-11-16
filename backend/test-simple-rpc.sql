-- Test ultra-simplifié sans DISTINCT

SELECT json_build_object(
  'vehicles', (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT DISTINCT
        cgc.cgc_type_id,
        at.type_id,
        at.type_name,
        am.modele_name,
        amb.marque_name
      FROM __cross_gamme_car_new cgc
      INNER JOIN auto_type at ON at.type_id::TEXT = cgc.cgc_type_id
      INNER JOIN auto_modele am ON am.modele_id::TEXT = at.type_modele_id
      INNER JOIN auto_marque amb ON amb.marque_id = am.modele_marque_id
      WHERE cgc.cgc_level = '2'
        AND amb.marque_id = 33
        AND am.modele_display = 1
        AND at.type_display = '1'
      LIMIT 3
    ) t
  )
);
