-- Mandat EN — pages R2 servables (définition du mandat DW) : ligne de
-- __sitemap_p_link dont le type est affiché. indexable : modèle de l'URL égal
-- au modèle du type et map_has_item > 20. Lecture seule.
\pset footer off
\pset format unaligned
\pset fieldsep '\t'
SELECT s.map_pg_id AS pg_id, g.pg_name, g.pg_alias,
       s.map_marque_id, s.map_marque_alias, s.map_modele_id, s.map_modele_alias,
       s.map_type_id AS type_id, s.map_type_alias, s.map_has_item,
       (s.map_modele_id = t.type_modele_id_i AND s.map_has_item > 20) AS indexable
  FROM __sitemap_p_link s
  JOIN auto_type t ON t.type_id_i = s.map_type_id AND t.type_display = '1'
  JOIN pieces_gamme g ON g.pg_id = s.map_pg_id
 ORDER BY s.map_pg_id, s.map_type_id;
