-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 3: Diagnostic Vehicle-Aware
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- RPC kg_diagnose_vehicle_aware():
--   - Détecte la famille moteur du véhicule
--   - Applique boost_factor aux relations spécifiques
--   - Utilise les nouveaux edge types (INDICATES, CONFIRMS, MANIFESTS_AS)
--   - Retourne les pannes scorées avec causes racines
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Type de retour pour le diagnostic enrichi                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP TYPE IF EXISTS kg_diagnosis_result CASCADE;
CREATE TYPE kg_diagnosis_result AS (
  fault_id UUID,
  fault_label TEXT,
  fault_family TEXT,
  score FLOAT,
  confidence FLOAT,
  matched_observables INT,
  is_vehicle_specific BOOLEAN,
  engine_family_boost FLOAT,
  root_causes JSONB,
  parts JSONB,
  actions JSONB
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Fonction helper: Calculer le poids selon edge_type                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_get_edge_type_weight_multiplier(p_edge_type TEXT)
RETURNS FLOAT AS $$
BEGIN
  RETURN CASE p_edge_type
    WHEN 'MANIFESTS_AS' THEN 1.5   -- DTC: très fiable, boost élevé
    WHEN 'CONFIRMS' THEN 1.2       -- Sign: fiable, boost moyen
    WHEN 'INDICATES' THEN 1.0      -- Symptom: base
    WHEN 'CAUSES' THEN 1.0         -- Legacy
    ELSE 1.0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. RPC principale: kg_diagnose_vehicle_aware                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_diagnose_vehicle_aware(
  p_observable_ids UUID[],
  p_vehicle_id UUID DEFAULT NULL,
  p_engine_family_code TEXT DEFAULT NULL,
  p_confidence_threshold FLOAT DEFAULT 0.5,
  p_limit INT DEFAULT 10
)
RETURNS SETOF kg_diagnosis_result AS $$
DECLARE
  v_engine_family_code TEXT;
  v_engine_family_id UUID;
BEGIN
  -- Déterminer la famille moteur
  IF p_engine_family_code IS NOT NULL THEN
    v_engine_family_code := p_engine_family_code;
  ELSIF p_vehicle_id IS NOT NULL THEN
    -- Chercher la famille moteur via le véhicule (si lien existe)
    SELECT ef.family_code INTO v_engine_family_code
    FROM kg_nodes v
    JOIN kg_edges e ON e.source_node_id = v.node_id AND e.edge_type = 'HAS_ENGINE'
    JOIN kg_engine_families ef ON ef.family_id = e.target_node_id::UUID
    WHERE v.node_id = p_vehicle_id
    LIMIT 1;
  END IF;

  -- Récupérer l'ID de la famille moteur si trouvée
  IF v_engine_family_code IS NOT NULL THEN
    SELECT family_id INTO v_engine_family_id
    FROM kg_engine_families
    WHERE family_code = v_engine_family_code;
  END IF;

  RETURN QUERY
  WITH
  -- Étape 1: Trouver toutes les pannes liées aux observables
  observable_to_fault AS (
    SELECT
      f.node_id AS fault_id,
      f.node_label AS fault_label,
      o.node_id AS observable_id,
      e.edge_type,
      e.weight,
      e.confidence,
      e.evidence,
      -- Boost selon le type d'edge
      kg_get_edge_type_weight_multiplier(e.edge_type) AS edge_type_multiplier,
      -- Boost spécificité moteur (si applicable)
      CASE
        WHEN v_engine_family_code IS NOT NULL
             AND e.evidence->>'specific_to_engine_family' = v_engine_family_code
        THEN COALESCE((e.evidence->>'boost_factor')::FLOAT, 1.3)
        ELSE 1.0
      END AS engine_boost,
      -- Flag si relation spécifique au véhicule
      CASE
        WHEN e.evidence->>'specific_to_engine_family' = v_engine_family_code
        THEN TRUE
        ELSE FALSE
      END AS is_vehicle_specific
    FROM kg_nodes o
    JOIN kg_edges e ON e.source_node_id = o.node_id
      AND e.edge_type IN ('INDICATES', 'CONFIRMS', 'MANIFESTS_AS', 'CAUSES')
      AND e.status = 'active'
      AND e.valid_to IS NULL
    JOIN kg_nodes f ON f.node_id = e.target_node_id
      AND f.node_type = 'Fault'
      AND f.status = 'active'
      AND f.valid_to IS NULL
    WHERE o.node_id = ANY(p_observable_ids)
      AND o.status = 'active'
      AND o.valid_to IS NULL
  ),

  -- Étape 2: Agréger par panne avec score combiné
  fault_scores AS (
    SELECT
      otf.fault_id,
      otf.fault_label,
      COUNT(DISTINCT otf.observable_id) AS matched_observables,
      -- Score = somme(weight × confidence × edge_multiplier × engine_boost)
      SUM(otf.weight * otf.confidence * otf.edge_type_multiplier * otf.engine_boost) AS raw_score,
      -- Confidence moyenne pondérée
      SUM(otf.confidence * otf.weight) / NULLIF(SUM(otf.weight), 0) AS avg_confidence,
      -- Au moins une relation spécifique au véhicule?
      BOOL_OR(otf.is_vehicle_specific) AS has_vehicle_specific,
      -- Meilleur boost moteur appliqué
      MAX(otf.engine_boost) AS max_engine_boost
    FROM observable_to_fault otf
    GROUP BY otf.fault_id, otf.fault_label
  ),

  -- Étape 3: Normaliser le score (0-100)
  normalized_scores AS (
    SELECT
      fs.*,
      -- Normalisation: score / (nombre d'observables en entrée × poids max théorique)
      LEAST(100, (fs.raw_score / (ARRAY_LENGTH(p_observable_ids, 1) * 10.0)) * 100) AS score
    FROM fault_scores fs
    WHERE fs.avg_confidence >= p_confidence_threshold
  ),

  -- Étape 4: Récupérer la famille de panne
  fault_with_family AS (
    SELECT
      ns.*,
      ff.node_label AS fault_family
    FROM normalized_scores ns
    LEFT JOIN kg_edges e ON e.source_node_id = ns.fault_id
      AND e.edge_type = 'BELONGS_TO_FAMILY'
      AND e.status = 'active'
    LEFT JOIN kg_nodes ff ON ff.node_id = e.target_node_id
      AND ff.node_type = 'FaultFamily'
  ),

  -- Étape 5: Récupérer les causes racines
  fault_root_causes AS (
    SELECT
      fwf.fault_id,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'root_cause_id', rc.node_id,
          'label', rc.node_label,
          'category', rc.root_cause_category,
          'warranty_impact', rc.warranty_impact,
          'frequency', rc.frequency,
          'weight', e.weight,
          'advice', rc.node_data->>'advice'
        ) ORDER BY e.weight DESC
      ) AS root_causes
    FROM fault_with_family fwf
    JOIN kg_edges e ON e.source_node_id = fwf.fault_id
      AND e.edge_type = 'HAS_ROOT_CAUSE'
      AND e.status = 'active'
    JOIN kg_nodes rc ON rc.node_id = e.target_node_id
      AND rc.node_type = 'RootCause'
      AND rc.status = 'active'
    GROUP BY fwf.fault_id
  ),

  -- Étape 6: Récupérer les pièces associées
  fault_parts AS (
    SELECT
      fwf.fault_id,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'part_id', p.node_id,
          'label', p.node_label,
          'pg_id', p.node_data->>'pg_id',
          'confidence', e.confidence
        ) ORDER BY e.confidence DESC
      ) AS parts
    FROM fault_with_family fwf
    JOIN kg_edges e ON e.source_node_id = fwf.fault_id
      AND e.edge_type = 'FIXED_BY'
      AND e.status = 'active'
    JOIN kg_nodes p ON p.node_id = e.target_node_id
      AND p.node_type = 'Part'
      AND p.status = 'active'
    GROUP BY fwf.fault_id
  ),

  -- Étape 7: Récupérer les actions associées
  fault_actions AS (
    SELECT
      fwf.fault_id,
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'action_id', a.node_id,
          'label', a.node_label,
          'category', a.node_category,
          'confidence', e.confidence
        ) ORDER BY e.confidence DESC
      ) AS actions
    FROM fault_with_family fwf
    JOIN kg_edges e ON e.source_node_id = fwf.fault_id
      AND e.edge_type = 'DIAGNOSED_BY'
      AND e.status = 'active'
    JOIN kg_nodes a ON a.node_id = e.target_node_id
      AND a.node_type = 'Action'
      AND a.status = 'active'
    GROUP BY fwf.fault_id
  )

  -- Résultat final
  SELECT
    fwf.fault_id,
    fwf.fault_label,
    fwf.fault_family,
    fwf.score,
    fwf.avg_confidence AS confidence,
    fwf.matched_observables::INT,
    fwf.has_vehicle_specific AS is_vehicle_specific,
    fwf.max_engine_boost AS engine_family_boost,
    COALESCE(frc.root_causes, '[]'::JSONB) AS root_causes,
    COALESCE(fp.parts, '[]'::JSONB) AS parts,
    COALESCE(fa.actions, '[]'::JSONB) AS actions
  FROM fault_with_family fwf
  LEFT JOIN fault_root_causes frc ON frc.fault_id = fwf.fault_id
  LEFT JOIN fault_parts fp ON fp.fault_id = fwf.fault_id
  LEFT JOIN fault_actions fa ON fa.fault_id = fwf.fault_id
  ORDER BY fwf.score DESC, fwf.avg_confidence DESC
  LIMIT p_limit;

END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. RPC simplifiée: diagnostic par labels d'observables                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_diagnose_by_labels(
  p_observable_labels TEXT[],
  p_engine_family_code TEXT DEFAULT NULL,
  p_confidence_threshold FLOAT DEFAULT 0.5,
  p_limit INT DEFAULT 10
)
RETURNS SETOF kg_diagnosis_result AS $$
DECLARE
  v_observable_ids UUID[];
BEGIN
  -- Résoudre les labels en UUIDs
  SELECT ARRAY_AGG(node_id) INTO v_observable_ids
  FROM kg_nodes
  WHERE node_type = 'Observable'
    AND status = 'active'
    AND valid_to IS NULL
    AND (
      node_label ILIKE ANY(p_observable_labels)
      OR node_alias ILIKE ANY(p_observable_labels)
    );

  IF v_observable_ids IS NULL OR ARRAY_LENGTH(v_observable_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM kg_diagnose_vehicle_aware(
    v_observable_ids,
    NULL,
    p_engine_family_code,
    p_confidence_threshold,
    p_limit
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RPC: diagnostic contextuel (avec filtrage par contexte)                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_diagnose_contextual(
  p_observable_labels TEXT[],
  p_ctx_phase TEXT DEFAULT NULL,
  p_ctx_temp TEXT DEFAULT NULL,
  p_ctx_speed TEXT DEFAULT NULL,
  p_engine_family_code TEXT DEFAULT NULL,
  p_confidence_threshold FLOAT DEFAULT 0.5,
  p_limit INT DEFAULT 10
)
RETURNS SETOF kg_diagnosis_result AS $$
DECLARE
  v_observable_ids UUID[];
BEGIN
  -- Trouver les observables correspondant aux labels ET contextes
  SELECT ARRAY_AGG(node_id) INTO v_observable_ids
  FROM kg_nodes
  WHERE node_type = 'Observable'
    AND status = 'active'
    AND valid_to IS NULL
    AND (
      node_label ILIKE ANY(p_observable_labels)
      OR node_alias ILIKE ANY(p_observable_labels)
    )
    -- Filtrage contextuel (NULL = pas de filtre)
    AND (p_ctx_phase IS NULL OR ctx_phase = p_ctx_phase OR ctx_phase = 'any')
    AND (p_ctx_temp IS NULL OR ctx_temp = p_ctx_temp OR ctx_temp = 'any')
    AND (p_ctx_speed IS NULL OR ctx_speed = p_ctx_speed OR ctx_speed = 'any');

  IF v_observable_ids IS NULL OR ARRAY_LENGTH(v_observable_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM kg_diagnose_vehicle_aware(
    v_observable_ids,
    NULL,
    p_engine_family_code,
    p_confidence_threshold,
    p_limit
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Vue: Statistiques des diagnostics (pour monitoring)                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_diagnosis_stats AS
SELECT
  f.node_id AS fault_id,
  f.node_label AS fault_label,
  ff.node_label AS fault_family,
  COUNT(DISTINCT e_in.source_node_id) AS observable_count,
  COUNT(DISTINCT e_rc.target_node_id) AS root_cause_count,
  COUNT(DISTINCT e_part.target_node_id) AS part_count,
  AVG(e_in.weight) AS avg_weight,
  AVG(e_in.confidence) AS avg_confidence
FROM kg_nodes f
LEFT JOIN kg_edges e_ff ON e_ff.source_node_id = f.node_id AND e_ff.edge_type = 'BELONGS_TO_FAMILY'
LEFT JOIN kg_nodes ff ON ff.node_id = e_ff.target_node_id AND ff.node_type = 'FaultFamily'
LEFT JOIN kg_edges e_in ON e_in.target_node_id = f.node_id
  AND e_in.edge_type IN ('INDICATES', 'CONFIRMS', 'MANIFESTS_AS', 'CAUSES')
LEFT JOIN kg_edges e_rc ON e_rc.source_node_id = f.node_id AND e_rc.edge_type = 'HAS_ROOT_CAUSE'
LEFT JOIN kg_edges e_part ON e_part.source_node_id = f.node_id AND e_part.edge_type = 'FIXED_BY'
WHERE f.node_type = 'Fault'
  AND f.status = 'active'
GROUP BY f.node_id, f.node_label, ff.node_label;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Grants et Comments                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Permettre l'accès aux fonctions
GRANT EXECUTE ON FUNCTION kg_diagnose_vehicle_aware TO authenticated;
GRANT EXECUTE ON FUNCTION kg_diagnose_by_labels TO authenticated;
GRANT EXECUTE ON FUNCTION kg_diagnose_contextual TO authenticated;
GRANT EXECUTE ON FUNCTION kg_get_edge_type_weight_multiplier TO authenticated;

COMMENT ON FUNCTION kg_diagnose_vehicle_aware IS 'Diagnostic intelligent avec boost spécificité véhicule et causes racines';
COMMENT ON FUNCTION kg_diagnose_by_labels IS 'Diagnostic simplifié par labels d''observables';
COMMENT ON FUNCTION kg_diagnose_contextual IS 'Diagnostic avec filtrage contextuel (phase, temp, speed)';
COMMENT ON VIEW kg_diagnosis_stats IS 'Statistiques des pannes pour monitoring';

COMMIT;
