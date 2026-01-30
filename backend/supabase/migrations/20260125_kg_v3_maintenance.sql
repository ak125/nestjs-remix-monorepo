-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 5: Maintenance & Rappels
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Nodes et RPC pour:
--   - MaintenanceInterval: Intervalles d'entretien constructeur
--   - RecallCampaign: Campagnes de rappel
--   - kg_get_vehicle_maintenance_schedule(): Planning entretien
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Champs spécifiques MaintenanceInterval                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Type d'intervalle (km, mois, ou les deux)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  interval_type TEXT CHECK (interval_type IN ('km', 'months', 'both'));

-- Intervalle kilométrique
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  km_interval INT CHECK (km_interval > 0);

-- Intervalle en mois
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  month_interval INT CHECK (month_interval > 0);

-- Priorité de l'entretien (pour affichage)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  maintenance_priority TEXT CHECK (maintenance_priority IN (
    'critical',    -- Sécurité (freins, direction)
    'important',   -- Moteur (vidange, distribution)
    'recommended', -- Confort (clim, filtres)
    'optional'     -- Accessoires
  ));

-- Coût estimé (min-max)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  estimated_cost_min FLOAT;

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  estimated_cost_max FLOAT;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Champs spécifiques RecallCampaign                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Code de la campagne constructeur
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  recall_code TEXT;

-- Date de début de la campagne
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  recall_start_date DATE;

-- Date de fin (si applicable)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  recall_end_date DATE;

-- Sévérité du rappel
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  recall_severity TEXT CHECK (recall_severity IN (
    'safety',      -- Sécurité critique
    'emissions',   -- Normes antipollution
    'compliance',  -- Conformité réglementaire
    'quality'      -- Qualité/fiabilité
  ));

-- Index pour recherche par code
CREATE INDEX IF NOT EXISTS idx_kg_nodes_recall_code
  ON kg_nodes(recall_code)
  WHERE recall_code IS NOT NULL;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Données initiales: MaintenanceInterval (entretiens courants)           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO kg_nodes (
  node_type, node_label, node_alias, node_category,
  interval_type, km_interval, month_interval, maintenance_priority,
  estimated_cost_min, estimated_cost_max,
  status, source_type, confidence_base, node_data
) VALUES
  -- Vidanges
  ('MaintenanceInterval', 'Vidange moteur essence', 'vidange-essence', 'engine',
   'both', 15000, 12, 'important', 60, 120,
   'active', 'oem', 0.95, '{"operations": ["Vidange huile", "Filtre huile"], "oil_type": "5W30"}'),

  ('MaintenanceInterval', 'Vidange moteur diesel', 'vidange-diesel', 'engine',
   'both', 20000, 24, 'important', 80, 150,
   'active', 'oem', 0.95, '{"operations": ["Vidange huile", "Filtre huile", "Filtre gasoil"], "oil_type": "5W30 C3"}'),

  -- Freinage
  ('MaintenanceInterval', 'Contrôle freinage', 'controle-freinage', 'safety',
   'both', 20000, 12, 'critical', 0, 50,
   'active', 'oem', 0.95, '{"operations": ["Contrôle épaisseur plaquettes", "Contrôle disques", "Niveau liquide"]}'),

  ('MaintenanceInterval', 'Remplacement liquide de frein', 'liquide-frein', 'safety',
   'months', NULL, 24, 'critical', 50, 100,
   'active', 'oem', 0.95, '{"operations": ["Purge circuit", "Remplacement liquide DOT4"]}'),

  -- Distribution
  ('MaintenanceInterval', 'Remplacement courroie distribution', 'distribution', 'engine',
   'both', 120000, 72, 'critical', 400, 800,
   'active', 'oem', 0.95, '{"operations": ["Courroie", "Galets", "Pompe à eau recommandée"], "warning": "Casse = destruction moteur"}'),

  -- Filtration
  ('MaintenanceInterval', 'Remplacement filtre à air', 'filtre-air', 'engine',
   'both', 30000, 24, 'recommended', 20, 50,
   'active', 'oem', 0.90, '{"operations": ["Filtre à air moteur"]}'),

  ('MaintenanceInterval', 'Remplacement filtre habitacle', 'filtre-habitacle', 'comfort',
   'both', 15000, 12, 'recommended', 15, 40,
   'active', 'oem', 0.90, '{"operations": ["Filtre pollen/charbon actif"]}'),

  -- Bougies
  ('MaintenanceInterval', 'Remplacement bougies essence', 'bougies-essence', 'engine',
   'km', 60000, NULL, 'important', 40, 120,
   'active', 'oem', 0.90, '{"operations": ["4 bougies allumage"], "note": "Vérifier couple de serrage"}'),

  ('MaintenanceInterval', 'Remplacement bougies préchauffage diesel', 'bougies-prechauffage', 'engine',
   'km', 100000, NULL, 'important', 80, 200,
   'active', 'oem', 0.90, '{"operations": ["4 bougies préchauffage"], "note": "Risque casse à la dépose"}'),

  -- Refroidissement
  ('MaintenanceInterval', 'Remplacement liquide refroidissement', 'liquide-refroidissement', 'engine',
   'both', 60000, 48, 'important', 60, 120,
   'active', 'oem', 0.90, '{"operations": ["Vidange circuit", "Liquide G12/G13"]}'),

  -- Transmission
  ('MaintenanceInterval', 'Vidange boîte manuelle', 'vidange-bvm', 'drivetrain',
   'km', 60000, NULL, 'recommended', 80, 150,
   'active', 'oem', 0.85, '{"operations": ["Vidange huile boîte"], "note": "Souvent négligé"}'),

  ('MaintenanceInterval', 'Vidange boîte automatique', 'vidange-bva', 'drivetrain',
   'km', 60000, NULL, 'important', 150, 350,
   'active', 'oem', 0.90, '{"operations": ["Vidange huile ATF", "Filtre si accessible"]}'),

  -- Climatisation
  ('MaintenanceInterval', 'Recharge climatisation', 'recharge-clim', 'comfort',
   'months', NULL, 24, 'optional', 80, 150,
   'active', 'manual', 0.80, '{"operations": ["Contrôle pression", "Recharge gaz R134a/R1234yf"]}')
ON CONFLICT DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Type de retour pour le planning maintenance                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP TYPE IF EXISTS kg_maintenance_item CASCADE;
CREATE TYPE kg_maintenance_item AS (
  maintenance_id UUID,
  label TEXT,
  category TEXT,
  priority TEXT,
  status TEXT,              -- 'due', 'overdue', 'upcoming', 'done'
  km_interval INT,
  month_interval INT,
  km_since_last INT,
  months_since_last INT,
  km_remaining INT,
  months_remaining INT,
  due_at_km INT,
  due_at_date DATE,
  estimated_cost_min FLOAT,
  estimated_cost_max FLOAT,
  operations JSONB,
  related_parts JSONB
);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. RPC: Planning d'entretien pour un véhicule                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_get_vehicle_maintenance_schedule(
  p_engine_family_code TEXT,
  p_current_km INT,
  p_vehicle_age_months INT DEFAULT 36,
  p_last_maintenance_km INT DEFAULT 0,
  p_last_maintenance_date DATE DEFAULT NULL
)
RETURNS SETOF kg_maintenance_item AS $$
DECLARE
  v_last_date DATE;
BEGIN
  v_last_date := COALESCE(p_last_maintenance_date, CURRENT_DATE - (p_vehicle_age_months || ' months')::INTERVAL);

  RETURN QUERY
  WITH maintenance_intervals AS (
    SELECT
      mi.node_id AS maintenance_id,
      mi.node_label AS label,
      mi.node_category AS category,
      mi.maintenance_priority AS priority,
      mi.km_interval,
      mi.month_interval,
      mi.estimated_cost_min,
      mi.estimated_cost_max,
      mi.node_data AS operations_data,
      -- Calculs de statut
      p_current_km - p_last_maintenance_km AS km_since_last,
      EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_last_date))::INT AS months_since_last,
      -- Restant
      COALESCE(mi.km_interval - (p_current_km - p_last_maintenance_km), 999999) AS km_remaining,
      COALESCE(mi.month_interval - EXTRACT(MONTH FROM AGE(CURRENT_DATE, v_last_date))::INT, 999) AS months_remaining
    FROM kg_nodes mi
    LEFT JOIN kg_edges e ON e.source_node_id = mi.node_id
      AND e.edge_type = 'SCHEDULED_FOR'
      AND e.status = 'active'
    LEFT JOIN kg_engine_families ef ON ef.family_id = e.target_node_id::UUID
    WHERE mi.node_type = 'MaintenanceInterval'
      AND mi.status = 'active'
      -- Filtrer par famille moteur si spécifié, sinon tous les entretiens génériques
      AND (ef.family_code = p_engine_family_code OR e.edge_id IS NULL)
  ),
  with_status AS (
    SELECT
      mi.*,
      CASE
        WHEN mi.km_remaining < 0 OR mi.months_remaining < 0 THEN 'overdue'
        WHEN mi.km_remaining < 3000 OR mi.months_remaining < 1 THEN 'due'
        WHEN mi.km_remaining < 5000 OR mi.months_remaining < 3 THEN 'upcoming'
        ELSE 'ok'
      END AS status,
      p_last_maintenance_km + COALESCE(mi.km_interval, 999999) AS due_at_km,
      v_last_date + (COALESCE(mi.month_interval, 999) || ' months')::INTERVAL AS due_at_date
    FROM maintenance_intervals mi
  )
  SELECT
    ws.maintenance_id,
    ws.label,
    ws.category,
    ws.priority,
    ws.status,
    ws.km_interval,
    ws.month_interval,
    ws.km_since_last,
    ws.months_since_last,
    GREATEST(0, ws.km_remaining)::INT AS km_remaining,
    GREATEST(0, ws.months_remaining)::INT AS months_remaining,
    ws.due_at_km::INT,
    ws.due_at_date::DATE,
    ws.estimated_cost_min,
    ws.estimated_cost_max,
    ws.operations_data AS operations,
    -- Récupérer les pièces associées
    (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'part_id', p.node_id,
          'label', p.node_label,
          'pg_id', p.node_data->>'pg_id'
        )
      )
      FROM kg_edges e
      JOIN kg_nodes p ON p.node_id = e.target_node_id AND p.node_type = 'Part'
      WHERE e.source_node_id = ws.maintenance_id
        AND e.edge_type = 'REQUIRES_PART'
        AND e.status = 'active'
    ) AS related_parts
  FROM with_status ws
  ORDER BY
    CASE ws.status
      WHEN 'overdue' THEN 1
      WHEN 'due' THEN 2
      WHEN 'upcoming' THEN 3
      ELSE 4
    END,
    CASE ws.priority
      WHEN 'critical' THEN 1
      WHEN 'important' THEN 2
      WHEN 'recommended' THEN 3
      ELSE 4
    END,
    ws.km_remaining;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. RPC: Rappels constructeur pour un véhicule                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP TYPE IF EXISTS kg_recall_item CASCADE;
CREATE TYPE kg_recall_item AS (
  recall_id UUID,
  recall_code TEXT,
  label TEXT,
  severity TEXT,
  start_date DATE,
  end_date DATE,
  description TEXT,
  affected_fault TEXT,
  fix_parts JSONB
);

CREATE OR REPLACE FUNCTION kg_get_vehicle_recalls(
  p_engine_family_code TEXT
)
RETURNS SETOF kg_recall_item AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.node_id AS recall_id,
    rc.recall_code,
    rc.node_label AS label,
    rc.recall_severity AS severity,
    rc.recall_start_date AS start_date,
    rc.recall_end_date AS end_date,
    rc.node_data->>'description' AS description,
    f.node_label AS affected_fault,
    (
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'part_id', p.node_id,
          'label', p.node_label,
          'pg_id', p.node_data->>'pg_id'
        )
      )
      FROM kg_edges ep
      JOIN kg_nodes p ON p.node_id = ep.target_node_id AND p.node_type = 'Part'
      WHERE ep.source_node_id = rc.node_id
        AND ep.edge_type = 'FIXED_BY'
        AND ep.status = 'active'
    ) AS fix_parts
  FROM kg_nodes rc
  JOIN kg_edges e ON e.source_node_id = rc.node_id
    AND e.edge_type = 'AFFECTS'
    AND e.status = 'active'
  JOIN kg_engine_families ef ON ef.family_id = e.target_node_id::UUID
  LEFT JOIN kg_edges ef2 ON ef2.source_node_id = rc.node_id
    AND ef2.edge_type = 'RECALLS_FOR'
    AND ef2.status = 'active'
  LEFT JOIN kg_nodes f ON f.node_id = ef2.target_node_id AND f.node_type = 'Fault'
  WHERE rc.node_type = 'RecallCampaign'
    AND rc.status = 'active'
    AND ef.family_code = p_engine_family_code
    AND (rc.recall_end_date IS NULL OR rc.recall_end_date > CURRENT_DATE)
  ORDER BY
    CASE rc.recall_severity
      WHEN 'safety' THEN 1
      WHEN 'emissions' THEN 2
      WHEN 'compliance' THEN 3
      ELSE 4
    END,
    rc.recall_start_date DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Vue: Résumé maintenance par famille moteur                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_maintenance_summary AS
SELECT
  ef.family_code,
  ef.family_name,
  ef.fuel_type,
  COUNT(DISTINCT mi.node_id) AS maintenance_count,
  COUNT(DISTINCT rc.node_id) AS active_recalls,
  ARRAY_AGG(DISTINCT mi.maintenance_priority) FILTER (WHERE mi.maintenance_priority IS NOT NULL) AS priorities,
  SUM(mi.estimated_cost_min) AS total_min_cost,
  SUM(mi.estimated_cost_max) AS total_max_cost
FROM kg_engine_families ef
LEFT JOIN kg_edges e1 ON e1.target_node_id = ef.family_id::TEXT::UUID AND e1.edge_type = 'SCHEDULED_FOR'
LEFT JOIN kg_nodes mi ON mi.node_id = e1.source_node_id AND mi.node_type = 'MaintenanceInterval'
LEFT JOIN kg_edges e2 ON e2.target_node_id = ef.family_id::TEXT::UUID AND e2.edge_type = 'AFFECTS'
LEFT JOIN kg_nodes rc ON rc.node_id = e2.source_node_id AND rc.node_type = 'RecallCampaign' AND rc.status = 'active'
WHERE ef.is_active = TRUE
GROUP BY ef.family_code, ef.family_name, ef.fuel_type;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Grants et Comments                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

GRANT EXECUTE ON FUNCTION kg_get_vehicle_maintenance_schedule TO authenticated;
GRANT EXECUTE ON FUNCTION kg_get_vehicle_recalls TO authenticated;

COMMENT ON FUNCTION kg_get_vehicle_maintenance_schedule IS 'Retourne le planning d''entretien pour une famille moteur avec statut (due/overdue/upcoming)';
COMMENT ON FUNCTION kg_get_vehicle_recalls IS 'Retourne les campagnes de rappel actives pour une famille moteur';
COMMENT ON VIEW kg_maintenance_summary IS 'Résumé des entretiens et rappels par famille moteur';

COMMENT ON COLUMN kg_nodes.interval_type IS 'Type d''intervalle: km, months, both';
COMMENT ON COLUMN kg_nodes.km_interval IS 'Intervalle kilométrique pour MaintenanceInterval';
COMMENT ON COLUMN kg_nodes.month_interval IS 'Intervalle en mois pour MaintenanceInterval';
COMMENT ON COLUMN kg_nodes.maintenance_priority IS 'Priorité: critical, important, recommended, optional';
COMMENT ON COLUMN kg_nodes.recall_code IS 'Code de campagne de rappel constructeur';
COMMENT ON COLUMN kg_nodes.recall_severity IS 'Sévérité du rappel: safety, emissions, compliance, quality';

COMMIT;
