-- Mandat EE, point 6.6 : types affichés et leurs modèles, pour vérifier que les
-- valeurs corrigées ne créent aucun titre R8 ni R2 identique (règle de #2212).
-- Lecture seule. Sortie : voisins.tsv (une ligne par type affiché).
\o voisins.tsv
copy (
  select t.type_id, t.type_modele_id, t.type_name, t.type_name_meta,
         t.type_power_ps, t.type_fuel,
         m.modele_marque_id, m.modele_name, m.modele_name_meta, m.modele_display
  from auto_type t
  join auto_modele m on m.modele_id::text = t.type_modele_id
  where t.type_display = '1'
  order by t.type_id::int
) to stdout with (format csv, delimiter E'\t', header);
\o
