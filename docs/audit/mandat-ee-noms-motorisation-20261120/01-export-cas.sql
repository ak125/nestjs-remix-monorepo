-- Mandat EE — export rejouable des motorisations affichées dont type_name_meta
-- n'est pas contenu dans type_name (lettres et chiffres seulement, majuscules).
-- Lecture seule. Usage (transaction en lecture seule imposée par le script) :
--   sweep-psql.sh -f 01-export-cas.sql   → écrit cas-enrichis.tsv dans le dossier courant
\o cas-enrichis.tsv
copy (
with cas as (
  select t.*
    from public.auto_type t
   where t.type_display = '1'
     and coalesce(t.type_name_meta, '') <> ''
     and t.type_name_meta <> t.type_name
     and position(upper(regexp_replace(t.type_name_meta, '[^[:alnum:]]', '', 'g'))
                  in upper(regexp_replace(t.type_name, '[^[:alnum:]]', '', 'g'))) = 0
)
select c.type_id,
       ma.marque_name,
       mo.modele_name,
       coalesce(nullif(mo.modele_name_meta, ''), mo.modele_name)            as modele_affiche,
       c.type_name,
       c.type_name_meta,
       c.type_fuel,
       c.type_liter,
       c.type_power_ps,
       c.type_power_kw,
       c.type_year_from,
       c.type_year_to,
       c.type_relfollow,
       c.type_marque_id,
       c.type_modele_id,
       c.type_body,
       (select string_agg(m.tmc_code, ',' order by m.tmc_code)
          from public.auto_type_motor_code m where m.tmc_type_id = c.type_id) as codes_moteur,
       (select string_agg(distinct e.engine_code || ':' || coalesce(e.displacement_cc::text, '')
                         || 'cc:' || coalesce(e.power_hp::text, '') || 'ch:' || coalesce(e.fuel_type, ''), ' ; ')
          from public.auto_type_motor_code m
          join tecdoc_ext.engine_types e on e.engine_code = m.tmc_code
         where m.tmc_type_id = c.type_id)                                   as tecdoc_moteurs,
       (select r.type_name from tecdoc_map.type_id_remap r
         where r.new_id = c.type_id_i limit 1)                               as nom_tecdoc_remap,
       (select string_agg(s.type_id || '|' || s.type_name || '|' || coalesce(s.type_name_meta, '')
                          || '|' || coalesce(s.type_liter, '') || '|' || coalesce(s.type_power_ps, '')
                          || '|' || coalesce(s.type_fuel, ''), ' ¦ ' order by s.type_id_i)
          from public.auto_type s
         where s.type_display = '1' and s.type_id <> c.type_id
           and s.type_modele_id = c.type_modele_id)                          as soeurs_meme_modele,
       coalesce((pc.payload -> 'seo_validation' ->> 'is_indexable')::boolean, false)
         and not (c.type_id_i between 60000 and 83456)                       as r8_indexable,
       exists (select 1 from public.__sitemap_motorisation sm
                where sm.map_type_id = c.type_id)                            as r8_sitemap,
       (select count(*) from public.__sitemap_p_link p
         where p.map_type_id = c.type_id_i)                                  as r2_servables,
       (select count(*) from public.__sitemap_p_link p
         where p.map_type_id = c.type_id_i
           and p.map_modele_id = c.type_modele_id_i
           and p.map_has_item > 20)                                          as r2_indexables
  from cas c
  left join public.auto_marque ma on ma.marque_id = c.type_marque_id_i
  left join public.auto_modele mo on mo.modele_id = c.type_modele_id_i
  left join public.__vehicle_page_cache pc on pc.type_id = c.type_id_i
 order by ma.marque_name, mo.modele_name, c.type_name, c.type_id_i
) to stdout with (format csv, delimiter E'\t', header);
\o
