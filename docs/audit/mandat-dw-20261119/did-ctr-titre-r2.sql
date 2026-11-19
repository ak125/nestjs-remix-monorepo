-- Mandat DW — mesure de l'essai de titre R2 (différence de différences du CTR).
-- Lecture seule. Usage :
--   psql ... -v start_date=AAAA-MM-JJ -v weeks=4 -f did-ctr-titre-r2.sql
-- start_date = date du tag PROD qui sert le code ET de l'application de la
-- migration 20261119_seo_r2_title_trial_pg10_pg316 (la plus tardive des deux).
-- Groupe essai   : pages R2 /pieces/<gamme>-<pg>/<marque>/<modèle>/<type>.html
--                  des gammes 10 (courroie d'accessoire) et 316 (thermostat).
-- Groupe témoin  : pages R2 de toutes les autres gammes (titre inchangé).
-- Fenêtres       : avant = [start - 7*weeks, start - 1] ;
--                  après = [start + 2, start + 1 + 7*weeks] (J0 et J+1 exclus :
--                  cache Redis `seo:processed:*` de 24 h), tronquée à la
--                  dernière date disponible, affichée en sortie.
-- Source         : __seo_gsc_daily_page_totals (totaux par page, sans la perte
--                  des requêtes anonymisées de __seo_gsc_daily : ~83-86 % des
--                  impressions R2 de ces gammes sur 90 j au 2026-11-16).
-- Position comparable : la position quotidienne de chaque page est rangée en
-- tranche (1-3, 4-10, 11-20, 21+) ; le CTR est comparé tranche par tranche,
-- puis agrégé avec les poids d'impressions de l'essai AVANT (mix fixe).
-- Limite : effet observable seulement si l'après contient au moins 28 jours
-- complets ; CTR de pages à faible volume = bruit, lire `imp` avec le CTR.

-- Les deux variables sont obligatoires (weeks=4 pour la lecture prévue).

WITH params AS (
  SELECT :'start_date'::date AS d0,
         :weeks::int * 7      AS span,
         (SELECT max(date) FROM public.__seo_gsc_daily_page_totals) AS last_date
),
r2 AS (
  SELECT t.date, t.clicks, t.impressions, t.position,
         substring(t.page FROM '/pieces/[a-z0-9-]+-([0-9]+)/[^/]+/[^/]+/[^/]+\.html$')::int AS pg_id
    FROM public.__seo_gsc_daily_page_totals t, params p
   WHERE t.page ~ '^https?://[^/]+/pieces/[a-z0-9-]+-[0-9]+/[^/]+/[^/]+/[^/]+\.html$'
     AND t.date BETWEEN p.d0 - p.span AND LEAST(p.d0 + 1 + p.span, p.last_date)
     AND t.impressions > 0
),
lab AS (
  SELECT CASE WHEN pg_id IN (10, 316) THEN 'essai' ELSE 'temoin' END AS grp,
         CASE WHEN r2.date < p.d0 THEN 'avant'
              WHEN r2.date >= p.d0 + 2 THEN 'apres' END AS periode,
         CASE WHEN position < 3.5 THEN '1-3'
              WHEN position < 10.5 THEN '4-10'
              WHEN position < 20.5 THEN '11-20'
              ELSE '21+' END AS tranche,
         clicks, impressions
    FROM r2, params p
),
agg AS (
  SELECT grp, periode, tranche,
         sum(impressions) AS imp, sum(clicks) AS clk,
         sum(clicks)::numeric / NULLIF(sum(impressions), 0) AS ctr
    FROM lab
   WHERE periode IS NOT NULL
   GROUP BY 1, 2, 3
),
pivot AS (
  SELECT tranche,
         max(imp) FILTER (WHERE grp = 'essai'  AND periode = 'avant') AS imp_e_av,
         max(ctr) FILTER (WHERE grp = 'essai'  AND periode = 'avant') AS ctr_e_av,
         max(imp) FILTER (WHERE grp = 'essai'  AND periode = 'apres') AS imp_e_ap,
         max(ctr) FILTER (WHERE grp = 'essai'  AND periode = 'apres') AS ctr_e_ap,
         max(imp) FILTER (WHERE grp = 'temoin' AND periode = 'avant') AS imp_t_av,
         max(ctr) FILTER (WHERE grp = 'temoin' AND periode = 'avant') AS ctr_t_av,
         max(imp) FILTER (WHERE grp = 'temoin' AND periode = 'apres') AS imp_t_ap,
         max(ctr) FILTER (WHERE grp = 'temoin' AND periode = 'apres') AS ctr_t_ap
    FROM agg
   GROUP BY 1
),
did AS (
  SELECT *, (ctr_e_ap - ctr_e_av) - (ctr_t_ap - ctr_t_av) AS did_ctr
    FROM pivot
)
SELECT tranche,
       imp_e_av, round(100 * ctr_e_av, 2) AS ctr_essai_avant_pct,
       imp_e_ap, round(100 * ctr_e_ap, 2) AS ctr_essai_apres_pct,
       imp_t_av, round(100 * ctr_t_av, 2) AS ctr_temoin_avant_pct,
       imp_t_ap, round(100 * ctr_t_ap, 2) AS ctr_temoin_apres_pct,
       round(100 * did_ctr, 2) AS did_points_ctr
  FROM did
UNION ALL
SELECT 'TOTAL (mix essai avant)',
       sum(imp_e_av), NULL, sum(imp_e_ap), NULL, sum(imp_t_av), NULL, sum(imp_t_ap), NULL,
       round(100 * sum(did_ctr * imp_e_av) FILTER (WHERE did_ctr IS NOT NULL)
             / NULLIF(sum(imp_e_av) FILTER (WHERE did_ctr IS NOT NULL), 0), 2)
  FROM did
ORDER BY 1;

SELECT :'start_date'::date - :weeks * 7          AS avant_debut,
       :'start_date'::date - 1                    AS avant_fin,
       :'start_date'::date + 2                    AS apres_debut,
       LEAST(:'start_date'::date + 1 + :weeks * 7,
             (SELECT max(date) FROM public.__seo_gsc_daily_page_totals)) AS apres_fin,
       (SELECT max(date) FROM public.__seo_gsc_daily_page_totals)        AS derniere_date_gsc;
