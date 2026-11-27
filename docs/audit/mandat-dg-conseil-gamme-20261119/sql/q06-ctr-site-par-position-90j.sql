-- Mandat DG, 6.2 — courbe de taux de clic du site par position (référence « attendue » interne).
-- Couples page × requête agrégés sur 90 jours (2026-08-19 → 2026-11-16), requêtes synthétiques ^ai\d+$ exclues,
-- position pondérée par impressions puis arrondie (1 à 10). Deux courbes : site entier, et site hors pages conseil.
with pq as (
  select page, query, sum(clicks) c, sum(impressions) i, sum(position*impressions)/nullif(sum(impressions),0) p
  from __seo_gsc_daily
  where date between '2026-08-19' and '2026-11-16' and query !~ '^ai[0-9]+$'
  group by 1,2
)
select round(p)::int pos_arrondie,
       count(*) couples, sum(i) impressions, sum(c) clics,
       round(sum(c)::numeric/nullif(sum(i),0),4) ctr_site,
       round((sum(c) filter (where page !~ '/blog-pieces-auto/conseils/'))::numeric/nullif(sum(i) filter (where page !~ '/blog-pieces-auto/conseils/'),0),4) ctr_hors_conseil,
       sum(i) filter (where page !~ '/blog-pieces-auto/conseils/') imp_hors_conseil
from pq where p >= 0.5 and p < 10.5
group by 1 order by 1;
