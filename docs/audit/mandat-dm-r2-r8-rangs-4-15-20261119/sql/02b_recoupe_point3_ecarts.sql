-- Mandat DM — explication des écarts au point 3 (R8, impressions R2 pos<=10) et exemples. Lecture seule.
with c as (
  select regexp_replace(page,'^https?://[^/]+','') path, query, sum(clicks) clk, sum(impressions) impr,
         sum(position*impressions)/nullif(sum(impressions),0) pos
  from __seo_gsc_daily where date between date '2026-04-01' and date '2026-11-16' group by 1,2
)
select case when path ~ '^/constructeurs/[^/]+/[^/]+/[^/]+\.html$' then 'R8 (3 segments)'
            when path ~ '^/constructeurs/[^/]+/[^/]+\.html$' then 'constructeurs 2 segments (R7)'
            when path ~ '^/constructeurs/[^/]+\.html$' then 'constructeurs 1 segment'
            when path ~ '^/constructeurs' then 'constructeurs autre' end as forme,
       count(*) n_couples, count(*) filter (where clk>0) n_couples_clic, sum(clk) clics,
       count(*) filter (where clk>0 and pos<=10) couples_clic_pos_le10, sum(clk) filter (where pos<=10) clics_pos_le10
from c where path like '/constructeurs%' group by 1 order by 1;
with c as (
  select regexp_replace(page,'^https?://[^/]+','') path, query, sum(clicks) clk, sum(impressions) impr,
         round((sum(position*impressions)/nullif(sum(impressions),0))::numeric,1) pos
  from __seo_gsc_daily where date between date '2026-04-01' and date '2026-11-16'
   and query in ('courroie climatiseur clio 4 1.2 16v','poulie vilebrequin 1.5 dci','thermostat 207 1.6 hdi',
                 'courroie alternateur symbol 1.2 16v','moteur express 1.6 diesel','pièce mercedes classe c 220 cdi')
  group by 1,2
) select query, path, clk, impr, pos from c where clk>0 order by query, clk desc;
