-- Mandat DM — grain page fidèle (__seo_gsc_daily_page_totals, agrégation byPage, sans dimension requête).
-- (a) totaux par page R2/R8 sur 90 j et 28 j ; (b) courbe de taux de clic au grain page.
with params as (select (select max(date) from __seo_gsc_daily_page_totals) d_max),
w as (select '90j'::text win, d_max-89 d_from, d_max d_to from params
      union all select '28j', d_max-27, d_max from params)
select w.win,
       case when t.page ~ '/pieces/' then 'R2' else 'R8' end role,
       regexp_replace(t.page,'^https?://[^/]+','') path,
       sum(t.impressions) impr_page, sum(t.clicks) clics_page,
       round((sum(t.position*t.impressions)/nullif(sum(t.impressions),0))::numeric,2) pos_page
from __seo_gsc_daily_page_totals t join w on t.date between w.d_from and w.d_to
where t.page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$'
   or t.page ~ '^https?://[^/]+/constructeurs/[^/]+/[^/]+/[^/]+\.html$'
group by 1,2,3 order by 1,2,3;
