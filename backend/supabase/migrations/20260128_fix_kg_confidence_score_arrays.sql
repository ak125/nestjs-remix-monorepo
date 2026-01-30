-- ============================================================================
-- FIX: kg_calculate_confidence_score array concatenation bug
-- Bug: Using 'array || string' instead of 'array_append(array, string)'
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

  -- Build missing factors and tips (FIX: use array_append instead of ||)
  IF NOT v_has_km THEN
    v_missing := array_append(v_missing, 'km');
    v_tips := array_append(v_tips, FORMAT('Ajoutez le kilométrage pour +%s%% de confidence', v_config.weight_km));
  END IF;
  IF NOT v_has_history THEN
    v_missing := array_append(v_missing, 'historique');
    v_tips := array_append(v_tips, FORMAT('Ajoutez l''historique d''entretien pour +%s%% de confidence', v_config.weight_history));
  END IF;
  IF NOT v_has_context THEN
    v_missing := array_append(v_missing, 'contexte');
    v_tips := array_append(v_tips, FORMAT('Précisez le contexte (phase, température, vitesse) pour +%s%%', v_config.weight_context));
  END IF;
  IF NOT v_has_known_vehicle THEN
    v_missing := array_append(v_missing, 'véhicule');
    v_tips := array_append(v_tips, FORMAT('Identifiez le véhicule pour +%s%% et des résultats spécifiques', v_config.weight_known_vehicle));
  END IF;
  IF NOT p_has_dtc THEN
    v_missing := array_append(v_missing, 'code_obd');
    v_tips := array_append(v_tips, FORMAT('Un code OBD augmente la confidence de +%s%%', v_config.weight_dtc));
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
