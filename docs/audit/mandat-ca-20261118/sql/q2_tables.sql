-- q2
with t as (
  select c.oid, c.relname, c.relkind::text as relkind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p') and not c.relispartition
),
parts as (
  select i.inhparent as parent, c.oid as child, c.relname, pg_get_expr(c.relpartbound,c.oid) as bound,
         pg_total_relation_size(c.oid) as sz, c.reltuples, coalesce(s.n_live_tup,0) n_live_tup,
         coalesce(s.seq_scan,0) seq_scan, coalesce(s.idx_scan,0) idx_scan,
         coalesce(s.n_tup_ins,0) ins, coalesce(s.n_tup_upd,0) upd, coalesce(s.n_tup_del,0) del,
         greatest(s.last_autoanalyze,s.last_analyze,s.last_autovacuum,s.last_vacuum) last_maint
  from pg_inherits i join pg_class c on c.oid=i.inhrelid
  left join pg_stat_user_tables s on s.relid=c.oid
),
agg as (
  select parent, count(*) nparts, sum(sz) sz, sum(greatest(reltuples,0)) reltuples, sum(n_live_tup) n_live,
         sum(seq_scan) seq_scan, sum(idx_scan) idx_scan, sum(ins) ins, sum(upd) upd, sum(del) del, max(last_maint) last_maint,
         count(*) filter (where n_live_tup=0 and sz <= 65536) nparts_empty_est
  from parts group by parent
)
select t.relname, t.relkind,
  coalesce(a.nparts,0) nparts,
  coalesce(a.sz, pg_total_relation_size(t.oid)) total_bytes,
  round(coalesce(a.reltuples, greatest(c.reltuples,0)))::bigint reltuples,
  coalesce(a.n_live, s.n_live_tup,0) n_live_tup,
  coalesce(a.seq_scan, s.seq_scan,0) seq_scan,
  coalesce(a.idx_scan, s.idx_scan,0) idx_scan,
  coalesce(a.ins, s.n_tup_ins,0) n_tup_ins,
  coalesce(a.upd, s.n_tup_upd,0) n_tup_upd,
  coalesce(a.del, s.n_tup_del,0) n_tup_del,
  coalesce(a.last_maint, greatest(s.last_autoanalyze,s.last_analyze,s.last_autovacuum,s.last_vacuum)) last_maint,
  s.last_seq_scan, s.last_idx_scan,
  coalesce(a.nparts_empty_est,0) nparts_empty_est,
  replace(replace(coalesce(obj_description(t.oid,'pg_class'),''),E'\n',' '),'"','''') as comment
from t join pg_class c on c.oid=t.oid
left join pg_stat_user_tables s on s.relid=t.oid
left join agg a on a.parent=t.oid
order by 1
;
