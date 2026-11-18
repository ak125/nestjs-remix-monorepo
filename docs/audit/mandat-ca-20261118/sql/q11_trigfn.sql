select distinct p.proname from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal;
