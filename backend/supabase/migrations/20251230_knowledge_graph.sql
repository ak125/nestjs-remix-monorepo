-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH + REASONING ENGINE - AI-COS v2.8.0
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Architecture: Vehicle → System → Observable → Fault → Action → Part
-- Purpose: Diagnostic multi-symptomes avec scoring automatique
--
-- Tables:
--   - kg_nodes: Entites du graphe (Vehicle, System, Observable, Fault, Action, Part)
--   - kg_edges: Relations versionnees entre nodes
--   - kg_reasoning_cache: Cache des diagnostics pour performance
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. TABLE kg_nodes - Entites du Knowledge Graph                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_nodes (
  node_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type et classification
  node_type TEXT NOT NULL CHECK (node_type IN (
    'Vehicle',      -- Vehicule (Clio 3 1.5 dCi, Golf VII 2.0 TDI)
    'System',       -- Systeme (Moteur, Freinage, Refroidissement)
    'Observable',   -- Symptome observable (fumee noire, voyant moteur)
    'Fault',        -- Panne identifiee (EGR encrasse, turbo HS)
    'Action',       -- Action diagnostic/reparation (nettoyage, remplacement)
    'Part'          -- Piece concernee (Vanne EGR, Turbo)
  )),

  -- Identification
  node_label TEXT NOT NULL,                    -- "Fumee noire a l'echappement"
  node_alias TEXT,                             -- Alias court pour URL/SEO
  node_category TEXT,                          -- "Electrique", "Mecanique", "Emissions"

  -- Metadata flexible
  node_data JSONB DEFAULT '{}',                -- Donnees specifiques au type
  -- Vehicle: { type_id, model_id, brand_id, engine_code }
  -- Observable: { severity: 1-5, frequency: "constant"|"intermittent" }
  -- Fault: { urgency: 1-5, repair_cost_range: [min, max] }
  -- Part: { piece_id, gamme_id, oem_refs: [] }

  -- Qualite et tracabilite
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  sources TEXT[] DEFAULT '{}',                 -- ["TecDoc", "RTA", "Forum", "Constructeur"]
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN (
    'pending',      -- En attente de validation
    'approved',     -- Valide par le systeme
    'rejected',     -- Rejete (incoherent)
    'manual_review' -- Requiert verification humaine
  )),

  -- Versioning
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,                             -- user_id ou 'system'

  -- Soft delete
  is_active BOOLEAN DEFAULT TRUE
);

-- Index pour recherche rapide
CREATE INDEX idx_kg_nodes_type ON kg_nodes(node_type) WHERE is_active;
CREATE INDEX idx_kg_nodes_category ON kg_nodes(node_category) WHERE is_active;
CREATE INDEX idx_kg_nodes_label_search ON kg_nodes USING gin(to_tsvector('french', node_label));
CREATE INDEX idx_kg_nodes_alias ON kg_nodes(node_alias) WHERE node_alias IS NOT NULL;
CREATE INDEX idx_kg_nodes_validation ON kg_nodes(validation_status) WHERE is_active;
CREATE INDEX idx_kg_nodes_data ON kg_nodes USING gin(node_data);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. TABLE kg_edges - Relations entre nodes (versionnees)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_edges (
  edge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relation source → target
  source_node_id UUID NOT NULL REFERENCES kg_nodes(node_id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES kg_nodes(node_id) ON DELETE CASCADE,

  -- Type de relation
  edge_type TEXT NOT NULL CHECK (edge_type IN (
    -- Hierarchie vehicule
    'HAS_SYSTEM',         -- Vehicle → System (Clio → Moteur)

    -- Diagnostic
    'SHOWS_SYMPTOM',      -- System → Observable (Moteur → fumee noire)
    'CAUSES',             -- Observable → Fault (fumee noire → EGR encrasse)
    'CAUSED_BY',          -- Fault → Observable (inverse, pour traversal bi-directionnel)

    -- Resolution
    'DIAGNOSED_BY',       -- Fault → Action (EGR encrasse → nettoyage EGR)
    'FIXED_BY',           -- Fault → Part (EGR encrasse → Vanne EGR)
    'REQUIRES_PART',      -- Action → Part (nettoyage → kit nettoyage)

    -- Compatibilite
    'COMPATIBLE_WITH',    -- Part → Vehicle (Vanne EGR → Clio 3 K9K)

    -- Correlations
    'CORRELATES_WITH',    -- Observable ↔ Observable (symptomes associes)
    'OFTEN_WITH',         -- Fault ↔ Fault (pannes souvent liees)
    'PRECEDES',           -- Fault → Fault (panne A mene a panne B)

    -- SEO/Contenu
    'MENTIONED_IN',       -- Node → Article/Content
    'SIMILAR_TO'          -- Node → Node (pour suggestions)
  )),

  -- Force et direction
  weight FLOAT DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 10),
  is_bidirectional BOOLEAN DEFAULT FALSE,

  -- Qualite et tracabilite
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  evidence JSONB DEFAULT '{}',                 -- Preuves de la relation
  -- { occurrences: 847, last_seen: "2024-12", forum_threads: [...] }
  sources TEXT[] DEFAULT '{}',

  -- Versioning
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,

  -- Soft delete
  is_active BOOLEAN DEFAULT TRUE,

  -- Contrainte: pas de self-loop
  CONSTRAINT no_self_loop CHECK (source_node_id != target_node_id)
);

-- Index pour traversal rapide du graphe
CREATE INDEX idx_kg_edges_source ON kg_edges(source_node_id) WHERE is_active;
CREATE INDEX idx_kg_edges_target ON kg_edges(target_node_id) WHERE is_active;
CREATE INDEX idx_kg_edges_type ON kg_edges(edge_type) WHERE is_active;
CREATE INDEX idx_kg_edges_traverse ON kg_edges(source_node_id, edge_type) WHERE is_active;
CREATE INDEX idx_kg_edges_reverse ON kg_edges(target_node_id, edge_type) WHERE is_active;
CREATE INDEX idx_kg_edges_confidence ON kg_edges(confidence DESC) WHERE is_active;

-- Index composite pour requetes frequentes
CREATE INDEX idx_kg_edges_source_type_target
  ON kg_edges(source_node_id, edge_type, target_node_id) WHERE is_active;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. TABLE kg_reasoning_cache - Cache des diagnostics                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_reasoning_cache (
  cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification de la requete
  query_hash TEXT UNIQUE NOT NULL,             -- SHA256 de (vehicle_id + observables triees)
  vehicle_node_id UUID REFERENCES kg_nodes(node_id),
  input_observables TEXT[] NOT NULL,           -- ["fumee noire", "perte puissance"]
  input_node_ids UUID[],                       -- IDs des nodes Observable matches

  -- Resultats du diagnostic
  result_faults JSONB NOT NULL DEFAULT '[]',   -- Pannes identifiees avec scores
  -- [{ fault_id, fault_label, score, matched_symptoms: [...], actions: [...], parts: [...] }]

  result_primary_fault_id UUID REFERENCES kg_nodes(node_id),
  result_score FLOAT,                          -- Score du diagnostic principal
  result_explanation TEXT,                     -- Explication generee

  -- Chemins traverses (pour debug/audit)
  traversal_paths JSONB DEFAULT '[]',          -- Chemins dans le graphe

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,                      -- TTL pour invalidation
  hit_count INT DEFAULT 0,                     -- Nombre d'utilisations
  last_hit_at TIMESTAMPTZ,

  -- Performance
  computation_time_ms INT                      -- Temps de calcul en ms
);

-- Index pour cache lookup
CREATE INDEX idx_kg_cache_hash ON kg_reasoning_cache(query_hash);
CREATE INDEX idx_kg_cache_vehicle ON kg_reasoning_cache(vehicle_node_id);
CREATE INDEX idx_kg_cache_expires ON kg_reasoning_cache(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_kg_cache_hits ON kg_reasoning_cache(hit_count DESC);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. TABLE kg_audit_log - Historique des modifications                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference
  entity_type TEXT NOT NULL CHECK (entity_type IN ('node', 'edge')),
  entity_id UUID NOT NULL,

  -- Action
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'validate', 'reject')),

  -- Changements
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],

  -- Contexte
  performed_by TEXT,                           -- user_id, 'system', 'agent_1', etc.
  reason TEXT,

  -- Timestamp
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kg_audit_entity ON kg_audit_log(entity_type, entity_id);
CREATE INDEX idx_kg_audit_action ON kg_audit_log(action);
CREATE INDEX idx_kg_audit_date ON kg_audit_log(performed_at DESC);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. TRIGGERS - updated_at automatique                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Fonction update_updated_at (reutilisable)
CREATE OR REPLACE FUNCTION kg_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers sur les tables
CREATE TRIGGER trg_kg_nodes_updated_at
  BEFORE UPDATE ON kg_nodes
  FOR EACH ROW
  EXECUTE FUNCTION kg_update_updated_at();

CREATE TRIGGER trg_kg_edges_updated_at
  BEFORE UPDATE ON kg_edges
  FOR EACH ROW
  EXECUTE FUNCTION kg_update_updated_at();

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RPC FUNCTIONS - Traversal optimise du graphe                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Fonction: Trouver toutes les pannes liees a des symptomes
CREATE OR REPLACE FUNCTION kg_find_faults_from_observables(
  p_observable_ids UUID[]
)
RETURNS TABLE (
  fault_id UUID,
  fault_label TEXT,
  fault_category TEXT,
  edge_weight FLOAT,
  edge_confidence FLOAT,
  source_observable_id UUID,
  sources TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.node_id as fault_id,
    n.node_label as fault_label,
    n.node_category as fault_category,
    e.weight as edge_weight,
    e.confidence as edge_confidence,
    e.source_node_id as source_observable_id,
    e.sources
  FROM kg_edges e
  JOIN kg_nodes n ON n.node_id = e.target_node_id
  WHERE e.source_node_id = ANY(p_observable_ids)
    AND e.edge_type = 'CAUSES'
    AND e.is_active = TRUE
    AND n.node_type = 'Fault'
    AND n.is_active = TRUE
  ORDER BY e.confidence DESC, e.weight DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction: Trouver les pieces qui reparent une panne
CREATE OR REPLACE FUNCTION kg_find_parts_for_fault(
  p_fault_id UUID
)
RETURNS TABLE (
  part_node_id UUID,
  part_label TEXT,
  piece_id TEXT,
  gamme_id TEXT,
  edge_confidence FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.node_id as part_node_id,
    n.node_label as part_label,
    n.node_data->>'piece_id' as piece_id,
    n.node_data->>'gamme_id' as gamme_id,
    e.confidence as edge_confidence
  FROM kg_edges e
  JOIN kg_nodes n ON n.node_id = e.target_node_id
  WHERE e.source_node_id = p_fault_id
    AND e.edge_type = 'FIXED_BY'
    AND e.is_active = TRUE
    AND n.node_type = 'Part'
    AND n.is_active = TRUE
  ORDER BY e.confidence DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction: Trouver les actions de diagnostic pour une panne
CREATE OR REPLACE FUNCTION kg_find_actions_for_fault(
  p_fault_id UUID
)
RETURNS TABLE (
  action_node_id UUID,
  action_label TEXT,
  action_category TEXT,
  edge_confidence FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.node_id as action_node_id,
    n.node_label as action_label,
    n.node_category as action_category,
    e.confidence as edge_confidence
  FROM kg_edges e
  JOIN kg_nodes n ON n.node_id = e.target_node_id
  WHERE e.source_node_id = p_fault_id
    AND e.edge_type = 'DIAGNOSED_BY'
    AND e.is_active = TRUE
    AND n.node_type = 'Action'
    AND n.is_active = TRUE
  ORDER BY e.confidence DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fonction: Diagnostic complet (multi-symptomes → pannes avec score)
CREATE OR REPLACE FUNCTION kg_diagnose(
  p_vehicle_id UUID,
  p_observable_labels TEXT[],
  p_confidence_threshold FLOAT DEFAULT 0.75
)
RETURNS TABLE (
  fault_id UUID,
  fault_label TEXT,
  match_score FLOAT,
  matched_symptoms INT,
  total_symptoms INT,
  avg_confidence FLOAT,
  parts JSONB,
  actions JSONB
) AS $$
DECLARE
  v_observable_ids UUID[];
  v_total_symptoms INT;
BEGIN
  -- 1. Trouver les nodes Observable correspondants aux labels
  SELECT array_agg(node_id), count(*)
  INTO v_observable_ids, v_total_symptoms
  FROM kg_nodes
  WHERE node_type = 'Observable'
    AND is_active = TRUE
    AND node_label ILIKE ANY (
      SELECT '%' || unnest(p_observable_labels) || '%'
    );

  -- 2. Retourner les pannes avec scoring
  RETURN QUERY
  WITH fault_matches AS (
    SELECT
      f.fault_id,
      f.fault_label,
      f.fault_category,
      count(*) as matched_count,
      avg(f.edge_confidence) as avg_conf
    FROM kg_find_faults_from_observables(v_observable_ids) f
    GROUP BY f.fault_id, f.fault_label, f.fault_category
  ),
  scored_faults AS (
    SELECT
      fm.*,
      (fm.matched_count::float / v_total_symptoms) * fm.avg_conf as score
    FROM fault_matches fm
    WHERE (fm.matched_count::float / v_total_symptoms) * fm.avg_conf >= p_confidence_threshold
  )
  SELECT
    sf.fault_id,
    sf.fault_label,
    sf.score as match_score,
    sf.matched_count::int as matched_symptoms,
    v_total_symptoms as total_symptoms,
    sf.avg_conf as avg_confidence,
    (SELECT jsonb_agg(jsonb_build_object(
      'part_id', p.part_node_id,
      'label', p.part_label,
      'piece_id', p.piece_id
    )) FROM kg_find_parts_for_fault(sf.fault_id) p) as parts,
    (SELECT jsonb_agg(jsonb_build_object(
      'action_id', a.action_node_id,
      'label', a.action_label
    )) FROM kg_find_actions_for_fault(sf.fault_id) a) as actions
  FROM scored_faults sf
  ORDER BY sf.score DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. ROW LEVEL SECURITY                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_reasoning_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_audit_log ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifies
CREATE POLICY "kg_nodes_select_authenticated" ON kg_nodes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kg_edges_select_authenticated" ON kg_edges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kg_cache_select_authenticated" ON kg_reasoning_cache
  FOR SELECT TO authenticated USING (true);

-- Ecriture pour service_role uniquement
CREATE POLICY "kg_nodes_all_service" ON kg_nodes
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_edges_all_service" ON kg_edges
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_cache_all_service" ON kg_reasoning_cache
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_audit_all_service" ON kg_audit_log
  FOR ALL TO service_role USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. COMMENTS                                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE kg_nodes IS 'Knowledge Graph nodes: Vehicle, System, Observable, Fault, Action, Part';
COMMENT ON TABLE kg_edges IS 'Knowledge Graph edges: relations versionnees entre nodes';
COMMENT ON TABLE kg_reasoning_cache IS 'Cache des diagnostics pour performance (TTL configurable)';
COMMENT ON TABLE kg_audit_log IS 'Historique des modifications du Knowledge Graph';

COMMENT ON FUNCTION kg_find_faults_from_observables IS 'Trouve les pannes liees a des symptomes observes';
COMMENT ON FUNCTION kg_find_parts_for_fault IS 'Trouve les pieces qui reparent une panne';
COMMENT ON FUNCTION kg_find_actions_for_fault IS 'Trouve les actions de diagnostic pour une panne';
COMMENT ON FUNCTION kg_diagnose IS 'Diagnostic complet: symptomes → pannes scorees avec pieces/actions';
