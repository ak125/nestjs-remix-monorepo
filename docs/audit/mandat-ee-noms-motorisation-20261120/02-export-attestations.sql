-- Mandat EE — noms bruts de toutes les motorisations (affichées ou non) des marques
-- concernées, avec leurs codes moteur : sert à « attester » un mot ajouté par le nom
-- d'affichage (même marque, même code moteur, mot présent dans un nom brut).
-- Lecture seule. Usage : sweep-psql.sh -f 02-export-attestations.sql → attestations.tsv
\o attestations.tsv
copy (
select t.type_id,
       t.type_marque_id,
       t.type_name,
       t.type_display,
       t.type_fuel,
       t.type_liter,
       t.type_power_ps,
       string_agg(m.tmc_code, ',' order by m.tmc_code) as codes_moteur
  from public.auto_type t
  join public.auto_type_motor_code m on m.tmc_type_id = t.type_id
 where t.type_marque_id in (
         select distinct c.type_marque_id
           from public.auto_type c
          where c.type_display = '1'
            and coalesce(c.type_name_meta, '') <> ''
            and c.type_name_meta <> c.type_name
            and position(upper(regexp_replace(c.type_name_meta, '[^[:alnum:]]', '', 'g'))
                         in upper(regexp_replace(c.type_name, '[^[:alnum:]]', '', 'g'))) = 0)
 group by t.type_id, t.type_marque_id, t.type_name, t.type_display, t.type_fuel,
          t.type_liter, t.type_power_ps
 order by t.type_id
) to stdout with (format csv, delimiter E'\t', header);
\o
