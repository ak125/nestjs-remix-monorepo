\pset footer off
select 'heure_utc', now() at time zone 'utc';
-- A. sg_content : liens /pieces/<cible> sans identifiant (cible sans '/' qui ne finit pas par -<id>.html)
with l as (
  select sg.sg_pg_id pg, (m)[1] tgt
  from __seo_gamme sg, regexp_matches(sg.sg_content, 'href=["'']/pieces/([^"''/?#]*)["'']', 'gi') m
)
select 'A_sg_content', count(*) liens, count(distinct pg) gammes,
       count(*) filter (where g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1') liens_sur_r1_indexees,
       count(distinct pg) filter (where g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1') gammes_indexees,
       count(distinct tgt) cibles_distinctes
from l join pieces_gamme g on g.pg_id::text = l.pg
where tgt !~ '-[0-9]+\.html$';
