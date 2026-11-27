-- Mandat EN — tous les types affichés, avec marque, modèle (brut, affichage)
-- et codes moteur. Lecture seule.
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
SELECT t.type_id, t.type_modele_id, m.modele_marque_id AS marque_id,
       ma.marque_name, m.modele_name, coalesce(m.modele_name_meta,'') AS modele_name_meta,
       m.modele_display, t.type_name, coalesce(t.type_name_meta,'') AS type_name_meta,
       coalesce(t.type_power_ps,'') AS type_power_ps, coalesce(t.type_fuel,'') AS type_fuel,
       coalesce(t.type_year_from,'') AS year_from, coalesce(t.type_year_to,'') AS year_to,
       coalesce((SELECT string_agg(c.tmc_code, '|' ORDER BY c.tmc_code)
                   FROM auto_type_motor_code c WHERE c.tmc_type_id = t.type_id), '') AS motor_codes
  FROM auto_type t
  JOIN auto_modele m ON m.modele_id = t.type_modele_id_i
  JOIN auto_marque ma ON ma.marque_id = m.modele_marque_id
 WHERE t.type_display = '1'
 ORDER BY t.type_id_i;
