select 'releve_utc', (now() at time zone 'utc')::text;
select 'stats_reset_db', coalesce(stats_reset::text,'NULL') from pg_stat_database where datname=current_database();
select 'stats_reset_bgwriter', coalesce(stats_reset::text,'NULL') from pg_stat_bgwriter;
select 'stats_reset_wal', coalesce(stats_reset::text,'NULL') from pg_stat_wal;
select 'stats_reset_io_min', coalesce(min(stats_reset)::text,'NULL') from pg_stat_io;
select 'postmaster_start', pg_postmaster_start_time()::text;
select 'db_size_bytes', pg_database_size(current_database())::text;
select 'ns_'||n.nspname||'_relkind_'||c.relkind::text||case when c.relispartition then '_partition' else '' end, count(*)::text||' / '||pg_size_pretty(sum(pg_total_relation_size(c.oid)))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname not in ('pg_catalog','information_schema','pg_toast') and c.relkind in ('r','p','v','m','f')
group by 1 order by 1;
