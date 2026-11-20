-- Complément n° 13 au mandat DS : Core Web Vitals de terrain (RUM du site) des pages R8. SELECT seulement.
-- 1. Échantillons bruts des deux pages Clio III 1.5 dCi (19052, 19051), toute la rétention de __seo_cwv_raw.
select metric, device, count(*) n, round(percentile_cont(0.75) within group (order by value)::numeric, 3) p75,
       min(received_at)::date du, max(received_at)::date au
from __seo_cwv_raw
where url like '%/constructeurs/renault-140/clio-iii-140004/1-5-dci-19052%'
   or url like '%/constructeurs/renault-140/clio-iii-140004/1-5-dci-19051%'
group by 1, 2 order by 1, 2;
-- 2. Groupe de routes r8_vehicle (toutes les fiches véhicule), p75 exact sur les échantillons bruts conservés.
select metric, device, count(*) n, round(percentile_cont(0.75) within group (order by value)::numeric, 3) p75,
       min(received_at)::date du, max(received_at)::date au
from __seo_cwv_raw
where route_group = 'r8_vehicle' and metric in ('LCP', 'CLS', 'INP')
group by 1, 2 order by 1, 2;
-- 3. Agrégat quotidien r8_vehicle sur 28 jours : échantillons et p75 quotidien (min / médiane / max des jours).
select device, metric, sum(sample_count) n, count(*) jours,
       round(min(p75_value)::numeric, 3) p75_jour_min,
       round(percentile_cont(0.5) within group (order by p75_value)::numeric, 3) p75_jour_median,
       round(max(p75_value)::numeric, 3) p75_jour_max, min(date) du, max(date) au
from __seo_cwv_daily_rum
where date >= date '2026-10-23' and route_group = 'r8_vehicle' and metric in ('LCP', 'CLS', 'INP')
group by 1, 2 order by 1, 2;
