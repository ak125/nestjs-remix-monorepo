-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 4: Système de Feedback (Amélioration Continue)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Tables pour collecter et traiter les retours terrain:
--   - kg_feedback_events: Événements de feedback (confirmation, rejet, achat, retour)
--   - kg_weight_adjustments: Audit des ajustements de poids
--   - Triggers pour mise à jour bayésienne automatique
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Table des événements de feedback                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_feedback_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type d'événement
  event_type TEXT NOT NULL CHECK (event_type IN (
    'diagnosis_confirmed',    -- Diagnostic confirmé correct par le client
    'diagnosis_rejected',     -- Diagnostic jugé incorrect
    'part_purchased',         -- Pièce achetée après diagnostic
    'part_returned',          -- Pièce retournée (possiblement mauvais diag)
    'repair_successful',      -- Réparation réussie (retour garage)
    'repair_failed',          -- Réparation échouée
    'technician_correction',  -- Technicien propose autre diagnostic
    'customer_rating',        -- Note client (1-5)
    'sav_ticket'              -- Ticket SAV ouvert
  )),

  -- Référence au diagnostic concerné
  diagnosis_cache_id UUID,    -- Référence à kg_reasoning_cache si applicable
  edge_id UUID REFERENCES kg_edges(edge_id) ON DELETE SET NULL,
  fault_id UUID,              -- Panne concernée
  observable_ids UUID[],      -- Observables utilisés

  -- Source du feedback
  feedback_source TEXT NOT NULL CHECK (feedback_source IN (
    'customer',       -- Client direct
    'technician',     -- Technicien partenaire
    'garage',         -- Garage partenaire
    'sales_system',   -- Système de vente (achat/retour automatique)
    'support',        -- Support client
    'automated'       -- Système automatique (heuristique)
  )),

  -- Fiabilité de la source (0-1)
  source_reliability FLOAT NOT NULL DEFAULT 0.5 CHECK (source_reliability >= 0 AND source_reliability <= 1),

  -- Données du feedback
  feedback_data JSONB DEFAULT '{}',
  -- Exemples de contenu:
  -- { "rating": 5, "comment": "Diagnostic correct" }
  -- { "correct_fault": "...", "reason": "..." }
  -- { "order_id": "...", "amount": 45.99 }
  -- { "return_reason": "wrong_part" }

  -- Sentiment (pour les retours textuels)
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Statut de traitement
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_result JSONB,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,  -- Référence à l'utilisateur si applicable
  session_id TEXT
);

-- Index pour traitement par batch
CREATE INDEX IF NOT EXISTS idx_kg_feedback_unprocessed
  ON kg_feedback_events(processed, created_at)
  WHERE processed = FALSE;

-- Index par type d'événement
CREATE INDEX IF NOT EXISTS idx_kg_feedback_event_type
  ON kg_feedback_events(event_type, created_at DESC);

-- Index par edge (pour agrégation par relation)
CREATE INDEX IF NOT EXISTS idx_kg_feedback_edge
  ON kg_feedback_events(edge_id)
  WHERE edge_id IS NOT NULL;

-- Index par fault (pour agrégation par panne)
CREATE INDEX IF NOT EXISTS idx_kg_feedback_fault
  ON kg_feedback_events(fault_id)
  WHERE fault_id IS NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Table d'audit des ajustements de poids                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_weight_adjustments (
  adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Edge concerné
  edge_id UUID NOT NULL REFERENCES kg_edges(edge_id) ON DELETE CASCADE,

  -- Valeurs avant/après
  weight_before FLOAT NOT NULL,
  weight_after FLOAT NOT NULL,
  confidence_before FLOAT NOT NULL,
  confidence_after FLOAT NOT NULL,

  -- Raison de l'ajustement
  adjustment_reason TEXT NOT NULL CHECK (adjustment_reason IN (
    'bayesian_update',        -- Mise à jour bayésienne automatique
    'manual_correction',      -- Correction manuelle
    'technician_feedback',    -- Retour technicien
    'bulk_recalculation',     -- Recalcul global
    'decay',                  -- Décroissance temporelle
    'boost'                   -- Boost suite à confirmations
  )),

  -- Métriques du calcul
  feedback_count INT DEFAULT 0,           -- Nombre de feedbacks considérés
  positive_count INT DEFAULT 0,           -- Confirmations
  negative_count INT DEFAULT 0,           -- Rejets
  reliability_sum FLOAT DEFAULT 0,        -- Somme des fiabilités
  calculation_formula TEXT,               -- Formule utilisée (pour audit)

  -- Référence aux feedbacks utilisés
  feedback_event_ids UUID[],

  -- Audit
  adjusted_at TIMESTAMPTZ DEFAULT NOW(),
  adjusted_by TEXT  -- 'system' ou user_id
);

-- Index pour historique par edge
CREATE INDEX IF NOT EXISTS idx_kg_weight_adjustments_edge
  ON kg_weight_adjustments(edge_id, adjusted_at DESC);

-- Index par raison
CREATE INDEX IF NOT EXISTS idx_kg_weight_adjustments_reason
  ON kg_weight_adjustments(adjustment_reason, adjusted_at DESC);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Table de configuration des seuils de feedback                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_feedback_config (
  config_key TEXT PRIMARY KEY,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration par défaut
INSERT INTO kg_feedback_config (config_key, config_value, description) VALUES
  ('min_feedback_count', '10', 'Nombre minimum de feedbacks avant recalcul'),
  ('bayesian_prior', '0.5', 'Prior bayésien pour le calcul'),
  ('source_reliability', '{
    "customer": 0.5,
    "technician": 0.9,
    "garage": 0.85,
    "sales_system": 0.7,
    "support": 0.75,
    "automated": 0.4
  }', 'Fiabilité par source de feedback'),
  ('decay_rate', '0.01', 'Taux de décroissance mensuel des poids non confirmés'),
  ('max_boost', '2.0', 'Boost maximum applicable'),
  ('min_weight', '0.1', 'Poids minimum après ajustement'),
  ('max_weight', '10.0', 'Poids maximum après ajustement')
ON CONFLICT (config_key) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Fonction: Calcul bayésien des poids                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_calculate_bayesian_weight(
  p_edge_id UUID,
  p_min_feedback INT DEFAULT 10
)
RETURNS TABLE (
  new_weight FLOAT,
  new_confidence FLOAT,
  feedback_count INT,
  positive_count INT,
  negative_count INT
) AS $$
DECLARE
  v_prior FLOAT;
  v_current_weight FLOAT;
  v_current_confidence FLOAT;
BEGIN
  -- Récupérer le prior
  SELECT (config_value::TEXT)::FLOAT INTO v_prior
  FROM kg_feedback_config WHERE config_key = 'bayesian_prior';
  v_prior := COALESCE(v_prior, 0.5);

  -- Récupérer les valeurs actuelles
  SELECT weight, confidence INTO v_current_weight, v_current_confidence
  FROM kg_edges WHERE edge_id = p_edge_id;

  RETURN QUERY
  WITH feedback_stats AS (
    SELECT
      COUNT(*) AS total_count,
      COUNT(*) FILTER (WHERE event_type IN ('diagnosis_confirmed', 'repair_successful', 'part_purchased')) AS pos_count,
      COUNT(*) FILTER (WHERE event_type IN ('diagnosis_rejected', 'repair_failed', 'part_returned')) AS neg_count,
      SUM(source_reliability) AS reliability_total
    FROM kg_feedback_events
    WHERE edge_id = p_edge_id
      AND processed = FALSE
  )
  SELECT
    -- Nouveau poids: (ancien_poids × prior + confirmations × avg_reliability) / (prior + total)
    CASE
      WHEN fs.total_count >= p_min_feedback THEN
        LEAST(10.0, GREATEST(0.1,
          (v_current_weight * v_prior + fs.pos_count * (fs.reliability_total / NULLIF(fs.total_count, 0)))
          / (v_prior + fs.total_count)
        ))
      ELSE v_current_weight
    END AS new_weight,
    -- Nouvelle confidence: augmente avec le nombre de feedbacks
    CASE
      WHEN fs.total_count >= p_min_feedback THEN
        LEAST(0.99, v_current_confidence + (fs.total_count * 0.01))
      ELSE v_current_confidence
    END AS new_confidence,
    fs.total_count::INT AS feedback_count,
    fs.pos_count::INT AS positive_count,
    fs.neg_count::INT AS negative_count
  FROM feedback_stats fs;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Fonction: Traitement batch des feedbacks                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_process_feedback_batch(
  p_batch_size INT DEFAULT 100
)
RETURNS TABLE (
  edges_updated INT,
  feedbacks_processed INT
) AS $$
DECLARE
  v_min_feedback INT;
  v_edge_record RECORD;
  v_calc RECORD;
  v_edges_updated INT := 0;
  v_feedbacks_processed INT := 0;
  v_feedback_ids UUID[];
BEGIN
  -- Récupérer le seuil minimum
  SELECT (config_value::TEXT)::INT INTO v_min_feedback
  FROM kg_feedback_config WHERE config_key = 'min_feedback_count';
  v_min_feedback := COALESCE(v_min_feedback, 10);

  -- Trouver les edges avec suffisamment de feedbacks non traités
  FOR v_edge_record IN
    SELECT
      fe.edge_id,
      ARRAY_AGG(fe.event_id) AS event_ids,
      COUNT(*) AS feedback_count
    FROM kg_feedback_events fe
    WHERE fe.processed = FALSE
      AND fe.edge_id IS NOT NULL
    GROUP BY fe.edge_id
    HAVING COUNT(*) >= v_min_feedback
    LIMIT p_batch_size
  LOOP
    -- Calculer les nouveaux poids
    SELECT * INTO v_calc
    FROM kg_calculate_bayesian_weight(v_edge_record.edge_id, v_min_feedback);

    IF v_calc.feedback_count >= v_min_feedback THEN
      -- Enregistrer l'ajustement
      INSERT INTO kg_weight_adjustments (
        edge_id, weight_before, weight_after, confidence_before, confidence_after,
        adjustment_reason, feedback_count, positive_count, negative_count,
        feedback_event_ids, adjusted_by
      )
      SELECT
        v_edge_record.edge_id,
        e.weight,
        v_calc.new_weight,
        e.confidence,
        v_calc.new_confidence,
        'bayesian_update',
        v_calc.feedback_count,
        v_calc.positive_count,
        v_calc.negative_count,
        v_edge_record.event_ids,
        'system'
      FROM kg_edges e
      WHERE e.edge_id = v_edge_record.edge_id;

      -- Mettre à jour l'edge
      UPDATE kg_edges
      SET
        weight = v_calc.new_weight,
        confidence = v_calc.new_confidence,
        version = version + 1,
        updated_at = NOW()
      WHERE edge_id = v_edge_record.edge_id;

      -- Marquer les feedbacks comme traités
      UPDATE kg_feedback_events
      SET
        processed = TRUE,
        processed_at = NOW(),
        processing_result = JSONB_BUILD_OBJECT(
          'new_weight', v_calc.new_weight,
          'new_confidence', v_calc.new_confidence,
          'adjustment_id', (SELECT adjustment_id FROM kg_weight_adjustments ORDER BY adjusted_at DESC LIMIT 1)
        )
      WHERE event_id = ANY(v_edge_record.event_ids);

      v_edges_updated := v_edges_updated + 1;
      v_feedbacks_processed := v_feedbacks_processed + v_calc.feedback_count;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_edges_updated, v_feedbacks_processed;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RPC: Enregistrer un feedback                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_record_feedback(
  p_event_type TEXT,
  p_feedback_source TEXT,
  p_edge_id UUID DEFAULT NULL,
  p_fault_id UUID DEFAULT NULL,
  p_observable_ids UUID[] DEFAULT NULL,
  p_diagnosis_cache_id UUID DEFAULT NULL,
  p_feedback_data JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_reliability FLOAT;
BEGIN
  -- Récupérer la fiabilité de la source
  SELECT (config_value->>p_feedback_source)::FLOAT INTO v_reliability
  FROM kg_feedback_config WHERE config_key = 'source_reliability';
  v_reliability := COALESCE(v_reliability, 0.5);

  -- Déterminer le sentiment si non fourni
  -- (basé sur le type d'événement)

  INSERT INTO kg_feedback_events (
    event_type,
    feedback_source,
    source_reliability,
    edge_id,
    fault_id,
    observable_ids,
    diagnosis_cache_id,
    feedback_data,
    sentiment,
    user_id,
    session_id
  ) VALUES (
    p_event_type,
    p_feedback_source,
    v_reliability,
    p_edge_id,
    p_fault_id,
    p_observable_ids,
    p_diagnosis_cache_id,
    p_feedback_data,
    CASE
      WHEN p_event_type IN ('diagnosis_confirmed', 'repair_successful', 'part_purchased') THEN 'positive'
      WHEN p_event_type IN ('diagnosis_rejected', 'repair_failed', 'part_returned') THEN 'negative'
      ELSE 'neutral'
    END,
    p_user_id,
    p_session_id
  )
  RETURNING event_id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Vue: Statistiques de feedback par edge                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_feedback_stats AS
SELECT
  e.edge_id,
  e.edge_type,
  sn.node_label AS source_label,
  tn.node_label AS target_label,
  e.weight,
  e.confidence,
  COUNT(fe.*) AS total_feedback,
  COUNT(*) FILTER (WHERE fe.sentiment = 'positive') AS positive_count,
  COUNT(*) FILTER (WHERE fe.sentiment = 'negative') AS negative_count,
  COUNT(*) FILTER (WHERE fe.processed = FALSE) AS pending_count,
  AVG(fe.source_reliability) AS avg_reliability,
  MAX(fe.created_at) AS last_feedback_at
FROM kg_edges e
LEFT JOIN kg_feedback_events fe ON fe.edge_id = e.edge_id
LEFT JOIN kg_nodes sn ON sn.node_id = e.source_node_id
LEFT JOIN kg_nodes tn ON tn.node_id = e.target_node_id
WHERE e.status = 'active'
GROUP BY e.edge_id, e.edge_type, sn.node_label, tn.node_label, e.weight, e.confidence;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. RLS et Grants                                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_feedback_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_weight_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_feedback_config ENABLE ROW LEVEL SECURITY;

-- Lecture pour authenticated
CREATE POLICY "kg_feedback_select_authenticated" ON kg_feedback_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kg_adjustments_select_authenticated" ON kg_weight_adjustments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kg_config_select_authenticated" ON kg_feedback_config
  FOR SELECT TO authenticated USING (true);

-- Insert feedback pour authenticated
CREATE POLICY "kg_feedback_insert_authenticated" ON kg_feedback_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Full access pour service_role
CREATE POLICY "kg_feedback_all_service" ON kg_feedback_events
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_adjustments_all_service" ON kg_weight_adjustments
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_config_all_service" ON kg_feedback_config
  FOR ALL TO service_role USING (true);

-- Grants
GRANT EXECUTE ON FUNCTION kg_record_feedback TO authenticated;
GRANT EXECUTE ON FUNCTION kg_process_feedback_batch TO service_role;
GRANT EXECUTE ON FUNCTION kg_calculate_bayesian_weight TO service_role;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Comments                                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE kg_feedback_events IS 'Événements de feedback terrain pour amélioration continue du graphe';
COMMENT ON TABLE kg_weight_adjustments IS 'Audit trail des ajustements de poids sur les edges';
COMMENT ON TABLE kg_feedback_config IS 'Configuration des paramètres de feedback';
COMMENT ON FUNCTION kg_record_feedback IS 'Enregistre un événement de feedback';
COMMENT ON FUNCTION kg_process_feedback_batch IS 'Traite les feedbacks en batch avec mise à jour bayésienne';
COMMENT ON FUNCTION kg_calculate_bayesian_weight IS 'Calcule les nouveaux poids/confidence selon Bayes';

COMMIT;
