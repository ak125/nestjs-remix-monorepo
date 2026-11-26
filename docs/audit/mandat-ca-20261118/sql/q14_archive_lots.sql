select now() at time zone 'utc' as measured_utc;
select n.nspname, c.relname, c.relkind, pg_total_relation_size(c.oid) as bytes
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='_archive' and c.relkind in ('r','v','m','p') order by 2;
select nspname from pg_namespace where nspname like 'tecdoc%' order by 1;
select indexrelid::regclass::text as idx from pg_index i join pg_class c on c.oid=i.indrelid where c.relname='pieces_price' and c.relnamespace='public'::regnamespace order by 1;
select jobid, jobname from cron.job where jobname like '%soft-404%';
