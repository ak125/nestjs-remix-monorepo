-- Search Console, pages R8 /constructeurs/renault-140/clio-iii*/…-<type_id>.html, 2026-06-01 → 2026-11-17 (toute la profondeur en base).
with t(type_id) as (values ('26627'),('30141'),('19051'),('34744'),('28839'),('19052'),('34746'),('20078'),('19053'),
  ('34749'),('23455'),('34745'),('23456'),('34747'),('23457'),('23458'),('77069'),('77070'))
select t.type_id, regexp_replace(p.page,'^https?://[^/]+','') page,
  coalesce(sum(p.impressions),0) impressions, coalesce(sum(p.clicks),0) clics,
  round((sum(p.impressions*p.position)/nullif(sum(p.impressions),0))::numeric,1) position_moy,
  count(distinct p.date) jours
from t left join __seo_gsc_daily_page_totals p
  on p.page ~ ('/constructeurs/renault-140/clio-iii[a-z0-9-]*/[a-z0-9-]+-'||t.type_id||'\.html$')
group by 1,2 order by 3 desc nulls last;
