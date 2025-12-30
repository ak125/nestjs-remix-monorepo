-- ═══════════════════════════════════════════════════════════════════════════
-- 🧠 Knowledge Graph Seed Data - AI-COS v2.8.0
-- Migration pour peupler le Knowledge Graph avec les données automobiles initiales
-- ═══════════════════════════════════════════════════════════════════════════

-- Cette migration doit être exécutée APRÈS 20251230_knowledge_graph.sql

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- SYSTÈMES AUTOMOBILES (10 nodes)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_nodes (node_type, node_label, node_alias, node_category, confidence, sources, validation_status, created_by) VALUES
('System', 'Système injection', 'injection', 'Moteur', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système EGR', 'egr', 'Émissions', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système turbo', 'turbo', 'Admission', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système freinage', 'freins', 'Freinage', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système distribution', 'distribution', 'Moteur', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système embrayage', 'embrayage', 'Transmission', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système suspension', 'suspension', 'Châssis', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système direction', 'direction', 'Châssis', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système refroidissement', 'refroidissement', 'Moteur', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed'),
('System', 'Système électrique', 'electrique', 'Électrique', 1.0, '["TecDoc", "RTA"]', 'approved', 'seed');

-- ═══════════════════════════════════════════════════════════════════════════
-- SYMPTÔMES / OBSERVABLES (21 nodes)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_nodes (node_type, node_label, node_alias, node_category, node_data, confidence, sources, validation_status, created_by) VALUES
-- Symptômes EGR
('Observable', 'Fumée noire à l''échappement', 'fumee-noire', 'Visuel', '{"severity": "medium", "systems": ["egr", "injection", "turbo"]}', 0.95, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Observable', 'Perte de puissance', 'perte-puissance', 'Performance', '{"severity": "high", "systems": ["egr", "turbo", "injection"]}', 0.95, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Observable', 'Voyant moteur allumé', 'voyant-moteur', 'Électronique', '{"severity": "medium", "systems": ["injection", "egr", "electrique"]}', 0.98, '["TecDoc", "RTA", "Constructeur"]', 'approved', 'seed'),
('Observable', 'Mode dégradé activé', 'mode-degrade', 'Électronique', '{"severity": "high", "systems": ["egr", "turbo", "injection"]}', 0.92, '["TecDoc", "Constructeur"]', 'approved', 'seed'),
('Observable', 'Ralenti instable', 'ralenti-instable', 'Performance', '{"severity": "medium", "systems": ["egr", "injection"]}', 0.90, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Symptômes Turbo
('Observable', 'Sifflement à l''accélération', 'sifflement-acceleration', 'Sonore', '{"severity": "medium", "systems": ["turbo"]}', 0.94, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Observable', 'Fumée bleue à l''échappement', 'fumee-bleue', 'Visuel', '{"severity": "high", "systems": ["turbo", "moteur"]}', 0.93, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Observable', 'Consommation huile excessive', 'conso-huile', 'Consommation', '{"severity": "high", "systems": ["turbo", "moteur"]}', 0.91, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Symptômes Freins
('Observable', 'Bruit au freinage', 'bruit-freinage', 'Sonore', '{"severity": "medium", "systems": ["freins"]}', 0.96, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Observable', 'Vibration pédale de frein', 'vibration-pedale-frein', 'Mécanique', '{"severity": "medium", "systems": ["freins"]}', 0.94, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Observable', 'Freinage inefficace', 'freinage-inefficace', 'Performance', '{"severity": "critical", "systems": ["freins"]}', 0.98, '["TecDoc", "RTA", "Constructeur"]', 'approved', 'seed'),
('Observable', 'Pédale de frein molle', 'pedale-molle', 'Mécanique', '{"severity": "high", "systems": ["freins"]}', 0.93, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Symptômes Distribution
('Observable', 'Claquement moteur', 'claquement-moteur', 'Sonore', '{"severity": "high", "systems": ["distribution", "moteur"]}', 0.92, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Observable', 'Moteur ne démarre pas', 'pas-demarrage', 'Démarrage', '{"severity": "critical", "systems": ["distribution", "electrique", "injection"]}', 0.95, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Observable', 'Bruit de cliquetis au ralenti', 'cliquetis-ralenti', 'Sonore', '{"severity": "medium", "systems": ["distribution"]}', 0.88, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Symptômes Embrayage
('Observable', 'Embrayage patine', 'embrayage-patine', 'Transmission', '{"severity": "high", "systems": ["embrayage"]}', 0.94, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Observable', 'Pédale embrayage dure', 'pedale-embrayage-dure', 'Mécanique', '{"severity": "medium", "systems": ["embrayage"]}', 0.91, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Observable', 'Bruit à l''embrayage', 'bruit-embrayage', 'Sonore', '{"severity": "medium", "systems": ["embrayage"]}', 0.89, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Symptômes Refroidissement
('Observable', 'Surchauffe moteur', 'surchauffe', 'Température', '{"severity": "critical", "systems": ["refroidissement"]}', 0.97, '["TecDoc", "RTA", "Constructeur"]', 'approved', 'seed'),
('Observable', 'Fuite liquide refroidissement', 'fuite-ldr', 'Visuel', '{"severity": "high", "systems": ["refroidissement"]}', 0.95, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Observable', 'Voyant température allumé', 'voyant-temperature', 'Électronique', '{"severity": "high", "systems": ["refroidissement"]}', 0.96, '["TecDoc", "RTA", "Constructeur"]', 'approved', 'seed');

-- ═══════════════════════════════════════════════════════════════════════════
-- PANNES / FAULTS (18 nodes)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_nodes (node_type, node_label, node_alias, node_category, node_data, confidence, sources, validation_status, created_by) VALUES
-- Pannes EGR
('Fault', 'Vanne EGR encrassée', 'egr-encrassee', 'Émissions', '{"dtc_codes": ["P0401", "P0402", "P0403"], "repair_difficulty": "medium"}', 0.94, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Fault', 'Vanne EGR bloquée ouverte', 'egr-bloquee-ouverte', 'Émissions', '{"dtc_codes": ["P0402"], "repair_difficulty": "medium"}', 0.92, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Vanne EGR bloquée fermée', 'egr-bloquee-fermee', 'Émissions', '{"dtc_codes": ["P0401"], "repair_difficulty": "medium"}', 0.91, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Pannes Turbo
('Fault', 'Turbo HS', 'turbo-hs', 'Admission', '{"dtc_codes": ["P0234", "P0235"], "repair_difficulty": "hard"}', 0.93, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Wastegate grippée', 'wastegate-grippee', 'Admission', '{"dtc_codes": ["P0234"], "repair_difficulty": "medium"}', 0.89, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Durite turbo percée', 'durite-turbo-percee', 'Admission', '{"repair_difficulty": "easy"}', 0.91, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
-- Pannes Freins
('Fault', 'Plaquettes de frein usées', 'plaquettes-usees', 'Freinage', '{"repair_difficulty": "easy"}', 0.97, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Fault', 'Disques de frein voilés', 'disques-voiles', 'Freinage', '{"repair_difficulty": "medium"}', 0.95, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Étrier de frein grippé', 'etrier-grippe', 'Freinage', '{"repair_difficulty": "medium"}', 0.92, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Fuite liquide de frein', 'fuite-ldf', 'Freinage', '{"repair_difficulty": "medium"}', 0.94, '["TecDoc", "RTA", "Constructeur"]', 'approved', 'seed'),
-- Pannes Distribution
('Fault', 'Courroie distribution usée', 'courroie-usee', 'Moteur', '{"repair_difficulty": "hard"}', 0.95, '["TecDoc", "RTA", "Constructeur"]', 'approved', 'seed'),
('Fault', 'Galet tendeur HS', 'galet-tendeur-hs', 'Moteur', '{"repair_difficulty": "hard"}', 0.92, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Pompe à eau défaillante', 'pompe-eau-hs', 'Refroidissement', '{"repair_difficulty": "medium"}', 0.93, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Pannes Embrayage
('Fault', 'Kit embrayage usé', 'kit-embrayage-use', 'Transmission', '{"repair_difficulty": "hard"}', 0.95, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed'),
('Fault', 'Butée embrayage HS', 'butee-hs', 'Transmission', '{"repair_difficulty": "hard"}', 0.91, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Volant moteur bimasse HS', 'volant-bimasse-hs', 'Transmission', '{"repair_difficulty": "hard"}', 0.90, '["TecDoc", "RTA"]', 'approved', 'seed'),
-- Pannes Refroidissement
('Fault', 'Thermostat bloqué', 'thermostat-bloque', 'Refroidissement', '{"repair_difficulty": "easy"}', 0.93, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Radiateur percé', 'radiateur-perce', 'Refroidissement', '{"repair_difficulty": "medium"}', 0.94, '["TecDoc", "RTA"]', 'approved', 'seed'),
('Fault', 'Durite fissurée', 'durite-fissuree', 'Refroidissement', '{"repair_difficulty": "easy"}', 0.95, '["TecDoc", "RTA", "Forum"]', 'approved', 'seed');

-- ═══════════════════════════════════════════════════════════════════════════
-- ACTIONS (9 nodes)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_nodes (node_type, node_label, node_alias, node_category, node_data, confidence, sources, validation_status, created_by) VALUES
('Action', 'Nettoyage vanne EGR', 'nettoyage-egr', 'Entretien', '{"duration_hours": 1.5, "skill_level": "intermediate"}', 0.95, '["RTA"]', 'approved', 'seed'),
('Action', 'Remplacement vanne EGR', 'remplacement-egr', 'Réparation', '{"duration_hours": 2, "skill_level": "intermediate"}', 0.95, '["RTA"]', 'approved', 'seed'),
('Action', 'Remplacement turbo', 'remplacement-turbo', 'Réparation', '{"duration_hours": 4, "skill_level": "expert"}', 0.95, '["RTA"]', 'approved', 'seed'),
('Action', 'Remplacement plaquettes de frein', 'remplacement-plaquettes', 'Entretien', '{"duration_hours": 1, "skill_level": "beginner"}', 0.98, '["RTA", "Forum"]', 'approved', 'seed'),
('Action', 'Remplacement disques de frein', 'remplacement-disques', 'Réparation', '{"duration_hours": 1.5, "skill_level": "intermediate"}', 0.96, '["RTA"]', 'approved', 'seed'),
('Action', 'Remplacement kit distribution', 'remplacement-distribution', 'Réparation', '{"duration_hours": 5, "skill_level": "expert"}', 0.95, '["RTA", "Constructeur"]', 'approved', 'seed'),
('Action', 'Remplacement kit embrayage', 'remplacement-embrayage', 'Réparation', '{"duration_hours": 4, "skill_level": "expert"}', 0.95, '["RTA"]', 'approved', 'seed'),
('Action', 'Remplacement thermostat', 'remplacement-thermostat', 'Réparation', '{"duration_hours": 1, "skill_level": "intermediate"}', 0.94, '["RTA"]', 'approved', 'seed'),
('Action', 'Purge circuit refroidissement', 'purge-refroidissement', 'Entretien', '{"duration_hours": 0.5, "skill_level": "beginner"}', 0.95, '["RTA"]', 'approved', 'seed');

-- ═══════════════════════════════════════════════════════════════════════════
-- PIÈCES / PARTS (11 nodes)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_nodes (node_type, node_label, node_alias, node_category, node_data, confidence, sources, validation_status, created_by) VALUES
('Part', 'Vanne EGR', 'vanne-egr', 'Émissions', '{"price_range": {"min": 80, "max": 350}, "gamme_id": "1137"}', 0.95, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Turbocompresseur', 'turbo', 'Admission', '{"price_range": {"min": 300, "max": 1500}, "gamme_id": "1240"}', 0.95, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Plaquettes de frein avant', 'plaquettes-av', 'Freinage', '{"price_range": {"min": 20, "max": 80}, "gamme_id": "135"}', 0.98, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Disques de frein avant', 'disques-av', 'Freinage', '{"price_range": {"min": 40, "max": 150}, "gamme_id": "145"}', 0.97, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Étrier de frein', 'etrier', 'Freinage', '{"price_range": {"min": 80, "max": 250}, "gamme_id": "155"}', 0.95, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Kit distribution', 'kit-distribution', 'Moteur', '{"price_range": {"min": 100, "max": 400}, "gamme_id": "120"}', 0.96, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Pompe à eau', 'pompe-eau', 'Refroidissement', '{"price_range": {"min": 30, "max": 120}, "gamme_id": "125"}', 0.95, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Kit embrayage', 'kit-embrayage', 'Transmission', '{"price_range": {"min": 150, "max": 500}, "gamme_id": "110"}', 0.96, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Volant moteur bimasse', 'volant-bimasse', 'Transmission', '{"price_range": {"min": 300, "max": 800}, "gamme_id": "115"}', 0.94, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Thermostat', 'thermostat', 'Refroidissement', '{"price_range": {"min": 15, "max": 60}, "gamme_id": "130"}', 0.95, '["TecDoc"]', 'approved', 'seed'),
('Part', 'Radiateur', 'radiateur', 'Refroidissement', '{"price_range": {"min": 80, "max": 300}, "gamme_id": "140"}', 0.94, '["TecDoc"]', 'approved', 'seed');

-- ═══════════════════════════════════════════════════════════════════════════
-- EDGES: SYMPTÔMES → PANNES (CAUSES) - 37 edges
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_edges (source_node_id, target_node_id, edge_type, weight, confidence, sources, created_by)
SELECT
  s.node_id,
  t.node_id,
  'CAUSES',
  m.weight,
  m.confidence,
  '["seed-data"]',
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
JOIN kg_nodes t ON t.node_alias = m.target_alias AND t.deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- EDGES: PANNES → ACTIONS (DIAGNOSED_BY) - 19 edges
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_edges (source_node_id, target_node_id, edge_type, weight, confidence, sources, created_by)
SELECT
  s.node_id,
  t.node_id,
  'DIAGNOSED_BY',
  m.weight,
  m.confidence,
  '["seed-data"]',
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
  ('durite-fissuree', 'purge-refroidissement', 0.5, 0.70),
  ('pompe-eau-hs', 'remplacement-distribution', 0.8, 0.88)
) AS m(source_alias, target_alias, weight, confidence)
JOIN kg_nodes s ON s.node_alias = m.source_alias AND s.deleted_at IS NULL
JOIN kg_nodes t ON t.node_alias = m.target_alias AND t.deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- EDGES: PANNES → PIÈCES (FIXED_BY) - 17 edges
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO kg_edges (source_node_id, target_node_id, edge_type, weight, confidence, sources, created_by)
SELECT
  s.node_id,
  t.node_id,
  'FIXED_BY',
  m.weight,
  m.confidence,
  '["seed-data"]',
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
JOIN kg_nodes t ON t.node_alias = m.target_alias AND t.deleted_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- STATISTIQUES FINALES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  node_count INTEGER;
  edge_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO node_count FROM kg_nodes WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO edge_count FROM kg_edges WHERE deleted_at IS NULL;

  RAISE NOTICE '🧠 Knowledge Graph Seed Complete!';
  RAISE NOTICE '   Nodes: % (Systems: 10, Observables: 21, Faults: 18, Actions: 9, Parts: 11)', node_count;
  RAISE NOTICE '   Edges: % (CAUSES: 35, DIAGNOSED_BY: 20, FIXED_BY: 16)', edge_count;
END $$;

COMMIT;
