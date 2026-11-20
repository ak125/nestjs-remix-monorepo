select table_name, string_agg(column_name||':'||data_type, ', ' order by ordinal_position)
from information_schema.columns where table_schema='public' and table_name in ('__seo_keywords','__seo_type_vlevel','__seo_item_switch','__seo_gamme_car_switch','__seo_type_switch','gamme_aggregates')
group by 1;
select relname, n_live_tup, last_autoanalyze, n_tup_ins, n_tup_upd, n_tup_del from pg_stat_user_tables where relname in ('__seo_keywords','__seo_type_vlevel','__seo_item_switch','__seo_gamme_car_switch','__seo_type_switch','gamme_aggregates');
select table_name from information_schema.tables where table_schema='public' and (table_name like '__seo_gsc%' or table_name like '%gsc%' or table_name like '%v_level%' or table_name like '%vlevel%') order by 1;
