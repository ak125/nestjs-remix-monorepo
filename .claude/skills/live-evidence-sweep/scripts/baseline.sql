-- Baseline structurelle — a rejouer apres une fenetre de maintenance, puis `diff`.
-- Lecture seule : aucun BEGIN/COMMIT ici, la transaction est ouverte par scripts/sweep-psql.sh.
--   ./scripts/sweep-psql.sh -f scripts/baseline.sql > avant.txt
--   (apres la fenetre) ./scripts/sweep-psql.sh -f scripts/baseline.sql > apres.txt && diff avant.txt apres.txt
\pset border 2
\pset title 'Baseline PG massdoc'
select 'version' as mesure, substring(version() from 'PostgreSQL [0-9.]+') as valeur
union all select 'taille_base', pg_size_pretty(pg_database_size(current_database()))
union all select 'tables_public', (select count(*)::text from pg_tables where schemaname='public')
union all select 'tables_tous_schemas', (select count(*)::text from pg_tables where schemaname not in ('pg_catalog','information_schema'))
union all select 'vues', (select count(*)::text from pg_views where schemaname not in ('pg_catalog','information_schema'))
union all select 'fonctions_public', (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')
union all select 'fonctions_tous_schemas', (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname not in ('pg_catalog','information_schema'))
union all select 'extensions', (select count(*)::text from pg_extension)
union all select 'cron_jobs_actifs', (select count(*)::text from cron.job where active)
union all select 'cron_jobs_total', (select count(*)::text from cron.job)
union all select 'roles', (select count(*)::text from pg_roles)
union all select 'policies_rls', (select count(*)::text from pg_policies)
union all select 'triggers', (select count(*)::text from pg_trigger where not tgisinternal)
union all select 'index_total', (select count(*)::text from pg_indexes where schemaname not in ('pg_catalog','information_schema'))
union all select 'slots_replication', (select count(*)::text from pg_replication_slots)
union all select 'publications', (select count(*)::text from pg_publication)
union all select 'transactions_preparees', (select count(*)::text from pg_prepared_xacts)
union all select 'roles_md5', (select count(*)::text from pg_shadow where passwd like 'md5%')
order by 1;
select extname, extversion from pg_extension order by 1;
select 'tables protegees' as bloc, schemaname||'.'||relname as relation, to_char(n_live_tup, 'FM999G999G999') as lignes_estimees
  from pg_stat_user_tables
 where relname in ('auto_marque','auto_modele','auto_type','pieces','pieces_gamme','pieces_relation_type',
                   'pieces_relation_criteria','pieces_criteria','pieces_ref_search','pieces_ref_oem','pieces_media_img')
 order by schemaname, relname;
