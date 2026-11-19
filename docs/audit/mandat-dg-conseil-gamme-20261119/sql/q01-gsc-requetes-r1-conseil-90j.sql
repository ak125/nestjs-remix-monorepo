-- Mandat DG, 6.1 — requêtes GSC des pages R1 et conseil, 90 jours (2026-08-19 → 2026-11-16).
-- Agrégé tous appareils. Position = moyenne pondérée par les impressions (somme position×impressions / impressions).
-- Type de page : R1 = /pieces/<alias>-<id>.html ; conseil = /blog-pieces-auto/conseils/<alias> (sans sous-chemin).
with g as (
  select page, query, clicks, impressions, position
  from __seo_gsc_daily
  where date between '2026-08-19' and '2026-11-16'
), t as (
  select
    case when page ~ '^https://www\.automecanik\.com/pieces/[a-z0-9-]+-[0-9]+\.html$' then 'R1'
         when page ~ '^https://www\.automecanik\.com/blog-pieces-auto/conseils/[a-z0-9-]+$' then 'conseil' end as ptype,
    page, query, clicks, impressions, position
  from g
)
select ptype,
       case when ptype='R1' then substring(page from '-([0-9]+)\.html$')::int
            else (select min(pg_id) from pieces_gamme pg where pg.pg_alias = substring(t.page from '/conseils/([a-z0-9-]+)$')) end as pg_id,
       page, query, sum(clicks) clicks, sum(impressions) impressions,
       round((sum(position*impressions)/nullif(sum(impressions),0))::numeric,2) pos
from t where ptype is not null
group by 1,2,3,4;
