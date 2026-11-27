-- Mandat DM — recoupe des chiffres du point 3 du mandat (pilotage, 19 nov. 12:00–12:25 UTC).
-- Couples page × requête, 2026-04-01 → dernière date, SANS aucun filtre (ni ai, ni marque).
with c as (
  select case when page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' then 'R2'
              when page ~ '/constructeurs/[^/]+/[^/]+/[^/]+\.html$' then 'R8' else 'autre' end role,
         page, query, sum(clicks) clk, sum(impressions) impr,
         sum(position*impressions)/nullif(sum(impressions),0) pos
  from __seo_gsc_daily where date between date '2026-04-01' and (select max(date) from __seo_gsc_daily)
  group by 1,2,3
)
select role, count(*) n_couples, count(*) filter (where clk>0) n_couples_clic, sum(clk) clics, sum(impr) impr,
       sum(clk) filter (where pos<=10) clics_pos_le10, sum(impr) filter (where pos<=10 and clk>0) impr_pos_le10_couples_clic,
       sum(impr) filter (where pos<=10) impr_pos_le10
from c group by 1 order by 1;
