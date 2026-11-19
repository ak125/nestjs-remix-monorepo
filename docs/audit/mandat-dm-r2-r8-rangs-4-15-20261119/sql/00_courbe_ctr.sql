-- Mandat DM — courbe de taux de clic du site, par rang arrondi (lignes jour × page × requête × appareil).
-- Périmètre retenu pour la courbe de référence : pages R2 + R8, requêtes de 3 mots ou plus,
-- du 2026-04-01 à la dernière date en base ; ^ai[0-9]+$ et requêtes de marque exclues.
-- Les portées 'tout_3mots' et 'tout' servent de sensibilité.
with r as (
  select regexp_replace(page,'^https?://[^/]+','') path, query, device, clicks, impressions, position
  from __seo_gsc_daily
  where date between date '2026-04-01' and (select max(date) from __seo_gsc_daily)
    and query !~ '^ai[0-9]+$' and query !~* '(automecani|auto mecanik|site:)'
), x as (
  select 'r2r8_3mots' scope, device, least(round(position)::int,21) b, clicks, impressions from r
   where array_length(regexp_split_to_array(trim(query),'\s+'),1)>=3
     and (path ~ '^/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' or path ~ '^/constructeurs/[^/]+/[^/]+/[^/]+\.html$')
  union all
  select 'tout_3mots', device, least(round(position)::int,21), clicks, impressions from r
   where array_length(regexp_split_to_array(trim(query),'\s+'),1)>=3
  union all
  select 'tout', device, least(round(position)::int,21), clicks, impressions from r
)
select scope, device, b as rang, sum(impressions) impr, sum(clicks) clics
from x group by 1,2,3 order by 1,2,3;
