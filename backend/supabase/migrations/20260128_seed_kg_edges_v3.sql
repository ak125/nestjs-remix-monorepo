-- ============================================================================
-- KNOWLEDGE GRAPH V3.0 - SEED EDGES
-- Insertion des edges avec source_type et status corrects
-- ============================================================================

BEGIN;

-- ============================================================================
-- EDGES: CAUSES (Observable → Fault) - 35 edges
-- ============================================================================

INSERT INTO kg_edges (source_node_id, target_node_id, edge_type, weight, confidence, sources, source_type, status, created_by)
SELECT
  s.node_id,
  t.node_id,
  'CAUSES',
  m.weight,
  m.confidence,
  ARRAY['seed'],
  'manual',
  'active',
  'seed'
FROM (VALUES
  ('fumee-noire', 'egr-encrassee', 0.9, 0.94),
  ('perte-puissance', 'egr-encrassee', 0.85, 0.92),
  ('voyant-moteur', 'egr-encrassee', 0.7, 0.88),
  ('mode-degrade', 'egr-encrassee', 0.8, 0.90),
  ('ralenti-instable', 'egr-encrassee', 0.75, 0.85),
  ('fumee-noire', 'egr-bloquee-ouverte', 0.85, 0.88),
  ('perte-puissance', 'egr-bloquee-fermee', 0.7, 0.82),
  ('sifflement-acceleration', 'turbo-hs', 0.8, 0.88),
  ('fumee-bleue', 'turbo-hs', 0.9, 0.92),
  ('conso-huile', 'turbo-hs', 0.85, 0.90),
  ('perte-puissance', 'turbo-hs', 0.75, 0.85),
  ('sifflement-acceleration', 'durite-turbo-percee', 0.7, 0.80),
  ('perte-puissance', 'wastegate-grippee', 0.65, 0.78),
  ('bruit-freinage', 'plaquettes-usees', 0.95, 0.96),
  ('vibration-pedale-frein', 'disques-voiles', 0.9, 0.94),
  ('freinage-inefficace', 'plaquettes-usees', 0.8, 0.88),
  ('freinage-inefficace', 'fuite-ldf', 0.85, 0.90),
  ('pedale-molle', 'fuite-ldf', 0.9, 0.92),
  ('bruit-freinage', 'etrier-grippe', 0.6, 0.75),
  ('claquement-moteur', 'courroie-usee', 0.7, 0.82),
  ('claquement-moteur', 'galet-tendeur-hs', 0.8, 0.85),
  ('cliquetis-ralenti', 'galet-tendeur-hs', 0.75, 0.80),
  ('pas-demarrage', 'courroie-usee', 0.5, 0.70),
  ('embrayage-patine', 'kit-embrayage-use', 0.95, 0.96),
  ('pedale-embrayage-dure', 'butee-hs', 0.8, 0.85),
  ('bruit-embrayage', 'butee-hs', 0.7, 0.82),
  ('bruit-embrayage', 'volant-bimasse-hs', 0.75, 0.84),
  ('surchauffe', 'thermostat-bloque', 0.85, 0.90),
  ('surchauffe', 'radiateur-perce', 0.8, 0.88),
  ('surchauffe', 'pompe-eau-hs', 0.7, 0.82),
  ('fuite-ldr', 'radiateur-perce', 0.9, 0.94),
  ('fuite-ldr', 'durite-fissuree', 0.85, 0.92),
  ('fuite-ldr', 'pompe-eau-hs', 0.6, 0.78),
  ('voyant-temperature', 'thermostat-bloque', 0.8, 0.88),
  ('voyant-temperature', 'pompe-eau-hs', 0.75, 0.85)
) AS m(source_alias, target_alias, weight, confidence)
JOIN kg_nodes s ON s.node_alias = m.source_alias AND s.deleted_at IS NULL
JOIN kg_nodes t ON t.node_alias = m.target_alias AND t.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- EDGES: DIAGNOSED_BY (Fault → Action) - 19 edges
-- ============================================================================

INSERT INTO kg_edges (source_node_id, target_node_id, edge_type, weight, confidence, sources, source_type, status, created_by)
SELECT
  s.node_id,
  t.node_id,
  'DIAGNOSED_BY',
  m.weight,
  m.confidence,
  ARRAY['seed'],
  'manual',
  'active',
  'seed'
FROM (VALUES
  ('egr-encrassee', 'nettoyage-egr', 0.8, 0.90),
  ('egr-encrassee', 'remplacement-egr', 0.9, 0.95),
  ('egr-bloquee-ouverte', 'remplacement-egr', 0.95, 0.96),
  ('egr-bloquee-fermee', 'remplacement-egr', 0.95, 0.96),
  ('turbo-hs', 'remplacement-turbo', 0.95, 0.97),
  ('wastegate-grippee', 'remplacement-turbo', 0.7, 0.82),
  ('plaquettes-usees', 'remplacement-plaquettes', 0.98, 0.99),
  ('disques-voiles', 'remplacement-disques', 0.95, 0.97),
  ('etrier-grippe', 'remplacement-disques', 0.5, 0.70),
  ('courroie-usee', 'remplacement-distribution', 0.98, 0.99),
  ('galet-tendeur-hs', 'remplacement-distribution', 0.95, 0.97),
  ('pompe-eau-hs', 'remplacement-distribution', 0.6, 0.78),
  ('kit-embrayage-use', 'remplacement-embrayage', 0.98, 0.99),
  ('butee-hs', 'remplacement-embrayage', 0.95, 0.97),
  ('volant-bimasse-hs', 'remplacement-embrayage', 0.7, 0.82),
  ('thermostat-bloque', 'remplacement-thermostat', 0.95, 0.97),
  ('thermostat-bloque', 'purge-refroidissement', 0.4, 0.60),
  ('radiateur-perce', 'purge-refroidissement', 0.3, 0.50),
  ('durite-fissuree', 'purge-refroidissement', 0.5, 0.70)
) AS m(source_alias, target_alias, weight, confidence)
JOIN kg_nodes s ON s.node_alias = m.source_alias AND s.deleted_at IS NULL
JOIN kg_nodes t ON t.node_alias = m.target_alias AND t.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- EDGES: FIXED_BY (Fault → Part) - 16 edges
-- ============================================================================

INSERT INTO kg_edges (source_node_id, target_node_id, edge_type, weight, confidence, sources, source_type, status, created_by)
SELECT
  s.node_id,
  t.node_id,
  'FIXED_BY',
  m.weight,
  m.confidence,
  ARRAY['seed'],
  'manual',
  'active',
  'seed'
FROM (VALUES
  ('egr-encrassee', 'vanne-egr', 0.9, 0.95),
  ('egr-bloquee-ouverte', 'vanne-egr', 0.98, 0.99),
  ('egr-bloquee-fermee', 'vanne-egr', 0.98, 0.99),
  ('turbo-hs', 'turbo', 0.98, 0.99),
  ('wastegate-grippee', 'turbo', 0.85, 0.90),
  ('plaquettes-usees', 'plaquettes-av', 0.98, 0.99),
  ('disques-voiles', 'disques-av', 0.95, 0.97),
  ('etrier-grippe', 'etrier', 0.9, 0.94),
  ('courroie-usee', 'kit-distribution', 0.98, 0.99),
  ('galet-tendeur-hs', 'kit-distribution', 0.95, 0.97),
  ('pompe-eau-hs', 'pompe-eau', 0.95, 0.97),
  ('kit-embrayage-use', 'kit-embrayage', 0.98, 0.99),
  ('butee-hs', 'kit-embrayage', 0.9, 0.94),
  ('volant-bimasse-hs', 'volant-bimasse', 0.95, 0.97),
  ('thermostat-bloque', 'thermostat', 0.95, 0.97),
  ('radiateur-perce', 'radiateur', 0.95, 0.97)
) AS m(source_alias, target_alias, weight, confidence)
JOIN kg_nodes s ON s.node_alias = m.source_alias AND s.deleted_at IS NULL
JOIN kg_nodes t ON t.node_alias = m.target_alias AND t.deleted_at IS NULL
ON CONFLICT DO NOTHING;

COMMIT;
