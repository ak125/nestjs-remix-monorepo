\echo == Q5a Clio III : modeles
select m.modele_id, m.modele_name, m.modele_alias, m.modele_parent, m.modele_year_from, m.modele_year_to, m.modele_display from auto_modele m join auto_marque ma on ma.marque_id::text=m.modele_marque_id::text where ma.marque_alias='renault' and m.modele_name ilike 'clio iii%' order by 1;
\echo == Q5b types 1.5 dCi des Clio III
select t.type_id, t.type_modele_id, t.type_name, t.type_alias, t.type_power_ps, t.type_power_kw, t.type_fuel, t.type_year_from, t.type_year_to, t.type_display
from auto_type t where t.type_modele_id in (select m.modele_id::text from auto_modele m join auto_marque ma on ma.marque_id::text=m.modele_marque_id::text where ma.marque_alias='renault' and m.modele_name ilike 'clio iii%') and t.type_name ilike '%1.5%dci%' order by t.type_modele_id, t.type_power_ps::int, t.type_id;
\echo == Q5c codes moteur (auto_type_motor_code si present)
select table_name, column_name from information_schema.columns where table_schema='public' and table_name like 'auto_type_motor%' order by 1;
