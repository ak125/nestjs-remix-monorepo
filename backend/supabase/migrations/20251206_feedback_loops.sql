-- AI-COS v2.30.0: Feedback Loops Migration
-- Créé le 2025-12-06
-- Description: Tables pour boucles de feedback, validation CEO, et mesure d'impact

-- ============================================
-- Table 1: AI_COS_LEARNING_EVENTS
-- Stocke tous les événements d'apprentissage des agents
-- ============================================
CREATE TABLE IF NOT EXISTS ai_cos_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Identification
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  squad_id TEXT NOT NULL,
  action_id UUID REFERENCES ai_cos_actions(id) ON DELETE SET NULL,
  
  -- Détails de l'action
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  
  -- KPIs avant/après
  kpis_before JSONB NOT NULL DEFAULT '{}',
  kpis_after JSONB DEFAULT NULL,
  kpis_delta JSONB DEFAULT NULL,
  impact_score NUMERIC(5,2) DEFAULT NULL, -- -100 à +100
  
  -- Feedback
  outcome TEXT NOT NULL DEFAULT 'pending', -- 'success' | 'failure' | 'neutral' | 'pending'
  human_feedback TEXT DEFAULT NULL,
  human_feedback_by TEXT DEFAULT NULL,
  human_feedback_reason TEXT DEFAULT NULL,
  human_feedback_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Confiance agent
  confidence_before NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  confidence_after NUMERIC(5,2) DEFAULT NULL,
  confidence_delta NUMERIC(5,2) DEFAULT NULL,
  
  -- Pattern learning
  pattern_stored BOOLEAN NOT NULL DEFAULT FALSE,
  pattern_id UUID DEFAULT NULL,
  pattern_name TEXT DEFAULT NULL,
  
  -- Contexte
  context JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  notes TEXT DEFAULT NULL,
  
  -- Index
  CONSTRAINT learning_event_outcome_check CHECK (outcome IN ('success', 'failure', 'neutral', 'pending', 'rollback'))
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_learning_events_agent ON ai_cos_learning_events(agent_id, created_at DESC);
CREATE INDEX idx_learning_events_squad ON ai_cos_learning_events(squad_id, created_at DESC);
CREATE INDEX idx_learning_events_outcome ON ai_cos_learning_events(outcome, created_at DESC);
CREATE INDEX idx_learning_events_pattern ON ai_cos_learning_events(pattern_stored) WHERE pattern_stored = TRUE;
CREATE INDEX idx_learning_events_impact ON ai_cos_learning_events(impact_score) WHERE impact_score IS NOT NULL;

-- ============================================
-- Table 2: AI_COS_CEO_VALIDATIONS
-- Validations requises par le Human CEO
-- ============================================
CREATE TABLE IF NOT EXISTS ai_cos_ceo_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Références
  action_id UUID REFERENCES ai_cos_actions(id) ON DELETE CASCADE,
  escalation_id TEXT NOT NULL,
  learning_event_id UUID REFERENCES ai_cos_learning_events(id) ON DELETE SET NULL,
  
  -- Détails de l'escalade
  escalation_level TEXT NOT NULL DEFAULT 'CEO', -- 'CFO' | 'CEO' | 'BOARD'
  escalation_reason TEXT NOT NULL,
  escalation_source TEXT NOT NULL, -- 'IA-CEO' | 'META-AGENT' | 'CIRCUIT-BREAKER'
  
  -- Contexte de l'action
  agent_id TEXT NOT NULL,
  squad_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  budget_impact NUMERIC(12,2) DEFAULT 0.00,
  risk_score NUMERIC(5,2) NOT NULL,
  strategic_impact BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- KPIs projetés
  projected_kpis JSONB DEFAULT '{}',
  potential_risks JSONB DEFAULT '[]',
  
  -- Validation Human CEO
  human_ceo_id TEXT DEFAULT NULL,
  human_ceo_email TEXT DEFAULT NULL,
  human_ceo_name TEXT DEFAULT NULL,
  
  -- Décision
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'deferred' | 'expired'
  decision TEXT DEFAULT NULL, -- 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'MODIFIED'
  decision_reasoning TEXT DEFAULT NULL,
  decision_conditions JSONB DEFAULT NULL, -- Conditions spéciales si approved
  decided_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Délais
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL, -- Auto-expire si pas validé
  reminder_sent_at TIMESTAMPTZ DEFAULT NULL,
  expired_at TIMESTAMPTZ DEFAULT NULL,
  
  -- Notifications
  notification_channels JSONB DEFAULT '["email", "slack"]',
  notifications_sent JSONB DEFAULT '[]',
  
  -- Suivi post-décision
  action_executed_at TIMESTAMPTZ DEFAULT NULL,
  action_result TEXT DEFAULT NULL,
  post_action_review JSONB DEFAULT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Contraintes
  CONSTRAINT ceo_validation_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'deferred', 'expired', 'auto-rejected')),
  CONSTRAINT ceo_validation_level_check CHECK (escalation_level IN ('CFO', 'CEO', 'BOARD'))
);

-- Index pour dashboard CEO
CREATE INDEX idx_ceo_validations_status ON ai_cos_ceo_validations(status, deadline_at);
CREATE INDEX idx_ceo_validations_pending ON ai_cos_ceo_validations(status, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_ceo_validations_human ON ai_cos_ceo_validations(human_ceo_id, status);
CREATE INDEX idx_ceo_validations_escalation ON ai_cos_ceo_validations(escalation_level, status);
CREATE INDEX idx_ceo_validations_deadline ON ai_cos_ceo_validations(deadline_at) WHERE status = 'pending';

-- ============================================
-- Table 3: AI_COS_IMPACT_MEASUREMENTS
-- Mesures d'impact à différents intervals (1h, 24h, 7d, 30d)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_cos_impact_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Références
  action_id UUID REFERENCES ai_cos_actions(id) ON DELETE CASCADE,
  learning_event_id UUID REFERENCES ai_cos_learning_events(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  squad_id TEXT NOT NULL,
  
  -- Type de mesure
  measurement_type TEXT NOT NULL, -- '1h' | '4h' | '24h' | '7d' | '30d'
  measurement_number INTEGER NOT NULL DEFAULT 1, -- 1ère, 2ème mesure du même type
  scheduled_at TIMESTAMPTZ NOT NULL,
  measured_at TIMESTAMPTZ DEFAULT NULL,
  
  -- KPIs snapshot
  kpis_baseline JSONB NOT NULL DEFAULT '{}', -- KPIs avant action
  kpis_current JSONB DEFAULT NULL, -- KPIs au moment de la mesure
  kpis_delta JSONB DEFAULT NULL, -- Différence calculée
  kpis_delta_percent JSONB DEFAULT NULL, -- Différence en %
  
  -- Impact calculé
  impact_score NUMERIC(5,2) DEFAULT NULL, -- -100 à +100
  impact_category TEXT DEFAULT NULL, -- 'critical_negative' | 'negative' | 'neutral' | 'positive' | 'critical_positive'
  is_positive BOOLEAN DEFAULT NULL,
  
  -- Seuils et alertes
  threshold_breached BOOLEAN NOT NULL DEFAULT FALSE,
  threshold_type TEXT DEFAULT NULL, -- 'rollback' | 'warning' | 'escalation'
  alert_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  alert_type TEXT DEFAULT NULL,
  
  -- Actions automatiques déclenchées
  auto_action_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  auto_action_type TEXT DEFAULT NULL, -- 'rollback' | 'adjustment' | 'escalation'
  auto_action_result TEXT DEFAULT NULL,
  auto_adjusted BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Confidence adjustment
  confidence_adjustment NUMERIC(5,2) DEFAULT NULL, -- +/- points
  
  -- Metadata
  measurement_context JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Contraintes
  CONSTRAINT measurement_type_check CHECK (measurement_type IN ('1h', '4h', '24h', '7d', '30d')),
  CONSTRAINT impact_category_check CHECK (impact_category IN ('critical_negative', 'negative', 'neutral', 'positive', 'critical_positive'))
);

-- Index pour mesures
CREATE INDEX idx_impact_measurements_action ON ai_cos_impact_measurements(action_id, measurement_type);
CREATE INDEX idx_impact_measurements_scheduled ON ai_cos_impact_measurements(scheduled_at) WHERE measured_at IS NULL;
CREATE INDEX idx_impact_measurements_agent ON ai_cos_impact_measurements(agent_id, created_at DESC);
CREATE INDEX idx_impact_measurements_threshold ON ai_cos_impact_measurements(threshold_breached) WHERE threshold_breached = TRUE;
CREATE INDEX idx_impact_measurements_impact ON ai_cos_impact_measurements(impact_score, is_positive);

-- ============================================
-- Table 4: AI_COS_AGENT_CONFIDENCE
-- Historique de confiance par agent (auto-ajustement)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_cos_agent_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Agent
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  squad_id TEXT NOT NULL,
  
  -- Confiance
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  confidence_previous NUMERIC(5,2) DEFAULT NULL,
  confidence_delta NUMERIC(5,2) DEFAULT NULL,
  
  -- Raison du changement
  adjustment_reason TEXT NOT NULL,
  adjustment_type TEXT NOT NULL, -- 'action_success' | 'action_failure' | 'rollback' | 'manual' | 'decay' | 'boost'
  adjustment_source TEXT NOT NULL, -- 'auto' | 'meta-agent' | 'ia-ceo' | 'human-ceo'
  
  -- Référence action
  action_id UUID REFERENCES ai_cos_actions(id) ON DELETE SET NULL,
  learning_event_id UUID REFERENCES ai_cos_learning_events(id) ON DELETE SET NULL,
  
  -- Stats rolling
  success_rate_7d NUMERIC(5,2) DEFAULT NULL,
  success_rate_30d NUMERIC(5,2) DEFAULT NULL,
  total_actions_7d INTEGER DEFAULT 0,
  total_actions_30d INTEGER DEFAULT 0,
  
  -- Autonomie
  autonomy_level TEXT NOT NULL DEFAULT 'standard', -- 'restricted' | 'standard' | 'elevated' | 'full'
  autonomy_previous TEXT DEFAULT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Index pour suivi confiance
CREATE INDEX idx_agent_confidence_agent ON ai_cos_agent_confidence(agent_id, created_at DESC);
CREATE INDEX idx_agent_confidence_squad ON ai_cos_agent_confidence(squad_id, created_at DESC);
CREATE INDEX idx_agent_confidence_autonomy ON ai_cos_agent_confidence(autonomy_level);

-- ============================================
-- Table 5: AI_COS_LEARNED_PATTERNS
-- Patterns appris par les agents
-- ============================================
CREATE TABLE IF NOT EXISTS ai_cos_learned_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Identification
  pattern_name TEXT NOT NULL UNIQUE,
  pattern_type TEXT NOT NULL, -- 'success' | 'failure' | 'optimization' | 'risk_mitigation'
  agent_id TEXT NOT NULL,
  squad_id TEXT NOT NULL,
  
  -- Pattern details
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  action_template JSONB NOT NULL DEFAULT '{}',
  expected_outcome TEXT NOT NULL,
  expected_impact_range JSONB DEFAULT '{"min": -10, "max": 50}',
  
  -- Stats
  times_applied INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN times_applied > 0 
    THEN (success_count::NUMERIC / times_applied * 100)
    ELSE 0 END
  ) STORED,
  average_impact NUMERIC(5,2) DEFAULT NULL,
  
  -- Validité
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  validated_by TEXT DEFAULT NULL,
  validated_at TIMESTAMPTZ DEFAULT NULL,
  deprecated_at TIMESTAMPTZ DEFAULT NULL,
  deprecation_reason TEXT DEFAULT NULL,
  
  -- Contexte
  applicable_contexts JSONB DEFAULT '[]',
  contraindications JSONB DEFAULT '[]',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Index pour patterns
CREATE INDEX idx_learned_patterns_agent ON ai_cos_learned_patterns(agent_id, is_active);
CREATE INDEX idx_learned_patterns_squad ON ai_cos_learned_patterns(squad_id, is_active);
CREATE INDEX idx_learned_patterns_type ON ai_cos_learned_patterns(pattern_type, success_rate DESC);
CREATE INDEX idx_learned_patterns_active ON ai_cos_learned_patterns(is_active, success_rate DESC);

-- ============================================
-- Fonctions utilitaires
-- ============================================

-- Fonction: Calculer le score d'impact à partir des deltas KPI
CREATE OR REPLACE FUNCTION calculate_impact_score(kpis_delta JSONB)
RETURNS NUMERIC AS $$
DECLARE
  total_score NUMERIC := 0;
  kpi_count INTEGER := 0;
  kpi_key TEXT;
  kpi_value NUMERIC;
  weighted_value NUMERIC;
BEGIN
  -- Pondération par type de KPI
  FOR kpi_key, kpi_value IN SELECT * FROM jsonb_each_text(kpis_delta)
  LOOP
    kpi_count := kpi_count + 1;
    
    -- Pondération selon importance
    CASE 
      WHEN kpi_key ILIKE '%revenue%' OR kpi_key ILIKE '%ca%' THEN weighted_value := kpi_value::NUMERIC * 2.0;
      WHEN kpi_key ILIKE '%conversion%' OR kpi_key ILIKE '%cvr%' THEN weighted_value := kpi_value::NUMERIC * 1.8;
      WHEN kpi_key ILIKE '%nps%' OR kpi_key ILIKE '%satisfaction%' THEN weighted_value := kpi_value::NUMERIC * 1.5;
      WHEN kpi_key ILIKE '%cost%' OR kpi_key ILIKE '%cout%' THEN weighted_value := -kpi_value::NUMERIC * 1.3; -- Coût inversé
      ELSE weighted_value := kpi_value::NUMERIC * 1.0;
    END CASE;
    
    total_score := total_score + weighted_value;
  END LOOP;
  
  IF kpi_count = 0 THEN
    RETURN 0;
  END IF;
  
  -- Normaliser entre -100 et +100
  RETURN GREATEST(-100, LEAST(100, total_score / kpi_count));
END;
$$ LANGUAGE plpgsql;

-- Fonction: Déterminer la catégorie d'impact
CREATE OR REPLACE FUNCTION get_impact_category(impact_score NUMERIC)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN impact_score <= -20 THEN 'critical_negative'
    WHEN impact_score <= -5 THEN 'negative'
    WHEN impact_score <= 5 THEN 'neutral'
    WHEN impact_score <= 20 THEN 'positive'
    ELSE 'critical_positive'
  END;
END;
$$ LANGUAGE plpgsql;

-- Fonction: Auto-adjust confidence
CREATE OR REPLACE FUNCTION adjust_agent_confidence(
  p_agent_id TEXT,
  p_outcome TEXT,
  p_impact_score NUMERIC DEFAULT 0
)
RETURNS NUMERIC AS $$
DECLARE
  current_confidence NUMERIC;
  adjustment NUMERIC;
  new_confidence NUMERIC;
BEGIN
  -- Récupérer confiance actuelle
  SELECT confidence_score INTO current_confidence
  FROM ai_cos_agent_confidence
  WHERE agent_id = p_agent_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF current_confidence IS NULL THEN
    current_confidence := 50.0;
  END IF;
  
  -- Calculer ajustement
  CASE p_outcome
    WHEN 'success' THEN
      adjustment := 5.0 + (p_impact_score / 20.0); -- +5 à +10 selon impact
    WHEN 'failure' THEN
      adjustment := -8.0 + (p_impact_score / 25.0); -- -8 à -12 selon impact
    WHEN 'rollback' THEN
      adjustment := -15.0; -- Pénalité importante
    WHEN 'neutral' THEN
      adjustment := 0.0;
    ELSE
      adjustment := 0.0;
  END CASE;
  
  -- Appliquer avec limites
  new_confidence := GREATEST(10.0, LEAST(95.0, current_confidence + adjustment));
  
  RETURN new_confidence;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Trigger: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_learning_events_updated_at
  BEFORE UPDATE ON ai_cos_learning_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ceo_validations_updated_at
  BEFORE UPDATE ON ai_cos_ceo_validations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_learned_patterns_updated_at
  BEFORE UPDATE ON ai_cos_learned_patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-calculate impact category
CREATE OR REPLACE FUNCTION auto_calculate_impact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.kpis_delta IS NOT NULL AND NEW.impact_score IS NULL THEN
    NEW.impact_score := calculate_impact_score(NEW.kpis_delta);
    NEW.impact_category := get_impact_category(NEW.impact_score);
    NEW.is_positive := NEW.impact_score > 0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_calculate_impact_trigger
  BEFORE INSERT OR UPDATE ON ai_cos_impact_measurements
  FOR EACH ROW EXECUTE FUNCTION auto_calculate_impact();

-- ============================================
-- Vues utilitaires
-- ============================================

-- Vue: Dashboard CEO - Validations en attente
CREATE OR REPLACE VIEW v_ceo_pending_validations AS
SELECT 
  v.id,
  v.created_at,
  v.escalation_level,
  v.escalation_reason,
  v.agent_id,
  v.squad_id,
  v.action_type,
  v.action_description,
  v.budget_impact,
  v.risk_score,
  v.strategic_impact,
  v.deadline_at,
  v.deadline_at - NOW() as time_remaining,
  CASE 
    WHEN v.deadline_at < NOW() THEN 'EXPIRED'
    WHEN v.deadline_at < NOW() + INTERVAL '4 hours' THEN 'URGENT'
    WHEN v.deadline_at < NOW() + INTERVAL '24 hours' THEN 'HIGH'
    ELSE 'NORMAL'
  END as urgency,
  v.projected_kpis,
  v.potential_risks
FROM ai_cos_ceo_validations v
WHERE v.status = 'pending'
ORDER BY 
  CASE v.escalation_level 
    WHEN 'BOARD' THEN 1 
    WHEN 'CEO' THEN 2 
    WHEN 'CFO' THEN 3 
  END,
  v.deadline_at ASC;

-- Vue: Agent performance summary
CREATE OR REPLACE VIEW v_agent_performance_summary AS
SELECT 
  agent_id,
  agent_name,
  squad_id,
  COUNT(*) as total_actions,
  COUNT(*) FILTER (WHERE outcome = 'success') as success_count,
  COUNT(*) FILTER (WHERE outcome = 'failure') as failure_count,
  COUNT(*) FILTER (WHERE outcome = 'rollback') as rollback_count,
  ROUND(AVG(impact_score), 2) as avg_impact_score,
  ROUND(
    COUNT(*) FILTER (WHERE outcome = 'success')::NUMERIC / 
    NULLIF(COUNT(*) FILTER (WHERE outcome IN ('success', 'failure')), 0) * 100
  , 2) as success_rate,
  MAX(confidence_after) as current_confidence,
  COUNT(*) FILTER (WHERE pattern_stored = TRUE) as patterns_learned
FROM ai_cos_learning_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY agent_id, agent_name, squad_id
ORDER BY success_rate DESC NULLS LAST;

-- Vue: Impact measurements due
CREATE OR REPLACE VIEW v_impact_measurements_due AS
SELECT 
  m.id,
  m.action_id,
  m.agent_id,
  m.squad_id,
  m.measurement_type,
  m.scheduled_at,
  m.kpis_baseline,
  NOW() - m.scheduled_at as overdue_by
FROM ai_cos_impact_measurements m
WHERE m.measured_at IS NULL
  AND m.scheduled_at <= NOW()
ORDER BY m.scheduled_at ASC;

-- ============================================
-- Seed data: Seuils par défaut
-- ============================================
INSERT INTO ai_cos_learned_patterns (
  pattern_name,
  pattern_type,
  agent_id,
  squad_id,
  trigger_conditions,
  action_template,
  expected_outcome,
  is_active,
  validated_by,
  validated_at
) VALUES 
(
  'rollback_on_critical_negative_impact',
  'risk_mitigation',
  'SYSTEM',
  'SYSTEM',
  '{"impact_score": {"$lte": -20}, "measurement_type": "1h"}',
  '{"action": "rollback", "notify": ["meta-agent", "ia-ceo"]}',
  'Prevent further damage from critically negative actions',
  TRUE,
  'SYSTEM',
  NOW()
),
(
  'escalate_on_high_budget_impact',
  'risk_mitigation',
  'SYSTEM',
  'SYSTEM',
  '{"budget_impact": {"$gte": 10000}, "risk_score": {"$gte": 70}}',
  '{"action": "escalate", "level": "CEO", "deadline_hours": 24}',
  'Ensure human oversight on high-impact decisions',
  TRUE,
  'SYSTEM',
  NOW()
),
(
  'boost_confidence_on_consecutive_success',
  'optimization',
  'SYSTEM',
  'SYSTEM',
  '{"consecutive_successes": {"$gte": 5}, "avg_impact": {"$gte": 10}}',
  '{"action": "adjust_confidence", "delta": 10, "max": 85}',
  'Reward consistently performing agents',
  TRUE,
  'SYSTEM',
  NOW()
)
ON CONFLICT (pattern_name) DO NOTHING;

-- ============================================
-- Permissions (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE ai_cos_learning_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_ceo_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_impact_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_agent_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cos_learned_patterns ENABLE ROW LEVEL SECURITY;

-- Policy: Service role peut tout faire
CREATE POLICY "Service role full access learning_events" ON ai_cos_learning_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access ceo_validations" ON ai_cos_ceo_validations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access impact_measurements" ON ai_cos_impact_measurements
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access agent_confidence" ON ai_cos_agent_confidence
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access learned_patterns" ON ai_cos_learned_patterns
  FOR ALL USING (auth.role() = 'service_role');

-- Policy: Admins peuvent lire
CREATE POLICY "Admins read learning_events" ON ai_cos_learning_events
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins read ceo_validations" ON ai_cos_ceo_validations
  FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Policy: CEO peut valider
CREATE POLICY "CEO can update validations" ON ai_cos_ceo_validations
  FOR UPDATE USING (
    auth.jwt() ->> 'role' IN ('admin', 'ceo') 
    AND status = 'pending'
  );

-- ============================================
-- Commentaires
-- ============================================

COMMENT ON TABLE ai_cos_learning_events IS 'Enregistre tous les événements d''apprentissage des agents AI-COS pour analyse et amélioration continue';
COMMENT ON TABLE ai_cos_ceo_validations IS 'Gère les demandes de validation escaladées au Human CEO avec suivi des décisions';
COMMENT ON TABLE ai_cos_impact_measurements IS 'Stocke les mesures d''impact à différents intervalles (1h, 24h, 7d, 30d) pour chaque action';
COMMENT ON TABLE ai_cos_agent_confidence IS 'Historique des scores de confiance par agent avec ajustements automatiques';
COMMENT ON TABLE ai_cos_learned_patterns IS 'Patterns appris par les agents, réutilisables pour optimiser les décisions futures';

COMMENT ON FUNCTION calculate_impact_score IS 'Calcule un score d''impact normalisé (-100 à +100) à partir des deltas KPI avec pondération';
COMMENT ON FUNCTION get_impact_category IS 'Catégorise l''impact: critical_negative, negative, neutral, positive, critical_positive';
COMMENT ON FUNCTION adjust_agent_confidence IS 'Calcule le nouvel indice de confiance d''un agent basé sur l''outcome et l''impact';
