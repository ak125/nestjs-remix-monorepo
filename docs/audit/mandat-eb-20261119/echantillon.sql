-- Échantillon mandat EB : 5 pages par gamme, indexables d'abord (définition #2212),
-- une marque différente par page tant que possible, map_has_item décroissant.
with base as (
  select s.*, (t.type_modele_id::int = s.map_modele_id and s.map_has_item > 20) as indexable
  from __sitemap_p_link s join auto_type t on t.type_id = s.map_type_id::text and t.type_display = '1'
  where s.map_pg_id in (1750,2066,2462,2669,3213,3859,3908,3927)
), rk as (
  select *, row_number() over (partition by map_pg_id, map_marque_id order by indexable desc, map_has_item desc, map_id) rb from base
), pick as (
  select *, row_number() over (partition by map_pg_id order by rb, indexable desc, map_has_item desc, map_id) rn from rk
)
select map_pg_id, map_type_id, indexable, map_has_item,
  '/pieces/'||map_pg_alias||'-'||map_pg_id||'/'||map_marque_alias||'-'||map_marque_id||'/'||map_modele_alias||'-'||map_modele_id||'/'||map_type_alias||'-'||map_type_id||'.html'
from pick where rn <= 5 order by map_pg_id, rn;
