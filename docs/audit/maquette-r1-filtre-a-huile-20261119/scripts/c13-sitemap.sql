select t.type_id, t.type_name, t.type_year_from, t.type_year_to, t.type_display, t.type_modele_id,
 (select count(*) from __sitemap_p_link s where s.map_type_id=t.type_id::int) as lignes_sitemap_toutes_gammes,
 (select count(distinct r.rtp_pg_id) from pieces_relation_type r where r.rtp_type_id=t.type_id::int) as gammes_liees
from auto_type t where t.type_id in ('77310','65057','16108');
select count(*) as lignes, max(map_type_id) as type_id_max, count(distinct map_type_id) as types from __sitemap_p_link;
select count(*) as types_au_dessus_65000_dans_sitemap from (select distinct map_type_id from __sitemap_p_link where map_type_id>65000) x;
