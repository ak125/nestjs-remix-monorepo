-- Mandat DM 6.5 — reconstitution de la liste AK (#2087 §1.a) : pages /pieces/ avec >= 1 clic du 2026-07-01
-- au 2026-07-31 et 0 clic du 2026-10-01 au 2026-10-31, grain page (__seo_gsc_daily_page_totals),
-- chemin normalisé (hôte retiré). Lecture seule.
with p as (
  select regexp_replace(page,'^https?://[^/]+','') path,
         sum(clicks) filter (where date between '2026-07-01' and '2026-07-31') c_jul,
         sum(impressions) filter (where date between '2026-07-01' and '2026-07-31') i_jul,
         sum(clicks) filter (where date between '2026-10-01' and '2026-10-31') c_oct,
         sum(impressions) filter (where date between '2026-10-01' and '2026-10-31') i_oct
  from __seo_gsc_daily_page_totals
  where page ~ '^https?://[^/]+/pieces/' and date between '2026-07-01' and '2026-10-31'
  group by 1)
select path, c_jul, i_jul, coalesce(c_oct,0) c_oct, coalesce(i_oct,0) i_oct
from p where coalesce(c_jul,0) >= 1 and coalesce(c_oct,0) = 0 order by path;
