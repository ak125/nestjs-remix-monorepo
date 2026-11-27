-- Mandat EN — formes des requêtes Search Console sur les pages R2
-- (gamme × véhicule), fenêtres 90 et 28 jours avant la dernière date chargée.
-- Lecture seule (sweep-psql.sh : transaction unique en read only).
--   cylindree : nombre décimal type 1.6 / 2,0
--   puissance : nombre suivi de ch / cv / hp / kw
--   version   : un mot alphabétique (≥ 2 lettres) du segment type de l'URL
--               (ex. « hdi », « cooper », « tdi ») présent dans la requête
--   annee     : 19xx / 20xx
\pset footer off
WITH bornes AS (SELECT max(date) AS fin FROM __seo_gsc_daily),
r2 AS (
  SELECT g.query, g.page, g.date, g.clicks, g.impressions,
         lower(substring(g.page from '/pieces/[^/]+/[^/]+/[^/]+/([^/]+)-[0-9]+\.html$')) AS type_slug
  FROM __seo_gsc_daily g, bornes b
  WHERE g.date > b.fin - 90
    AND g.page ~ '/pieces/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+\.html$'
),
formes AS (
  SELECT r.*, (r.date > b.fin - 28) AS f28,
    r.query ~ '(^|[^0-9])[0-9][.,][0-9]([^0-9]|$)' AS cylindree,
    r.query ~* '[0-9]{2,3} ?(ch|cv|hp|kw)\M' AS puissance,
    EXISTS (
      SELECT 1 FROM unnest(regexp_split_to_array(r.type_slug, '-')) t(m)
      WHERE m ~ '^[a-z]{2,}$' AND r.query ~* ('\m' || m || '\M')
    ) AS version,
    r.query ~ '\m(19|20)[0-9]{2}\M' AS annee
  FROM r2 r, bornes b
)
SELECT fenetre, cylindree, puissance, version,
       count(DISTINCT query) AS requetes, sum(impressions) AS impressions,
       sum(clicks) AS clics,
       round(100.0 * sum(impressions) / sum(sum(impressions)) OVER (PARTITION BY fenetre), 1) AS pct_impr
FROM (
  SELECT '90j' AS fenetre, * FROM formes
  UNION ALL
  SELECT '28j', * FROM formes WHERE f28
) x
GROUP BY 1, 2, 3, 4
ORDER BY 1 DESC, impressions DESC;

-- Bornes et volumes
WITH bornes AS (SELECT max(date) AS fin FROM __seo_gsc_daily)
SELECT b.fin - 89 AS debut_90j, b.fin - 27 AS debut_28j, b.fin AS fin,
       count(DISTINCT g.page) AS pages_r2, count(DISTINCT g.query) AS requetes,
       sum(g.impressions) AS impressions, sum(g.clicks) AS clics
FROM __seo_gsc_daily g, bornes b
WHERE g.date > b.fin - 90
  AND g.page ~ '/pieces/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+\.html$'
GROUP BY b.fin;

-- 40 requêtes les plus tapées (impressions 90 j) sur les pages R2
WITH bornes AS (SELECT max(date) AS fin FROM __seo_gsc_daily)
SELECT g.query, sum(g.impressions) AS impressions, sum(g.clicks) AS clics,
       round(avg(g.position)::numeric, 1) AS position_moy, count(DISTINCT g.page) AS pages
FROM __seo_gsc_daily g, bornes b
WHERE g.date > b.fin - 90
  AND g.page ~ '/pieces/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+/[^/]+-[0-9]+\.html$'
GROUP BY g.query
ORDER BY impressions DESC
LIMIT 40;
