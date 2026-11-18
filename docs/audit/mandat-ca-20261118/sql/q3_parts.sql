select p.relname parent, c.relname part, pg_get_expr(c.relpartbound,c.oid) bound, pg_total_relation_size(c.oid) bytes,
       coalesce(s.n_live_tup,0) n_live, coalesce(s.n_tup_ins,0) ins, greatest(c.reltuples,0)::bigint reltuples,
       pt.partstrat, pg_get_partkeydef(p.oid) partkey
from pg_inherits i join pg_class c on c.oid=i.inhrelid join pg_class p on p.oid=i.inhparent
join pg_namespace n on n.oid=p.relnamespace join pg_partitioned_table pt on pt.partrelid=p.oid
left join pg_stat_user_tables s on s.relid=c.oid
where n.nspname='public' order by 1,2;
