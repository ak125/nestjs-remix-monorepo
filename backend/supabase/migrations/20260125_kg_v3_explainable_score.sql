-- ============================================================================
-- KNOWLEDGE GRAPH V3.0 - PHASE 4C: EXPLAINABLE SCORE
-- Score Explicable: Probability (knowledge score) + Confidence (data score)
-- ============================================================================
--
-- PRINCIPE:
-- Un systeme pro sort 2 scores:
-- 1. PROBABILITY SCORE (0-100%): Panne la plus probable (basé sur le graphe)
-- 2. CONFIDENCE SCORE (0-100%): Qualité du diagnostic (basé sur les inputs)
--
-- CONFIDENCE FACTORS:
-- - has_km: +15% (kilométrage fourni)
-- - has_history: +20% (historique entretien)
-- - has_context: +15% (phase/temp/vitesse - au moins 2 sur 3)
-- - has_multiple_observables: +10% (>1 observable)
-- - has_known_vehicle: +15% (modèle ou famille moteur connu)
-- - has_dtc: +20% (code OBD fourni)
-- - base: +5% (minimum)
-- TOTAL POSSIBLE: 100%
--
-- CONFIDENCE LEVELS:
-- 80-100%: high (Diagnostic fiable)
-- 60-79%: good (Diagnostic probable)
-- 40-59%: medium (Diagnostic indicatif)
-- 20-39%: low (Diagnostic à confirmer)
-- 0-19%: very_low (Informations insuffisantes)
--
-- ============================================================================

-- ============================================================================
-- CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS kg_confidence_config (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Confidence factor weights (sum = 100)
  weight_km INT DEFAULT 15,
  weight_history INT DEFAULT 20,
  weight_context INT DEFAULT 15,
  weight_multiple_observables INT DEFAULT 10,
  weight_known_vehicle INT DEFAULT 15,
  weight_dtc INT DEFAULT 20,
  weight_base INT DEFAULT 5,

  -- Confidence thresholds
  threshold_high INT DEFAULT 80,
  threshold_good INT DEFAULT 60,
  threshold_medium INT DEFAULT 40,
  threshold_low INT DEFAULT 20,

  -- Probability thresholds (based on raw_score / matched_count)
  prob_very_high_threshold FLOAT DEFAULT 8.0,
  prob_high_threshold FLOAT DEFAULT 6.0,
  prob_medium_threshold FLOAT DEFAULT 4.0,
  prob_low_threshold FLOAT DEFAULT 2.0,

  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Insert default configuration
INSERT INTO kg_confidence_config (
  weight_km, weight_history, weight_context,
  weight_multiple_observables, weight_known_vehicle, weight_dtc, weight_base
) VALUES (15, 20, 15, 10, 15, 20, 5)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTION: Calculate confidence score and factors
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_calculate_confidence_score(
  p_current_km INT,
  p_maintenance_records JSONB,
  p_ctx_phase TEXT,
  p_ctx_temp TEXT,
  p_ctx_speed TEXT,
  p_observable_count INT,
  p_vehicle_id UUID,
  p_engine_family_code TEXT,
  p_has_dtc BOOLEAN
)
RETURNS TABLE (
  confidence_score INT,
  confidence_level TEXT,
  confidence_factors JSONB,
  missing_factors TEXT[],
  improvement_tips TEXT[],
  confidence_explanation TEXT
) AS $$
DECLARE
  v_config RECORD;
  v_has_km BOOLEAN;
  v_has_history BOOLEAN;
  v_has_context BOOLEAN;
  v_has_multiple_obs BOOLEAN;
  v_has_known_vehicle BOOLEAN;
  v_score INT;
  v_level TEXT;
  v_missing TEXT[] := '{}';
  v_tips TEXT[] := '{}';
  v_explanation TEXT;
BEGIN
  -- Get active config
  SELECT * INTO v_config FROM kg_confidence_config WHERE is_active = TRUE LIMIT 1;

  -- Calculate each factor
  v_has_km := p_current_km IS NOT NULL;
  v_has_history := p_maintenance_records IS NOT NULL AND JSONB_ARRAY_LENGTH(p_maintenance_records) > 0;
  v_has_context := (
    (p_ctx_phase IS NOT NULL)::INT +
    (p_ctx_temp IS NOT NULL)::INT +
    (p_ctx_speed IS NOT NULL)::INT
  ) >= 2;
  v_has_multiple_obs := p_observable_count > 1;
  v_has_known_vehicle := p_vehicle_id IS NOT NULL OR p_engine_family_code IS NOT NULL;

  -- Calculate score
  v_score := v_config.weight_base
    + (CASE WHEN v_has_km THEN v_config.weight_km ELSE 0 END)
    + (CASE WHEN v_has_history THEN v_config.weight_history ELSE 0 END)
    + (CASE WHEN v_has_context THEN v_config.weight_context ELSE 0 END)
    + (CASE WHEN v_has_multiple_obs THEN v_config.weight_multiple_observables ELSE 0 END)
    + (CASE WHEN v_has_known_vehicle THEN v_config.weight_known_vehicle ELSE 0 END)
    + (CASE WHEN p_has_dtc THEN v_config.weight_dtc ELSE 0 END);

  -- Determine level
  IF v_score >= v_config.threshold_high THEN
    v_level := 'high';
    v_explanation := 'Diagnostic fiable - données complètes';
  ELSIF v_score >= v_config.threshold_good THEN
    v_level := 'good';
  ELSIF v_score >= v_config.threshold_medium THEN
    v_level := 'medium';
  ELSIF v_score >= v_config.threshold_low THEN
    v_level := 'low';
  ELSE
    v_level := 'very_low';
  END IF;

  -- Build missing factors and tips
  IF NOT v_has_km THEN
    v_missing := v_missing || 'km';
    v_tips := v_tips || FORMAT('Ajoutez le kilométrage pour +%s%% de confidence', v_config.weight_km);
  END IF;
  IF NOT v_has_history THEN
    v_missing := v_missing || 'historique';
    v_tips := v_tips || FORMAT('Ajoutez l''historique d''entretien pour +%s%% de confidence', v_config.weight_history);
  END IF;
  IF NOT v_has_context THEN
    v_missing := v_missing || 'contexte';
    v_tips := v_tips || FORMAT('Précisez le contexte (phase, température, vitesse) pour +%s%%', v_config.weight_context);
  END IF;
  IF NOT v_has_known_vehicle THEN
    v_missing := v_missing || 'véhicule';
    v_tips := v_tips || FORMAT('Identifiez le véhicule pour +%s%% et des résultats spécifiques', v_config.weight_known_vehicle);
  END IF;
  IF NOT p_has_dtc THEN
    v_missing := v_missing || 'code_obd';
    v_tips := v_tips || FORMAT('Un code OBD augmente la confidence de +%s%%', v_config.weight_dtc);
  END IF;

  -- Build explanation based on level
  IF v_level != 'high' THEN
    IF v_level = 'good' THEN
      v_explanation := 'Diagnostic probable - ' || ARRAY_TO_STRING(v_missing, ', ') || ' manquant(s)';
    ELSIF v_level = 'medium' THEN
      v_explanation := 'Diagnostic indicatif - informations limitées';
    ELSIF v_level = 'low' THEN
      v_explanation := 'Diagnostic à confirmer - plusieurs données manquantes';
    ELSE
      v_explanation := 'Informations insuffisantes pour un diagnostic fiable';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    v_score,
    v_level,
    JSONB_BUILD_OBJECT(
      'has_km', v_has_km,
      'has_history', v_has_history,
      'has_context', v_has_context,
      'has_multiple_observables', v_has_multiple_obs,
      'has_known_vehicle', v_has_known_vehicle,
      'has_dtc', p_has_dtc
    ),
    v_missing,
    v_tips,
    v_explanation;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_calculate_confidence_score IS
'Calcule le score de confidence basé sur la qualité des données fournies.
Retourne le score (0-100), le niveau, les facteurs détaillés, et des conseils pour améliorer.';

-- ============================================================================
-- MAIN RPC: Diagnose with Explainable Score
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_diagnose_with_explainable_score(
  p_observable_ids UUID[],
  p_vehicle_id UUID DEFAULT NULL,
  p_engine_family_code TEXT DEFAULT NULL,
  p_current_km INT DEFAULT NULL,
  p_last_maintenance_records JSONB DEFAULT '[]'::JSONB,
  p_ctx_phase TEXT DEFAULT NULL,
  p_ctx_temp TEXT DEFAULT NULL,
  p_ctx_speed TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  -- Fault identification
  fault_id UUID,
  fault_label TEXT,
  fault_family TEXT,

  -- Probability Score (Knowledge Score)
  probability_score INT,
  probability_level TEXT,
  raw_score FLOAT,

  -- Confidence Score (Data Score)
  confidence_score INT,
  confidence_level TEXT,
  confidence_factors JSONB,
  missing_factors TEXT[],
  improvement_tips TEXT[],
  confidence_explanation TEXT,

  -- Match details
  matched_observables INT,
  total_observables INT,
  matched_observable_labels TEXT[],

  -- Vehicle specificity
  is_vehicle_specific BOOLEAN,
  engine_family_boost FLOAT,

  -- Actions
  recommended_actions JSONB,

  -- Metadata
  diagnostic_timestamp TIMESTAMPTZ
) AS $$
DECLARE
  v_has_dtc BOOLEAN;
  v_observable_count INT;
  v_config RECORD;
  v_conf_score INT;
  v_conf_level TEXT;
  v_conf_factors JSONB;
  v_missing TEXT[];
  v_tips TEXT[];
  v_conf_explanation TEXT;
BEGIN
  -- Get config
  SELECT * INTO v_config FROM kg_confidence_config WHERE is_active = TRUE LIMIT 1;

  -- Count observables
  v_observable_count := COALESCE(ARRAY_LENGTH(p_observable_ids, 1), 0);

  -- Check if any observable is a DTC
  SELECT EXISTS(
    SELECT 1 FROM kg_nodes
    WHERE node_id = ANY(p_observable_ids)
      AND input_type = 'dtc'
  ) INTO v_has_dtc;

  -- Calculate confidence score once (same for all faults)
  SELECT cs.* INTO v_conf_score, v_conf_level, v_conf_factors, v_missing, v_tips, v_conf_explanation
  FROM kg_calculate_confidence_score(
    p_current_km,
    p_last_maintenance_records,
    p_ctx_phase,
    p_ctx_temp,
    p_ctx_speed,
    v_observable_count,
    p_vehicle_id,
    p_engine_family_code,
    v_has_dtc
  ) cs;

  RETURN QUERY
  WITH diagnosed_faults AS (
    -- Core diagnostic logic
    SELECT
      f.node_id AS fault_id,
      f.node_label AS fault_label,
      ff.node_label AS fault_family,
      SUM(
        e.weight * e.confidence *
        COALESCE(
          CASE
            WHEN p_engine_family_code IS NOT NULL
              AND e.evidence->>'specific_to_engine_family' = p_engine_family_code
            THEN (e.evidence->>'boost_factor')::FLOAT
            ELSE 1.0
          END,
          1.0
        )
      ) AS total_raw_score,
      COUNT(DISTINCT e.source_node_id) AS matched_count,
      ARRAY_AGG(DISTINCT o.node_label) AS matched_labels,
      BOOL_OR(e.evidence->>'specific_to_engine_family' = p_engine_family_code) AS is_specific,
      MAX(COALESCE((e.evidence->>'boost_factor')::FLOAT, 1.0)) AS max_boost
    FROM kg_nodes f
    JOIN kg_edges e ON e.target_node_id = f.node_id
      AND e.edge_type IN ('INDICATES', 'CONFIRMS', 'MANIFESTS_AS', 'CAUSES')
      AND e.is_active = TRUE
      AND (e.status IS NULL OR e.status = 'active')
    JOIN kg_nodes o ON o.node_id = e.source_node_id
    LEFT JOIN kg_edges e_family ON e_family.source_node_id = f.node_id
      AND e_family.edge_type = 'BELONGS_TO_FAMILY'
    LEFT JOIN kg_nodes ff ON ff.node_id = e_family.target_node_id
      AND ff.node_type = 'FaultFamily'
    WHERE f.node_type = 'Fault'
      AND (f.status IS NULL OR f.status = 'active')
      AND e.source_node_id = ANY(p_observable_ids)
    GROUP BY f.node_id, f.node_label, ff.node_label
    ORDER BY total_raw_score DESC
    LIMIT p_limit
  ),
  fault_actions AS (
    -- Get recommended actions for each fault
    SELECT
      df.fault_id,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'action_id', a.node_id,
          'action_label', a.node_label,
          'action_type', a.action_type,
          'urgency', a.urgency,
          'estimated_duration', a.estimated_duration,
          'safety_level', a.safety_level
        ) ORDER BY
          CASE a.urgency
            WHEN 'immediate' THEN 1
            WHEN 'soon' THEN 2
            ELSE 3
          END
      ) AS actions
    FROM diagnosed_faults df
    JOIN kg_edges ea ON ea.source_node_id = df.fault_id
      AND ea.edge_type = 'FIXED_BY'
    JOIN kg_nodes a ON a.node_id = ea.target_node_id
      AND a.node_type = 'Action'
    GROUP BY df.fault_id
  )
  SELECT
    df.fault_id,
    df.fault_label,
    df.fault_family,

    -- Probability score (normalized 0-100)
    LEAST(100, GREATEST(0,
      (df.total_raw_score / NULLIF(df.matched_count, 0) * 10)::INT
    ))::INT AS probability_score,

    -- Probability level
    CASE
      WHEN df.total_raw_score >= v_config.prob_very_high_threshold * df.matched_count THEN 'very_high'
      WHEN df.total_raw_score >= v_config.prob_high_threshold * df.matched_count THEN 'high'
      WHEN df.total_raw_score >= v_config.prob_medium_threshold * df.matched_count THEN 'medium'
      WHEN df.total_raw_score >= v_config.prob_low_threshold * df.matched_count THEN 'low'
      ELSE 'very_low'
    END AS probability_level,

    df.total_raw_score AS raw_score,

    -- Confidence score (same for all)
    v_conf_score AS confidence_score,
    v_conf_level AS confidence_level,
    v_conf_factors AS confidence_factors,
    v_missing AS missing_factors,
    v_tips AS improvement_tips,
    v_conf_explanation AS confidence_explanation,

    -- Match details
    df.matched_count::INT AS matched_observables,
    v_observable_count AS total_observables,
    df.matched_labels AS matched_observable_labels,

    -- Vehicle specificity
    COALESCE(df.is_specific, FALSE) AS is_vehicle_specific,
    df.max_boost AS engine_family_boost,

    -- Actions
    COALESCE(fa.actions, '[]'::JSONB) AS recommended_actions,

    -- Metadata
    NOW() AS diagnostic_timestamp
  FROM diagnosed_faults df
  LEFT JOIN fault_actions fa ON fa.fault_id = df.fault_id;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_diagnose_with_explainable_score IS
'Diagnostic avec scores explicables séparés:
- PROBABILITY SCORE (0-100%): Probabilité que cette panne soit la cause (basé sur le graphe)
- CONFIDENCE SCORE (0-100%): Qualité du diagnostic (basé sur les données fournies)

Retourne également:
- Facteurs de confidence détaillés
- Conseils pour améliorer la confidence
- Actions recommandées
- Boost si véhicule spécifique détecté';

-- ============================================================================
-- SIMPLIFIED VERSION: For quick lookups
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_quick_diagnose(
  p_observable_ids UUID[],
  p_engine_family_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  fault_id UUID,
  fault_label TEXT,
  probability_score INT,
  probability_level TEXT,
  confidence_score INT,
  confidence_level TEXT,
  is_vehicle_specific BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.fault_id,
    r.fault_label,
    r.probability_score,
    r.probability_level,
    r.confidence_score,
    r.confidence_level,
    r.is_vehicle_specific
  FROM kg_diagnose_with_explainable_score(
    p_observable_ids,
    NULL,  -- p_vehicle_id
    p_engine_family_code,
    NULL,  -- p_current_km
    '[]'::JSONB,  -- p_last_maintenance_records
    NULL,  -- p_ctx_phase
    NULL,  -- p_ctx_temp
    NULL,  -- p_ctx_speed
    5      -- p_limit
  ) r;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_quick_diagnose IS
'Version simplifiée du diagnostic avec scores explicables.
Retourne seulement les scores essentiels sans détails.';

-- ============================================================================
-- VIEW: Diagnostic Quality Metrics
-- ============================================================================

CREATE OR REPLACE VIEW kg_diagnostic_quality_stats AS
WITH recent_diagnostics AS (
  SELECT
    input_data->>'confidence_score' AS confidence_score,
    input_data->>'confidence_level' AS confidence_level,
    input_data->'confidence_factors' AS factors,
    created_at
  FROM kg_reasoning_cache
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND input_data->>'confidence_score' IS NOT NULL
)
SELECT
  confidence_level,
  COUNT(*) AS diagnostic_count,
  ROUND(AVG((confidence_score)::INT), 1) AS avg_confidence_score,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (factors->>'has_km')::BOOLEAN = TRUE) / COUNT(*), 1) AS pct_with_km,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (factors->>'has_history')::BOOLEAN = TRUE) / COUNT(*), 1) AS pct_with_history,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (factors->>'has_context')::BOOLEAN = TRUE) / COUNT(*), 1) AS pct_with_context,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (factors->>'has_dtc')::BOOLEAN = TRUE) / COUNT(*), 1) AS pct_with_dtc,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (factors->>'has_known_vehicle')::BOOLEAN = TRUE) / COUNT(*), 1) AS pct_with_vehicle
FROM recent_diagnostics
GROUP BY confidence_level
ORDER BY
  CASE confidence_level
    WHEN 'very_low' THEN 1
    WHEN 'low' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'good' THEN 4
    WHEN 'high' THEN 5
  END;

COMMENT ON VIEW kg_diagnostic_quality_stats IS
'Statistiques sur la qualité des diagnostics des 30 derniers jours.
Permet d''identifier les données manquantes les plus fréquentes.';

-- ============================================================================
-- FUNCTION: Get improvement suggestions for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_get_confidence_improvements(
  p_user_id UUID
)
RETURNS TABLE (
  factor TEXT,
  current_usage_pct FLOAT,
  potential_gain INT,
  suggestion TEXT
) AS $$
DECLARE
  v_config RECORD;
BEGIN
  SELECT * INTO v_config FROM kg_confidence_config WHERE is_active = TRUE LIMIT 1;

  RETURN QUERY
  WITH user_diagnostics AS (
    SELECT
      input_data->'confidence_factors' AS factors
    FROM kg_reasoning_cache
    WHERE (input_data->>'user_id')::UUID = p_user_id
      AND created_at > NOW() - INTERVAL '90 days'
  ),
  factor_stats AS (
    SELECT
      'km' AS factor,
      100.0 * COUNT(*) FILTER (WHERE (factors->>'has_km')::BOOLEAN = TRUE) / NULLIF(COUNT(*), 0) AS usage_pct,
      v_config.weight_km AS gain
    FROM user_diagnostics
    UNION ALL
    SELECT
      'historique' AS factor,
      100.0 * COUNT(*) FILTER (WHERE (factors->>'has_history')::BOOLEAN = TRUE) / NULLIF(COUNT(*), 0),
      v_config.weight_history
    FROM user_diagnostics
    UNION ALL
    SELECT
      'contexte' AS factor,
      100.0 * COUNT(*) FILTER (WHERE (factors->>'has_context')::BOOLEAN = TRUE) / NULLIF(COUNT(*), 0),
      v_config.weight_context
    FROM user_diagnostics
    UNION ALL
    SELECT
      'véhicule' AS factor,
      100.0 * COUNT(*) FILTER (WHERE (factors->>'has_known_vehicle')::BOOLEAN = TRUE) / NULLIF(COUNT(*), 0),
      v_config.weight_known_vehicle
    FROM user_diagnostics
    UNION ALL
    SELECT
      'code_obd' AS factor,
      100.0 * COUNT(*) FILTER (WHERE (factors->>'has_dtc')::BOOLEAN = TRUE) / NULLIF(COUNT(*), 0),
      v_config.weight_dtc
    FROM user_diagnostics
  )
  SELECT
    fs.factor,
    COALESCE(fs.usage_pct, 0)::FLOAT AS current_usage_pct,
    fs.gain AS potential_gain,
    CASE fs.factor
      WHEN 'km' THEN 'Ajoutez le kilométrage de votre véhicule pour des diagnostics plus précis'
      WHEN 'historique' THEN 'Renseignez votre historique d''entretien pour une meilleure analyse'
      WHEN 'contexte' THEN 'Décrivez le contexte (quand, comment) pour affiner le diagnostic'
      WHEN 'véhicule' THEN 'Sélectionnez votre véhicule exact pour des résultats spécifiques'
      WHEN 'code_obd' THEN 'Utilisez une valise OBD pour des diagnostics professionnels'
    END AS suggestion
  FROM factor_stats fs
  WHERE COALESCE(fs.usage_pct, 0) < 80  -- Only suggest if usage < 80%
  ORDER BY fs.gain DESC, fs.usage_pct ASC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_get_confidence_improvements IS
'Suggestions personnalisées pour améliorer la confidence des diagnostics d''un utilisateur.
Basé sur son historique des 90 derniers jours.';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index for confidence config lookup
CREATE INDEX IF NOT EXISTS idx_kg_confidence_config_active
ON kg_confidence_config(is_active)
WHERE is_active = TRUE;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE kg_confidence_config ENABLE ROW LEVEL SECURITY;

-- Admin only for config
CREATE POLICY kg_confidence_config_admin_all ON kg_confidence_config
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

-- Read-only for authenticated users
CREATE POLICY kg_confidence_config_read ON kg_confidence_config
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION kg_calculate_confidence_score TO authenticated;
GRANT EXECUTE ON FUNCTION kg_diagnose_with_explainable_score TO authenticated;
GRANT EXECUTE ON FUNCTION kg_quick_diagnose TO authenticated;
GRANT EXECUTE ON FUNCTION kg_get_confidence_improvements TO authenticated;
GRANT SELECT ON kg_diagnostic_quality_stats TO authenticated;
GRANT SELECT ON kg_confidence_config TO authenticated;
