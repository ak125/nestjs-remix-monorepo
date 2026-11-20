\echo == Q8a couverture des tables GSC (min/max date)
select 'daily' t, min(date), max(date), max(fetched_at) from __seo_gsc_daily
union all select 'page_totals', min(date), max(date), max(fetched_at) from __seo_gsc_daily_page_totals;
\echo == Q8b page R1 filtre-a-huile-7 : totaux par mois (page_totals)
select date_trunc('month',date)::date m, sum(clicks) clics, sum(impressions) impr, round(avg(position)::numeric,1) pos_moy
from __seo_gsc_daily_page_totals where page like '%/pieces/filtre-a-huile-7.html' group by 1 order by 1;
\echo == Q8c pages R2 filtre-a-huile-7 x Clio III (toutes motorisations) depuis 2026-06-01
select page, sum(clicks) clics, sum(impressions) impr, round(avg(position)::numeric,1) pos
from __seo_gsc_daily_page_totals where page like '%/pieces/filtre-a-huile-7/renault-140/clio-iii%' group by 1 order by impr desc;
\echo == Q8d toutes pages R2 filtre-a-huile-7 : nb de pages avec impressions, clics
select count(distinct page) pages, sum(clicks) clics, sum(impressions) impr from __seo_gsc_daily_page_totals where page like '%/pieces/filtre-a-huile-7/%';
\echo == Q8e requetes GSC contenant filtre + huile + clio (toutes pages)
select query, sum(clicks) clics, sum(impressions) impr, round(avg(position)::numeric,1) pos, count(distinct page) pages
from __seo_gsc_daily where query ~* 'filtre.*huile' and query ~* 'clio' group by 1 order by impr desc limit 25;
\echo == Q8f top 20 requetes GSC filtre a huile (toutes pages)
select query, sum(clicks) clics, sum(impressions) impr, round(avg(position)::numeric,1) pos
from __seo_gsc_daily where query ~* 'filtre.*huile' group by 1 order by impr desc limit 20;
\echo == Q8g requetes GSC menant a la page R1 filtre-a-huile-7
select query, sum(clicks) clics, sum(impressions) impr, round(avg(position)::numeric,1) pos
from __seo_gsc_daily where page like '%/pieces/filtre-a-huile-7.html' group by 1 order by impr desc limit 20;
