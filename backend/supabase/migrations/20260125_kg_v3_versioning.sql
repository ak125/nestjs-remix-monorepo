-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 0: Versioning Complet
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Principe: Corriger/améliorer le référentiel SANS casser les diagnostics historiques
--
-- Nouveaux champs:
--   - status: draft → active → deprecated (lifecycle)
--   - valid_from / valid_to: fenêtre temporelle
--   - source_type: classification de la source (OEM, RTA, forum...)
--   - confidence_base: qualité intrinsèque (distincte de confidence calculé)
--
-- Tables d'historique:
--   - kg_node_history: snapshots des nodes
--   - kg_edge_history: snapshots des edges avec weight/confidence avant/après
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. kg_nodes: Ajout versioning complet                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Status lifecycle: draft → active → deprecated
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated'));

-- Fenêtre temporelle de validité
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  valid_from TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  valid_to TIMESTAMPTZ DEFAULT NULL;

-- Classification de la source
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  source_type TEXT CHECK (source_type IN (
    'oem',              -- Constructeur (fiabilité 0.98)
    'rta',              -- Revue Technique Automobile (0.95)
    'tecdoc',           -- Base TecDoc (0.92)
    'garage_partner',   -- Garage partenaire certifié (0.85)
    'technician',       -- Technicien individuel (0.80)
    'customer_feedback',-- Retour client (0.60)
    'forum',            -- Forum communautaire (0.50)
    'ai_generated',     -- Généré par IA (0.70)
    'manual'            -- Saisie manuelle interne (0.75)
  ));

-- Qualité intrinsèque (distincte de confidence calculé)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  confidence_base FLOAT DEFAULT 0.75 CHECK (confidence_base >= 0 AND confidence_base <= 1);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. kg_edges: Même ajouts de versioning                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'deprecated'));

ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS
  valid_from TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS
  valid_to TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS
  source_type TEXT CHECK (source_type IN (
    'oem', 'rta', 'tecdoc', 'garage_partner', 'technician',
    'customer_feedback', 'forum', 'ai_generated', 'manual'
  ));

ALTER TABLE kg_edges ADD COLUMN IF NOT EXISTS
  confidence_base FLOAT DEFAULT 0.75 CHECK (confidence_base >= 0 AND confidence_base <= 1);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Index pour requêtes temporelles                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Index optimisé pour les diagnostics actuels (status = active, valid_to IS NULL)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_active_current
  ON kg_nodes(status, valid_to)
  WHERE status = 'active' AND valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_kg_edges_active_current
  ON kg_edges(status, valid_to)
  WHERE status = 'active' AND valid_to IS NULL;

-- Index pour les requêtes temporelles historiques
CREATE INDEX IF NOT EXISTS idx_kg_nodes_temporal
  ON kg_nodes(status, valid_from, valid_to)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_kg_edges_temporal
  ON kg_edges(status, valid_from, valid_to)
  WHERE status = 'active';

-- Index par source_type pour statistiques
CREATE INDEX IF NOT EXISTS idx_kg_nodes_source_type
  ON kg_nodes(source_type)
  WHERE source_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kg_edges_source_type
  ON kg_edges(source_type)
  WHERE source_type IS NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Tables d'historique des versions                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Historique des modifications de nodes
CREATE TABLE IF NOT EXISTS kg_node_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL,
  version INT NOT NULL,

  -- Snapshot complet au moment de la modification
  node_data_snapshot JSONB NOT NULL,

  -- Détails du changement
  changed_fields TEXT[],
  change_reason TEXT,

  -- Audit
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT,

  -- Contrainte unicité node_id + version
  UNIQUE(node_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kg_node_history_node ON kg_node_history(node_id);
CREATE INDEX IF NOT EXISTS idx_kg_node_history_date ON kg_node_history(changed_at DESC);

-- Historique des modifications d'edges (avec weight/confidence avant/après)
CREATE TABLE IF NOT EXISTS kg_edge_history (
  history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id UUID NOT NULL,
  version INT NOT NULL,

  -- Valeurs avant/après pour poids et confidence
  weight_before FLOAT,
  weight_after FLOAT,
  confidence_before FLOAT,
  confidence_after FLOAT,

  -- Snapshot complet optionnel
  edge_data_snapshot JSONB,

  -- Détails du changement
  change_reason TEXT,

  -- Audit
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT,

  -- Contrainte unicité edge_id + version
  UNIQUE(edge_id, version)
);

CREATE INDEX IF NOT EXISTS idx_kg_edge_history_edge ON kg_edge_history(edge_id);
CREATE INDEX IF NOT EXISTS idx_kg_edge_history_date ON kg_edge_history(changed_at DESC);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Migration des données existantes                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Nodes approuvés → active
UPDATE kg_nodes
SET status = 'active',
    source_type = 'manual',
    valid_from = created_at
WHERE validation_status = 'approved'
  AND status IS NULL;

-- Nodes en attente → draft
UPDATE kg_nodes
SET status = 'draft',
    source_type = 'manual',
    valid_from = created_at
WHERE validation_status IN ('pending', 'manual_review')
  AND status IS NULL;

-- Nodes rejetés → deprecated
UPDATE kg_nodes
SET status = 'deprecated',
    source_type = 'manual',
    valid_from = created_at,
    valid_to = updated_at
WHERE validation_status = 'rejected'
  AND status IS NULL;

-- Edges actifs → active
UPDATE kg_edges
SET status = 'active',
    source_type = 'manual',
    valid_from = created_at
WHERE is_active = TRUE
  AND status IS NULL;

-- Edges inactifs → deprecated
UPDATE kg_edges
SET status = 'deprecated',
    source_type = 'manual',
    valid_from = created_at,
    valid_to = updated_at
WHERE is_active = FALSE
  AND status IS NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RLS pour les nouvelles tables                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_node_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_edge_history ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés
CREATE POLICY "kg_node_history_select_authenticated" ON kg_node_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kg_edge_history_select_authenticated" ON kg_edge_history
  FOR SELECT TO authenticated USING (true);

-- Écriture pour service_role uniquement
CREATE POLICY "kg_node_history_all_service" ON kg_node_history
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_edge_history_all_service" ON kg_edge_history
  FOR ALL TO service_role USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Trigger pour auto-snapshot historique                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Fonction de snapshot automatique pour les nodes
CREATE OR REPLACE FUNCTION kg_node_auto_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Seulement si version change (pas sur création initiale)
  IF OLD.version IS NOT NULL AND NEW.version > OLD.version THEN
    INSERT INTO kg_node_history (
      node_id,
      version,
      node_data_snapshot,
      changed_fields,
      change_reason,
      changed_by
    ) VALUES (
      OLD.node_id,
      OLD.version,
      jsonb_build_object(
        'node_type', OLD.node_type,
        'node_label', OLD.node_label,
        'node_alias', OLD.node_alias,
        'node_category', OLD.node_category,
        'node_data', OLD.node_data,
        'confidence', OLD.confidence,
        'confidence_base', OLD.confidence_base,
        'status', OLD.status,
        'source_type', OLD.source_type,
        'valid_from', OLD.valid_from,
        'valid_to', OLD.valid_to
      ),
      ARRAY(
        SELECT key FROM (
          SELECT key FROM jsonb_each(to_jsonb(NEW))
          EXCEPT
          SELECT key FROM jsonb_each(to_jsonb(OLD))
        ) diff
      ),
      'Auto-snapshot before version ' || NEW.version,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction de snapshot automatique pour les edges
CREATE OR REPLACE FUNCTION kg_edge_auto_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Seulement si version change ou weight/confidence change
  IF OLD.version IS NOT NULL AND (
    NEW.version > OLD.version OR
    NEW.weight != OLD.weight OR
    NEW.confidence != OLD.confidence
  ) THEN
    INSERT INTO kg_edge_history (
      edge_id,
      version,
      weight_before,
      weight_after,
      confidence_before,
      confidence_after,
      edge_data_snapshot,
      change_reason,
      changed_by
    ) VALUES (
      OLD.edge_id,
      OLD.version,
      OLD.weight,
      NEW.weight,
      OLD.confidence,
      NEW.confidence,
      jsonb_build_object(
        'edge_type', OLD.edge_type,
        'source_node_id', OLD.source_node_id,
        'target_node_id', OLD.target_node_id,
        'evidence', OLD.evidence,
        'status', OLD.status,
        'source_type', OLD.source_type
      ),
      CASE
        WHEN NEW.weight != OLD.weight THEN 'Weight adjustment'
        WHEN NEW.confidence != OLD.confidence THEN 'Confidence adjustment'
        ELSE 'Version update'
      END,
      NEW.created_by
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Activer les triggers
DROP TRIGGER IF EXISTS trg_kg_node_auto_history ON kg_nodes;
CREATE TRIGGER trg_kg_node_auto_history
  BEFORE UPDATE ON kg_nodes
  FOR EACH ROW
  EXECUTE FUNCTION kg_node_auto_history();

DROP TRIGGER IF EXISTS trg_kg_edge_auto_history ON kg_edges;
CREATE TRIGGER trg_kg_edge_auto_history
  BEFORE UPDATE ON kg_edges
  FOR EACH ROW
  EXECUTE FUNCTION kg_edge_auto_history();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Vue pour diagnostics actuels (optimisée)                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_active_nodes AS
SELECT * FROM kg_nodes
WHERE status = 'active'
  AND valid_to IS NULL
  AND is_active = TRUE;

CREATE OR REPLACE VIEW kg_active_edges AS
SELECT * FROM kg_edges
WHERE status = 'active'
  AND valid_to IS NULL
  AND is_active = TRUE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Comments                                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON COLUMN kg_nodes.status IS 'Lifecycle: draft → active → deprecated';
COMMENT ON COLUMN kg_nodes.valid_from IS 'Start of validity window (NULL = since forever)';
COMMENT ON COLUMN kg_nodes.valid_to IS 'End of validity window (NULL = still valid)';
COMMENT ON COLUMN kg_nodes.source_type IS 'Data source classification (oem=0.98, forum=0.50)';
COMMENT ON COLUMN kg_nodes.confidence_base IS 'Intrinsic quality score (0-1), distinct from computed confidence';

COMMENT ON TABLE kg_node_history IS 'Version history snapshots for kg_nodes';
COMMENT ON TABLE kg_edge_history IS 'Version history with weight/confidence changes for kg_edges';

COMMIT;
