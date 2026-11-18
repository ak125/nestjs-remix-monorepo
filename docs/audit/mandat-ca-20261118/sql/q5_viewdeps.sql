select distinct tc.relname as table_name, vn.nspname||'.'||vc.relname as dependent, vc.relkind::text kind
from pg_depend d join pg_rewrite r on r.oid=d.objid
join pg_class vc on vc.oid=r.ev_class join pg_namespace vn on vn.oid=vc.relnamespace
join pg_class tc on tc.oid=d.refobjid join pg_namespace tn on tn.oid=tc.relnamespace
where d.classid='pg_rewrite'::regclass and tn.nspname='public' and tc.relkind in ('r','p') and vc.oid<>tc.oid
order by 1,2;
