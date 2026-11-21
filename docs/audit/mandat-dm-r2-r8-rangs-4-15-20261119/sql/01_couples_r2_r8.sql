-- Mandat DM — extraction des couples page × requête R2 et R8, par fenêtre.
-- Source : public.__seo_gsc_daily (requêtes nommées par Google seulement).
-- Lecture seule. Fenêtres ancrées sur la dernière date en base (2026-11-16).
-- Filtres : requêtes ^ai[0-9]+$ (identifiants internes, non humains) et requêtes
-- de marque (automecani|auto mecanik|site:) exclues.
with params as (
  select (select max(date) from __seo_gsc_daily) as d_max
), w as (
  select '90j'::text as win, d_max - 89 as d_from, d_max as d_to from params
  union all select '28j', d_max - 27, d_max from params
  union all select 'avr-nov', date '2026-04-01', d_max from params
), r as (
  select w.win,
         regexp_replace(g.page,'^https?://[^/]+','') as path,
         g.query, g.device, g.clicks, g.impressions, g.position
  from __seo_gsc_daily g
  join w on g.date between w.d_from and w.d_to
  where g.query !~ '^ai[0-9]+$'
    and g.query !~* '(automecani|auto mecanik|site:)'
    and (g.page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$'
      or g.page ~ '^https?://[^/]+/constructeurs/[^/]+/[^/]+/[^/]+\.html$')
)
select win,
       case when path like '/pieces/%' then 'R2' else 'R8' end as role,
       path, query,
       array_length(regexp_split_to_array(trim(query),'\s+'),1) as n_mots,
       sum(impressions) as impr,
       sum(clicks) as clics,
       round((sum(position*impressions)/nullif(sum(impressions),0))::numeric,2) as pos,
       sum(impressions) filter (where device='desktop') as impr_desk,
       sum(clicks) filter (where device='desktop') as clics_desk,
       round((sum(position*impressions) filter (where device='desktop')
             / nullif(sum(impressions) filter (where device='desktop'),0))::numeric,2) as pos_desk,
       sum(impressions) filter (where device='mobile') as impr_mob,
       sum(clicks) filter (where device='mobile') as clics_mob,
       round((sum(position*impressions) filter (where device='mobile')
             / nullif(sum(impressions) filter (where device='mobile'),0))::numeric,2) as pos_mob,
       count(distinct device) filter (where device in ('desktop','mobile')) as n_app
from r
group by 1,2,3,4
order by 1,2,3,4;
