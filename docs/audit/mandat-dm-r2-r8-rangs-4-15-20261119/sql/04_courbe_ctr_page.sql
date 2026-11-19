-- Mandat DM — courbe de taux de clic au grain page (lignes jour × page), pages R2 + R8, 2026-06-01 → dernière date.
select least(round(position)::int,21) rang, sum(impressions) impr, sum(clicks) clics
from __seo_gsc_daily_page_totals
where date >= date '2026-06-01'
  and (page ~ '^https?://[^/]+/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$'
    or page ~ '^https?://[^/]+/constructeurs/[^/]+/[^/]+/[^/]+\.html$')
group by 1 order by 1;
