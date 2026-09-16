-- Migration : rendre OBSERVABLE la vacance de detect_cwv_trend_divergence().
--
-- PROBLÈME (mesuré 2026-09-16 ~14:45Z, lecture seule sur la base live) :
--   Le détecteur de régression interne CWV tourne « vert » alors qu'il est
--   structurellement incapable d'émettre la moindre alerte.
--     cron.job jobid 21 (cwv-trend-divergence-detection, 0 4 * * *) :
--       7 runs / 7 succeeded, dernier 2026-09-16 04:00:00Z, alerts_inserted = 0.
--     Or sa CTE `reference` exige p75_exact IS NOT NULL ET date < CURRENT_DATE - 8.
--       SELECT count(*) FILTER (WHERE p75_exact IS NOT NULL)                        -> 301
--       SELECT count(*) FILTER (WHERE p75_exact IS NOT NULL AND date < CURRENT_DATE - 8) -> 0
--       min(date) FILTER (WHERE p75_exact IS NOT NULL) = 2026-09-10, cutoff = 2026-09-08.
--     `reference` est donc vide, le JOIN de `divergent` l'est aussi, et
--     alerts_inserted vaut 0 QUELLE QUE SOIT la dégradation du site.
--   Depuis l'extérieur, « 0 divergence trouvée sur N clés comparées » et
--   « 0 clé comparée, donc rien n'a été regardé » sont indiscernables : même
--   statut cron succeeded, même valeur de retour. La garde est verte ET vide,
--   pendant la fenêtre d'évaluation du correctif sanitizer (A1, PR #1457).
--
-- CAUSE RACINE — un repli gouverné mais NON observable :
--   La vacance est une conséquence CONNUE et DOCUMENTÉE de 20260911
--   (« Conséquence assumée : aucune alerte tant que n_exact n'atteint pas les
--   planchers après l'application (jours antérieurs non recalculables, brut
--   purgé) »). Le défaut n'est pas cette conséquence — elle est physique :
--   p75_exact se calcule sur __seo_cwv_raw (TTL 48 h), donc l'historique
--   antérieur à l'application n'est PAS reconstructible. Le défaut est que
--   rien ne l'ÉMET. CLAUDE.md invariant 3 : « No silent fallback : tout repli
--   INTERDIT sauf explicitement gouverné ET observable ». Gouverné : oui.
--   Observable : non. C'est cette moitié qui manque, et c'est elle qu'on ajoute.
--
--   Portée générale, pas ponctuelle : tout changement futur d'estimateur, de
--   rétention du brut, de plancher, ou toute nouvelle métrique/route_group
--   rouvre la même fenêtre aveugle. Le signal la rend bruyante à chaque fois.
--
-- CHANGEMENT (additif, un seul objet touché) :
--   detect_cwv_trend_divergence() compte les clés (route_group, device, metric)
--   réellement COMPARÉES — c.-à-d. présentes simultanément dans recent,
--   reference et recent_3d, avant le filtre de divergence à 1,30. Si ce compte
--   est nul, la fonction émet un événement dans __seo_event_log décrivant quel
--   plancher est vide.
--
-- CE QUI N'EST PAS TOUCHÉ (délibérément) :
--   - Les planchers (7 j ≥ 100, référence ≥ 300, 3 j n·7 ≥ 100·3) et le seuil
--     de divergence 1,30. Les assouplir pour « faire passer » un cas hors de
--     leur périmètre est l'anti-pattern nommé par .claude/rules/guardrails.md.
--     Le contrat de la garde est juste ; c'est sa donnée de référence qui manque.
--   - Aucun second détecteur : la responsabilité est déjà portée ici, on la
--     complète (guardrails.md, passe 2).
--   - La signature RETURNS TABLE(alerts_inserted INT) : inchangée, donc aucun
--     DROP FUNCTION, aucune reprise du job pg_cron, aucune exposition PostgREST
--     modifiée. alerts_inserted reste le compte des SEULES alertes de
--     régression — l'événement de vacance n'y est pas ajouté, pour ne pas faire
--     lire « une régression a été détectée » là où il n'y en a pas. La vacance
--     est visible dans __seo_event_log, le puits canon que l'alerting lit déjà.
--   - Aucune donnée recalculée, aucun backfill : READ-ONLY / ALERTING.
--
-- TAXONOMIE — miroir exact de 20260601 (detect_cwv_aggregation_coverage_gap),
--   qui a résolu le trou SILENCIEUX analogue raw -> hourly :
--   enum existant seo_event_type='anomaly_detected' + discriminant
--   payload.alert_kind='cwv_trend_detector_vacant'. AUCUN ALTER TYPE ADD VALUE
--   -> migration 100 % réversible, et pas de « valeur d'enum non utilisable
--   dans la transaction qui la crée ». Sévérité 'high' (une garde aveugle
--   pendant une fenêtre d'évaluation est un risque opérationnel, pas un warning).
--   Dédup sur événements OUVERTS (resolved_at IS NULL) < 7 j, comme 20260601 :
--   un seul événement ouvert à la fois, ré-armable après 7 j.
--
-- LIMITE ASSUMÉE (documentée, pas construite) :
--   Le signal se déclenche sur vacance TOTALE (0 clé comparée). Une vacance
--   PARTIELLE (p. ex. 1 clé comparée au lieu de 8) reste muette : la détecter
--   exigerait un attendu de couverture, donc un seuil inventé sans mesure pour
--   l'étalonner. Les compteurs par plancher sont dans la charge utile, ce qui
--   permettra de l'étalonner plus tard sur des données réelles plutôt que sur
--   une hypothèse.
--
-- RÉARMEMENT ATTENDU DE LA GARDE (arithmétique, pas une action) :
--   p75_exact démarre au 2026-09-10 ; la référence exige date < CURRENT_DATE-8,
--   donc au plus tôt le 2026-09-19, et seulement si ce jour atteint n_exact>=300
--   pour une clé (route_group, device, metric) donnée. L'événement de vacance
--   doit disparaître de lui-même à ce moment (plus d'émission) ; l'événement
--   ouvert se résout à la main, comme pour cwv_aggregation_coverage_gap.
--
-- VERROUS : CREATE OR REPLACE FUNCTION = modification de catalogue seule, aucun
--   lock de table, aucune réécriture. lock_timeout court : en cas d'attente,
--   l'application échoue proprement au lieu de bloquer les lecteurs.
--
-- DROITS : inchangés (REVOKE PUBLIC/anon/authenticated, GRANT service_role),
--   ré-affirmés ici car CREATE OR REPLACE conserve l'ACL mais la ré-affirmation
--   rend la migration autoportante si elle est rejouée sur une base neuve.
--   search_path vide + noms qualifiés, comme 20260911.
--
-- ROLLBACK : 20260916_seo_cwv_trend_detector_vacancy_signal.down.sql
--   (restaure verbatim le corps 20260911).
--
-- Test de comportement (PostgreSQL 17 jetable, sans réseau) :
--   bash scripts/db/test-cwv-trend-detector-vacancy.sh
--
-- Le runner (scripts/ci/apply-supabase-migration.py) wrappe le fichier dans une
-- transaction (squawk: assume_in_transaction).

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- =============================================================================
-- detect_cwv_trend_divergence() — inchangée sauf le signal de vacance
-- =============================================================================

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
RETURNS TABLE(alerts_inserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count           INT  := 0;   -- alertes de régression insérées (contrat inchangé)
  v_comparable      INT  := 0;   -- clés réellement comparées (recent ∩ reference ∩ 3d)
  v_exact_rows      INT  := 0;   -- lignes jour×clé dotées d'un bloc exact
  v_recent_keys     INT  := 0;   -- clés passant le plancher 7 j
  v_reference_keys  INT  := 0;   -- clés passant le plancher référence
  v_recent_3d_keys  INT  := 0;   -- clés passant le plancher 3 j
  v_earliest_exact  DATE;        -- 1er jour doté d'un bloc exact dans la fenêtre
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
  comparable AS (
    -- Clés que le détecteur regarde RÉELLEMENT, avant tout jugement de
    -- divergence. C'est le dénominateur de la garde : s'il est nul, la garde
    -- n'a rien regardé et son « 0 alerte » ne veut rien dire.
    SELECT
      r.route_group, r.device, r.metric,
      r.p75_recent, ref.p75_ref, r3.p75_3d,
      r.samples_recent, ref.samples_reference, r3.samples_3d
    FROM recent r
    JOIN reference ref USING (route_group, device, metric)
    JOIN recent_3d r3 USING (route_group, device, metric)
  ),
  divergent AS (
    SELECT *
    FROM comparable
    WHERE p75_recent > p75_ref * 1.30
      AND p75_3d     > p75_ref * 1.30
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
  ),
  inserted AS (
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
    FROM not_already_open
    RETURNING 1
  )
  -- Une seule passe : les alertes de régression ET les compteurs de couverture.
  -- Les CTE ne sont définies qu'ici : aucun plancher n'est ré-écrit ailleurs,
  -- donc le compteur ne peut pas diverger de ce que la garde évalue.
  SELECT
    (SELECT count(*) FROM inserted),
    (SELECT count(*) FROM comparable),
    (SELECT count(*) FROM exact_days),
    (SELECT count(*) FROM recent),
    (SELECT count(*) FROM reference),
    (SELECT count(*) FROM recent_3d),
    (SELECT min(date) FROM exact_days)
  INTO
    v_count, v_comparable, v_exact_rows,
    v_recent_keys, v_reference_keys, v_recent_3d_keys, v_earliest_exact;

  -- ---------------------------------------------------------------------------
  -- Signal de vacance : la garde n'a comparé AUCUNE clé.
  -- Sans cet événement, ce cas est indiscernable de « aucune régression ».
  -- ---------------------------------------------------------------------------
  IF v_comparable = 0 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.__seo_event_log e
      WHERE e.event_type = 'anomaly_detected'
        AND e.resolved_at IS NULL
        AND e.created_at >= now() - INTERVAL '7 days'
        AND e.payload->>'alert_kind' = 'cwv_trend_detector_vacant'
    ) THEN
      INSERT INTO public.__seo_event_log (event_type, entity_url, severity, payload)
      VALUES (
        'anomaly_detected'::public.seo_event_type,
        NULL,
        'high'::public.seo_severity,
        jsonb_build_object(
          'alert_kind',            'cwv_trend_detector_vacant',
          'comparable_keys',       0,
          'exact_day_rows',        v_exact_rows,
          'recent_keys',           v_recent_keys,
          'reference_keys',        v_reference_keys,
          'recent_3d_keys',        v_recent_3d_keys,
          'earliest_exact_date',   v_earliest_exact,
          'reference_cutoff_date', (CURRENT_DATE - INTERVAL '8 days')::date,
          'hint',                  'detect_cwv_trend_divergence n a compare AUCUNE cle (route_group, device, metric) : elle ne peut emettre aucune alerte de regression, quel que soit l etat du site. Lire recent_keys / reference_keys / recent_3d_keys pour savoir quel plancher est vide. Cause la plus frequente : p75_exact (20260911) n a pas d historique au-dela du cutoff de reference, et les jours anterieurs ne sont PAS recalculables (brut __seo_cwv_raw purge a 48h). NE PAS assouplir les planchers ni ajouter un second detecteur : attendre que l historique p75_exact franchisse le cutoff, ou backfiller __seo_cwv_daily_rum.p75_exact depuis un instantane du brut conserve.'
        )
      );
    END IF;
  END IF;

  alerts_inserted := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.detect_cwv_trend_divergence() IS
  'Bloc 6 VOLATILE — détecte régressions CWV_P0 LCP/INP > 30% sur 7j vs référence (J-35..J-9) ET confirmé sur 3 derniers jours, sur p75_exact pondéré par n_exact (20260911). Jours sans bloc exact exclus, sans repli sur p75_value. Planchers n_exact : 7j ≥ 100, référence ≥ 300, 3j à densité égale (n·7 ≥ 100·3). Dedup 14j sur même (route_group, device, metric). INSERT __seo_event_log cwv.alert.internal_regression severity=high. 20260916 : si AUCUNE clé n''est comparable (recent ∩ reference ∩ recent_3d vide), émet en plus anomaly_detected payload.alert_kind=cwv_trend_detector_vacant (dedup 7j sur événements ouverts) — sans quoi une garde aveugle est indiscernable d''une absence de régression. alerts_inserted ne compte QUE les alertes de régression.';

REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;
