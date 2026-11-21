-- Mandat DG, point 3 — recoupement des chiffres du pilotage : 31 jours, 2026-10-17 → 2026-11-16.
-- Variante A : requête partagée avec n'importe quelle page conseil ; variante B : avec la page conseil de la même gamme.
with t as (
  select case when page ~ '^https://www\.automecanik\.com/pieces/[a-z0-9-]+-[0-9]+\.html$' then 'R1'
              when page ~ '^https://www\.automecanik\.com/blog-pieces-auto/conseils/' then 'conseil' end ptype,
         page, query, impressions, position
  from __seo_gsc_daily where date between '2026-10-17' and '2026-11-16'
), q as (
  select ptype, query, sum(impressions) imp, sum(position*impressions)/nullif(sum(impressions),0) pos
  from t where ptype is not null group by 1,2
), r1 as (select * from q where ptype='R1'), co as (select * from q where ptype='conseil')
select 'A_any' variante,
  (select count(*) from r1) r1_requetes,
  count(*) partagees,
  count(*) filter (where co.pos < r1.pos) conseil_devant,
  count(*) filter (where r1.pos < co.pos) r1_devant,
  count(*) filter (where r1.pos = co.pos) egal
from r1 join co using (query);
