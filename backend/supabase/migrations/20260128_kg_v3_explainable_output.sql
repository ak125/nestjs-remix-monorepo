-- ============================================================================
-- KNOWLEDGE GRAPH V3.0 - PHASE 4D: EXPLAINABLE OUTPUT
-- Génération de blocs explicatifs standardisés pour diagnostics
-- ============================================================================
--
-- OBJECTIF: Générer un bloc formaté réutilisable contenant:
--   1. POURQUOI (Why) - Explication du diagnostic
--   2. CONTROLE (Quick Check) - Test rapide recommandé
--   3. URGENCE (Urgency) - Niveau d'urgence avec message
--   4. PIECES (Parts) - Pièces concernées avec prix estimés
--
-- UTILISATION:
--   - Pages diagnostic frontend
--   - Génération de contenu blog/FAQ
--   - Emails de recommandation
--   - Chatbot/assistant
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- MAIN RPC: Generate Explainable Diagnostic Block
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_generate_explainable_diagnostic(
  p_fault_id UUID,
  p_matched_observable_ids UUID[],
  p_ctx_phase TEXT DEFAULT NULL,
  p_ctx_temp TEXT DEFAULT NULL,
  p_ctx_speed TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_fault RECORD;
  v_why JSONB;
  v_quick_check JSONB;
  v_urgency JSONB;
  v_parts JSONB;
  v_matched_symptoms TEXT[];
  v_context_used TEXT[];
  v_explanation TEXT;
  v_control_action RECORD;
BEGIN
  -- =========================================================================
  -- 1. Récupérer les infos de la panne
  -- =========================================================================
  SELECT
    n.node_id,
    n.node_label,
    n.node_category,
    n.urgency,
    n.safety_level,
    n.node_data
  INTO v_fault
  FROM kg_nodes n
  WHERE n.node_id = p_fault_id
    AND n.node_type = 'Fault';

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Fault not found: ' || p_fault_id
    );
  END IF;

  -- =========================================================================
  -- 2. POURQUOI - Collecter les symptômes matchés
  -- =========================================================================
  SELECT ARRAY_AGG(DISTINCT o.node_label)
  INTO v_matched_symptoms
  FROM kg_nodes o
  WHERE o.node_id = ANY(p_matched_observable_ids);

  -- Contexte utilisé
  v_context_used := '{}';
  IF p_ctx_phase IS NOT NULL THEN
    v_context_used := v_context_used || (
      CASE p_ctx_phase
        WHEN 'demarrage' THEN 'au démarrage'
        WHEN 'ralenti' THEN 'au ralenti'
        WHEN 'acceleration' THEN 'en accélération'
        WHEN 'regime_constant' THEN 'à régime constant'
        WHEN 'deceleration' THEN 'en décélération'
        WHEN 'arret' THEN 'à l''arrêt'
        ELSE p_ctx_phase
      END
    );
  END IF;
  IF p_ctx_temp IS NOT NULL THEN
    v_context_used := v_context_used || (
      CASE p_ctx_temp
        WHEN 'froid' THEN 'moteur froid'
        WHEN 'chaud' THEN 'moteur chaud'
        WHEN 'surchauffe' THEN 'en surchauffe'
        ELSE p_ctx_temp
      END
    );
  END IF;
  IF p_ctx_speed IS NOT NULL THEN
    v_context_used := v_context_used || (
      CASE p_ctx_speed
        WHEN '0_30' THEN 'à basse vitesse (0-30 km/h)'
        WHEN '30_70' THEN 'en ville (30-70 km/h)'
        WHEN '70_110' THEN 'sur route (70-110 km/h)'
        WHEN '110_plus' THEN 'sur autoroute (>110 km/h)'
        ELSE p_ctx_speed
      END
    );
  END IF;

  -- Générer l'explication
  v_explanation := FORMAT(
    'Ce diagnostic de "%s" est basé sur %s symptôme(s) correspondant(s)%s.',
    v_fault.node_label,
    COALESCE(ARRAY_LENGTH(v_matched_symptoms, 1), 0),
    CASE WHEN ARRAY_LENGTH(v_context_used, 1) > 0
      THEN ' observé(s) ' || ARRAY_TO_STRING(v_context_used, ', ')
      ELSE ''
    END
  );

  v_why := jsonb_build_object(
    'title', FORMAT('Pourquoi "%s" ?', v_fault.node_label),
    'matched_symptoms', COALESCE(v_matched_symptoms, '{}'),
    'context_used', v_context_used,
    'explanation', v_explanation
  );

  -- =========================================================================
  -- 3. CONTROLE RAPIDE - Trouver une action de type 'controle'
  -- =========================================================================
  SELECT
    a.node_label,
    a.estimated_duration,
    a.skill_level,
    a.tools_required,
    a.prerequisites,
    a.node_data
  INTO v_control_action
  FROM kg_edges e
  JOIN kg_nodes a ON a.node_id = e.target_node_id
  WHERE e.source_node_id = p_fault_id
    AND e.edge_type IN ('FIXED_BY', 'DIAGNOSED_BY')
    AND e.status = 'active'
    AND a.node_type = 'Action'
    AND a.action_type = 'controle'
  ORDER BY a.confidence_base DESC
  LIMIT 1;

  IF v_control_action IS NOT NULL THEN
    v_quick_check := jsonb_build_object(
      'title', 'Test rapide recommandé',
      'action_label', v_control_action.node_label,
      'steps', COALESCE(
        v_control_action.node_data->'steps',
        '["Effectuer un contrôle visuel"]'::JSONB
      ),
      'tools_needed', COALESCE(v_control_action.tools_required, '[]'::JSONB),
      'skill_level', COALESCE(v_control_action.skill_level, 'diy'),
      'estimated_time', COALESCE(v_control_action.estimated_duration, '15min'),
      'prerequisites', COALESCE(v_control_action.prerequisites, '[]'::JSONB)
    );
  ELSE
    -- Fallback: contrôle visuel générique
    v_quick_check := jsonb_build_object(
      'title', 'Test rapide recommandé',
      'action_label', 'Contrôle visuel',
      'steps', jsonb_build_array(
        'Ouvrir le capot moteur',
        'Inspecter visuellement les composants concernés',
        'Rechercher des traces de fuite, usure ou dommage',
        'Noter toute anomalie observée'
      ),
      'tools_needed', '[]'::JSONB,
      'skill_level', 'diy',
      'estimated_time', '10min',
      'prerequisites', '[]'::JSONB
    );
  END IF;

  -- =========================================================================
  -- 4. URGENCE - Niveau et message
  -- =========================================================================
  v_urgency := jsonb_build_object(
    'level', COALESCE(v_fault.urgency, 'scheduled'),
    'safety_level', COALESCE(v_fault.safety_level, 'normal'),
    'message', CASE COALESCE(v_fault.urgency, 'scheduled')
      WHEN 'immediate' THEN 'Intervention urgente requise - Ne pas rouler'
      WHEN 'soon' THEN 'À traiter sous 1-2 semaines'
      ELSE 'À planifier lors du prochain entretien'
    END,
    'color', CASE COALESCE(v_fault.urgency, 'scheduled')
      WHEN 'immediate' THEN 'red'
      WHEN 'soon' THEN 'orange'
      ELSE 'green'
    END,
    'icon', CASE COALESCE(v_fault.urgency, 'scheduled')
      WHEN 'immediate' THEN 'alert-triangle'
      WHEN 'soon' THEN 'clock'
      ELSE 'calendar'
    END
  );

  -- =========================================================================
  -- 5. PIECES CONCERNEES - Avec prix estimés
  -- =========================================================================
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'label', p.node_label,
      'pg_id', (p.node_data->>'pg_id')::INT,
      'estimated_price_range', jsonb_build_array(
        COALESCE((p.node_data->>'price_min')::INT, 0),
        COALESCE((p.node_data->>'price_max')::INT, 0)
      ),
      'gamme_url', '/pieces/gamme-' || (p.node_data->>'pg_id') || '.html',
      'is_primary', (e.edge_data->>'is_primary')::BOOLEAN
    )
  ), '[]'::JSONB)
  INTO v_parts
  FROM kg_edges e
  JOIN kg_nodes p ON p.node_id = e.target_node_id
  WHERE e.source_node_id = p_fault_id
    AND e.edge_type = 'FIXED_BY'
    AND e.status = 'active'
    AND p.node_type = 'Part';

  -- =========================================================================
  -- 6. Retourner le bloc complet
  -- =========================================================================
  RETURN jsonb_build_object(
    'success', true,
    'fault_id', v_fault.node_id,
    'fault_label', v_fault.node_label,
    'fault_category', v_fault.node_category,

    -- Les 4 sections
    'why', v_why,
    'quick_check', v_quick_check,
    'urgency', v_urgency,
    'related_parts', v_parts,

    -- Metadata
    'generated_at', NOW(),
    'reusable_for', jsonb_build_array('frontend', 'blog', 'faq', 'email')
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_generate_explainable_diagnostic IS
'Génère un bloc explicatif standardisé pour un diagnostic.
Contient: POURQUOI (symptômes), CONTROLE (test rapide), URGENCE, PIECES.
Réutilisable pour frontend, blog, FAQ, emails.';

-- ============================================================================
-- SIMPLIFIED VERSION: Generate from diagnosis result
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_explain_diagnosis_result(
  p_diagnosis_result JSONB
)
RETURNS JSONB AS $$
DECLARE
  v_fault_id UUID;
  v_matched_ids UUID[];
BEGIN
  -- Extraire les infos du résultat de diagnostic
  v_fault_id := (p_diagnosis_result->>'fault_id')::UUID;

  -- Extraire les observables matchés
  SELECT ARRAY_AGG(id::UUID)
  INTO v_matched_ids
  FROM jsonb_array_elements_text(
    COALESCE(p_diagnosis_result->'matched_observable_ids', '[]'::JSONB)
  ) AS id;

  -- Appeler la fonction principale
  RETURN kg_generate_explainable_diagnostic(
    v_fault_id,
    v_matched_ids,
    p_diagnosis_result->>'ctx_phase',
    p_diagnosis_result->>'ctx_temp',
    p_diagnosis_result->>'ctx_speed'
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_explain_diagnosis_result IS
'Version simplifiée qui prend le résultat d''un diagnostic et génère l''explication.';

-- ============================================================================
-- BATCH VERSION: Generate explanations for multiple faults
-- ============================================================================

CREATE OR REPLACE FUNCTION kg_generate_batch_explanations(
  p_fault_ids UUID[],
  p_matched_observable_ids UUID[],
  p_ctx_phase TEXT DEFAULT NULL,
  p_ctx_temp TEXT DEFAULT NULL,
  p_ctx_speed TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_fault_id UUID;
  v_result JSONB := '[]'::JSONB;
  v_explanation JSONB;
BEGIN
  FOREACH v_fault_id IN ARRAY p_fault_ids
  LOOP
    v_explanation := kg_generate_explainable_diagnostic(
      v_fault_id,
      p_matched_observable_ids,
      p_ctx_phase,
      p_ctx_temp,
      p_ctx_speed
    );
    v_result := v_result || jsonb_build_array(v_explanation);
  END LOOP;

  RETURN jsonb_build_object(
    'explanations', v_result,
    'count', ARRAY_LENGTH(p_fault_ids, 1),
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_generate_batch_explanations IS
'Génère des explications pour plusieurs pannes en batch.';

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION kg_generate_explainable_diagnostic TO authenticated;
GRANT EXECUTE ON FUNCTION kg_explain_diagnosis_result TO authenticated;
GRANT EXECUTE ON FUNCTION kg_generate_batch_explanations TO authenticated;

COMMIT;
