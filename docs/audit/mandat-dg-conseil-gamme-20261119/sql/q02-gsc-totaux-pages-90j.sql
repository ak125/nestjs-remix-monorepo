-- Mandat DG, 6.1 — totaux par page (dimension page seule, inclut les requêtes anonymisées), même fenêtre.
select page, sum(clicks) clicks, sum(impressions) impressions,
       round((sum(position*impressions)/nullif(sum(impressions),0))::numeric,2) pos
from __seo_gsc_daily_page_totals
where date between '2026-08-19' and '2026-11-16'
  and (page ~ '^https://www\.automecanik\.com/pieces/[a-z0-9-]+-[0-9]+\.html$'
    or page ~ '^https://www\.automecanik\.com/blog-pieces-auto/conseils/[a-z0-9-]+$')
group by 1;
