-- Migration : rendre OBSERVABLE la cécité de detect_cwv_trend_divergence().
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
--   statut cron succeeded, même valeur de retour. La garde est verte ET aveugle,
--   pendant la fenêtre d'évaluation du correctif sanitizer (A1, PR #1457).
--
-- CAUSE RACINE — un repli gouverné mais NON observable :
--   La cécité est une conséquence CONNUE et DOCUMENTÉE de 20260911
--   (« Conséquence assumée : aucune alerte tant que n_exact n'atteint pas les
--   planchers après l'application (jours antérieurs non recalculables, brut
--   purgé) »). Le défaut n'est pas cette conséquence — elle est physique :
--   p75_exact se calcule sur __seo_cwv_raw (TTL 48 h), donc l'historique
--   antérieur à l'application n'est PAS reconstructible. Le défaut est que
--   rien ne l'ÉMET. CLAUDE.md invariant 3 : « No silent fallback : tout repli
--   INTERDIT sauf explicitement gouverné ET observable ». Gouverné : oui.
--   Observable : non. C'est cette moitié qui manque, et c'est elle qu'on ajoute.
--
-- CHANGEMENT (additif, un seul objet touché) :
--   detect_cwv_trend_divergence() compare deux ensembles qu'elle calcule DÉJÀ :
--     `live`       = clés (route_group, device, metric) qui passent les deux
--                    planchers du présent (recent 7 j ET recent_3d) — donc des
--                    clés réellement observées aujourd'hui ;
--     `comparable` = celles de `live` qui ont EN PLUS une référence — donc
--                    celles que la garde peut réellement juger.
--   Toute clé de `live` absente de `comparable` est une clé sur laquelle la
--   garde est aveugle. Si au moins une l'est (ou si `live` est vide, c.-à-d.
--   plus aucun signal du tout), la fonction émet un événement dans
--   __seo_event_log nommant les clés aveugles et le plancher fautif. Quand la
--   couverture redevient complète, elle RÉSOUT ses propres événements ouverts.
--
-- POURQUOI `comparable < live` ET NON `comparable = 0` :
--   Le déclencheur « vacance totale » serait faux dès le 2026-09-19. Rejeu des
--   30 lignes live décalées sur le run du 09-19 (jours 09-16/17/18 extrapolés au
--   débit du 09-15, hypothèse FAVORABLE au détecteur) :
--     pieces_product/desktop/LCP  n_7d=1007 | n_ref=316 | n_3d=384 | comparable
--     pieces_product/desktop/INP  n_7d= 114 | n_ref= 22 | n_3d= 66 | AVEUGLE
--     pieces_product/mobile/LCP   n_7d= 282 | n_ref= 34 | n_3d=108 | AVEUGLE
--     pieces_product/mobile/INP   n_7d=  98 | n_ref= 17 | n_3d= 39 | AVEUGLE
--     checkout/{desktop,mobile}×{LCP,INP}                          | AVEUGLE ×4
--   -> 1 clé couverte sur 8. Un signal conditionné à `comparable = 0` se serait
--   tu ce jour-là en laissant 7 clés aveugles — dont pieces_product/mobile/INP,
--   la métrique même du chantier en cours. Il aurait vécu 3 runs et se serait
--   éteint pile au moment où il devient utile.
--   Ce prédicat n'introduit AUCUNE constante nouvelle et n'a pas besoin d'un
--   « attendu de couverture » étalonné : il est auto-résorbant. Une clé qui
--   passe `recent` a >= 100 n_exact sur 7 j, soit >= 14,3/j, soit >= 385 sur les
--   27 j de la fenêtre de référence, donc > 300 — dès que son historique franchit
--   le cutoff, elle entre dans `comparable` et le signal se referme tout seul.
--
-- CE QUI N'EST PAS TOUCHÉ (délibérément) :
--   - Les planchers (7 j >= 100, référence >= 300, 3 j n·7 >= 100·3) et le seuil
--     de divergence 1,30, bit pour bit. Les assouplir pour « faire passer » un cas
--     hors de leur périmètre est l'anti-pattern nommé par .claude/rules/guardrails.md.
--     Le contrat de la garde est juste ; c'est sa donnée de référence qui manque.
--   - Aucun second détecteur : la responsabilité est déjà portée ici, on la
--     complète (guardrails.md, passe 2).
--   - La signature RETURNS TABLE(alerts_inserted INT) : inchangée, donc aucun
--     DROP FUNCTION, aucune reprise du job pg_cron, aucune exposition PostgREST
--     modifiée. alerts_inserted reste le compte des SEULES alertes de
--     régression — l'événement de cécité n'y est pas ajouté, pour ne pas faire
--     lire « une régression a été détectée » là où il n'y en a pas.
--   - Aucune donnée recalculée, aucun backfill : READ-ONLY / ALERTING.
--
-- TAXONOMIE — miroir de detect_cwv_aggregation_coverage_gap, qui a résolu le trou
--   SILENCIEUX analogue raw -> hourly. Le miroir porte sur les DEUX migrations qui
--   la définissent aujourd'hui, pas seulement la première :
--     20260601 : enum existant seo_event_type='anomaly_detected' + discriminant
--                payload.alert_kind, sévérité 'high', dédup sur événements OUVERTS
--                (resolved_at IS NULL) < 7 j. AUCUN ALTER TYPE ADD VALUE -> migration
--                100 % réversible, et pas de « valeur d'enum non utilisable dans la
--                transaction qui la crée ».
--     20260626 : AUTO-RÉSOLUTION — quand la condition disparaît, la fonction pose
--                resolved_at + resolution_kind sur ses propres événements ouverts.
--                « Aligne le RUM sur la doctrine CWV OPEN -> STILL_OPEN -> RESOLVED
--                (ADR-063) ». Sans cette moitié, l'événement survit à sa cause et
--                tout gate « 0 alerte ouverte » échoue à vie.
--   `reason` est ajouté à la charge utile parce que rpc_seo_alerts_v1 (source B)
--   ne projette que reason/source/count : sans lui, l'événement se réduit à {} dans
--   cette projection. Les compteurs restent dans la ligne complète de __seo_event_log,
--   qui est la surface réellement lue pour ce détecteur.
--
-- BORNES DE LA CHARGE UTILE : `blind_keys` liste au plus 104 clés
--   (13 route_group × 4 device × 2 metric, bornés par les CHECK de 20260527),
--   donc pas de cap arbitraire à inventer.
--
-- VERROUS : le remplacement de la fonction (CREATE OR REPLACE) ne modifie que le
--   catalogue : aucun lock de table, aucune réécriture. lock_timeout court : en
--   cas d'attente, l'application échoue proprement au lieu de bloquer les lecteurs.
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
-- detect_cwv_trend_divergence() — inchangée sauf le signal de cécité
-- =============================================================================

CREATE OR REPLACE FUNCTION public.detect_cwv_trend_divergence()
RETURNS TABLE(alerts_inserted INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count           INT  := 0;   -- alertes de régression insérées (contrat inchangé)
  v_live_keys       INT  := 0;   -- clés observées aujourd'hui (recent ∩ recent_3d)
  v_comparable      INT  := 0;   -- celles d'entre elles qui ont une référence
  v_exact_rows      INT  := 0;   -- lignes jour×clé dotées d'un bloc exact
  v_recent_keys     INT  := 0;   -- clés passant le plancher 7 j
  v_reference_keys  INT  := 0;   -- clés passant le plancher référence
  v_recent_3d_keys  INT  := 0;   -- clés passant le plancher 3 j
  v_earliest_exact  DATE;        -- 1er jour doté d'un bloc exact dans la fenêtre
  v_blind           JSONB;       -- clés observées SANS référence
  v_reason          TEXT;
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
  live AS (
    -- Clés réellement observées aujourd'hui : les deux planchers du PRÉSENT
    -- passent. Seule la référence peut encore manquer. C'est le dénominateur
    -- de la couverture de la garde.
    SELECT r.route_group, r.device, r.metric
    FROM recent r
    JOIN recent_3d r3 USING (route_group, device, metric)
  ),
  comparable AS (
    -- Clés que le détecteur juge RÉELLEMENT, avant tout verdict de divergence.
    SELECT
      r.route_group, r.device, r.metric,
      r.p75_recent, ref.p75_ref, r3.p75_3d,
      r.samples_recent, ref.samples_reference, r3.samples_3d
    FROM recent r
    JOIN recent_3d r3  USING (route_group, device, metric)
    JOIN reference ref USING (route_group, device, metric)
  ),
  blind AS (
    SELECT l.route_group, l.device, l.metric
    FROM live l
    WHERE NOT EXISTS (
      SELECT 1 FROM comparable c
      WHERE c.route_group = l.route_group
        AND c.device      = l.device
        AND c.metric      = l.metric
    )
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
  -- donc le dénominateur ne peut pas diverger de ce que la garde évalue.
  SELECT
    (SELECT count(*) FROM inserted),
    (SELECT count(*) FROM live),
    (SELECT count(*) FROM comparable),
    (SELECT count(*) FROM exact_days),
    (SELECT count(*) FROM recent),
    (SELECT count(*) FROM reference),
    (SELECT count(*) FROM recent_3d),
    (SELECT min(date) FROM exact_days),
    (SELECT COALESCE(
       jsonb_agg(jsonb_build_object('route_group', route_group, 'device', device, 'metric', metric)
                 ORDER BY route_group, device, metric),
       '[]'::jsonb) FROM blind)
  INTO
    v_count, v_live_keys, v_comparable, v_exact_rows,
    v_recent_keys, v_reference_keys, v_recent_3d_keys, v_earliest_exact, v_blind;

  -- ---------------------------------------------------------------------------
  -- Couverture de la garde. Aveugle sur au moins une clé observée, ou plus
  -- aucune clé observée du tout : sans cet événement, ce cas est indiscernable
  -- de « aucune régression ». Doctrine CWV OPEN -> STILL_OPEN -> RESOLVED.
  -- ---------------------------------------------------------------------------
  IF v_live_keys = 0 OR v_comparable < v_live_keys THEN
    v_reason := CASE
      WHEN v_live_keys = 0 THEN
        'cwv_trend_detector_blind_keys : aucune cle observee (recent ET recent_3d vides) — la garde ne surveille plus rien'
      ELSE
        'cwv_trend_detector_blind_keys : ' || (v_live_keys - v_comparable)::text || ' cle(s) observee(s) sur '
        || v_live_keys::text || ' sans reference — la garde est aveugle dessus'
    END;

    -- Dédup : un seul événement ouvert à la fois (miroir 20260601), refermé par
    -- la branche ELSE ci-dessous dès que la couverture est complète.
    IF NOT EXISTS (
      SELECT 1 FROM public.__seo_event_log e
      WHERE e.event_type = 'anomaly_detected'
        AND e.resolved_at IS NULL
        AND e.created_at >= now() - INTERVAL '7 days'
        AND e.payload->>'alert_kind' = 'cwv_trend_detector_blind_keys'
    ) THEN
      INSERT INTO public.__seo_event_log (event_type, entity_url, severity, payload)
      VALUES (
        'anomaly_detected'::public.seo_event_type,
        NULL,
        'high'::public.seo_severity,
        jsonb_build_object(
          'alert_kind',            'cwv_trend_detector_blind_keys',
          'reason',                v_reason,
          'count',                 v_live_keys - v_comparable,
          'live_keys',             v_live_keys,
          'comparable_keys',       v_comparable,
          'blind_keys',            v_blind,
          'exact_day_rows',        v_exact_rows,
          'recent_keys',           v_recent_keys,
          'reference_keys',        v_reference_keys,
          'recent_3d_keys',        v_recent_3d_keys,
          'earliest_exact_date',   v_earliest_exact,
          'reference_cutoff_date', (CURRENT_DATE - INTERVAL '8 days')::date,
          'hint',                  'detect_cwv_trend_divergence ne juge pas toutes les cles qu elle observe : elle ne peut emettre aucune alerte de regression sur les cles listees dans blind_keys, quel que soit l etat du site. Lire recent_keys / reference_keys / recent_3d_keys pour savoir quel plancher est vide. Cause la plus frequente : p75_exact (20260911) n a pas d historique au-dela du cutoff de reference, et les jours anterieurs ne sont PAS recalculables (brut __seo_cwv_raw purge a 48h). NE PAS assouplir les planchers ni ajouter un second detecteur : le signal est auto-resorbant (une cle qui passe recent a >= 100 n_exact sur 7j, donc > 300 sur les 27j de reference des que son historique franchit le cutoff). Backfiller __seo_cwv_daily_rum.p75_exact depuis un instantane du brut conserve accelere le rearmement.'
        )
      );
    END IF;
  ELSE
    -- Couverture complète rétablie : la garde referme ses propres événements.
    -- Miroir de 20260626 (auto-résolution) — sans quoi l'événement survit à sa
    -- cause et tout gate « 0 alerte ouverte » échoue à vie.
    UPDATE public.__seo_event_log
    SET resolved_at = now(),
        payload = payload || jsonb_build_object(
          'resolution_kind', 'detector_rearmed',
          'resolved_by',     'detect_cwv_trend_divergence',
          'comparable_keys_at_resolution', v_comparable,
          'resolved_at',     now()
        )
    WHERE event_type = 'anomaly_detected'
      AND resolved_at IS NULL
      AND payload->>'alert_kind' = 'cwv_trend_detector_blind_keys';
  END IF;

  alerts_inserted := v_count;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.detect_cwv_trend_divergence() IS
  'Bloc 6 VOLATILE — détecte régressions CWV_P0 LCP/INP > 30% sur 7j vs référence (J-35..J-9) ET confirmé sur 3 derniers jours, sur p75_exact pondéré par n_exact (20260911). Jours sans bloc exact exclus, sans repli sur p75_value. Planchers n_exact : 7j ≥ 100, référence ≥ 300, 3j à densité égale (n·7 ≥ 100·3). Dedup 14j sur même (route_group, device, metric). INSERT __seo_event_log cwv.alert.internal_regression severity=high. 20260916 : mesure sa propre couverture — si au moins une clé observée (recent ∩ recent_3d) n''a pas de référence, ou si plus aucune clé n''est observée, émet anomaly_detected payload.alert_kind=cwv_trend_detector_blind_keys (dedup 7j sur événements ouverts) listant les clés aveugles ; referme ses événements ouverts (resolution_kind=detector_rearmed) dès que la couverture est complète, doctrine OPEN → STILL_OPEN → RESOLVED comme detect_cwv_aggregation_coverage_gap (20260626). Sans quoi une garde aveugle est indiscernable d''une absence de régression. alerts_inserted ne compte QUE les alertes de régression.';

REVOKE EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.detect_cwv_trend_divergence() TO service_role;
