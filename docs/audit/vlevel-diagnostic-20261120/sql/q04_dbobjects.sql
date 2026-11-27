\echo == Q4a fonctions qui citent les tables/colonnes V-Level
select p.proname, pg_get_function_identity_arguments(p.oid) args,
  (p.prosrc ilike '%__seo_type_vlevel%') tv, (p.prosrc ilike '%__seo_keywords%') kw, (p.prosrc ~* 'v_level|vlevel') vl,
  (p.prosrc ilike '%__seo_item_switch%' or p.prosrc ilike '%__seo_gamme_car_switch%' or p.prosrc ilike '%__seo_type_switch%') sw
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and (p.prosrc ilike '%__seo_type_vlevel%' or p.prosrc ilike '%__seo_keywords%' or p.prosrc ~* 'v_level|vlevel' or p.prosrc ilike '%__seo_item_switch%' or p.prosrc ilike '%__seo_gamme_car_switch%' or p.prosrc ilike '%__seo_type_switch%')
order by 1;
\echo == Q4b vues qui citent
select viewname from pg_views where schemaname='public' and (definition ilike '%__seo_type_vlevel%' or definition ilike '%__seo_keywords%' or definition ~* 'v_level' ) order by 1;
select matviewname from pg_matviews where definition ilike '%__seo_keywords%' or definition ilike '%__seo_type_vlevel%' or definition ~* 'v_level';
\echo == Q4c triggers sur les tables
select c.relname, t.tgname, t.tgenabled, pr.proname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc pr on pr.oid=t.tgfoid where not t.tgisinternal and c.relname in ('__seo_keywords','__seo_type_vlevel') order by 1,2;
\echo == Q4d stats acces
select relname, seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del, last_seq_scan, last_idx_scan from pg_stat_user_tables where relname in ('__seo_keywords','__seo_type_vlevel','__seo_item_switch','__seo_gamme_car_switch','__seo_type_switch');
select stats_reset from pg_stat_database where datname=current_database();
