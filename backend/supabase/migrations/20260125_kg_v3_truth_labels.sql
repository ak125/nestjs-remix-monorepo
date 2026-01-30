-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 4b: Truth Labels (Ground Truth pour Recalibration)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Principe: Les Truth Labels sont des PREUVES VÉRIFIABLES que le diagnostic
--           était correct ou incorrect. Contrairement au soft feedback
--           (confirmations client), ils permettent une recalibration sérieuse.
--
-- Sources de Truth Labels:
--   - Facture de garage (preuve formelle)
--   - Validation technicien sur place
--   - Code OBD effacé après réparation
--   - Retour pièce (preuve négative)
--   - Récurrence du problème (preuve négative)
--
-- Fiabilité:
--   - Soft feedback: 0.30-0.70
--   - Truth labels: 0.70-0.98
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Table principale: kg_truth_labels                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_truth_labels (
  label_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- Lien vers le diagnostic validé
  -- ═══════════════════════════════════════════════════════════════════════════
  diagnosis_cache_id UUID,           -- Référence à kg_reasoning_cache (le cas diagnostic)
  edge_ids UUID[],                   -- Les relations (edges) validées/invalidées
  fault_id UUID,                     -- La panne diagnostiquée
  observable_ids UUID[],             -- Les observables utilisés pour le diagnostic

  -- ═══════════════════════════════════════════════════════════════════════════
  -- OUTCOME: Le diagnostic était-il correct?
  -- ═══════════════════════════════════════════════════════════════════════════
  outcome_confirmed BOOLEAN NOT NULL,  -- TRUE = diagnostic correct, FALSE = incorrect

  -- ═══════════════════════════════════════════════════════════════════════════
  -- MÉTHODE DE CONFIRMATION (critique pour calculer la reliability)
  -- ═══════════════════════════════════════════════════════════════════════════
  confirmation_method TEXT NOT NULL CHECK (confirmation_method IN (
    'garage_verification',  -- Garage partenaire a vérifié (reliability: 0.92)
    'invoice',              -- Facture de réparation fournie (reliability: 0.95)
    'customer_return',      -- Client confirme problème résolu (reliability: 0.70)
    'technician_validation',-- Technicien a validé sur place (reliability: 0.88)
    'obd_clear',            -- Code erreur disparu après réparation (reliability: 0.98)
    'part_return_wrong',    -- Pièce retournée - mauvais diagnostic (reliability: 0.85)
    'recurrence'            -- Problème revenu = mauvais diagnostic (reliability: 0.90)
  )),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PIÈCE REMPLACÉE (preuve matérielle)
  -- ═══════════════════════════════════════════════════════════════════════════
  replaced_part_id UUID,             -- Référence à kg_nodes Part si applicable
  replaced_part_pg_id INT,           -- Lien direct vers pieces_gamme
  order_id TEXT,                     -- Référence commande si achat chez nous

  -- ═══════════════════════════════════════════════════════════════════════════
  -- DATE ET KILOMÉTRAGE (contexte temporel)
  -- ═══════════════════════════════════════════════════════════════════════════
  confirmation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  confirmation_km INT,               -- Kilométrage au moment de la confirmation

  -- ═══════════════════════════════════════════════════════════════════════════
  -- PREUVES (données détaillées)
  -- ═══════════════════════════════════════════════════════════════════════════
  evidence_data JSONB DEFAULT '{}',
  -- Structure attendue:
  -- {
  --   "invoice_ref": "FAC-2026-001234",
  --   "garage_name": "Garage Dupont",
  --   "garage_partner_id": "uuid",
  --   "technician_name": "Jean Martin",
  --   "technician_notes": "Disques voilés confirmé, remplacé par...",
  --   "photo_urls": ["https://..."],
  --   "obd_codes_before": ["P0300", "P0420"],
  --   "obd_codes_after": [],
  --   "repair_cost": 250.00,
  --   "labor_time": "1h30"
  -- }

  -- ═══════════════════════════════════════════════════════════════════════════
  -- QUALITÉ DE LA VÉRIFICATION
  -- ═══════════════════════════════════════════════════════════════════════════
  verification_quality TEXT DEFAULT 'medium' CHECK (verification_quality IN (
    'high',    -- Preuve formelle (facture, OBD, technicien certifié)
    'medium',  -- Confirmation client détaillée
    'low'      -- Simple confirmation sans preuve
  )),

  -- ═══════════════════════════════════════════════════════════════════════════
  -- SOURCE
  -- ═══════════════════════════════════════════════════════════════════════════
  submitted_by TEXT NOT NULL CHECK (submitted_by IN (
    'garage_partner',    -- Garage partenaire certifié (très fiable)
    'technician',        -- Technicien individuel (fiable)
    'customer',          -- Client (moins fiable, mais compte)
    'system',            -- Détection automatique (retour/OBD)
    'support'            -- Support client après investigation
  )),
  submitted_by_user_id UUID,         -- Référence à l'utilisateur si applicable

  -- ═══════════════════════════════════════════════════════════════════════════
  -- TRAITEMENT
  -- ═══════════════════════════════════════════════════════════════════════════
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  recalibration_applied JSONB,       -- Détails du recalcul effectué
  -- {
  --   "edges_updated": ["uuid1", "uuid2"],
  --   "weight_changes": [{"edge_id": "...", "before": 5.0, "after": 6.2}],
  --   "adjustment_id": "uuid-de-kg_weight_adjustments"
  -- }

  -- ═══════════════════════════════════════════════════════════════════════════
  -- AUDIT
  -- ═══════════════════════════════════════════════════════════════════════════
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Index pour recherche rapide                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Index principal: labels non traités (pour batch processing)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_unprocessed
  ON kg_truth_labels(processed, created_at)
  WHERE processed = FALSE;

-- Index GIN pour recherche par edge (une relation peut avoir plusieurs labels)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_edge
  ON kg_truth_labels USING GIN(edge_ids);

-- Index par fault_id (stats par panne)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_fault
  ON kg_truth_labels(fault_id)
  WHERE fault_id IS NOT NULL;

-- Index par méthode de confirmation (analyse par source)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_method
  ON kg_truth_labels(confirmation_method);

-- Index par outcome (stats globales)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_outcome
  ON kg_truth_labels(outcome_confirmed);

-- Index par source (analyse par origine)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_source
  ON kg_truth_labels(submitted_by);

-- Index par date (analyse temporelle)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_date
  ON kg_truth_labels(confirmation_date DESC);

-- Index par pg_id (correlation avec ventes)
CREATE INDEX IF NOT EXISTS idx_kg_truth_labels_pgid
  ON kg_truth_labels(replaced_part_pg_id)
  WHERE replaced_part_pg_id IS NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Table de configuration des fiabilités                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Ajouter les configs de fiabilité pour truth labels
INSERT INTO kg_feedback_config (config_key, config_value, description) VALUES
  ('truth_label_min_count', '3', 'Nombre minimum de truth labels avant recalibration'),
  ('truth_label_method_reliability', '{
    "obd_clear": 0.98,
    "invoice": 0.95,
    "garage_verification": 0.92,
    "technician_validation": 0.88,
    "part_return_wrong": 0.85,
    "recurrence": 0.90,
    "customer_return": 0.70
  }', 'Fiabilité par méthode de confirmation'),
  ('truth_label_source_reliability', '{
    "garage_partner": 0.92,
    "technician": 0.88,
    "system": 0.85,
    "support": 0.80,
    "customer": 0.70
  }', 'Fiabilité de base par source'),
  ('truth_label_quality_multiplier', '{
    "high": 1.0,
    "medium": 0.7,
    "low": 0.4
  }', 'Multiplicateur de qualité pour la fiabilité'),
  ('truth_label_weight_impact', '0.7', 'Impact des truth labels vs poids actuel (0-1)')
ON CONFLICT (config_key) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. RPC: Enregistrer un Truth Label                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_record_truth_label(
  p_diagnosis_cache_id UUID,
  p_edge_ids UUID[],
  p_fault_id UUID,
  p_outcome_confirmed BOOLEAN,
  p_confirmation_method TEXT,
  p_replaced_part_pg_id INT DEFAULT NULL,
  p_confirmation_date DATE DEFAULT CURRENT_DATE,
  p_confirmation_km INT DEFAULT NULL,
  p_evidence_data JSONB DEFAULT '{}',
  p_verification_quality TEXT DEFAULT 'medium',
  p_submitted_by TEXT DEFAULT 'customer',
  p_submitted_by_user_id UUID DEFAULT NULL,
  p_order_id TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_label_id UUID;
  v_part_node_id UUID;
BEGIN
  -- Trouver le node Part si pg_id fourni
  IF p_replaced_part_pg_id IS NOT NULL THEN
    SELECT node_id INTO v_part_node_id
    FROM kg_nodes
    WHERE node_type = 'Part'
      AND (node_data->>'pg_id')::INT = p_replaced_part_pg_id
    LIMIT 1;
  END IF;

  -- Insérer le truth label
  INSERT INTO kg_truth_labels (
    diagnosis_cache_id,
    edge_ids,
    fault_id,
    observable_ids,
    outcome_confirmed,
    confirmation_method,
    replaced_part_id,
    replaced_part_pg_id,
    order_id,
    confirmation_date,
    confirmation_km,
    evidence_data,
    verification_quality,
    submitted_by,
    submitted_by_user_id,
    notes
  ) VALUES (
    p_diagnosis_cache_id,
    p_edge_ids,
    p_fault_id,
    NULL, -- observable_ids à remplir depuis le cache si besoin
    p_outcome_confirmed,
    p_confirmation_method,
    v_part_node_id,
    p_replaced_part_pg_id,
    p_order_id,
    p_confirmation_date,
    p_confirmation_km,
    p_evidence_data,
    p_verification_quality,
    p_submitted_by,
    p_submitted_by_user_id,
    p_notes
  )
  RETURNING label_id INTO v_label_id;

  RETURN v_label_id;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RPC: Calculer la fiabilité effective d'un truth label                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_calculate_truth_label_reliability(
  p_label_id UUID
)
RETURNS FLOAT AS $$
DECLARE
  v_method_reliability JSONB;
  v_source_reliability JSONB;
  v_quality_multiplier JSONB;
  v_method TEXT;
  v_source TEXT;
  v_quality TEXT;
  v_base_reliability FLOAT;
  v_quality_mult FLOAT;
  v_final_reliability FLOAT;
BEGIN
  -- Récupérer les configs
  SELECT config_value INTO v_method_reliability
  FROM kg_feedback_config WHERE config_key = 'truth_label_method_reliability';

  SELECT config_value INTO v_source_reliability
  FROM kg_feedback_config WHERE config_key = 'truth_label_source_reliability';

  SELECT config_value INTO v_quality_multiplier
  FROM kg_feedback_config WHERE config_key = 'truth_label_quality_multiplier';

  -- Récupérer les données du label
  SELECT confirmation_method, submitted_by, verification_quality
  INTO v_method, v_source, v_quality
  FROM kg_truth_labels
  WHERE label_id = p_label_id;

  -- Calculer la reliability: max(method_reliability, source_reliability) × quality_multiplier
  v_base_reliability := GREATEST(
    COALESCE((v_method_reliability->>v_method)::FLOAT, 0.7),
    COALESCE((v_source_reliability->>v_source)::FLOAT, 0.7)
  );

  v_quality_mult := COALESCE((v_quality_multiplier->>v_quality)::FLOAT, 0.7);

  v_final_reliability := v_base_reliability * v_quality_mult;

  RETURN LEAST(0.99, v_final_reliability);
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RPC: Calculer les poids recalibrés avec Truth Labels                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_calculate_weight_with_truth_labels(
  p_edge_id UUID,
  p_min_labels INT DEFAULT 3
)
RETURNS TABLE (
  new_weight FLOAT,
  new_confidence FLOAT,
  truth_label_count INT,
  confirmed_count INT,
  rejected_count INT,
  avg_reliability FLOAT,
  should_update BOOLEAN
) AS $$
DECLARE
  v_current_weight FLOAT;
  v_current_confidence FLOAT;
  v_weight_impact FLOAT;
BEGIN
  -- Récupérer les valeurs actuelles de l'edge
  SELECT weight, confidence INTO v_current_weight, v_current_confidence
  FROM kg_edges WHERE edge_id = p_edge_id;

  -- Récupérer l'impact configuré
  SELECT COALESCE((config_value::TEXT)::FLOAT, 0.7) INTO v_weight_impact
  FROM kg_feedback_config WHERE config_key = 'truth_label_weight_impact';

  RETURN QUERY
  WITH truth_stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE outcome_confirmed = TRUE) AS confirmed,
      COUNT(*) FILTER (WHERE outcome_confirmed = FALSE) AS rejected,
      AVG(kg_calculate_truth_label_reliability(label_id)) AS avg_rel
    FROM kg_truth_labels
    WHERE p_edge_id = ANY(edge_ids)
      AND processed = FALSE
  )
  SELECT
    -- Nouveau poids: combinaison poids actuel + signal truth labels
    CASE
      WHEN ts.total >= p_min_labels THEN
        LEAST(10.0, GREATEST(0.1,
          -- Partie conservée du poids actuel
          v_current_weight * (1 - v_weight_impact)
          -- Partie venant des truth labels
          + (ts.confirmed::FLOAT / NULLIF(ts.total, 0)) * 10 * ts.avg_rel * v_weight_impact
        ))
      ELSE v_current_weight
    END AS new_weight,

    -- Nouvelle confidence: augmente plus vite avec truth labels
    CASE
      WHEN ts.total >= p_min_labels THEN
        LEAST(0.99, v_current_confidence + (ts.total * 0.05 * ts.avg_rel))
      ELSE v_current_confidence
    END AS new_confidence,

    ts.total::INT AS truth_label_count,
    ts.confirmed::INT AS confirmed_count,
    ts.rejected::INT AS rejected_count,
    ts.avg_rel AS avg_reliability,
    ts.total >= p_min_labels AS should_update
  FROM truth_stats ts;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. RPC: Traitement batch des Truth Labels                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_process_truth_labels_batch(
  p_batch_size INT DEFAULT 50
)
RETURNS TABLE (
  edges_recalibrated INT,
  labels_processed INT,
  weights_increased INT,
  weights_decreased INT
) AS $$
DECLARE
  v_min_labels INT;
  v_edge_record RECORD;
  v_calc RECORD;
  v_edges_updated INT := 0;
  v_labels_processed INT := 0;
  v_weights_up INT := 0;
  v_weights_down INT := 0;
  v_label_ids UUID[];
  v_adjustment_id UUID;
  v_old_weight FLOAT;
BEGIN
  -- Récupérer le seuil minimum
  SELECT COALESCE((config_value::TEXT)::INT, 3) INTO v_min_labels
  FROM kg_feedback_config WHERE config_key = 'truth_label_min_count';

  -- Trouver les edges avec suffisamment de truth labels non traités
  FOR v_edge_record IN
    SELECT
      UNNEST(edge_ids) AS edge_id,
      ARRAY_AGG(label_id) AS label_ids,
      COUNT(*) AS label_count
    FROM kg_truth_labels
    WHERE processed = FALSE
    GROUP BY UNNEST(edge_ids)
    HAVING COUNT(*) >= v_min_labels
    LIMIT p_batch_size
  LOOP
    -- Sauvegarder l'ancien poids
    SELECT weight INTO v_old_weight
    FROM kg_edges WHERE edge_id = v_edge_record.edge_id;

    -- Calculer les nouveaux poids
    SELECT * INTO v_calc
    FROM kg_calculate_weight_with_truth_labels(v_edge_record.edge_id, v_min_labels);

    IF v_calc.should_update THEN
      -- Enregistrer l'ajustement dans kg_weight_adjustments
      INSERT INTO kg_weight_adjustments (
        edge_id,
        weight_before,
        weight_after,
        confidence_before,
        confidence_after,
        adjustment_reason,
        feedback_count,
        positive_count,
        negative_count,
        reliability_sum,
        calculation_formula,
        feedback_event_ids,
        adjusted_by
      )
      SELECT
        v_edge_record.edge_id,
        e.weight,
        v_calc.new_weight,
        e.confidence,
        v_calc.new_confidence,
        'truth_label_calibration',
        v_calc.truth_label_count,
        v_calc.confirmed_count,
        v_calc.rejected_count,
        v_calc.avg_reliability * v_calc.truth_label_count,
        'weight = current * (1-impact) + (confirmed/total) * 10 * avg_reliability * impact',
        NULL, -- On utilise label_ids, pas feedback_event_ids
        'system'
      FROM kg_edges e
      WHERE e.edge_id = v_edge_record.edge_id
      RETURNING adjustment_id INTO v_adjustment_id;

      -- Mettre à jour l'edge
      UPDATE kg_edges
      SET
        weight = v_calc.new_weight,
        confidence = v_calc.new_confidence,
        version = version + 1,
        updated_at = NOW()
      WHERE edge_id = v_edge_record.edge_id;

      -- Marquer les labels comme traités
      UPDATE kg_truth_labels
      SET
        processed = TRUE,
        processed_at = NOW(),
        recalibration_applied = JSONB_BUILD_OBJECT(
          'adjustment_id', v_adjustment_id,
          'new_weight', v_calc.new_weight,
          'new_confidence', v_calc.new_confidence,
          'weight_change', v_calc.new_weight - v_old_weight
        )
      WHERE label_id = ANY(v_edge_record.label_ids);

      -- Compteurs
      v_edges_updated := v_edges_updated + 1;
      v_labels_processed := v_labels_processed + v_calc.truth_label_count;

      IF v_calc.new_weight > v_old_weight THEN
        v_weights_up := v_weights_up + 1;
      ELSIF v_calc.new_weight < v_old_weight THEN
        v_weights_down := v_weights_down + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_edges_updated, v_labels_processed, v_weights_up, v_weights_down;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Vue: Dashboard Truth Labels                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_truth_labels_dashboard AS
SELECT
  f.node_label AS fault_label,
  tl.confirmation_method,
  COUNT(*) AS label_count,
  COUNT(*) FILTER (WHERE outcome_confirmed = TRUE) AS confirmed_count,
  COUNT(*) FILTER (WHERE outcome_confirmed = FALSE) AS rejected_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE outcome_confirmed = TRUE) / NULLIF(COUNT(*), 0), 1) AS accuracy_pct,
  AVG(CASE
    WHEN tl.verification_quality = 'high' THEN 1.0
    WHEN tl.verification_quality = 'medium' THEN 0.7
    ELSE 0.4
  END) AS avg_quality_score,
  MAX(tl.created_at) AS last_label_at
FROM kg_truth_labels tl
LEFT JOIN kg_nodes f ON f.node_id = tl.fault_id
GROUP BY f.node_label, tl.confirmation_method;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Vue: Statistiques globales Truth Labels                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_truth_labels_stats AS
SELECT
  submitted_by,
  verification_quality,
  COUNT(*) AS total_labels,
  COUNT(*) FILTER (WHERE outcome_confirmed = TRUE) AS positive_labels,
  COUNT(*) FILTER (WHERE outcome_confirmed = FALSE) AS negative_labels,
  ROUND(100.0 * COUNT(*) FILTER (WHERE outcome_confirmed = TRUE) / NULLIF(COUNT(*), 0), 1) AS accuracy_pct,
  COUNT(*) FILTER (WHERE processed = TRUE) AS processed_count,
  COUNT(*) FILTER (WHERE processed = FALSE) AS pending_count,
  AVG(DATE_PART('day', CURRENT_DATE - confirmation_date)) AS avg_days_to_confirm
FROM kg_truth_labels
GROUP BY submitted_by, verification_quality
ORDER BY total_labels DESC;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. Vue: Labels en attente de traitement                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_truth_labels_pending AS
SELECT
  UNNEST(edge_ids) AS edge_id,
  COUNT(*) AS label_count,
  COUNT(*) FILTER (WHERE outcome_confirmed = TRUE) AS confirmed,
  COUNT(*) FILTER (WHERE outcome_confirmed = FALSE) AS rejected,
  ARRAY_AGG(DISTINCT confirmation_method) AS methods,
  ARRAY_AGG(DISTINCT submitted_by) AS sources,
  MAX(created_at) AS latest_at
FROM kg_truth_labels
WHERE processed = FALSE
GROUP BY UNNEST(edge_ids)
ORDER BY label_count DESC;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 11. RLS et Grants                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_truth_labels ENABLE ROW LEVEL SECURITY;

-- Lecture pour authenticated
CREATE POLICY "kg_truth_labels_select_authenticated" ON kg_truth_labels
  FOR SELECT TO authenticated USING (true);

-- Insert pour authenticated (soumettre des truth labels)
CREATE POLICY "kg_truth_labels_insert_authenticated" ON kg_truth_labels
  FOR INSERT TO authenticated WITH CHECK (true);

-- Full access pour service_role
CREATE POLICY "kg_truth_labels_all_service" ON kg_truth_labels
  FOR ALL TO service_role USING (true);

-- Grants
GRANT EXECUTE ON FUNCTION kg_record_truth_label TO authenticated;
GRANT EXECUTE ON FUNCTION kg_calculate_truth_label_reliability TO authenticated;
GRANT EXECUTE ON FUNCTION kg_calculate_weight_with_truth_labels TO service_role;
GRANT EXECUTE ON FUNCTION kg_process_truth_labels_batch TO service_role;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 12. Trigger: updated_at automatique                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_truth_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_kg_truth_labels_updated_at
  BEFORE UPDATE ON kg_truth_labels
  FOR EACH ROW
  EXECUTE FUNCTION kg_truth_labels_updated_at();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 13. Comments                                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE kg_truth_labels IS
  'Ground truth labels pour recalibration des poids du Knowledge Graph - preuves vérifiables';

COMMENT ON FUNCTION kg_record_truth_label IS
  'Enregistre un truth label avec toutes ses preuves et métadonnées';

COMMENT ON FUNCTION kg_calculate_truth_label_reliability IS
  'Calcule la fiabilité effective d''un truth label basée sur méthode, source et qualité';

COMMENT ON FUNCTION kg_calculate_weight_with_truth_labels IS
  'Calcule les nouveaux poids pour un edge basé sur les truth labels non traités';

COMMENT ON FUNCTION kg_process_truth_labels_batch IS
  'Traite un batch de truth labels et recalibre les poids des edges concernés';

COMMENT ON VIEW kg_truth_labels_dashboard IS
  'Dashboard des truth labels par panne et méthode de confirmation';

COMMENT ON VIEW kg_truth_labels_stats IS
  'Statistiques globales des truth labels par source et qualité';

COMMENT ON VIEW kg_truth_labels_pending IS
  'Labels en attente de traitement groupés par edge';

COMMIT;
