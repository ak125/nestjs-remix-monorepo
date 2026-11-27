-- Mandat EN — complément de 10 : puissance tapée sans unité (« 1.6 hdi 110 »).
-- puissance_type : la puissance (ch) du type de la page apparaît comme mot
-- isolé dans la requête, avec ou sans « ch/cv ». Lecture seule.
\pset footer off
WITH bornes AS (SELECT max(date) AS fin FROM __seo_gsc_daily),
r2 AS (
  SELECT g.query, g.date, g.clicks, g.impressions,
         substring(g.page from '-([0-9]+)\.html$') AS type_id
  FROM __seo_gsc_daily g, bornes b
  WHERE g.date > b.fin - 90
    AND g.page ~ '/pieces/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+\.html$'
),
f AS (
  SELECT r.*, (r.date > b.fin - 28) AS f28,
         (t.type_power_ps ~ '^[0-9]{2,3}$' AND r.query ~ ('\m' || t.type_power_ps || '\M')) AS puissance_type,
         r.query ~* '[0-9]{2,3} ?(ch|cv|hp|kw)\M' AS puissance_unite
  FROM r2 r JOIN auto_type t ON t.type_id = r.type_id, bornes b
)
SELECT fenetre, puissance_type, puissance_unite, count(DISTINCT query) AS requetes,
       sum(impressions) AS impressions, sum(clicks) AS clics,
       round(100.0 * sum(impressions) / sum(sum(impressions)) OVER (PARTITION BY fenetre), 1) AS pct_impr
FROM (SELECT '90j' AS fenetre, * FROM f UNION ALL SELECT '28j', * FROM f WHERE f28) x
GROUP BY 1, 2, 3 ORDER BY 1 DESC, 5 DESC;
