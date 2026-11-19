-- Mandat DG, point 3 — exemples cités par le pilotage, 31 jours (2026-10-17 → 2026-11-16), position pondérée par type de page.
select query,
  sum(impressions) filter (where page ~ '/blog-pieces-auto/conseils/') imp_conseil,
  round((sum(position*impressions) filter (where page ~ '/blog-pieces-auto/conseils/') / nullif(sum(impressions) filter (where page ~ '/blog-pieces-auto/conseils/'),0))::numeric,1) pos_conseil,
  sum(impressions) filter (where page ~ '/pieces/[a-z0-9-]+-[0-9]+\.html$') imp_r1,
  round((sum(position*impressions) filter (where page ~ '/pieces/[a-z0-9-]+-[0-9]+\.html$') / nullif(sum(impressions) filter (where page ~ '/pieces/[a-z0-9-]+-[0-9]+\.html$'),0))::numeric,1) pos_r1
from __seo_gsc_daily
where date between '2026-10-17' and '2026-11-16'
  and query in ('arbre a came','corps papillon','colonne de direction','cable d''embrayage','joint cache culbuteur','alternateur','support moteur')
group by 1 order by 1;
