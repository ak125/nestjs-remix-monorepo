-- Migration : estimateur quotidien EXACT pour le RUM CWV (__seo_cwv_daily_rum)
--             + détecteur de tendance sur ce p75 exact.
--
-- PROBLÈME (mesuré 2026-09-11, lecture seule sur la base live) :
--   aggregate_cwv_daily_rum() (20260527) calcule le p75 quotidien comme la moyenne
--   pondérée des p75 HORAIRES. Avec ~15 échantillons INP par jour étalés sur la
--   journée, la plupart des heures ont n = 1 : le « p75 horaire » y est la valeur
--   brute elle-même, et l'estimateur dégénère en moyenne, tirée par une seule
--   valeur extrême.
--     2026-09-09, pieces_product / mobile / INP : 13 beacons sur 11 heures (9 à
--     n = 1, dont une à 8 528 ms) → p75 stocké 1 588,3 ; p75 du brut : 512.
--     2026-09-10, 42 lignes du jour : pieces_product mobile INP 303,3 contre 248,
--     desktop INP 64 contre 88, mobile LCP 2 500,0 contre 2 932.
--   detect_cwv_trend_divergence() (20260529) refait cette moyenne sur 7, 27 et
--   3 jours. L'alerte cwv.alert.internal_regression du 2026-09-11 04:00
--   (pieces_product mobile INP, p75_3d_ms 870, « +38,1 % ») se recalcule
--   exactement à partir des lignes stockées : (886,4×18 + 1 588,3×13 + 303,3×17)/48.
--
-- CAUSE RACINE :
--   Le choix de 20260527 était documenté (« Pas mathématiquement exact sans la
--   distribution raw (déjà droppé à 48h) »). Or le job cwv-daily-rum-aggregation
--   (00:15 UTC) calcule J-1 et J-2 alors que leurs partitions brutes existent
--   encore : la rotation cwv-raw-rotation (02:55 UTC) ne supprime que les jours
--   < CURRENT_DATE - 2, par partition journalière UTC entière. La distribution
--   exacte est donc disponible au moment du calcul.
--
-- CHANGEMENT (additif) :
--   1. Colonnes nullables sans défaut sur __seo_cwv_daily_rum (bloc « exact »).
--      p50_value / p75_value / p95_value / sample_count gardent leur sémantique
--      et leur calcul : les lecteurs actuels (get_cwv_dashboard, admin) ne voient
--      aucune différence.
--   2. aggregate_cwv_daily_rum() calcule, dans le même passage, le bloc exact
--      depuis __seo_cwv_raw : mêmes clés de dimension, même filtre ua_class =
--      'human', même journée UTC.
--   3. detect_cwv_trend_divergence() compare p75_exact au lieu de p75_value.
--
-- SÉMANTIQUE DU P75 — percentile_disc(0.75) :
--   CrUX déclare qu'une URL ou une origine passe si au moins 75 % de ses chargements
--   atteignent le seuil, et calcule son p75 BigQuery sur les classes de
--   l'histogramme (googlechrome/crux : colab/navigation-types-and-lcp.ipynb,
--   sql/test-my-site.sql). percentile_disc renvoie la valeur
--   observée de rang ⌈0,75·n⌉ ; c'est exactement l'estimateur pour lequel
--     p75_exact ≤ seuil good  ⇔  n_good ≥ 0,75·n_exact
--     p75_exact > seuil poor  ⇔  n_poor > 0,25·n_exact
--   Le p75 et les compteurs stockés sur la même ligne ne peuvent donc pas se
--   contredire. percentile_cont (utilisé par l'horaire) interpole et peut le faire
--   aux petits n de ce RUM : 6 valeurs dont 4 ≤ 200 ms → 175,75 alors que la
--   règle des 75 % n'est pas remplie.
--
-- SEUILS good / poor :
--   Miroir de .spec/00-canon/seo-runtime/cwv-taxonomy.yaml §metrics (même valeurs
--   que METRIC_BOUNDS de @repo/cwv-taxonomy ; rateMetric : good ≤ good_threshold,
--   poor > poor_threshold, bornes identiques au tri-bin CrUX). Encodés en
--   littéraux comme le SQL CWV existant le fait déjà (CHECK value <= 60000 de
--   20260526, paliers INP 200 / 500 de 20260529). Comparaison en REAL, le type de
--   la colonne value : 0,1 lu en REAL doit rester « good ». La parité avec le
--   canon est vérifiée par scripts/db/test-cwv-daily-rum-exact-p75.sh, qui lit le
--   YAML et teste chaque borne de chaque métrique (test manuel, pas encore en CI).
--   Une métrique admise par les CHECK mais absente de cette liste reste comptée
--   dans raw_sample_count et reçoit p75_exact / n_exact ; ses trois compteurs
--   restent NULL (jamais 0), ce qui la signale ligne par ligne.
--
-- COUVERTURE DU BRUT (jamais de bloc partiel, jamais d'écrasement) :
--   Témoin = sample_count issu de __seo_cwv_hourly pour la même clé et la même
--   journée (compte des lignes brutes vues par l'agrégation horaire). Le bloc
--   exact n'est écrit que si :
--     - la journée UTC est close (received_at vaut now() à l'insertion, jamais
--       fourni par le beacon : une journée écoulée ne reçoit plus de lignes) ;
--     - le brut retrouvé couvre le témoin (raw_sample_count ≥ sample_count ; plus
--       de brut que de témoin = horaire en retard, le brut reste la vérité).
--   Sinon le bloc exact déjà stocké est conservé tel quel (ou reste NULL) :
--   un recalcul après la rotation du brut ne dégrade jamais une valeur complète.
--   raw_sample_count est mis à jour à chaque passage : l'écart avec sample_count
--   rend visible, ligne par ligne, un brut partiel ou disparu.
--   Hypothèse : le brut ne disparaît que par partition journalière entière. Après
--   une suppression manuelle de lignes brutes, les buckets horaires vidés restent
--   (l'upsert horaire n'efface rien) et le bloc exact antérieur est conservé :
--   supprimer ces buckets pour les clés touchées avant de recalculer la journée.
--
-- DÉTECTEUR :
--   Moyenne des p75_exact pondérée par n_exact (même forme de fenêtres qu'en
--   20260529), planchers existants appliqués à n_exact (7 j ≥ 100, référence
--   ≥ 300) et plancher ajouté sur 3 j à la même densité journalière que celui de
--   7 j (n·7 ≥ 100·3). Un jour sans bloc exact (p75_exact NULL) est exclu : ni sa
--   valeur ni son n ne comptent, et p75_value n'est jamais utilisé en repli.
--   Conséquence assumée : aucune alerte tant que n_exact n'atteint pas les
--   planchers après l'application (jours antérieurs non recalculables, brut purgé).
--   Charge utile : clés existantes inchangées, + samples_3d et samples_reference.
--
-- DROITS : les deux fonctions ne sont appelées que par pg_cron (propriétaire
--   postgres), aucun appel .rpc() dans le dépôt. EXECUTE réservé à service_role,
--   comme les autres fonctions planifiées CWV (20260616_vague5). search_path vide
--   et noms qualifiés, types des variables compris (même durcissement que
--   20260907_tecdoc_api_surface_lockdown).
--
-- VERROUS : ADD COLUMN nullable sans défaut = modification de catalogue seule, pas
--   de réécriture ; un seul ALTER TABLE (parent + partitions mensuelles). Jobs
--   planifiés qui touchent la table : cwv-daily-rum-aggregation (00:15 UTC, lignes)
--   et cwv-daily-rum-rotation (dimanche 03:10 UTC, partitions). lock_timeout court :
--   en cas d'attente, l'application échoue proprement au lieu de bloquer les lecteurs.
--
-- HORS PÉRIMÈTRE : aggregate_cwv_hourly, get_cwv_dashboard (lit toujours
--   p75_value), crons, __seo_event_log (aucune alerte existante modifiée), aucune
--   donnée recalculée par cette migration.
--
-- VÉRIFICATION ATTENDUE APRÈS APPLICATION (owner) :
--   1. Après le job de 00:15 UTC : lignes de J-1 et J-2 avec estimator_version = 1
--      et raw_sample_count = sample_count (égalité observée sur les 42 lignes du
--      2026-09-10 en rejouant ce calcul en lecture seule).
--   2. has_function_privilege('anon', 'public.aggregate_cwv_daily_rum(date)',
--      'execute') = false.
--   3. cron.job_run_details : cwv-daily-rum-aggregation et
--      cwv-trend-divergence-detection en succeeded.
--
-- ROLLBACK : 20260911_seo_cwv_daily_rum_exact_p75.down.sql.
--
-- Test de comportement (PostgreSQL 17 jetable) : scripts/db/test-cwv-daily-rum-exact-p75.sh

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- =============================================================================
-- 1. Bloc exact : colonnes additives
-- =============================================================================

ALTER TABLE public.__seo_cwv_daily_rum
  ADD COLUMN IF NOT EXISTS raw_sample_count    BIGINT,
  ADD COLUMN IF NOT EXISTS p75_exact           REAL,
  ADD COLUMN IF NOT EXISTS n_exact             BIGINT,
  ADD COLUMN IF NOT EXISTS n_good              BIGINT,
  ADD COLUMN IF NOT EXISTS n_needs_improvement BIGINT,
  ADD COLUMN IF NOT EXISTS n_poor              BIGINT,
  ADD COLUMN IF NOT EXISTS estimator_version   BIGINT;

COMMENT ON COLUMN public.__seo_cwv_daily_rum.raw_sample_count IS
  'Lignes __seo_cwv_raw (human) retrouvées pour la clé et la journée UTC lors du dernier passage de aggregate_cwv_daily_rum. Inférieur à sample_count = brut partiel ou purgé.';
COMMENT ON COLUMN public.__seo_cwv_daily_rum.p75_exact IS
  'percentile_disc(0.75) des valeurs brutes de la journée UTC (rang ceil(0,75 n)). Écrit seulement sur journée close et brut complet ; NULL = aucun calcul exact complet.';
COMMENT ON COLUMN public.__seo_cwv_daily_rum.n_exact IS
  'Nombre de valeurs brutes sur lesquelles p75_exact et les compteurs ont été calculés.';
COMMENT ON COLUMN public.__seo_cwv_daily_rum.n_good IS
  'Valeurs brutes <= good_threshold (.spec/00-canon/seo-runtime/cwv-taxonomy.yaml §metrics). NULL = bloc exact absent ou métrique sans seuil.';
COMMENT ON COLUMN public.__seo_cwv_daily_rum.n_needs_improvement IS
  'Valeurs brutes > good_threshold et <= poor_threshold (canon cwv-taxonomy §metrics). NULL = bloc exact absent ou métrique sans seuil.';
COMMENT ON COLUMN public.__seo_cwv_daily_rum.n_poor IS
  'Valeurs brutes > poor_threshold (canon cwv-taxonomy §metrics). NULL = bloc exact absent ou métrique sans seuil.';
COMMENT ON COLUMN public.__seo_cwv_daily_rum.estimator_version IS
  'Version de l''estimateur du bloc exact (1 = percentile_disc sur __seo_cwv_raw, migration 20260911). NULL = bloc exact jamais calculé.';

COMMENT ON TABLE public.__seo_cwv_daily_rum IS
  'Bloc 4 — agrégat journalier CWV (RUM). p50/p75/p95_value : moyenne pondérée des percentiles de __seo_cwv_hourly (approximation historique, conservée). p75_exact, n_exact, n_good/n_needs_improvement/n_poor : calcul exact sur __seo_cwv_raw (20260911). Partitions monthly, TTL 12mo. Distinct de __seo_cwv_daily (lab PageSpeed, table existante).';

-- =============================================================================
-- 2. aggregate_cwv_daily_rum(date) — historique inchangé + bloc exact
-- =============================================================================

CREATE OR REPLACE FUNCTION public.aggregate_cwv_daily_rum(
  p_target_date DATE
)
RETURNS TABLE(rows_upserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted          INT := 0;
  c_estimator_version CONSTANT BIGINT := 1;
  -- Journée UTC explicite. Identique à p_target_date::timestamptz sous les
  -- sessions UTC (PostgREST) et GMT (pg_cron) ; les deux estimateurs lisent
  -- ainsi exactement la même fenêtre, condition du témoin de couverture.
  v_day_start         CONSTANT pg_catalog.timestamptz := p_target_date::timestamp AT TIME ZONE 'UTC';
  v_day_end           CONSTANT pg_catalog.timestamptz := (p_target_date + 1)::timestamp AT TIME ZONE 'UTC';
  v_day_closed        CONSTANT BOOLEAN := now() >= v_day_end;
BEGIN
  WITH hourly_agg AS (
    -- Approximation historique (20260527), inchangée.
    SELECT
      p_target_date AS date,
      surface,
      route_group,
      priority_tier,
      device,
      metric,
      ua_class,
      sum(sample_count)::BIGINT AS sample_count,
      (sum(p50_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p50_value,
      (sum(p75_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p75_value,
      (sum(p95_value * sample_count) / NULLIF(sum(sample_count), 0))::REAL AS p95_value
    FROM public.__seo_cwv_hourly
    WHERE hour >= v_day_start
      AND hour <  v_day_end
      AND ua_class = 'human'
    GROUP BY 1, 2, 3, 4, 5, 6, 7
    HAVING sum(sample_count) > 0
  ),
  metric_thresholds (metric, good_threshold, poor_threshold) AS (
    -- Miroir de .spec/00-canon/seo-runtime/cwv-taxonomy.yaml §metrics (voir en-tête).
    VALUES
      ('LCP',  2500::REAL, 4000::REAL),
      ('INP',   200::REAL,  500::REAL),
      ('CLS',   0.1::REAL,  0.25::REAL),
      ('FCP',  1800::REAL, 3000::REAL),
      ('TTFB',  800::REAL, 1800::REAL)
  ),
  raw_agg AS (
    SELECT
      r.surface,
      r.route_group,
      r.priority_tier,
      r.device,
      r.metric,
      r.ua_class,
      count(*)::BIGINT AS raw_sample_count,
      percentile_disc(0.75) WITHIN GROUP (ORDER BY r.value) AS p75_exact,
      -- Métrique absente de metric_thresholds : compteurs NULL, jamais 0 ; le brut
      -- reste compté ci-dessus (voir en-tête, SEUILS).
      CASE WHEN bool_and(t.metric IS NOT NULL) THEN
        count(*) FILTER (WHERE r.value <= t.good_threshold) END AS n_good,
      CASE WHEN bool_and(t.metric IS NOT NULL) THEN
        count(*) FILTER (WHERE r.value >  t.good_threshold
                           AND r.value <= t.poor_threshold) END AS n_needs_improvement,
      CASE WHEN bool_and(t.metric IS NOT NULL) THEN
        count(*) FILTER (WHERE r.value >  t.poor_threshold) END AS n_poor
    FROM public.__seo_cwv_raw r
    LEFT JOIN metric_thresholds t ON t.metric = r.metric
    WHERE r.received_at >= v_day_start
      AND r.received_at <  v_day_end
      AND r.ua_class = 'human'
    GROUP BY 1, 2, 3, 4, 5, 6
  ),
  src AS (
    SELECT
      h.date, h.surface, h.route_group, h.priority_tier, h.device, h.metric, h.ua_class,
      h.sample_count, h.p50_value, h.p75_value, h.p95_value,
      COALESCE(x.raw_sample_count, 0) AS raw_sample_count,
      -- Bloc exact complet : journée close ET brut couvrant le témoin horaire.
      (v_day_closed AND COALESCE(x.raw_sample_count, 0) >= h.sample_count) AS exact_complete,
      x.p75_exact, x.n_good, x.n_needs_improvement, x.n_poor
    FROM hourly_agg h
    LEFT JOIN raw_agg x
      ON  x.surface       = h.surface
      AND x.route_group   = h.route_group
      AND x.priority_tier = h.priority_tier
      AND x.device        = h.device
      AND x.metric        = h.metric
      AND x.ua_class      = h.ua_class
  )
  INSERT INTO public.__seo_cwv_daily_rum AS d (
    date, surface, route_group, priority_tier, device, metric, ua_class,
    sample_count, p50_value, p75_value, p95_value,
    raw_sample_count, p75_exact, n_exact, n_good, n_needs_improvement, n_poor, estimator_version,
    fetched_at
  )
  SELECT
    date, surface, route_group, priority_tier, device, metric, ua_class,
    sample_count, p50_value, p75_value, p95_value,
    raw_sample_count,
    CASE WHEN exact_complete THEN p75_exact END,
    CASE WHEN exact_complete THEN raw_sample_count END,
    CASE WHEN exact_complete THEN n_good END,
    CASE WHEN exact_complete THEN n_needs_improvement END,
    CASE WHEN exact_complete THEN n_poor END,
    CASE WHEN exact_complete THEN c_estimator_version END,
    now()
  FROM src
  ON CONFLICT (date, surface, route_group, device, metric, ua_class) DO UPDATE
  SET sample_count     = EXCLUDED.sample_count,
      p50_value        = EXCLUDED.p50_value,
      p75_value        = EXCLUDED.p75_value,
      p95_value        = EXCLUDED.p95_value,
      raw_sample_count = EXCLUDED.raw_sample_count,
      -- estimator_version non NULL dans la ligne proposée ⇔ bloc exact complet
      -- calculé à ce passage. Sinon le bloc stocké est conservé tel quel.
      p75_exact           = CASE WHEN EXCLUDED.estimator_version IS NULL THEN d.p75_exact           ELSE EXCLUDED.p75_exact           END,
      n_exact             = CASE WHEN EXCLUDED.estimator_version IS NULL THEN d.n_exact             ELSE EXCLUDED.n_exact             END,
      n_good              = CASE WHEN EXCLUDED.estimator_version IS NULL THEN d.n_good              ELSE EXCLUDED.n_good              END,
      n_needs_improvement = CASE WHEN EXCLUDED.estimator_version IS NULL THEN d.n_needs_improvement ELSE EXCLUDED.n_needs_improvement END,
      n_poor              = CASE WHEN EXCLUDED.estimator_version IS NULL THEN d.n_poor              ELSE EXCLUDED.n_poor              END,
      estimator_version   = COALESCE(EXCLUDED.estimator_version, d.estimator_version),
      fetched_at          = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  rows_upserted := v_inserted;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.aggregate_cwv_daily_rum(DATE) IS
  'Bloc 4 VOLATILE — agrège 24h UTC vers __seo_cwv_daily_rum. p50/p75/p95_value : weighted-avg des percentiles horaires (V1, inchangé). Bloc exact (p75_exact percentile_disc, compteurs good/NI/poor) depuis __seo_cwv_raw, écrit seulement sur journée close et brut couvrant le témoin horaire ; jamais écrasé par un calcul incomplet. Idempotent (UPSERT).';

REVOKE EXECUTE ON FUNCTION public.aggregate_cwv_daily_rum(DATE) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.aggregate_cwv_daily_rum(DATE) TO service_role;

-- =============================================================================
-- 3. detect_cwv_trend_divergence() — comparaison sur p75_exact
-- =============================================================================

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
RETURNS TABLE(alerts_inserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH exact_days AS (
    -- Seuls les jours dotés d'un bloc exact. Un jour sans p75_exact n'apporte ni
    -- valeur ni n ; p75_value n'est jamais utilisé en repli.
    SELECT date, route_group, device, metric, p75_exact, n_exact
    FROM public.__seo_cwv_daily_rum
    WHERE date >= CURRENT_DATE - INTERVAL '35 days'
      AND date <  CURRENT_DATE
      AND ua_class = 'human'
      AND priority_tier = 'CWV_P0'
      AND metric IN ('LCP', 'INP')
      AND p75_exact IS NOT NULL
  ),
  recent AS (
    SELECT
      route_group, device, metric,
      sum(p75_exact * n_exact) / NULLIF(sum(n_exact), 0) AS p75_recent,
      sum(n_exact) AS samples_recent
    FROM exact_days
    WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY route_group, device, metric
    HAVING sum(n_exact) >= 100  -- min samples pour alert valide (20260529)
  ),
  reference AS (
    SELECT
      route_group, device, metric,
      sum(p75_exact * n_exact) / NULLIF(sum(n_exact), 0) AS p75_ref,
      sum(n_exact) AS samples_reference
    FROM exact_days
    WHERE date < CURRENT_DATE - INTERVAL '8 days'
    GROUP BY route_group, device, metric
    HAVING sum(n_exact) >= 300
  ),
  recent_3d AS (
    SELECT
      route_group, device, metric,
      sum(p75_exact * n_exact) / NULLIF(sum(n_exact), 0) AS p75_3d,
      sum(n_exact) AS samples_3d
    FROM exact_days
    WHERE date >= CURRENT_DATE - INTERVAL '3 days'
    GROUP BY route_group, device, metric
    -- Même densité journalière que le plancher 7 j : n·7 ≥ 100·3.
    HAVING sum(n_exact) * 7 >= 100 * 3
  ),
  divergent AS (
    SELECT
      r.route_group, r.device, r.metric,
      r.p75_recent, ref.p75_ref, r3.p75_3d,
      r.samples_recent, ref.samples_reference, r3.samples_3d
    FROM recent r
    JOIN reference ref USING (route_group, device, metric)
    JOIN recent_3d r3 USING (route_group, device, metric)
    WHERE r.p75_recent > ref.p75_ref * 1.30
      AND r3.p75_3d   > ref.p75_ref * 1.30
  ),
  not_already_open AS (
    -- Dedup : skip si une alert non-resolved existe déjà sur même (rg, device, metric)
    SELECT dv.* FROM divergent dv
    WHERE NOT EXISTS (
      SELECT 1 FROM public.__seo_event_log e
      WHERE e.event_type = 'cwv.alert.internal_regression'
        AND e.resolved_at IS NULL
        AND e.created_at >= now() - INTERVAL '14 days'
        AND e.payload->>'route_group' = dv.route_group
        AND e.payload->>'device' = dv.device
        AND e.payload->>'metric' = dv.metric
    )
  )
  INSERT INTO public.__seo_event_log (event_type, entity_url, severity, payload)
  SELECT
    'cwv.alert.internal_regression'::public.seo_event_type,
    NULL,
    'high'::public.seo_severity,
    jsonb_build_object(
      'route_group', route_group,
      'device', device,
      'metric', metric,
      'p75_recent_ms', round(p75_recent::numeric, 0),
      'p75_reference_ms', round(p75_ref::numeric, 0),
      'p75_3d_ms', round(p75_3d::numeric, 0),
      'degradation_pct', round(((p75_recent - p75_ref) / NULLIF(p75_ref, 0) * 100)::numeric, 1),
      'samples_recent', samples_recent,
      'samples_3d', samples_3d,
      'samples_reference', samples_reference
    )
  FROM not_already_open;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  alerts_inserted := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.detect_cwv_trend_divergence() IS
  'Bloc 6 VOLATILE — détecte régressions CWV_P0 LCP/INP > 30% sur 7j vs référence (J-35..J-9) ET confirmé sur 3 derniers jours, sur p75_exact pondéré par n_exact (20260911). Jours sans bloc exact exclus, sans repli sur p75_value. Planchers n_exact : 7j ≥ 100, référence ≥ 300, 3j à densité égale (n·7 ≥ 100·3). Dedup 14j sur même (route_group, device, metric). INSERT __seo_event_log cwv.alert.internal_regression severity=high.';

REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;
