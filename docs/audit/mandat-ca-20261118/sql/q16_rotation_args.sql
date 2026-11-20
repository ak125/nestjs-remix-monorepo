select now() at time zone 'utc' as measured_utc;
select p.oid::regprocedure::text as fn, pg_get_function_arguments(p.oid) as args
from pg_proc p where p.pronamespace='public'::regnamespace
and p.proname ~ '(maintain_.*partitions|ensure_.*partition)' order by 1;
