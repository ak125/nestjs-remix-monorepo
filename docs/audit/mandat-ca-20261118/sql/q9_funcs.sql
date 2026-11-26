select n.nspname||'.'||p.proname||'#'||p.oid as fn, replace(replace(p.prosrc,E'\n',' '),E'\r',' ') src
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
left join pg_depend d on d.objid=p.oid and d.deptype='e'
where n.nspname not in ('pg_catalog','information_schema','extensions','graphql','graphql_public','pgsodium','vault','realtime','storage','auth','cron','net','supabase_functions','pgbouncer','pgmq','_realtime') and d.objid is null;
