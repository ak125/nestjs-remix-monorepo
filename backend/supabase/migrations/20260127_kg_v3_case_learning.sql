-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 11: Case-Based Learning
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Objectif: Apprendre des cas confirmés pour améliorer le diagnostic
--
-- Cycle:
--   1. Diagnostic → kg_record_case()
--   2. Achat/Réparation → kg_record_outcome()
--   3. Confirmation client → kg_apply_learning()
--   4. Ajustement poids → Meilleur diagnostic suivant
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TABLE kg_cases (Cas de diagnostic)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kg_cases (
  case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══ CONTEXTE VÉHICULE ═══
  vehicle_id UUID,                    -- Lien vers véhicule si connecté
  ktypnr INT,                         -- KType TecDoc
  engine_family_code TEXT,            -- Ex: 'K9K', 'F4R', 'EP6'
  current_km INT,
  vehicle_age_months INT,

  -- ═══ DIAGNOSTIC INITIAL ═══
  observable_ids UUID[],              -- Symptômes/signes rapportés
  diagnosis_timestamp TIMESTAMPTZ DEFAULT NOW(),
  diagnosis_result JSONB,             -- Résultat complet kg_diagnose()
  predicted_fault_id UUID,            -- Panne prédite #1
  predicted_fault_label TEXT,
  confidence_at_diagnosis FLOAT,      -- Confidence au moment du diagnostic
  safety_gate TEXT,                   -- Gate safety si applicable

  -- ═══ OUTCOME (Résultat) ═══
  outcome_type TEXT CHECK (outcome_type IN (
    'purchase',        -- Achat pièce sur le site
    'garage_repair',   -- Réparation en garage (facture)
    'no_action',       -- Pas d'action (fausse alerte?)
    'return',          -- Retour pièce (mauvais diagnostic)
    'pending'          -- En attente de confirmation
  )) DEFAULT 'pending',

  outcome_fault_id UUID,              -- Panne réelle (si différente de prédite)
  outcome_fault_label TEXT,
  diagnosis_correct BOOLEAN,          -- predicted = actual?

  -- ═══ VÉRIFICATION ═══
  verification_method TEXT CHECK (verification_method IN (
    'customer_confirm',  -- Client confirme "ça marche"
    'invoice',           -- Facture garage uploadée
    'garage_api',        -- API garage partenaire
    'obd_reading',       -- Lecture OBD post-réparation
    'return_analysis',   -- Analyse du retour produit
    'phone_support',     -- Confirmation par téléphone SAV
    'auto_inferred'      -- Inféré (pas de retour après X jours)
  )),
  verified_at TIMESTAMPTZ,
  verified_by TEXT,                   -- user_id ou 'system'
  verification_notes TEXT,

  -- ═══ MÉTADONNÉES ═══
  user_id UUID,                       -- Client (si connecté)
  session_id TEXT,                    -- Session (si anonyme)
  order_id INT,                       -- Lien __orders si achat
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche de cas similaires
CREATE INDEX IF NOT EXISTS idx_kg_cases_vehicle ON kg_cases(ktypnr, engine_family_code);
CREATE INDEX IF NOT EXISTS idx_kg_cases_outcome ON kg_cases(outcome_type, diagnosis_correct);
CREATE INDEX IF NOT EXISTS idx_kg_cases_fault ON kg_cases(predicted_fault_id, outcome_fault_id);
CREATE INDEX IF NOT EXISTS idx_kg_cases_user ON kg_cases(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kg_cases_order ON kg_cases(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kg_cases_pending ON kg_cases(created_at) WHERE outcome_type = 'pending';

COMMENT ON TABLE kg_cases IS
  'Cas de diagnostic avec contexte véhicule, prédiction et résultat confirmé';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TABLE kg_case_outcomes (Détails des outcomes)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kg_case_outcomes (
  outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES kg_cases(case_id) ON DELETE CASCADE,

  -- ═══ ACHAT SUR LE SITE ═══
  order_id INT,                       -- Lien __orders
  parts_purchased JSONB,              -- [{piece_id, ref, qty, price}]
  total_amount DECIMAL(10,2),

  -- ═══ FACTURE GARAGE ═══
  invoice_ref TEXT,
  invoice_date DATE,
  invoice_amount DECIMAL(10,2),
  garage_name TEXT,
  garage_id UUID,                     -- Si garage partenaire
  work_performed TEXT,                -- Description travaux
  parts_replaced JSONB,               -- Pièces remplacées

  -- ═══ FEEDBACK CLIENT ═══
  problem_solved BOOLEAN,
  customer_rating INT CHECK (customer_rating BETWEEN 1 AND 5),
  customer_comment TEXT,
  would_recommend BOOLEAN,

  -- ═══ RETOUR PRODUIT ═══
  return_reason TEXT,
  return_date DATE,
  refund_amount DECIMAL(10,2),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kg_case_outcomes_case ON kg_case_outcomes(case_id);
CREATE INDEX IF NOT EXISTS idx_kg_case_outcomes_order ON kg_case_outcomes(order_id) WHERE order_id IS NOT NULL;

COMMENT ON TABLE kg_case_outcomes IS
  'Détails des outcomes: achat, facture garage, feedback, retour';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. TABLE kg_learning_log (Journal d'apprentissage)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kg_learning_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══ SOURCE ═══
  case_id UUID REFERENCES kg_cases(case_id),
  batch_id UUID,                      -- Si recalibration en batch

  -- ═══ AJUSTEMENTS ═══
  edge_id UUID,                       -- REFERENCES kg_edges si existe
  old_weight FLOAT,
  new_weight FLOAT,
  old_confidence FLOAT,
  new_confidence FLOAT,
  adjustment_reason TEXT CHECK (adjustment_reason IN (
    'positive_outcome',   -- Diagnostic correct confirmé
    'negative_outcome',   -- Diagnostic incorrect
    'batch_recalibration',-- Recalibration périodique
    'manual_override'     -- Ajustement manuel expert
  )),

  -- ═══ MÉTADONNÉES ═══
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_kg_learning_log_edge ON kg_learning_log(edge_id);
CREATE INDEX IF NOT EXISTS idx_kg_learning_log_date ON kg_learning_log(applied_at);
CREATE INDEX IF NOT EXISTS idx_kg_learning_log_case ON kg_learning_log(case_id);

COMMENT ON TABLE kg_learning_log IS
  'Journal des ajustements de poids/confidence suite aux outcomes';


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: kg_record_case() - Enregistrer un cas de diagnostic
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_record_case(
  p_observable_ids UUID[],
  p_ktypnr INT DEFAULT NULL,
  p_engine_family_code TEXT DEFAULT NULL,
  p_current_km INT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_vehicle_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_case_id UUID;
  v_diagnosis JSONB;
  v_top_fault RECORD;
  v_safety_gate TEXT;
BEGIN
  -- 1. Exécuter le diagnostic avec sécurité
  BEGIN
    SELECT kg_diagnose_with_safety(
      p_observable_ids,
      p_vehicle_id,
      p_engine_family_code,
      p_current_km,
      FALSE  -- Ne pas skip le diagnostic même si critique
    ) INTO v_diagnosis;
  EXCEPTION WHEN OTHERS THEN
    -- Si la fonction n'existe pas, utiliser un diagnostic basique
    v_diagnosis := jsonb_build_object(
      'faults', '[]'::JSONB,
      'safety', jsonb_build_object('highest_gate', 'none')
    );
  END;

  -- 2. Extraire la panne #1 (si existe)
  SELECT
    (d->>'fault_id')::UUID AS fault_id,
    d->>'fault_label' AS fault_label,
    (d->>'score')::FLOAT AS score
  INTO v_top_fault
  FROM jsonb_array_elements(v_diagnosis->'faults') d
  LIMIT 1;

  -- 3. Extraire le safety gate
  v_safety_gate := v_diagnosis->'safety'->>'highest_gate';

  -- 4. Créer le cas
  INSERT INTO kg_cases (
    vehicle_id, ktypnr, engine_family_code, current_km,
    observable_ids, diagnosis_result,
    predicted_fault_id, predicted_fault_label,
    confidence_at_diagnosis,
    safety_gate,
    user_id, session_id
  ) VALUES (
    p_vehicle_id, p_ktypnr, p_engine_family_code, p_current_km,
    p_observable_ids, v_diagnosis,
    v_top_fault.fault_id, v_top_fault.fault_label,
    COALESCE(v_top_fault.score, 0),
    v_safety_gate,
    p_user_id, p_session_id
  ) RETURNING case_id INTO v_case_id;

  RETURN v_case_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_record_case IS
  'Enregistre un cas de diagnostic au moment où l''utilisateur consulte les résultats';


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: kg_record_outcome() - Enregistrer le résultat
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_record_outcome(
  p_case_id UUID,
  p_outcome_type TEXT,
  p_verification_method TEXT,
  p_problem_solved BOOLEAN DEFAULT NULL,
  p_actual_fault_id UUID DEFAULT NULL,
  p_order_id INT DEFAULT NULL,
  p_customer_rating INT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_predicted_fault_id UUID;
  v_diagnosis_correct BOOLEAN;
BEGIN
  -- 1. Récupérer la panne prédite
  SELECT predicted_fault_id INTO v_predicted_fault_id
  FROM kg_cases WHERE case_id = p_case_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found: %', p_case_id;
  END IF;

  -- 2. Déterminer si le diagnostic était correct
  v_diagnosis_correct := CASE
    -- Si problème résolu et pas de panne alternative spécifiée → correct
    WHEN p_actual_fault_id IS NULL AND p_problem_solved = TRUE THEN TRUE
    -- Si la panne réelle = panne prédite → correct
    WHEN p_actual_fault_id = v_predicted_fault_id THEN TRUE
    -- Si retour produit → incorrect
    WHEN p_outcome_type = 'return' THEN FALSE
    -- Si problème non résolu → incorrect
    WHEN p_problem_solved = FALSE THEN FALSE
    -- Sinon indéterminé
    ELSE NULL
  END;

  -- 3. Mettre à jour le cas
  UPDATE kg_cases SET
    outcome_type = p_outcome_type,
    outcome_fault_id = p_actual_fault_id,
    outcome_fault_label = (SELECT node_label FROM kg_nodes WHERE node_id = p_actual_fault_id),
    diagnosis_correct = v_diagnosis_correct,
    verification_method = p_verification_method,
    verified_at = NOW(),
    order_id = COALESCE(p_order_id, order_id),
    updated_at = NOW()
  WHERE case_id = p_case_id;

  -- 4. Enregistrer les détails outcome
  INSERT INTO kg_case_outcomes (
    case_id, order_id, problem_solved,
    customer_rating, customer_comment
  ) VALUES (
    p_case_id, p_order_id, p_problem_solved,
    p_customer_rating, p_notes
  );

  -- 5. Déclencher l'apprentissage si outcome confirmé
  IF v_diagnosis_correct IS NOT NULL THEN
    PERFORM kg_apply_learning(p_case_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_record_outcome IS
  'Enregistre le résultat (outcome) d''un cas et déclenche l''apprentissage';


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC: kg_apply_learning() - Appliquer l'apprentissage
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_apply_learning(
  p_case_id UUID
)
RETURNS INT AS $$
DECLARE
  v_case RECORD;
  v_edges_updated INT := 0;
  v_adjustment FLOAT;
  v_edge RECORD;
  v_new_confidence FLOAT;
BEGIN
  -- 1. Récupérer le cas
  SELECT * INTO v_case FROM kg_cases WHERE case_id = p_case_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- 2. Calculer l'ajustement
  -- Diagnostic correct → renforcer les edges (+2%)
  -- Diagnostic incorrect → affaiblir les edges (-5%)
  v_adjustment := CASE
    WHEN v_case.diagnosis_correct = TRUE THEN 0.02
    WHEN v_case.diagnosis_correct = FALSE THEN -0.05
    ELSE 0
  END;

  IF v_adjustment = 0 THEN
    RETURN 0;
  END IF;

  -- 3. Ajuster les edges Observable → Fault prédit
  FOR v_edge IN
    SELECT e.edge_id, e.weight, e.confidence
    FROM kg_edges e
    WHERE e.source_node_id = ANY(v_case.observable_ids)
      AND e.target_node_id = v_case.predicted_fault_id
      AND e.status = 'active'
  LOOP
    -- Calculer nouvelle confidence (bornée entre 0.1 et 1.0)
    v_new_confidence := LEAST(1.0, GREATEST(0.1, v_edge.confidence + v_adjustment));

    -- Ajuster la confidence (pas le weight)
    UPDATE kg_edges SET
      confidence = v_new_confidence,
      updated_at = NOW()
    WHERE edge_id = v_edge.edge_id;

    -- Logger l'ajustement
    INSERT INTO kg_learning_log (
      case_id, edge_id,
      old_confidence, new_confidence,
      adjustment_reason
    ) VALUES (
      p_case_id, v_edge.edge_id,
      v_edge.confidence,
      v_new_confidence,
      CASE WHEN v_adjustment > 0 THEN 'positive_outcome' ELSE 'negative_outcome' END
    );

    v_edges_updated := v_edges_updated + 1;
  END LOOP;

  RETURN v_edges_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_apply_learning IS
  'Applique l''apprentissage: ajuste la confidence des edges selon le résultat du cas';


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RPC: kg_find_similar_cases() - Trouver des cas similaires
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_find_similar_cases(
  p_observable_ids UUID[],
  p_ktypnr INT DEFAULT NULL,
  p_engine_family_code TEXT DEFAULT NULL,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  case_id UUID,
  similarity_score FLOAT,
  predicted_fault_label TEXT,
  diagnosis_correct BOOLEAN,
  outcome_type TEXT,
  problem_solved BOOLEAN,
  customer_rating INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.case_id,
    -- Score de similarité basé sur :
    -- 1. Observables en commun (60%)
    -- 2. Même famille moteur (25%)
    -- 3. Même KType (15%)
    (
      -- Observables en commun
      0.6 * (
        COALESCE(array_length(c.observable_ids & p_observable_ids, 1), 0)::FLOAT /
        GREATEST(COALESCE(array_length(c.observable_ids | p_observable_ids, 1), 1), 1)
      )
      +
      -- Même famille moteur
      CASE WHEN c.engine_family_code = p_engine_family_code AND p_engine_family_code IS NOT NULL
           THEN 0.25 ELSE 0 END
      +
      -- Même KType
      CASE WHEN c.ktypnr = p_ktypnr AND p_ktypnr IS NOT NULL
           THEN 0.15 ELSE 0 END
    ) AS similarity_score,
    c.predicted_fault_label,
    c.diagnosis_correct,
    c.outcome_type,
    co.problem_solved,
    co.customer_rating
  FROM kg_cases c
  LEFT JOIN kg_case_outcomes co ON co.case_id = c.case_id
  WHERE c.outcome_type != 'pending'
    AND c.observable_ids && p_observable_ids  -- Au moins 1 observable en commun
  ORDER BY similarity_score DESC, c.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_find_similar_cases IS
  'Trouve des cas similaires basés sur les observables et le contexte véhicule';


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. RPC: kg_get_learning_stats() - Statistiques d'apprentissage
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_get_learning_stats(
  p_days INT DEFAULT 30
)
RETURNS TABLE (
  total_cases BIGINT,
  confirmed_cases BIGINT,
  correct_diagnoses BIGINT,
  accuracy_rate FLOAT,
  edges_adjusted BIGINT,
  avg_confidence_change FLOAT,
  top_improved_faults JSONB,
  top_degraded_faults JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH case_stats AS (
    SELECT
      COUNT(*) AS total_cases,
      COUNT(*) FILTER (WHERE outcome_type != 'pending') AS confirmed_cases,
      COUNT(*) FILTER (WHERE diagnosis_correct = TRUE) AS correct_diagnoses
    FROM kg_cases
    WHERE created_at >= NOW() - (p_days || ' days')::INTERVAL
  ),
  learning_stats AS (
    SELECT
      COUNT(*) AS edges_adjusted,
      AVG(new_confidence - old_confidence) AS avg_confidence_change
    FROM kg_learning_log
    WHERE applied_at >= NOW() - (p_days || ' days')::INTERVAL
  ),
  fault_performance AS (
    SELECT
      predicted_fault_label,
      COUNT(*) AS cases,
      AVG(CASE WHEN diagnosis_correct THEN 1.0 ELSE 0.0 END) AS accuracy
    FROM kg_cases
    WHERE outcome_type != 'pending'
      AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      AND predicted_fault_label IS NOT NULL
    GROUP BY predicted_fault_label
    HAVING COUNT(*) >= 3
  )
  SELECT
    cs.total_cases,
    cs.confirmed_cases,
    cs.correct_diagnoses,
    CASE WHEN cs.confirmed_cases > 0
      THEN (cs.correct_diagnoses::FLOAT / cs.confirmed_cases)
      ELSE 0.0
    END AS accuracy_rate,
    ls.edges_adjusted,
    COALESCE(ls.avg_confidence_change, 0.0) AS avg_confidence_change,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'fault', fp.predicted_fault_label,
        'accuracy', ROUND(fp.accuracy::NUMERIC, 2),
        'cases', fp.cases
      )), '[]'::JSONB)
     FROM (SELECT * FROM fault_performance ORDER BY accuracy DESC LIMIT 5) fp
    ) AS top_improved_faults,
    (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'fault', fp.predicted_fault_label,
        'accuracy', ROUND(fp.accuracy::NUMERIC, 2),
        'cases', fp.cases
      )), '[]'::JSONB)
     FROM (SELECT * FROM fault_performance ORDER BY accuracy ASC LIMIT 5) fp
    ) AS top_degraded_faults
  FROM case_stats cs, learning_stats ls;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_get_learning_stats IS
  'Retourne les statistiques d''apprentissage: accuracy, adjustments, top faults';


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. RPC: kg_auto_infer_outcomes() - Inférence automatique (batch)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_auto_infer_outcomes(
  p_days_threshold INT DEFAULT 30
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_case RECORD;
BEGIN
  -- Cas avec achat et pas de retour après X jours → succès
  FOR v_case IN
    SELECT c.case_id
    FROM kg_cases c
    WHERE c.outcome_type = 'pending'
      AND c.order_id IS NOT NULL
      AND c.created_at < NOW() - (p_days_threshold || ' days')::INTERVAL
      -- Vérifier qu'il n'y a pas de retour associé
      AND NOT EXISTS (
        SELECT 1 FROM kg_case_outcomes co
        WHERE co.case_id = c.case_id
          AND co.return_date IS NOT NULL
      )
  LOOP
    PERFORM kg_record_outcome(
      v_case.case_id,
      'purchase',
      'auto_inferred',
      TRUE,  -- problem_solved = true (inféré)
      NULL,  -- actual_fault_id
      NULL,  -- order_id déjà set
      NULL,  -- customer_rating
      'Auto-inféré: pas de retour après ' || p_days_threshold || ' jours'
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION kg_auto_infer_outcomes IS
  'Infère automatiquement le succès des cas avec achat et sans retour après X jours';


-- ═══════════════════════════════════════════════════════════════════════════
-- 10. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE kg_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_case_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_learning_log ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous (données anonymisées pour analytics)
CREATE POLICY "kg_cases_select_all" ON kg_cases FOR SELECT USING (true);
CREATE POLICY "kg_case_outcomes_select_all" ON kg_case_outcomes FOR SELECT USING (true);
CREATE POLICY "kg_learning_log_select_all" ON kg_learning_log FOR SELECT USING (true);

-- Modification pour service role uniquement
CREATE POLICY "kg_cases_all_service" ON kg_cases FOR ALL TO service_role USING (true);
CREATE POLICY "kg_case_outcomes_all_service" ON kg_case_outcomes FOR ALL TO service_role USING (true);
CREATE POLICY "kg_learning_log_all_service" ON kg_learning_log FOR ALL TO service_role USING (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 11. TRIGGERS updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kg_cases_updated ON kg_cases;
CREATE TRIGGER trg_kg_cases_updated
  BEFORE UPDATE ON kg_cases
  FOR EACH ROW
  EXECUTE FUNCTION kg_cases_updated_at();


COMMIT;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VÉRIFICATION POST-MIGRATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 1. Vérifier les tables:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_name LIKE 'kg_case%' OR table_name = 'kg_learning_log';
--
-- 2. Tester kg_record_case:
--    SELECT kg_record_case(
--      ARRAY['uuid-1', 'uuid-2']::UUID[],
--      12345, 'K9K', 85000
--    );
--
-- 3. Tester kg_find_similar_cases:
--    SELECT * FROM kg_find_similar_cases(
--      ARRAY['uuid-1']::UUID[], 12345, 'K9K'
--    );
--
-- 4. Statistiques:
--    SELECT * FROM kg_get_learning_stats(30);
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
