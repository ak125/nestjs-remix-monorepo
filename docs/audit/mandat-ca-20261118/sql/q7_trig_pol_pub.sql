select 'trigger', c.relname, t.tgname||':'||p.proname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and not t.tgisinternal and not c.relispartition
union all select 'policy', tablename, policyname from pg_policies where schemaname='public'
union all select 'publication', tablename, pubname from pg_publication_tables where schemaname='public'
order by 1,2;
