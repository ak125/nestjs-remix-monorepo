-- ============================================================================
-- PR-2 — RPCs de la boucle OBSERVE : materialize (write, service_role) + read (anon-safe)
-- ----------------------------------------------------------------------------
-- Séparation stricte (CHECK-0 flag #2) :
--   * rpc_seo_action_outcomes_materialize_v1 : VOLATILE, SECURITY DEFINER, service_role
--     UNIQUEMENT. Lit __admin_audit_log (attribution) + __seo_gsc_daily (grain query, 71 j)
--     et UPSERT __seo_action_outcome. C'est le SEUL chemin qui lit le ledger admin.
--   * rpc_seo_action_outcomes_v1 : STABLE, SECURITY DEFINER (mirror detect_quality_outliers),
--     lit UNIQUEMENT __seo_action_outcome (table projetée propre). GRANT anon → sûr car
--     ne touche jamais __admin_audit_log.
--
-- Source métrique V1 = __seo_gsc_daily (grain query) : seul à avoir l'historique baseline
-- (71 j) ; biais d'anonymisation ~constant qui s'annule dans le delta (cf. CHECK-0).
-- Math honnête : taux PAR JOUR (impr/clics ÷ n jours), CTR = ratio agrégé, position
-- pondérée impressions ; fenêtre émise complète SEULEMENT si t0+w <= last_data_date.
-- ============================================================================

set lock_timeout = '5s';
set statement_timeout = '120s';

-- ----------------------------------------------------------------------------
-- MATERIALIZE — VOLATILE, service_role only. Idempotent (UPSERT).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_seo_action_outcomes_materialize_v1(
    p_now           timestamptz DEFAULT now(),
    p_lookback_days integer     DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_last_data_date date;
  v_data_lag       int;
  v_complete       int := 0;
  v_pending        int := 0;
  v_windows        int[] := ARRAY[7, 14, 28];
  r                record;
  w                int;
  v_base           record;
  v_obs            record;
  v_overlap        text[];
BEGIN
  SELECT max(date) INTO v_last_data_date FROM public.__seo_gsc_daily;
  IF v_last_data_date IS NULL THEN
    RETURN jsonb_build_object('status', 'no_gsc_data', 'complete', 0, 'pending', 0);
  END IF;
  v_data_lag := (p_now::date - v_last_data_date);

  FOR r IN
    SELECT a.aal_id                                          AS action_ref,
           a.aal_entity_id                                   AS page,
           a.aal_new_value->>'action_kind'                   AS action_kind,
           (a.aal_new_value->>'applied_at_utc')::timestamptz AS t0,
           COALESCE((a.aal_new_value->>'baseline_window_days')::int, 28) AS base_n
    FROM public.__admin_audit_log a
    WHERE a.aal_action = 'seo_action_applied'
      AND (a.aal_new_value->>'applied_at_utc')::timestamptz
            >= p_now - (p_lookback_days || ' days')::interval
      AND (a.aal_new_value->>'applied_at_utc')::timestamptz <= p_now
  LOOP
    -- Chevauchement : autre action sur la MÊME page, T0 différent, à <= 28 j.
    SELECT array_agg(DISTINCT b.aal_id::text) INTO v_overlap
    FROM public.__admin_audit_log b
    WHERE b.aal_action = 'seo_action_applied'
      AND b.aal_entity_id = r.page
      AND b.aal_id <> r.action_ref
      AND abs(extract(epoch FROM (
            (b.aal_new_value->>'applied_at_utc')::timestamptz - r.t0)) / 86400) <= 28;

    FOREACH w IN ARRAY v_windows LOOP
      IF ((r.t0 AT TIME ZONE 'UTC')::date + w) <= v_last_data_date THEN
        -- baseline [t0 - base_n, t0)
        SELECT
          sum(impressions)::float8 / NULLIF(r.base_n, 0)                 AS d_impr,
          sum(clicks)::float8      / NULLIF(r.base_n, 0)                 AS d_clk,
          sum(clicks)::float8      / NULLIF(sum(impressions), 0)         AS ctr,
          sum(position * impressions)::float8 / NULLIF(sum(impressions), 0) AS pos,
          (count(*) > 0)                                                 AS has_data
        INTO v_base
        FROM public.__seo_gsc_daily
        WHERE page = r.page AND date >= ((r.t0 AT TIME ZONE 'UTC')::date - r.base_n) AND date < (r.t0 AT TIME ZONE 'UTC')::date;

        -- observed [t0, t0+w)
        SELECT
          sum(impressions)::float8 / NULLIF(w, 0)                        AS d_impr,
          sum(clicks)::float8      / NULLIF(w, 0)                        AS d_clk,
          sum(clicks)::float8      / NULLIF(sum(impressions), 0)         AS ctr,
          sum(position * impressions)::float8 / NULLIF(sum(impressions), 0) AS pos
        INTO v_obs
        FROM public.__seo_gsc_daily
        WHERE page = r.page AND date >= (r.t0 AT TIME ZONE 'UTC')::date AND date < ((r.t0 AT TIME ZONE 'UTC')::date + w);

        INSERT INTO public.__seo_action_outcome (
          action_ref, page, action_kind, t0_utc, window_days, is_complete,
          expected_complete_date, baseline_has_data,
          baseline_daily_impr, baseline_daily_clicks, baseline_daily_ctr, baseline_daily_pos,
          observed_daily_impr, observed_daily_clicks, observed_daily_ctr, observed_daily_pos,
          delta_daily_impr, delta_daily_clicks, delta_ctr, delta_pos,
          is_overlapped, confounding_actions, data_lag_days, source, causal_claim, measured_at
        ) VALUES (
          r.action_ref, r.page, r.action_kind, r.t0, w, true,
          NULL, COALESCE(v_base.has_data, false),
          v_base.d_impr, v_base.d_clk, v_base.ctr, v_base.pos,
          v_obs.d_impr, v_obs.d_clk, v_obs.ctr, v_obs.pos,
          (COALESCE(v_obs.d_impr, 0) - COALESCE(v_base.d_impr, 0)),
          (COALESCE(v_obs.d_clk, 0)  - COALESCE(v_base.d_clk, 0)),
          (COALESCE(v_obs.ctr, 0)    - COALESCE(v_base.ctr, 0)),
          (COALESCE(v_obs.pos, 0)    - COALESCE(v_base.pos, 0)),
          (v_overlap IS NOT NULL), COALESCE(v_overlap, '{}'), v_data_lag,
          'query_grain', 'OBSERVATIONAL', p_now
        )
        ON CONFLICT (action_ref, window_days) DO UPDATE SET
          is_complete = EXCLUDED.is_complete,
          expected_complete_date = EXCLUDED.expected_complete_date,
          baseline_has_data = EXCLUDED.baseline_has_data,
          baseline_daily_impr = EXCLUDED.baseline_daily_impr,
          baseline_daily_clicks = EXCLUDED.baseline_daily_clicks,
          baseline_daily_ctr = EXCLUDED.baseline_daily_ctr,
          baseline_daily_pos = EXCLUDED.baseline_daily_pos,
          observed_daily_impr = EXCLUDED.observed_daily_impr,
          observed_daily_clicks = EXCLUDED.observed_daily_clicks,
          observed_daily_ctr = EXCLUDED.observed_daily_ctr,
          observed_daily_pos = EXCLUDED.observed_daily_pos,
          delta_daily_impr = EXCLUDED.delta_daily_impr,
          delta_daily_clicks = EXCLUDED.delta_daily_clicks,
          delta_ctr = EXCLUDED.delta_ctr,
          delta_pos = EXCLUDED.delta_pos,
          is_overlapped = EXCLUDED.is_overlapped,
          confounding_actions = EXCLUDED.confounding_actions,
          data_lag_days = EXCLUDED.data_lag_days,
          measured_at = EXCLUDED.measured_at;
        v_complete := v_complete + 1;
      ELSE
        -- fenêtre pas encore mûre → ligne PENDING explicite (jamais un faux 0)
        INSERT INTO public.__seo_action_outcome (
          action_ref, page, action_kind, t0_utc, window_days, is_complete,
          expected_complete_date, baseline_has_data, is_overlapped, confounding_actions,
          data_lag_days, source, causal_claim, measured_at
        ) VALUES (
          r.action_ref, r.page, r.action_kind, r.t0, w, false,
          ((r.t0 AT TIME ZONE 'UTC')::date + w), false, (v_overlap IS NOT NULL), COALESCE(v_overlap, '{}'),
          v_data_lag, 'query_grain', 'OBSERVATIONAL', p_now
        )
        ON CONFLICT (action_ref, window_days) DO UPDATE SET
          expected_complete_date = EXCLUDED.expected_complete_date,
          is_overlapped = EXCLUDED.is_overlapped,
          confounding_actions = EXCLUDED.confounding_actions,
          data_lag_days = EXCLUDED.data_lag_days,
          measured_at = EXCLUDED.measured_at
        WHERE public.__seo_action_outcome.is_complete = false; -- ne jamais écraser un outcome complet
        v_pending := v_pending + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'ok', 'complete', v_complete, 'pending', v_pending,
    'last_data_date', v_last_data_date, 'data_lag_days', v_data_lag, 'generated_at', p_now
  );
END;
$function$;

-- FROM PUBLIC seul NE SUFFIT PAS : les default privileges Supabase accordent EXECUTE
-- aux roles anon/authenticated sur toute fonction de public → on les retire explicitement.
-- materialize = VOLATILE + SECURITY DEFINER (écrit + lit le ledger admin) → service_role ONLY.
REVOKE ALL ON FUNCTION public.rpc_seo_action_outcomes_materialize_v1(timestamptz, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_seo_action_outcomes_materialize_v1(timestamptz, integer) TO service_role;

COMMENT ON FUNCTION public.rpc_seo_action_outcomes_materialize_v1(timestamptz, integer) IS
  'PR-2 boucle OBSERVE — matérialise les outcomes (delta baseline vs fenêtre 7/14/28 j) depuis '
  'les attributions seo_action_applied × __seo_gsc_daily. VOLATILE, service_role only (lit le '
  'ledger admin). Idempotent. Fenêtre émise complète seulement si t0+w <= last_data_date.';

-- ----------------------------------------------------------------------------
-- READ — STABLE SECURITY DEFINER, anon-safe (lit la table projetée uniquement).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_seo_action_outcomes_v1(
    p_now           timestamptz DEFAULT now(),
    p_lookback_days integer     DEFAULT 90,
    p_limit         integer     DEFAULT 100
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH sel AS (
    SELECT o.*
    FROM public.__seo_action_outcome o
    WHERE o.t0_utc >= p_now - (p_lookback_days || ' days')::interval
      AND o.t0_utc <= p_now
    ORDER BY o.t0_utc DESC, o.window_days
    LIMIT GREATEST(p_limit, 0)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'action_ref', s.action_ref,
        'page', s.page,
        'action_kind', s.action_kind,
        't0_utc', s.t0_utc,
        'window_days', s.window_days,
        'is_complete', s.is_complete,
        'expected_complete_date', s.expected_complete_date,
        'baseline_has_data', s.baseline_has_data,
        'baseline_daily', jsonb_build_object(
          'impressions', s.baseline_daily_impr, 'clicks', s.baseline_daily_clicks,
          'ctr', s.baseline_daily_ctr, 'avg_position', s.baseline_daily_pos),
        'observed_daily', jsonb_build_object(
          'impressions', s.observed_daily_impr, 'clicks', s.observed_daily_clicks,
          'ctr', s.observed_daily_ctr, 'avg_position', s.observed_daily_pos),
        'delta', jsonb_build_object(
          'daily_impressions', s.delta_daily_impr, 'daily_clicks', s.delta_daily_clicks,
          'ctr', s.delta_ctr, 'avg_position', s.delta_pos),
        'is_overlapped', s.is_overlapped,
        'confounding_actions', s.confounding_actions,
        'data_lag_days', s.data_lag_days,
        'source', s.source,
        'causal_claim', s.causal_claim,
        'measured_at', s.measured_at
      ) ORDER BY s.t0_utc DESC, s.window_days)
      FROM sel s
    ), '[]'::jsonb),
    'total', (SELECT count(*) FROM sel),
    'complete', (SELECT count(*) FROM sel WHERE is_complete),
    'pending', (SELECT count(*) FROM sel WHERE NOT is_complete),
    'last_data_date', (SELECT max(date) FROM public.__seo_gsc_daily),
    'metric_source', 'query_grain',
    'causal_disclaimer',
      'OBSERVATIONAL — comparaison baseline vs fenêtre, PAS une inférence causale '
      || '(saisonnalité, concurrence, mises à jour algorithme non contrôlées).',
    'generated_at', p_now
  );
$function$;

REVOKE ALL ON FUNCTION public.rpc_seo_action_outcomes_v1(timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_seo_action_outcomes_v1(timestamptz, integer, integer)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.rpc_seo_action_outcomes_v1(timestamptz, integer, integer) IS
  'PR-2 boucle OBSERVE — lecture des outcomes SEO matérialisés (enveloppe honnête : rows + '
  'complete/pending + last_data_date + disclaimer OBSERVATIONNEL). STABLE, lit UNIQUEMENT '
  '__seo_action_outcome (jamais __admin_audit_log) → anon-safe.';
