\pset footer off
select 'heure_utc', now() at time zone 'utc';
-- liens déjà canoniques dans sg_content : alias à jour ? cible indexable ?
with l as (
  select sg.sg_pg_id pg, (m)[1] alias, (m)[2]::int id
  from __seo_gamme sg, regexp_matches(sg.sg_content, 'href="/pieces/([a-z0-9-]+)-([0-9]+)\.html"', 'g') m
)
select 'canoniques', count(*) total,
  count(*) filter (where g.pg_id is null) id_inconnu,
  count(*) filter (where g.pg_alias = l.alias and g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1') intacts,
  count(*) filter (where g.pg_alias <> l.alias and g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1') alias_remis,
  count(*) filter (where not (g.pg_display='1' and g.pg_relfollow='1' and g.pg_level='1')) non_indexables
from l left join pieces_gamme g on g.pg_id = l.id;
-- liens #LinkGamme_ en clair restant dans sg_content
select 'jetons_LinkGamme_sg_content', count(*) from __seo_gamme sg, regexp_matches(sg.sg_content, '#LinkGamme_[0-9]+#', 'g') m;
-- autres champs
select '__seo_gamme_conseil.sgc_content', count(*) from __seo_gamme_conseil t, regexp_matches(t.sgc_content, 'href=["'']/pieces/([^"''/?#]*)["'']', 'gi') m where (m)[1] !~ '-[0-9]+\.html$';
select '__seo_gamme_info.sgi_content', count(*) from __seo_gamme_info t, regexp_matches(t.sgi_content, 'href=["'']/pieces/([^"''/?#]*)["'']', 'gi') m where (m)[1] !~ '-[0-9]+\.html$';
select '__seo_gamme.sg_descrip+sg_title+sg_h1', count(*) from __seo_gamme t, regexp_matches(coalesce(t.sg_descrip,'')||coalesce(t.sg_h1,'')||coalesce(t.sg_title,''), 'href=["'']/pieces/([^"''/?#]*)["'']', 'gi') m where (m)[1] !~ '-[0-9]+\.html$';
