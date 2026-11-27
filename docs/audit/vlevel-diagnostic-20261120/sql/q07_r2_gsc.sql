\echo == Q7a __sitemap_p_link pg 7 x types Clio III 1.5 dCi
select map_type_id, map_modele_alias, map_type_alias, map_has_item from __sitemap_p_link where map_pg_id=7 and map_type_id in (77069,77070,26627,30141,19051,34744,28839,19052,34746,20078,19053,34749,23455,34745,23456,34747,23457,23458) order by 1;
\echo == Q7b tables GSC
select table_name, (select reltuples::bigint from pg_class where relname=table_name) est from information_schema.tables where table_schema='public' and table_name like '__seo_gsc%' order by 1;
