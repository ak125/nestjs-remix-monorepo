-- Mandat DM — variantes de la règle « position ≤ 10 » pour les impressions R2 du point 3. Lecture seule.
with c as (
  select page, query, sum(clicks) clk, sum(impressions) impr, sum(position*impressions)/nullif(sum(impressions),0) pos
  from __seo_gsc_daily where date between date '2026-04-01' and date '2026-11-16'
    and page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$' group by 1,2
)
select sum(impr) filter (where pos<=10) pond_le10, sum(impr) filter (where round(pos::numeric,1)<=10) arrondi1_le10,
       sum(impr) filter (where pos<10.5) lt10_5, sum(impr) filter (where round(pos::numeric)<=10) arrondi0_le10 from c;
with r as (select page, query, impressions, position from __seo_gsc_daily where date between date '2026-04-01' and date '2026-11-16'
    and page ~ '/pieces/[^/]+/[^/]+/[^/]+/[^/]+\.html$')
select sum(impressions) filter (where position<=10) ligne_jour_le10 from r;
