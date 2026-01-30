-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🛡️ KNOWLEDGE GRAPH v3.0 - Phase 10: Gate Safety (Sécurité Routière)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Objectif: Détecter les situations dangereuses AVANT le diagnostic
--           et bloquer les ventes agressives sur les cas critiques
--
-- Niveaux:
--   none           → Diagnostic normal
--   warning        → Badge jaune + diagnostic
--   stop_soon      → Banner orange + pas de vente agressive
--   stop_immediate → Fullscreen rouge + blocage vente + urgence
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. CHAMP safety_gate SUR kg_nodes
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  safety_gate TEXT DEFAULT 'none' CHECK (safety_gate IN (
    'none',           -- Pas de risque sécurité immédiat
    'warning',        -- Attention, à surveiller
    'stop_soon',      -- Arrêter dès que possible (< 24h)
    'stop_immediate'  -- Ne pas rouler, danger immédiat
  ));

-- Index pour recherche rapide des observables avec safety concern
CREATE INDEX IF NOT EXISTS idx_kg_nodes_safety_gate
  ON kg_nodes(safety_gate)
  WHERE safety_gate != 'none';

COMMENT ON COLUMN kg_nodes.safety_gate IS
  'Gate de sécurité routière: none (normal), warning (à surveiller), stop_soon (arrêt sous 24h), stop_immediate (ne pas rouler)';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. TABLE kg_safety_triggers (Déclencheurs de sécurité)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kg_safety_triggers (
  trigger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ═══ MATCHING PATTERNS ═══
  observable_label_pattern TEXT NOT NULL,  -- Pattern ILIKE (ex: '%perte%frein%')
  dtc_code_pattern TEXT,                   -- Pattern pour codes OBD (ex: 'C1%')
  perception_channel TEXT,                 -- Filtre optionnel sur le canal
  intensity_min INT,                       -- Intensité minimale pour trigger

  -- ═══ GATE ASSIGNÉ ═══
  safety_gate TEXT NOT NULL CHECK (safety_gate IN (
    'warning', 'stop_soon', 'stop_immediate'
  )),

  -- ═══ MESSAGES (multilingue) ═══
  safety_message_fr TEXT NOT NULL,         -- Message FR
  safety_message_en TEXT,                  -- Message EN (optionnel)
  recommended_action_fr TEXT NOT NULL,     -- Action recommandée FR
  recommended_action_en TEXT,              -- Action recommandée EN

  -- ═══ COMPORTEMENT ═══
  block_sales BOOLEAN DEFAULT FALSE,       -- Bloquer les ventes
  show_emergency_contact BOOLEAN DEFAULT FALSE,  -- Montrer contact urgence
  emergency_contact TEXT,                  -- Numéro d'urgence

  -- ═══ MÉTADONNÉES ═══
  is_active BOOLEAN DEFAULT TRUE,
  priority INT DEFAULT 0,                  -- Priorité (plus haut = prioritaire)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche active
CREATE INDEX IF NOT EXISTS idx_kg_safety_triggers_active
  ON kg_safety_triggers(is_active, priority DESC)
  WHERE is_active = TRUE;

COMMENT ON TABLE kg_safety_triggers IS
  'Déclencheurs de sécurité routière basés sur patterns de symptômes';


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. DONNÉES INITIALES (Triggers de sécurité critiques)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_safety_triggers (
  observable_label_pattern,
  safety_gate,
  safety_message_fr,
  recommended_action_fr,
  block_sales,
  show_emergency_contact,
  priority
) VALUES
  -- ══════ STOP IMMEDIATE (Danger de mort) ══════
  ('%perte%frein%', 'stop_immediate',
   '⛔ DANGER : Perte de freinage détectée',
   'NE PAS ROULER. Faites remorquer le véhicule immédiatement.',
   TRUE, TRUE, 100),

  ('%plus de frein%', 'stop_immediate',
   '⛔ DANGER : Système de freinage défaillant',
   'NE PAS ROULER. Appelez une dépanneuse.',
   TRUE, TRUE, 100),

  ('%surchauffe%moteur%', 'stop_immediate',
   '⛔ DANGER : Surchauffe moteur détectée',
   'Coupez le moteur immédiatement. Risque de casse moteur.',
   TRUE, TRUE, 95),

  ('%fumée%habitacle%', 'stop_immediate',
   '⛔ DANGER : Fumée dans l''habitacle',
   'Arrêtez-vous immédiatement et évacuez le véhicule. Risque d''incendie.',
   TRUE, TRUE, 99),

  ('%odeur%essence%forte%', 'stop_immediate',
   '⛔ DANGER : Fuite de carburant possible',
   'Arrêtez-vous loin de toute source de chaleur. Risque d''incendie.',
   TRUE, TRUE, 98),

  ('%fuite%huile%importante%', 'stop_immediate',
   '⛔ DANGER : Fuite d''huile importante',
   'Coupez le moteur. Risque de casse moteur et d''incendie.',
   TRUE, TRUE, 90),

  ('%voyant%huile%rouge%', 'stop_immediate',
   '⛔ DANGER : Pression huile critique',
   'Coupez le moteur immédiatement. Vérifiez le niveau d''huile.',
   TRUE, TRUE, 92),

  ('%direction%bloquée%', 'stop_immediate',
   '⛔ DANGER : Direction bloquée',
   'NE PAS ROULER. Faites remorquer le véhicule.',
   TRUE, TRUE, 100),

  -- ══════ STOP SOON (Arrêt sous 24h) ══════
  ('%pédale%frein%molle%', 'stop_soon',
   '⚠️ ATTENTION : Freinage dégradé détecté',
   'Arrêtez-vous dès que possible et contactez un garage. Ne roulez pas longtemps.',
   TRUE, FALSE, 80),

  ('%pédale%frein%s''enfonce%', 'stop_soon',
   '⚠️ ATTENTION : Système de freinage anormal',
   'Faites contrôler le système de freinage en urgence.',
   TRUE, FALSE, 82),

  ('%direction%très%dure%', 'stop_soon',
   '⚠️ ATTENTION : Assistance direction défaillante',
   'Conduisez prudemment vers un garage. Évitez les longs trajets.',
   TRUE, FALSE, 75),

  ('%direction%dure%', 'stop_soon',
   '⚠️ ATTENTION : Direction assistée en panne',
   'Rejoignez un garage rapidement. Manœuvres difficiles à prévoir.',
   TRUE, FALSE, 70),

  ('%bruit%métallique%fort%continu%', 'stop_soon',
   '⚠️ ATTENTION : Bruit mécanique anormal',
   'Faites contrôler rapidement. Pièce en rupture possible.',
   FALSE, FALSE, 60),

  ('%claquement%suspension%', 'stop_soon',
   '⚠️ ATTENTION : Suspension endommagée',
   'Faites contrôler la suspension dans les plus brefs délais.',
   FALSE, FALSE, 55),

  ('%voyant%température%rouge%', 'stop_soon',
   '⚠️ ATTENTION : Température moteur critique',
   'Arrêtez-vous dès que possible. Laissez refroidir le moteur.',
   TRUE, FALSE, 85),

  ('%liquide%refroidissement%fuit%', 'stop_soon',
   '⚠️ ATTENTION : Fuite de liquide de refroidissement',
   'Surveillez la température et rejoignez un garage rapidement.',
   FALSE, FALSE, 70),

  -- ══════ WARNING (À surveiller) ══════
  ('%vibration%violent%volant%', 'warning',
   '⚠️ Vibrations anormales détectées',
   'Faites contrôler le parallélisme et l''équilibrage dans les prochains jours.',
   FALSE, FALSE, 40),

  ('%vibration%frein%', 'warning',
   '⚠️ Vibrations au freinage',
   'Faites contrôler les disques de frein. Usure ou voilage possible.',
   FALSE, FALSE, 45),

  ('%voyant%abs%', 'warning',
   '⚠️ Système ABS en défaut',
   'Freinage dégradé sur sol glissant. Faites contrôler.',
   FALSE, FALSE, 50),

  ('%voyant%esp%', 'warning',
   '⚠️ Système ESP/ESC en défaut',
   'Stabilité réduite. Conduisez prudemment et faites contrôler.',
   FALSE, FALSE, 48),

  ('%voyant%airbag%', 'warning',
   '⚠️ Système airbag en défaut',
   'Protection réduite en cas de choc. Faites contrôler rapidement.',
   FALSE, FALSE, 55),

  ('%bruit%roulement%', 'warning',
   '⚠️ Bruit de roulement détecté',
   'Faites vérifier les roulements de roue prochainement.',
   FALSE, FALSE, 35),

  ('%grincement%frein%', 'warning',
   '⚠️ Usure des plaquettes de frein',
   'Témoin d''usure activé. Planifiez le remplacement.',
   FALSE, FALSE, 42),

  ('%fuite%légère%huile%', 'warning',
   '⚠️ Fuite d''huile mineure détectée',
   'Surveillez le niveau et faites réparer prochainement.',
   FALSE, FALSE, 30)

ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. RPC: kg_check_safety_gate() - Vérification de sécurité
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_check_safety_gate(
  p_observable_ids UUID[]
)
RETURNS TABLE (
  has_safety_concern BOOLEAN,
  highest_gate TEXT,
  safety_message TEXT,
  recommended_action TEXT,
  can_continue_driving BOOLEAN,
  block_sales BOOLEAN,
  show_emergency_contact BOOLEAN,
  emergency_contact TEXT,
  triggered_observables JSONB
) AS $$
DECLARE
  v_gate_priority JSONB := '{"none": 0, "warning": 1, "stop_soon": 2, "stop_immediate": 3}';
BEGIN
  RETURN QUERY
  WITH
  -- 1. Vérifier les safety_gate directement sur les nodes
  node_gates AS (
    SELECT
      n.node_id,
      n.node_label,
      n.safety_gate,
      (v_gate_priority->>n.safety_gate)::INT AS gate_level
    FROM kg_nodes n
    WHERE n.node_id = ANY(p_observable_ids)
      AND n.safety_gate IS NOT NULL
      AND n.safety_gate != 'none'
  ),

  -- 2. Vérifier via les triggers patterns
  trigger_matches AS (
    SELECT DISTINCT ON (t.trigger_id)
      t.trigger_id,
      t.safety_gate,
      t.safety_message_fr,
      t.recommended_action_fr,
      t.block_sales,
      t.show_emergency_contact,
      t.emergency_contact,
      t.priority,
      n.node_id,
      n.node_label,
      (v_gate_priority->>t.safety_gate)::INT AS gate_level
    FROM kg_safety_triggers t
    CROSS JOIN LATERAL (
      SELECT n.node_id, n.node_label, n.dtc_code, n.intensity
      FROM kg_nodes n
      WHERE n.node_id = ANY(p_observable_ids)
        AND (
          n.node_label ILIKE t.observable_label_pattern
          OR (t.dtc_code_pattern IS NOT NULL AND n.dtc_code ILIKE t.dtc_code_pattern)
        )
        AND (t.intensity_min IS NULL OR COALESCE(n.intensity, 3) >= t.intensity_min)
    ) n
    WHERE t.is_active = TRUE
    ORDER BY t.trigger_id, t.priority DESC
  ),

  -- 3. Combiner et trouver le niveau le plus élevé
  all_concerns AS (
    SELECT
      node_id,
      node_label,
      safety_gate,
      gate_level,
      NULL::TEXT AS safety_message_fr,
      NULL::TEXT AS recommended_action_fr,
      FALSE AS block_sales,
      FALSE AS show_emergency_contact,
      NULL::TEXT AS emergency_contact
    FROM node_gates

    UNION ALL

    SELECT
      node_id,
      node_label,
      safety_gate,
      gate_level,
      safety_message_fr,
      recommended_action_fr,
      block_sales,
      show_emergency_contact,
      emergency_contact
    FROM trigger_matches
  ),

  highest AS (
    SELECT *
    FROM all_concerns
    ORDER BY gate_level DESC
    LIMIT 1
  ),

  all_triggered AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'node_id', node_id,
        'label', node_label,
        'gate', safety_gate
      )
    ) AS triggered
    FROM all_concerns
  )

  SELECT
    EXISTS(SELECT 1 FROM all_concerns) AS has_safety_concern,
    COALESCE(h.safety_gate, 'none') AS highest_gate,
    h.safety_message_fr AS safety_message,
    h.recommended_action_fr AS recommended_action,
    COALESCE(h.safety_gate, 'none') NOT IN ('stop_immediate', 'stop_soon') AS can_continue_driving,
    COALESCE(h.block_sales, FALSE) AS block_sales,
    COALESCE(h.show_emergency_contact, FALSE) AS show_emergency_contact,
    h.emergency_contact AS emergency_contact,
    at.triggered AS triggered_observables
  FROM (SELECT 1) AS dummy
  LEFT JOIN highest h ON TRUE
  LEFT JOIN all_triggered at ON TRUE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_check_safety_gate IS
  'Vérifie si les observables déclenchent un gate de sécurité routière. Retourne le niveau le plus élevé et les messages associés.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC: kg_diagnose_with_safety() - Diagnostic avec vérification sécurité
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_diagnose_with_safety(
  p_observable_ids UUID[],
  p_vehicle_id UUID DEFAULT NULL,
  p_engine_family_code TEXT DEFAULT NULL,
  p_current_km INT DEFAULT NULL,
  p_skip_diagnosis_if_critical BOOLEAN DEFAULT TRUE
)
RETURNS JSONB AS $$
DECLARE
  v_safety_result RECORD;
  v_diagnosis_results JSONB;
BEGIN
  -- 1. SAFETY CHECK EN PREMIER (toujours)
  SELECT * INTO v_safety_result
  FROM kg_check_safety_gate(p_observable_ids);

  -- 2. Si stop_immediate et skip_diagnosis_if_critical, retourner uniquement safety
  IF v_safety_result.highest_gate = 'stop_immediate' AND p_skip_diagnosis_if_critical THEN
    RETURN jsonb_build_object(
      'safety', jsonb_build_object(
        'has_safety_concern', v_safety_result.has_safety_concern,
        'highest_gate', v_safety_result.highest_gate,
        'safety_message', v_safety_result.safety_message,
        'recommended_action', v_safety_result.recommended_action,
        'can_continue_driving', v_safety_result.can_continue_driving,
        'block_sales', v_safety_result.block_sales,
        'show_emergency_contact', v_safety_result.show_emergency_contact,
        'emergency_contact', v_safety_result.emergency_contact,
        'triggered_observables', v_safety_result.triggered_observables
      ),
      'diagnosis_skipped', TRUE,
      'diagnosis_skip_reason', 'Situation de sécurité critique détectée. Diagnostic non pertinent.',
      'faults', '[]'::JSONB
    );
  END IF;

  -- 3. Sinon, effectuer le diagnostic normal
  SELECT jsonb_agg(
    jsonb_build_object(
      'fault_id', f.node_id,
      'fault_label', f.node_label,
      'score', ROUND((SUM(e.weight * e.confidence) / COUNT(*))::NUMERIC, 2),
      'matched_observables', COUNT(DISTINCT e.source_node_id)
    )
  ) INTO v_diagnosis_results
  FROM kg_nodes f
  JOIN kg_edges e ON e.target_node_id = f.node_id
    AND e.edge_type IN ('INDICATES', 'CONFIRMS', 'MANIFESTS_AS', 'CAUSES')
    AND e.status = 'active'
  WHERE f.node_type = 'Fault'
    AND f.status = 'active'
    AND e.source_node_id = ANY(p_observable_ids)
  GROUP BY f.node_id, f.node_label
  ORDER BY SUM(e.weight * e.confidence) DESC
  LIMIT 10;

  -- 4. Retourner résultat complet
  RETURN jsonb_build_object(
    'safety', jsonb_build_object(
      'has_safety_concern', v_safety_result.has_safety_concern,
      'highest_gate', v_safety_result.highest_gate,
      'safety_message', v_safety_result.safety_message,
      'recommended_action', v_safety_result.recommended_action,
      'can_continue_driving', v_safety_result.can_continue_driving,
      'block_sales', v_safety_result.block_sales,
      'show_emergency_contact', v_safety_result.show_emergency_contact,
      'emergency_contact', v_safety_result.emergency_contact,
      'triggered_observables', v_safety_result.triggered_observables
    ),
    'diagnosis_skipped', FALSE,
    'faults', COALESCE(v_diagnosis_results, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_diagnose_with_safety IS
  'Effectue un diagnostic avec vérification de sécurité préalable. Si danger critique, peut sauter le diagnostic.';


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE kg_safety_triggers ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous (triggers publics)
CREATE POLICY "kg_safety_triggers_select_all"
  ON kg_safety_triggers FOR SELECT
  USING (true);

-- Modification pour service role uniquement
CREATE POLICY "kg_safety_triggers_all_service"
  ON kg_safety_triggers FOR ALL
  TO service_role
  USING (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. TRIGGER updated_at
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION kg_safety_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kg_safety_triggers_updated ON kg_safety_triggers;
CREATE TRIGGER trg_kg_safety_triggers_updated
  BEFORE UPDATE ON kg_safety_triggers
  FOR EACH ROW
  EXECUTE FUNCTION kg_safety_triggers_updated_at();


COMMIT;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- VÉRIFICATION POST-MIGRATION
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 1. Vérifier la colonne safety_gate:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'kg_nodes' AND column_name = 'safety_gate';
--
-- 2. Vérifier les triggers:
--    SELECT observable_label_pattern, safety_gate, safety_message_fr
--    FROM kg_safety_triggers WHERE is_active = TRUE ORDER BY priority DESC;
--
-- 3. Tester la fonction:
--    SELECT * FROM kg_check_safety_gate(ARRAY['uuid-test']::UUID[]);
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
