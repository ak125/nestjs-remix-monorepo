-- ============================================================
-- Agentic Engine — Chain Rules
-- Orchestration chainee : un run termine peut declencher le suivant
-- ============================================================

CREATE TABLE IF NOT EXISTS __agentic_chain_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_goal_type TEXT NOT NULL,
  to_goal_type TEXT NOT NULL,
  condition JSONB NOT NULL DEFAULT '{"min_score": 60}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour lookup rapide par from_goal_type
CREATE INDEX IF NOT EXISTS idx_chain_rules_from_goal
  ON __agentic_chain_rules (from_goal_type)
  WHERE enabled = true;

-- Commentaire table
COMMENT ON TABLE __agentic_chain_rules IS
  'Regles de chainage entre runs agentiques. Un run termine avec score >= condition.min_score declenche un nouveau run to_goal_type.';

-- RLS : service_role only
ALTER TABLE __agentic_chain_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only_chain_rules"
  ON __agentic_chain_rules
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Regles de chainage par defaut
-- ============================================================

INSERT INTO __agentic_chain_rules (from_goal_type, to_goal_type, condition, priority, description)
VALUES
  ('keyword_plan', 'content_generation', '{"min_score": 60}'::jsonb, 10,
   'Apres keyword plan valide → generer le contenu'),
  ('seo_audit', 'keyword_plan', '{"min_score": 50}'::jsonb, 20,
   'Apres audit SEO → planifier les mots-cles manquants'),
  ('brand_content', 'vehicle_content', '{"min_score": 60}'::jsonb, 30,
   'Apres contenu marque → generer contenu vehicules associes')
ON CONFLICT DO NOTHING;
