-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🛡️ KNOWLEDGE GRAPH v3.0 - Phase 8: Gouvernance & Qualité
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Principe: La vraie valeur d'un Knowledge Graph = confiance dans les données
--
-- Contrôles qualité:
--   - Orphan detection (nodes/edges sans corrélation)
--   - Completeness validation (Fault → Action, Edge → source_type)
--   - Fitment coherence (year_from <= year_to)
--
-- Workflow:
--   - DRAFT → REVIEW → ACTIVE → DEPRECATED
--   - RPCs: kg_submit_for_review(), kg_approve_node(), kg_deprecate_node()
--
-- Audit:
--   - kg_audit_log: trace complète des changements
--   - Triggers automatiques sur kg_nodes et kg_edges
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Ajout status 'review' au workflow                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- kg_nodes: Mise à jour contrainte status
ALTER TABLE kg_nodes DROP CONSTRAINT IF EXISTS kg_nodes_status_check;
ALTER TABLE kg_nodes ADD CONSTRAINT kg_nodes_status_check
  CHECK (status IN ('draft', 'review', 'active', 'deprecated'));

-- kg_edges: Mise à jour contrainte status
ALTER TABLE kg_edges DROP CONSTRAINT IF EXISTS kg_edges_status_check;
ALTER TABLE kg_edges ADD CONSTRAINT kg_edges_status_check
  CHECK (status IN ('draft', 'review', 'active', 'deprecated'));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Champs workflow pour kg_nodes                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS reviewer_id UUID;
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Champs workflow pour kg_edges                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS reviewer_id UUID;
ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Contraintes qualité sur kg_edges                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Un edge actif DOIT avoir un source_type
ALTER TABLE kg_edges DROP CONSTRAINT IF EXISTS kg_edges_active_needs_source;
ALTER TABLE kg_edges ADD CONSTRAINT kg_edges_active_needs_source
  CHECK (status != 'active' OR source_type IS NOT NULL);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Contrainte cohérence PartFitment                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_nodes DROP CONSTRAINT IF EXISTS kg_nodes_fitment_years_coherent;
ALTER TABLE kg_nodes ADD CONSTRAINT kg_nodes_fitment_years_coherent
  CHECK (
    node_type != 'PartFitment'
    OR year_from IS NULL
    OR year_to IS NULL
    OR year_from <= year_to
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Table kg_audit_log                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entité concernée
  entity_type TEXT NOT NULL CHECK (entity_type IN ('node', 'edge')),
  entity_id UUID NOT NULL,

  -- Action effectuée
  action TEXT NOT NULL CHECK (action IN (
    'create', 'update', 'delete',
    'submit_review', 'approve', 'reject', 'deprecate',
    'weight_adjustment', 'recalibration'
  )),

  -- Valeurs avant/après
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],

  -- Contexte
  reason TEXT,
  triggered_by TEXT DEFAULT 'user' CHECK (triggered_by IN (
    'user', 'system', 'feedback', 'truth_label', 'batch_job', 'rag_sync'
  )),
  user_id UUID,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_kg_audit_entity ON kg_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_kg_audit_date ON kg_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kg_audit_action ON kg_audit_log(action);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Vues de détection qualité                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Vue: Observables orphelins (sans corrélation vers Fault)
CREATE OR REPLACE VIEW kg_orphan_observables AS
SELECT
  n.node_id,
  n.node_label,
  n.node_type,
  n.input_type,
  n.created_at
FROM kg_nodes n
WHERE n.node_type = 'Observable'
  AND n.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM kg_edges e
    WHERE e.source_node_id = n.node_id
      AND e.edge_type IN ('INDICATES', 'CONFIRMS', 'MANIFESTS_AS', 'CAUSES')
      AND e.status = 'active'
  );

-- Vue: Faults sans action FIXED_BY
CREATE OR REPLACE VIEW kg_faults_without_action AS
SELECT
  n.node_id,
  n.node_label,
  n.created_at
FROM kg_nodes n
WHERE n.node_type = 'Fault'
  AND n.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM kg_edges e
    WHERE e.source_node_id = n.node_id
      AND e.edge_type = 'FIXED_BY'
      AND e.status = 'active'
  );

-- Vue: Edges mal documentés (sans source_type ou confidence_base)
CREATE OR REPLACE VIEW kg_undocumented_edges AS
SELECT
  e.edge_id,
  e.edge_type,
  e.source_node_id,
  e.target_node_id,
  e.status,
  e.created_at
FROM kg_edges e
WHERE e.source_type IS NULL OR e.confidence_base IS NULL;

-- Vue: Parts sans PartFitment
CREATE OR REPLACE VIEW kg_parts_without_fitment AS
SELECT
  n.node_id,
  n.node_label,
  (n.node_data->>'pg_id')::INT as pg_id
FROM kg_nodes n
WHERE n.node_type = 'Part'
  AND n.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM kg_edges e
    WHERE e.source_node_id = n.node_id
      AND e.edge_type = 'FITS_ON'
      AND e.status = 'active'
  );

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Vue Dashboard Qualité                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_quality_dashboard AS
SELECT
  -- Stats globales
  (SELECT COUNT(*) FROM kg_nodes WHERE status = 'active') AS active_nodes,
  (SELECT COUNT(*) FROM kg_edges WHERE status = 'active') AS active_edges,
  (SELECT COUNT(*) FROM kg_nodes WHERE status = 'draft') AS draft_nodes,
  (SELECT COUNT(*) FROM kg_nodes WHERE status = 'review') AS review_pending,
  (SELECT COUNT(*) FROM kg_edges WHERE status = 'draft') AS draft_edges,

  -- Problèmes qualité
  (SELECT COUNT(*) FROM kg_orphan_observables) AS orphan_observables,
  (SELECT COUNT(*) FROM kg_faults_without_action) AS faults_without_action,
  (SELECT COUNT(*) FROM kg_undocumented_edges) AS undocumented_edges,
  (SELECT COUNT(*) FROM kg_parts_without_fitment) AS parts_without_fitment,

  -- Métriques
  (SELECT AVG(confidence_base) FROM kg_edges WHERE status = 'active') AS avg_edge_confidence,
  (SELECT COUNT(*) FROM kg_truth_labels WHERE processed = FALSE) AS pending_truth_labels,
  (SELECT COUNT(*) FROM kg_feedback_events WHERE processed = FALSE) AS pending_feedbacks;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. RPC: kg_submit_for_review()                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_submit_for_review(
  p_node_id UUID,
  p_submitter_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_node_type TEXT;
BEGIN
  -- Récupérer le statut actuel
  SELECT status, node_type INTO v_current_status, v_node_type
  FROM kg_nodes WHERE node_id = p_node_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Node non trouvé');
  END IF;

  -- Seuls les drafts peuvent être soumis pour review
  IF v_current_status != 'draft' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seul un draft peut être soumis pour review. Status actuel: ' || v_current_status
    );
  END IF;

  -- Mettre à jour le statut
  UPDATE kg_nodes
  SET status = 'review',
      review_notes = p_submitter_notes,
      updated_at = NOW()
  WHERE node_id = p_node_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'review',
    'node_id', p_node_id,
    'node_type', v_node_type
  );
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. RPC: kg_approve_node()                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_approve_node(
  p_node_id UUID,
  p_reviewer_id UUID,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_node_type TEXT;
  v_warnings TEXT[] := '{}';
BEGIN
  -- Récupérer le statut actuel
  SELECT status, node_type INTO v_current_status, v_node_type
  FROM kg_nodes WHERE node_id = p_node_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Node non trouvé');
  END IF;

  -- Seuls les nodes en review peuvent être approuvés
  IF v_current_status != 'review' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seul un node en review peut être approuvé. Status actuel: ' || v_current_status
    );
  END IF;

  -- Vérifications qualité selon node_type
  IF v_node_type = 'Observable' THEN
    -- Warning si Observable sans corrélation (ne bloque pas)
    IF NOT EXISTS (
      SELECT 1 FROM kg_edges
      WHERE source_node_id = p_node_id
        AND edge_type IN ('INDICATES', 'CONFIRMS', 'MANIFESTS_AS', 'CAUSES')
        AND status IN ('draft', 'review', 'active')
    ) THEN
      v_warnings := v_warnings || 'Observable sans corrélation vers une panne';
    END IF;

  ELSIF v_node_type = 'Fault' THEN
    -- Bloquer si Fault sans action FIXED_BY
    IF NOT EXISTS (
      SELECT 1 FROM kg_edges
      WHERE source_node_id = p_node_id
        AND edge_type = 'FIXED_BY'
        AND status IN ('draft', 'review', 'active')
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Impossible d''approuver un Fault sans action FIXED_BY'
      );
    END IF;
  END IF;

  -- Approuver le node
  UPDATE kg_nodes
  SET status = 'active',
      reviewer_id = p_reviewer_id,
      reviewed_at = NOW(),
      review_notes = COALESCE(p_review_notes, review_notes),
      valid_from = NOW(),
      updated_at = NOW()
  WHERE node_id = p_node_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'active',
    'node_id', p_node_id,
    'node_type', v_node_type,
    'warnings', v_warnings,
    'approved_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 11. RPC: kg_reject_node()                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_reject_node(
  p_node_id UUID,
  p_reviewer_id UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_node_type TEXT;
BEGIN
  -- Récupérer le statut actuel
  SELECT status, node_type INTO v_current_status, v_node_type
  FROM kg_nodes WHERE node_id = p_node_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Node non trouvé');
  END IF;

  -- Seuls les nodes en review peuvent être rejetés
  IF v_current_status != 'review' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Seul un node en review peut être rejeté. Status actuel: ' || v_current_status
    );
  END IF;

  -- Rejeter = remettre en draft avec notes
  UPDATE kg_nodes
  SET status = 'draft',
      reviewer_id = p_reviewer_id,
      reviewed_at = NOW(),
      review_notes = COALESCE(review_notes || E'\n', '') || 'REJETÉ: ' || p_rejection_reason,
      updated_at = NOW()
  WHERE node_id = p_node_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'draft',
    'node_id', p_node_id,
    'node_type', v_node_type,
    'rejection_reason', p_rejection_reason
  );
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 12. RPC: kg_deprecate_node()                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_deprecate_node(
  p_node_id UUID,
  p_reason TEXT,
  p_replacement_node_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_node_type TEXT;
BEGIN
  -- Vérifier que le node existe et est actif
  SELECT node_type INTO v_node_type
  FROM kg_nodes WHERE node_id = p_node_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Node non trouvé ou pas actif');
  END IF;

  -- Déprécier le node
  UPDATE kg_nodes
  SET status = 'deprecated',
      valid_to = NOW(),
      review_notes = COALESCE(review_notes || E'\n', '') || 'DEPRECATED: ' || p_reason,
      updated_at = NOW()
  WHERE node_id = p_node_id;

  -- Enregistrer le remplacement si fourni
  IF p_replacement_node_id IS NOT NULL THEN
    INSERT INTO kg_edges (
      source_node_id,
      target_node_id,
      edge_type,
      status,
      source_type,
      confidence_base,
      created_by
    )
    VALUES (
      p_node_id,
      p_replacement_node_id,
      'REPLACED_BY',
      'active',
      'system',
      1.0,
      'system'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'deprecated',
    'node_id', p_node_id,
    'node_type', v_node_type,
    'replacement_id', p_replacement_node_id,
    'deprecated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 13. RPC: kg_quality_report()                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_quality_report()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'summary', (SELECT row_to_json(d) FROM kg_quality_dashboard d),
    'orphan_observables', (
      SELECT COALESCE(jsonb_agg(o), '[]'::jsonb)
      FROM (SELECT * FROM kg_orphan_observables LIMIT 10) o
    ),
    'faults_without_action', (
      SELECT COALESCE(jsonb_agg(f), '[]'::jsonb)
      FROM (SELECT * FROM kg_faults_without_action LIMIT 10) f
    ),
    'undocumented_edges', (
      SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
      FROM (SELECT edge_id, edge_type, status, created_at FROM kg_undocumented_edges LIMIT 10) e
    ),
    'parts_without_fitment', (
      SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
      FROM (SELECT * FROM kg_parts_without_fitment LIMIT 10) p
    ),
    'recent_audits', (
      SELECT COALESCE(jsonb_agg(a), '[]'::jsonb)
      FROM (
        SELECT action, entity_type, entity_id, created_at
        FROM kg_audit_log
        ORDER BY created_at DESC
        LIMIT 20
      ) a
    ),
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 14. Trigger d'audit automatique                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Fonction trigger pour audit kg_nodes
CREATE OR REPLACE FUNCTION kg_audit_nodes_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_changed_fields TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO kg_audit_log (entity_type, entity_id, action, new_values, triggered_by)
    VALUES ('node', NEW.node_id, 'create', to_jsonb(NEW), 'user');
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Déterminer l'action basée sur le changement de statut
    v_action := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'review' THEN 'submit_review'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active' THEN 'approve'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'deprecated' THEN 'deprecate'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'draft' AND OLD.status = 'review' THEN 'reject'
      ELSE 'update'
    END;

    -- Calculer les champs modifiés
    SELECT array_agg(key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(to_jsonb(NEW))
      EXCEPT
      SELECT key FROM jsonb_each(to_jsonb(OLD))
    ) diff;

    INSERT INTO kg_audit_log (
      entity_type, entity_id, action,
      old_values, new_values,
      changed_fields, triggered_by
    ) VALUES (
      'node',
      NEW.node_id,
      v_action,
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_changed_fields,
      'user'
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO kg_audit_log (entity_type, entity_id, action, old_values, triggered_by)
    VALUES ('node', OLD.node_id, 'delete', to_jsonb(OLD), 'user');
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Fonction trigger pour audit kg_edges
CREATE OR REPLACE FUNCTION kg_audit_edges_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_changed_fields TEXT[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO kg_audit_log (entity_type, entity_id, action, new_values, triggered_by)
    VALUES ('edge', NEW.edge_id, 'create', to_jsonb(NEW), 'user');
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Déterminer l'action
    v_action := CASE
      WHEN OLD.weight IS DISTINCT FROM NEW.weight OR OLD.confidence IS DISTINCT FROM NEW.confidence THEN 'weight_adjustment'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active' THEN 'approve'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'deprecated' THEN 'deprecate'
      ELSE 'update'
    END;

    -- Calculer les champs modifiés
    SELECT array_agg(key) INTO v_changed_fields
    FROM (
      SELECT key FROM jsonb_each(to_jsonb(NEW))
      EXCEPT
      SELECT key FROM jsonb_each(to_jsonb(OLD))
    ) diff;

    INSERT INTO kg_audit_log (
      entity_type, entity_id, action,
      old_values, new_values,
      changed_fields, triggered_by
    ) VALUES (
      'edge',
      NEW.edge_id,
      v_action,
      to_jsonb(OLD),
      to_jsonb(NEW),
      v_changed_fields,
      'user'
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO kg_audit_log (entity_type, entity_id, action, old_values, triggered_by)
    VALUES ('edge', OLD.edge_id, 'delete', to_jsonb(OLD), 'user');
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Appliquer les triggers
DROP TRIGGER IF EXISTS trg_kg_nodes_audit ON kg_nodes;
CREATE TRIGGER trg_kg_nodes_audit
  AFTER INSERT OR UPDATE OR DELETE ON kg_nodes
  FOR EACH ROW EXECUTE FUNCTION kg_audit_nodes_trigger();

DROP TRIGGER IF EXISTS trg_kg_edges_audit ON kg_edges;
CREATE TRIGGER trg_kg_edges_audit
  AFTER INSERT OR UPDATE OR DELETE ON kg_edges
  FOR EACH ROW EXECUTE FUNCTION kg_audit_edges_trigger();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 15. RLS pour kg_audit_log                                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_audit_log ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés
DROP POLICY IF EXISTS "kg_audit_log_select_authenticated" ON kg_audit_log;
CREATE POLICY "kg_audit_log_select_authenticated" ON kg_audit_log
  FOR SELECT TO authenticated USING (true);

-- Écriture pour service_role uniquement (via triggers)
DROP POLICY IF EXISTS "kg_audit_log_all_service" ON kg_audit_log;
CREATE POLICY "kg_audit_log_all_service" ON kg_audit_log
  FOR ALL TO service_role USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 16. Index supplémentaires pour performance                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Index pour recherche de nodes en review
CREATE INDEX IF NOT EXISTS idx_kg_nodes_status_review
  ON kg_nodes(status) WHERE status = 'review';

CREATE INDEX IF NOT EXISTS idx_kg_edges_status_review
  ON kg_edges(status) WHERE status = 'review';

-- Index pour audit par user
CREATE INDEX IF NOT EXISTS idx_kg_audit_user
  ON kg_audit_log(user_id) WHERE user_id IS NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 17. Comments                                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE kg_audit_log IS 'Audit trail complet pour toutes les modifications du Knowledge Graph';
COMMENT ON COLUMN kg_nodes.reviewer_id IS 'ID du reviewer qui a approuvé/rejeté le node';
COMMENT ON COLUMN kg_nodes.reviewed_at IS 'Timestamp de la dernière review';
COMMENT ON COLUMN kg_nodes.review_notes IS 'Notes de review (raison approbation/rejet)';

COMMENT ON VIEW kg_orphan_observables IS 'Observables actifs sans corrélation vers un Fault';
COMMENT ON VIEW kg_faults_without_action IS 'Faults actifs sans action FIXED_BY';
COMMENT ON VIEW kg_undocumented_edges IS 'Edges sans source_type ou confidence_base';
COMMENT ON VIEW kg_parts_without_fitment IS 'Parts actives sans PartFitment';
COMMENT ON VIEW kg_quality_dashboard IS 'Dashboard de santé globale du Knowledge Graph';

COMMENT ON FUNCTION kg_submit_for_review IS 'Soumet un node draft pour review';
COMMENT ON FUNCTION kg_approve_node IS 'Approuve un node en review (avec vérifications qualité)';
COMMENT ON FUNCTION kg_reject_node IS 'Rejette un node en review (retour en draft)';
COMMENT ON FUNCTION kg_deprecate_node IS 'Déprécie un node actif (avec remplacement optionnel)';
COMMENT ON FUNCTION kg_quality_report IS 'Génère un rapport qualité complet du KG';

COMMIT;
