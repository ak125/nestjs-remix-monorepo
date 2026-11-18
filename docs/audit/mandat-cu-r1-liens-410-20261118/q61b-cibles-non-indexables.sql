\pset footer off
select 'heure_utc', now() at time zone 'utc';
with l as (
  select sg.sg_pg_id pg, (m)[1] tgt, (m)[2] lbl
  from __seo_gamme sg, regexp_matches(sg.sg_content, '<a\s[^>]*?href="/pieces/([^"/?#]*)"[^>]*>(.*?)</a>', 'gi') m
), c as (
  select l.*, regexp_replace(regexp_replace(lower(tgt), '/$', ''), '\.html$','') alias,
         substring(tgt || ' ' || lbl from '#LinkGamme_([0-9]+)#') tok
  from l where tgt !~ '-[0-9]+\.html$'
), r as (
  select c.*, (select count(*) from pieces_gamme g where
      (c.tok is not null and g.pg_id::text = c.tok) or (c.tok is null and g.pg_alias = c.alias)) n_all,
     (select count(*) from pieces_gamme g where
      ((c.tok is not null and g.pg_id::text = c.tok) or (c.tok is null and g.pg_alias = c.alias))
      and g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1') n_idx
  from c
)
select pg, tgt, tok, n_all, n_idx, (select string_agg(pg_id||':d'||pg_display||':r'||pg_relfollow||':l'||pg_level, ',') from pieces_gamme g where (r.tok is not null and g.pg_id::text=r.tok) or (r.tok is null and g.pg_alias=r.alias)) etat from r where n_idx<>1 order by tgt;
