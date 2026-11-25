-- Mandat DW, complément 1 : mesure avant/après du nouveau titre R2, toutes
-- gammes. Lecture seule, aucune écriture. Usage :
--   psql ... -v d0=AAAA-MM-JJ -f avant-apres-ctr-titre-r2.sql
-- d0 = date d'application de la migration 20261119_seo_r2_title_all_gammes
--      (après le tag PROD qui sert le code ; voir README, ordre de déploiement).
--
-- Périmètre : pages R2 /pieces/<gamme>-<pg>/<marque>/<modèle>/<type>.html des
-- gammes qui ont une ligne __seo_gamme_car (lue au moment de la requête). Les
-- 8 gammes du sitemap sans ligne gardent leur titre de repli et sont exclues.
--
-- Fenêtres :
--   avant    = [d0 - 14, d0 - 1]
--   apres_7  = [d0 + 1, d0 + 7]
--   apres_14 = [d0 + 1, d0 + 14]
--   J0 est exclu : le cache `seo:processed:*` (24 h) sert encore l'ancien
--   titre une partie de la journée. Une fenêtre après tronquée par la dernière
--   date disponible est signalée (`jours_couverts` < jours prévus).
--
-- Source : __seo_gsc_daily (lignes par requête). Les requêtes anonymisées par
-- Google n'y figurent pas : sur 90 j au 2026-11-16, elles portent 81,6 % des
-- impressions et 95,1 % des clics des pages R2. La ligne `total_r2_page_totals`
-- donne les clics de __seo_gsc_daily_page_totals (totaux par page, sans cette
-- perte) pour contrôle.
--
-- Tranches de position : position moyenne pondérée par les impressions, par
-- page et par jour, rangée en 1-3, 4-10, 11-20, 21+. Comparer le CTR tranche
-- par tranche : une variation de position change le CTR sans rapport avec le
-- titre. Faible volume = bruit : lire `impressions` avec le CTR.

WITH params AS (
  SELECT :'d0'::date AS d0,
         (SELECT max(date) FROM public.__seo_gsc_daily) AS last_date,
         (SELECT max(date) FROM public.__seo_gsc_daily_page_totals) AS last_date_totals
),
gammes AS (
  SELECT DISTINCT sgc_pg_id::int AS pg_id FROM public.__seo_gamme_car
),
fenetres(fenetre, debut, fin, jours) AS (
  SELECT 'avant',    d0 - 14, d0 - 1,  14 FROM params
  UNION ALL SELECT 'apres_7',  d0 + 1, d0 + 7,  7 FROM params
  UNION ALL SELECT 'apres_14', d0 + 1, d0 + 14, 14 FROM params
),
r2 AS (
  SELECT g.date, g.page, g.clicks, g.impressions, g.position
    FROM public.__seo_gsc_daily g, params p
   WHERE g.page ~ '^https?://[^/]+/pieces/[a-z0-9-]+-[0-9]+/[^/]+/[^/]+/[^/]+\.html$'
     AND substring(g.page FROM '/pieces/[a-z0-9-]+-([0-9]+)/')::int IN (SELECT pg_id FROM gammes)
     AND g.date BETWEEN p.d0 - 14 AND p.d0 + 14
),
page_jour AS (
  SELECT date, page, sum(clicks) AS clk, sum(impressions) AS imp,
         sum(position * impressions) / NULLIF(sum(impressions), 0) AS pos
    FROM r2
   GROUP BY 1, 2
),
tranche AS (
  SELECT date, clk, imp,
         CASE WHEN pos < 3.5 THEN '1-3'
              WHEN pos < 10.5 THEN '4-10'
              WHEN pos < 20.5 THEN '11-20'
              ELSE '21+' END AS tranche
    FROM page_jour
   WHERE imp > 0
),
par_tranche AS (
  SELECT f.fenetre, t.tranche, sum(t.imp) AS impressions, sum(t.clk) AS clics
    FROM fenetres f JOIN tranche t ON t.date BETWEEN f.debut AND f.fin
   GROUP BY 1, 2
),
totaux AS (
  SELECT f.fenetre, 'total_r2'::text AS tranche, sum(t.imp) AS impressions, sum(t.clk) AS clics
    FROM fenetres f JOIN tranche t ON t.date BETWEEN f.debut AND f.fin
   GROUP BY 1
),
page_totals AS (
  SELECT f.fenetre, 'total_r2_page_totals'::text AS tranche,
         sum(pt.impressions) AS impressions, sum(pt.clicks) AS clics
    FROM fenetres f
    JOIN public.__seo_gsc_daily_page_totals pt ON pt.date BETWEEN f.debut AND f.fin
   WHERE pt.page ~ '^https?://[^/]+/pieces/[a-z0-9-]+-[0-9]+/[^/]+/[^/]+/[^/]+\.html$'
     AND substring(pt.page FROM '/pieces/[a-z0-9-]+-([0-9]+)/')::int IN (SELECT pg_id FROM gammes)
   GROUP BY 1
),
lignes AS (
  SELECT * FROM par_tranche
  UNION ALL SELECT * FROM totaux
  UNION ALL SELECT * FROM page_totals
)
SELECT l.fenetre,
       f.debut,
       f.fin,
       f.jours AS jours_prevus,
       GREATEST(0, LEAST(f.fin, CASE WHEN l.tranche = 'total_r2_page_totals'
                                     THEN p.last_date_totals ELSE p.last_date END)
                   - f.debut + 1) AS jours_couverts,
       l.tranche,
       l.impressions,
       l.clics,
       round(100.0 * l.clics / NULLIF(l.impressions, 0), 2) AS ctr_pct,
       p.last_date AS derniere_date_gsc_daily,
       p.last_date_totals AS derniere_date_page_totals
  FROM lignes l
  JOIN fenetres f USING (fenetre)
  CROSS JOIN params p
 ORDER BY CASE l.fenetre WHEN 'avant' THEN 1 WHEN 'apres_7' THEN 2 ELSE 3 END,
          CASE l.tranche WHEN '1-3' THEN 1 WHEN '4-10' THEN 2 WHEN '11-20' THEN 3
                         WHEN '21+' THEN 4 WHEN 'total_r2' THEN 5 ELSE 6 END;
