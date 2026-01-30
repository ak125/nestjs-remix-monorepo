-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 7: Synchronisation RAG → KG
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Principe: Les documents RAG sont la SOURCE DE VÉRITÉ éditable
--           Le KG Supabase est le GRAPHE OPTIMISÉ pour le raisonnement
--
-- Table de tracking:
--   - kg_rag_sync_log: Historique des synchronisations fichier → KG
--
-- Workflow:
--   1. Script Node.js parse les fichiers RAG (diagnostic/*.md, vehicle/*.md)
--   2. Compare hash MD5 du fichier avec kg_rag_sync_log
--   3. Si changé: extrait symptoms, faults, relations → insère dans KG
--   4. Met à jour kg_rag_sync_log avec nouveau hash
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Table de tracking des synchronisations RAG → KG                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_rag_sync_log (
  sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiant du fichier source
  rag_file_path TEXT NOT NULL,           -- Ex: "diagnostic/alternateur.md"
  rag_file_hash TEXT NOT NULL,           -- Hash MD5 pour détecter changements

  -- Catégorie du fichier RAG
  rag_category TEXT CHECK (rag_category IN (
    'diagnostic',    -- Fichiers diagnostic/*.md
    'vehicle',       -- Fichiers vehicle/*.md
    'gammes',        -- Fichiers gammes/*.md
    'guides',        -- Fichiers guides/*.md
    'faq',           -- Fichiers faq/*.md
    'policies'       -- Fichiers policies/*.md
  )),

  -- Statistiques de la sync
  nodes_created INT DEFAULT 0,
  nodes_updated INT DEFAULT 0,
  edges_created INT DEFAULT 0,
  edges_updated INT DEFAULT 0,
  errors_count INT DEFAULT 0,

  -- Détails des erreurs si présentes
  errors_detail JSONB DEFAULT '[]',

  -- IDs des nodes créés/mis à jour (pour rollback)
  affected_node_ids UUID[] DEFAULT '{}',
  affected_edge_ids UUID[] DEFAULT '{}',

  -- Timestamps
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_duration_ms INT,

  -- Index unique sur le fichier (on garde la dernière sync)
  UNIQUE(rag_file_path)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_kg_rag_sync_log_category
  ON kg_rag_sync_log(rag_category);

CREATE INDEX IF NOT EXISTS idx_kg_rag_sync_log_date
  ON kg_rag_sync_log(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_kg_rag_sync_log_errors
  ON kg_rag_sync_log(errors_count)
  WHERE errors_count > 0;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Table de mapping RAG ID → KG UUID (correspondance)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_rag_mapping (
  mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants RAG
  rag_file_path TEXT NOT NULL,           -- Fichier source
  rag_item_id TEXT NOT NULL,             -- ID dans le fichier (ex: "S1", "F1")
  rag_item_type TEXT NOT NULL,           -- Type: symptom, fault, action, etc.

  -- Identifiant KG
  kg_node_id UUID NOT NULL REFERENCES kg_nodes(node_id) ON DELETE CASCADE,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: un seul mapping par (fichier, item_id)
  UNIQUE(rag_file_path, rag_item_id)
);

-- Index pour recherche bidirectionnelle
CREATE INDEX IF NOT EXISTS idx_kg_rag_mapping_rag
  ON kg_rag_mapping(rag_file_path, rag_item_id);

CREATE INDEX IF NOT EXISTS idx_kg_rag_mapping_kg
  ON kg_rag_mapping(kg_node_id);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Fonction helper: Vérifier si fichier RAG a changé                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_rag_file_needs_sync(
  p_file_path TEXT,
  p_file_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_existing_hash TEXT;
BEGIN
  SELECT rag_file_hash INTO v_existing_hash
  FROM kg_rag_sync_log
  WHERE rag_file_path = p_file_path;

  -- Si pas de sync précédente ou hash différent → besoin de sync
  RETURN v_existing_hash IS NULL OR v_existing_hash != p_file_hash;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Fonction helper: Enregistrer une synchronisation                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_rag_record_sync(
  p_file_path TEXT,
  p_file_hash TEXT,
  p_category TEXT,
  p_nodes_created INT DEFAULT 0,
  p_nodes_updated INT DEFAULT 0,
  p_edges_created INT DEFAULT 0,
  p_edges_updated INT DEFAULT 0,
  p_errors_count INT DEFAULT 0,
  p_errors_detail JSONB DEFAULT '[]',
  p_affected_node_ids UUID[] DEFAULT '{}',
  p_affected_edge_ids UUID[] DEFAULT '{}',
  p_duration_ms INT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_sync_id UUID;
BEGIN
  INSERT INTO kg_rag_sync_log (
    rag_file_path,
    rag_file_hash,
    rag_category,
    nodes_created,
    nodes_updated,
    edges_created,
    edges_updated,
    errors_count,
    errors_detail,
    affected_node_ids,
    affected_edge_ids,
    sync_duration_ms
  ) VALUES (
    p_file_path,
    p_file_hash,
    p_category,
    p_nodes_created,
    p_nodes_updated,
    p_edges_created,
    p_edges_updated,
    p_errors_count,
    p_errors_detail,
    p_affected_node_ids,
    p_affected_edge_ids,
    p_duration_ms
  )
  ON CONFLICT (rag_file_path) DO UPDATE SET
    rag_file_hash = EXCLUDED.rag_file_hash,
    rag_category = EXCLUDED.rag_category,
    nodes_created = EXCLUDED.nodes_created,
    nodes_updated = EXCLUDED.nodes_updated,
    edges_created = EXCLUDED.edges_created,
    edges_updated = EXCLUDED.edges_updated,
    errors_count = EXCLUDED.errors_count,
    errors_detail = EXCLUDED.errors_detail,
    affected_node_ids = EXCLUDED.affected_node_ids,
    affected_edge_ids = EXCLUDED.affected_edge_ids,
    sync_duration_ms = EXCLUDED.sync_duration_ms,
    synced_at = NOW()
  RETURNING sync_id INTO v_sync_id;

  RETURN v_sync_id;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Fonction: Obtenir le node KG pour un item RAG                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_rag_get_node_id(
  p_file_path TEXT,
  p_item_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_node_id UUID;
BEGIN
  SELECT kg_node_id INTO v_node_id
  FROM kg_rag_mapping
  WHERE rag_file_path = p_file_path
    AND rag_item_id = p_item_id;

  RETURN v_node_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Fonction: Créer ou mettre à jour un mapping RAG → KG                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_rag_upsert_mapping(
  p_file_path TEXT,
  p_item_id TEXT,
  p_item_type TEXT,
  p_kg_node_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_mapping_id UUID;
BEGIN
  INSERT INTO kg_rag_mapping (
    rag_file_path,
    rag_item_id,
    rag_item_type,
    kg_node_id
  ) VALUES (
    p_file_path,
    p_item_id,
    p_item_type,
    p_kg_node_id
  )
  ON CONFLICT (rag_file_path, rag_item_id) DO UPDATE SET
    rag_item_type = EXCLUDED.rag_item_type,
    kg_node_id = EXCLUDED.kg_node_id,
    updated_at = NOW()
  RETURNING mapping_id INTO v_mapping_id;

  RETURN v_mapping_id;
END;
$$ LANGUAGE plpgsql;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Vue: Statistiques de synchronisation RAG                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_rag_sync_stats AS
SELECT
  rag_category,
  COUNT(*) AS files_synced,
  SUM(nodes_created) AS total_nodes_created,
  SUM(nodes_updated) AS total_nodes_updated,
  SUM(edges_created) AS total_edges_created,
  SUM(edges_updated) AS total_edges_updated,
  SUM(errors_count) AS total_errors,
  MAX(synced_at) AS last_sync,
  AVG(sync_duration_ms)::INT AS avg_duration_ms
FROM kg_rag_sync_log
GROUP BY rag_category;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Vue: Fichiers RAG avec erreurs                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_rag_sync_errors AS
SELECT
  rag_file_path,
  rag_category,
  errors_count,
  errors_detail,
  synced_at
FROM kg_rag_sync_log
WHERE errors_count > 0
ORDER BY synced_at DESC;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. RLS pour les tables RAG sync                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_rag_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE kg_rag_mapping ENABLE ROW LEVEL SECURITY;

-- Lecture pour tous les authentifiés
CREATE POLICY "kg_rag_sync_log_select_authenticated" ON kg_rag_sync_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "kg_rag_mapping_select_authenticated" ON kg_rag_mapping
  FOR SELECT TO authenticated USING (true);

-- Écriture pour service_role uniquement
CREATE POLICY "kg_rag_sync_log_all_service" ON kg_rag_sync_log
  FOR ALL TO service_role USING (true);

CREATE POLICY "kg_rag_mapping_all_service" ON kg_rag_mapping
  FOR ALL TO service_role USING (true);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. Comments                                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE kg_rag_sync_log IS
  'Historique des synchronisations fichiers RAG → Knowledge Graph';

COMMENT ON TABLE kg_rag_mapping IS
  'Mapping bidirectionnel entre IDs RAG (S1, F1) et UUIDs KG';

COMMENT ON FUNCTION kg_rag_file_needs_sync IS
  'Vérifie si un fichier RAG a besoin d''être resynchronisé (hash MD5 différent)';

COMMENT ON FUNCTION kg_rag_record_sync IS
  'Enregistre le résultat d''une synchronisation RAG → KG';

COMMENT ON FUNCTION kg_rag_get_node_id IS
  'Récupère l''UUID KG pour un item RAG donné';

COMMENT ON FUNCTION kg_rag_upsert_mapping IS
  'Crée ou met à jour un mapping RAG item → KG node';

COMMENT ON VIEW kg_rag_sync_stats IS
  'Statistiques agrégées des synchronisations par catégorie RAG';

COMMENT ON VIEW kg_rag_sync_errors IS
  'Liste des fichiers RAG ayant des erreurs de synchronisation';

COMMIT;
