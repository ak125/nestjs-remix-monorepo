-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 6: Maintenance Intelligente (Intervals + Risk)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- Au lieu de juste "intervalle km", on ajoute:
--
--   MaintenanceRule:
--     - intervalle_km_base (intervalle standard)
--     - intervalle_temps_base (intervalle temps standard)
--     - facteurs d'usure (urbain, diesel, conduite agressive, charge)
--     - risk_curve (faible → moyen → élevé après X km)
--
--   Résultat:
--     - "Vous êtes à risque ÉLEVÉ" (pas juste "dépassé de X km")
--     - Rappels intelligents basés sur le profil de conduite
--     - Intervalles adaptatifs selon l'utilisation
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Nouveau Node Type: MaintenanceRule                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Ajouter MaintenanceRule au node_type si pas déjà présent
ALTER TABLE kg_nodes DROP CONSTRAINT IF EXISTS kg_nodes_node_type_check;
ALTER TABLE kg_nodes ADD CONSTRAINT kg_nodes_node_type_check
  CHECK (node_type IN (
    'Vehicle', 'System', 'Observable', 'Fault', 'Action', 'Part',
    'EngineFamily', 'MaintenanceInterval', 'RecallCampaign',
    'FaultFamily', 'RootCause', 'PartFitment', 'FaultPartLink',
    'MaintenanceRule'  -- NOUVEAU: Règle de maintenance intelligente
  ));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Champs pour MaintenanceRule (Intervalles adaptatifs)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Intervalle kilométrique BASE (conditions normales)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  km_interval_base INT CHECK (km_interval_base > 0);

-- Intervalle temps BASE (conditions normales)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  month_interval_base INT CHECK (month_interval_base > 0);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Facteurs d'usure (multiplicateurs d'intervalle)                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Facteur conduite urbaine (trajets courts, embouteillages)
-- Ex: 0.7 = réduire l'intervalle de 30% (plus fréquent)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  wear_factor_urban FLOAT DEFAULT 1.0 CHECK (wear_factor_urban > 0 AND wear_factor_urban <= 2.0);

-- Facteur diesel (suies, FAP, EGR)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  wear_factor_diesel FLOAT DEFAULT 1.0 CHECK (wear_factor_diesel > 0 AND wear_factor_diesel <= 2.0);

-- Facteur conduite sportive/agressive
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  wear_factor_aggressive FLOAT DEFAULT 1.0 CHECK (wear_factor_aggressive > 0 AND wear_factor_aggressive <= 2.0);

-- Facteur charge lourde (remorque, surcharge fréquente)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  wear_factor_heavy_load FLOAT DEFAULT 1.0 CHECK (wear_factor_heavy_load > 0 AND wear_factor_heavy_load <= 2.0);

-- Facteur conditions extrêmes (montagne, climat rude)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  wear_factor_extreme FLOAT DEFAULT 1.0 CHECK (wear_factor_extreme > 0 AND wear_factor_extreme <= 2.0);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Courbe de risque (Risk Curve)                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Seuils de risque en % de l'intervalle
-- Ex: risk_threshold_medium = 0.8 → risque moyen à 80% de l'intervalle
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  risk_threshold_medium FLOAT DEFAULT 0.8 CHECK (risk_threshold_medium > 0 AND risk_threshold_medium <= 1.0);

-- Seuil risque élevé (souvent à 100% ou légèrement au-delà)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  risk_threshold_high FLOAT DEFAULT 1.0 CHECK (risk_threshold_high > 0 AND risk_threshold_high <= 1.5);

-- Seuil risque critique (dépassement important)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  risk_threshold_critical FLOAT DEFAULT 1.2 CHECK (risk_threshold_critical > 0 AND risk_threshold_critical <= 2.0);

-- Pente de dégradation (vitesse de montée du risque)
-- Ex: 0.5 = risque monte lentement, 2.0 = risque monte vite après dépassement
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  risk_slope FLOAT DEFAULT 1.0 CHECK (risk_slope > 0 AND risk_slope <= 5.0);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Type énuméré pour le niveau de risque                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP TYPE IF EXISTS kg_risk_level CASCADE;
CREATE TYPE kg_risk_level AS ENUM ('low', 'medium', 'high', 'critical');

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Profil d'utilisation véhicule (table dédiée)                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_vehicle_usage_profiles (
  profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiant véhicule ou utilisateur
  vehicle_id UUID,                          -- Si lié à un véhicule spécifique
  user_id TEXT,                              -- Ou à un utilisateur

  -- Profil d'utilisation (booléens et scores)
  is_urban BOOLEAN DEFAULT FALSE,            -- Conduite principalement urbaine
  is_diesel BOOLEAN DEFAULT FALSE,           -- Moteur diesel
  is_aggressive_driver BOOLEAN DEFAULT FALSE,-- Conduite sportive
  is_heavy_load BOOLEAN DEFAULT FALSE,       -- Charge fréquente
  is_extreme_conditions BOOLEAN DEFAULT FALSE,-- Conditions extrêmes

  -- Scores de 0 à 1 pour nuance
  urban_score FLOAT DEFAULT 0.5 CHECK (urban_score >= 0 AND urban_score <= 1),
  aggressive_score FLOAT DEFAULT 0.3 CHECK (aggressive_score >= 0 AND aggressive_score <= 1),
  load_score FLOAT DEFAULT 0.2 CHECK (load_score >= 0 AND load_score <= 1),
  extreme_score FLOAT DEFAULT 0.1 CHECK (extreme_score >= 0 AND extreme_score <= 1),

  -- Kilométrage annuel moyen (pour prédiction)
  annual_km_estimate INT DEFAULT 15000,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: soit vehicle_id soit user_id
  CONSTRAINT usage_profile_target CHECK (vehicle_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_kg_usage_profiles_vehicle ON kg_vehicle_usage_profiles(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_kg_usage_profiles_user ON kg_vehicle_usage_profiles(user_id);

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Fonction: Calculer l'intervalle adapté selon le profil                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_calculate_adapted_interval(
  p_rule_id UUID,
  p_profile_id UUID DEFAULT NULL,
  p_is_urban BOOLEAN DEFAULT FALSE,
  p_is_diesel BOOLEAN DEFAULT FALSE,
  p_is_aggressive BOOLEAN DEFAULT FALSE,
  p_is_heavy_load BOOLEAN DEFAULT FALSE,
  p_is_extreme BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  adapted_km_interval INT,
  adapted_month_interval INT,
  wear_factor_total FLOAT,
  wear_factors_applied JSONB
) AS $$
DECLARE
  v_rule RECORD;
  v_profile RECORD;
  v_factor FLOAT := 1.0;
  v_factors_applied JSONB := '{}';
BEGIN
  -- Récupérer la règle
  SELECT *
  INTO v_rule
  FROM kg_nodes
  WHERE node_id = p_rule_id
    AND node_type = 'MaintenanceRule'
    AND status = 'active';

  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'MaintenanceRule not found: %', p_rule_id;
  END IF;

  -- Si profil fourni, l'utiliser
  IF p_profile_id IS NOT NULL THEN
    SELECT *
    INTO v_profile
    FROM kg_vehicle_usage_profiles
    WHERE profile_id = p_profile_id;

    IF v_profile IS NOT NULL THEN
      p_is_urban := v_profile.is_urban;
      p_is_diesel := v_profile.is_diesel;
      p_is_aggressive := v_profile.is_aggressive_driver;
      p_is_heavy_load := v_profile.is_heavy_load;
      p_is_extreme := v_profile.is_extreme_conditions;
    END IF;
  END IF;

  -- Calculer le facteur total
  IF p_is_urban AND v_rule.wear_factor_urban IS NOT NULL THEN
    v_factor := v_factor * v_rule.wear_factor_urban;
    v_factors_applied := v_factors_applied || jsonb_build_object('urban', v_rule.wear_factor_urban);
  END IF;

  IF p_is_diesel AND v_rule.wear_factor_diesel IS NOT NULL THEN
    v_factor := v_factor * v_rule.wear_factor_diesel;
    v_factors_applied := v_factors_applied || jsonb_build_object('diesel', v_rule.wear_factor_diesel);
  END IF;

  IF p_is_aggressive AND v_rule.wear_factor_aggressive IS NOT NULL THEN
    v_factor := v_factor * v_rule.wear_factor_aggressive;
    v_factors_applied := v_factors_applied || jsonb_build_object('aggressive', v_rule.wear_factor_aggressive);
  END IF;

  IF p_is_heavy_load AND v_rule.wear_factor_heavy_load IS NOT NULL THEN
    v_factor := v_factor * v_rule.wear_factor_heavy_load;
    v_factors_applied := v_factors_applied || jsonb_build_object('heavy_load', v_rule.wear_factor_heavy_load);
  END IF;

  IF p_is_extreme AND v_rule.wear_factor_extreme IS NOT NULL THEN
    v_factor := v_factor * v_rule.wear_factor_extreme;
    v_factors_applied := v_factors_applied || jsonb_build_object('extreme', v_rule.wear_factor_extreme);
  END IF;

  RETURN QUERY
  SELECT
    ROUND(COALESCE(v_rule.km_interval_base, v_rule.km_interval) * v_factor)::INT,
    ROUND(COALESCE(v_rule.month_interval_base, v_rule.month_interval) * v_factor)::INT,
    v_factor,
    v_factors_applied;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Fonction: Calculer le niveau de risque                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_calculate_risk_level(
  p_rule_id UUID,
  p_current_km INT,
  p_last_maintenance_km INT,
  p_current_date DATE DEFAULT CURRENT_DATE,
  p_last_maintenance_date DATE DEFAULT NULL,
  p_profile_id UUID DEFAULT NULL
)
RETURNS TABLE (
  risk_level kg_risk_level,
  risk_score FLOAT,                -- 0-100
  km_progress_pct FLOAT,           -- % de l'intervalle km parcouru
  time_progress_pct FLOAT,         -- % de l'intervalle temps écoulé
  km_until_due INT,
  days_until_due INT,
  adapted_km_interval INT,
  adapted_month_interval INT,
  risk_message TEXT,
  urgency_color TEXT               -- green, yellow, orange, red
) AS $$
DECLARE
  v_rule RECORD;
  v_adapted RECORD;
  v_km_since_last INT;
  v_months_since_last FLOAT;
  v_km_pct FLOAT;
  v_time_pct FLOAT;
  v_max_pct FLOAT;
  v_risk_score FLOAT;
  v_risk kg_risk_level;
  v_message TEXT;
  v_color TEXT;
BEGIN
  -- Récupérer la règle
  SELECT *
  INTO v_rule
  FROM kg_nodes
  WHERE node_id = p_rule_id
    AND node_type IN ('MaintenanceRule', 'MaintenanceInterval')
    AND status = 'active';

  IF v_rule IS NULL THEN
    RAISE EXCEPTION 'Maintenance rule not found: %', p_rule_id;
  END IF;

  -- Calculer l'intervalle adapté
  SELECT * INTO v_adapted
  FROM kg_calculate_adapted_interval(p_rule_id, p_profile_id);

  -- Calcul du temps écoulé
  v_km_since_last := p_current_km - p_last_maintenance_km;
  IF p_last_maintenance_date IS NOT NULL THEN
    v_months_since_last := EXTRACT(EPOCH FROM (p_current_date - p_last_maintenance_date)) / (30.44 * 24 * 60 * 60);
  ELSE
    v_months_since_last := 0;
  END IF;

  -- Pourcentages d'avancement
  IF v_adapted.adapted_km_interval > 0 THEN
    v_km_pct := v_km_since_last::FLOAT / v_adapted.adapted_km_interval;
  ELSE
    v_km_pct := 0;
  END IF;

  IF v_adapted.adapted_month_interval > 0 THEN
    v_time_pct := v_months_since_last / v_adapted.adapted_month_interval;
  ELSE
    v_time_pct := 0;
  END IF;

  -- Prendre le pire des deux
  v_max_pct := GREATEST(v_km_pct, v_time_pct);

  -- Calculer le score de risque (0-100)
  -- Utiliser la pente pour accélérer la montée après dépassement
  IF v_max_pct <= COALESCE(v_rule.risk_threshold_medium, 0.8) THEN
    -- Zone verte → jaune
    v_risk_score := (v_max_pct / COALESCE(v_rule.risk_threshold_medium, 0.8)) * 40;
  ELSIF v_max_pct <= COALESCE(v_rule.risk_threshold_high, 1.0) THEN
    -- Zone jaune → orange
    v_risk_score := 40 + ((v_max_pct - COALESCE(v_rule.risk_threshold_medium, 0.8))
      / (COALESCE(v_rule.risk_threshold_high, 1.0) - COALESCE(v_rule.risk_threshold_medium, 0.8))) * 30;
  ELSIF v_max_pct <= COALESCE(v_rule.risk_threshold_critical, 1.2) THEN
    -- Zone orange → rouge
    v_risk_score := 70 + ((v_max_pct - COALESCE(v_rule.risk_threshold_high, 1.0))
      / (COALESCE(v_rule.risk_threshold_critical, 1.2) - COALESCE(v_rule.risk_threshold_high, 1.0))) * 20
      * COALESCE(v_rule.risk_slope, 1.0);
  ELSE
    -- Zone critique (au-delà du seuil critique)
    v_risk_score := 90 + LEAST(10, (v_max_pct - COALESCE(v_rule.risk_threshold_critical, 1.2)) * 50
      * COALESCE(v_rule.risk_slope, 1.0));
  END IF;

  v_risk_score := LEAST(100, GREATEST(0, v_risk_score));

  -- Déterminer le niveau de risque
  IF v_risk_score < 40 THEN
    v_risk := 'low';
    v_message := 'Entretien dans les temps';
    v_color := 'green';
  ELSIF v_risk_score < 70 THEN
    v_risk := 'medium';
    v_message := 'Entretien à prévoir prochainement';
    v_color := 'yellow';
  ELSIF v_risk_score < 90 THEN
    v_risk := 'high';
    v_message := 'Entretien recommandé rapidement';
    v_color := 'orange';
  ELSE
    v_risk := 'critical';
    v_message := 'ENTRETIEN URGENT - Risque de panne élevé';
    v_color := 'red';
  END IF;

  RETURN QUERY
  SELECT
    v_risk,
    ROUND(v_risk_score::NUMERIC, 1)::FLOAT,
    ROUND((v_km_pct * 100)::NUMERIC, 1)::FLOAT,
    ROUND((v_time_pct * 100)::NUMERIC, 1)::FLOAT,
    GREATEST(0, v_adapted.adapted_km_interval - v_km_since_last)::INT,
    GREATEST(0, (v_adapted.adapted_month_interval * 30.44 - v_months_since_last * 30.44))::INT,
    v_adapted.adapted_km_interval,
    v_adapted.adapted_month_interval,
    v_message,
    v_color;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Fonction: Planning complet avec risques                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP TYPE IF EXISTS kg_smart_maintenance_item CASCADE;
CREATE TYPE kg_smart_maintenance_item AS (
  rule_id UUID,
  label TEXT,
  category TEXT,
  maintenance_priority TEXT,

  -- Intervalles
  base_km_interval INT,
  base_month_interval INT,
  adapted_km_interval INT,
  adapted_month_interval INT,
  wear_factors_applied JSONB,

  -- Progression
  km_since_last INT,
  months_since_last FLOAT,
  km_progress_pct FLOAT,
  time_progress_pct FLOAT,

  -- Risque
  risk_level TEXT,
  risk_score FLOAT,
  risk_message TEXT,
  urgency_color TEXT,

  -- Prédiction
  km_until_due INT,
  days_until_due INT,
  predicted_due_date DATE,

  -- Coûts
  estimated_cost_min FLOAT,
  estimated_cost_max FLOAT,

  -- Détails
  operations JSONB,
  related_parts JSONB
);

CREATE OR REPLACE FUNCTION kg_get_smart_maintenance_schedule(
  p_engine_family_code TEXT,
  p_current_km INT,
  p_profile_id UUID DEFAULT NULL,
  p_last_maintenance_records JSONB DEFAULT '[]'  -- [{rule_id, km, date}, ...]
)
RETURNS SETOF kg_smart_maintenance_item AS $$
DECLARE
  v_rule RECORD;
  v_adapted RECORD;
  v_risk RECORD;
  v_last_km INT;
  v_last_date DATE;
  v_result kg_smart_maintenance_item;
BEGIN
  FOR v_rule IN
    SELECT
      mr.node_id,
      mr.node_label,
      mr.node_category,
      mr.maintenance_priority,
      COALESCE(mr.km_interval_base, mr.km_interval) AS km_interval_base,
      COALESCE(mr.month_interval_base, mr.month_interval) AS month_interval_base,
      mr.estimated_cost_min,
      mr.estimated_cost_max,
      mr.node_data AS operations
    FROM kg_nodes mr
    LEFT JOIN kg_edges e ON e.source_node_id = mr.node_id
      AND e.edge_type = 'SCHEDULED_FOR'
      AND e.status = 'active'
    LEFT JOIN kg_engine_families ef ON ef.family_id = e.target_node_id::UUID
    WHERE mr.node_type IN ('MaintenanceRule', 'MaintenanceInterval')
      AND mr.status = 'active'
      AND (ef.family_code = p_engine_family_code OR e.edge_id IS NULL)
  LOOP
    -- Récupérer le dernier entretien pour cette règle
    SELECT
      (record->>'km')::INT,
      (record->>'date')::DATE
    INTO v_last_km, v_last_date
    FROM jsonb_array_elements(p_last_maintenance_records) AS record
    WHERE (record->>'rule_id')::UUID = v_rule.node_id
    LIMIT 1;

    v_last_km := COALESCE(v_last_km, 0);
    v_last_date := COALESCE(v_last_date, CURRENT_DATE - INTERVAL '3 years');

    -- Calculer l'intervalle adapté
    SELECT * INTO v_adapted
    FROM kg_calculate_adapted_interval(v_rule.node_id, p_profile_id);

    -- Calculer le risque
    SELECT * INTO v_risk
    FROM kg_calculate_risk_level(
      v_rule.node_id,
      p_current_km,
      v_last_km,
      CURRENT_DATE,
      v_last_date,
      p_profile_id
    );

    -- Construire le résultat
    v_result.rule_id := v_rule.node_id;
    v_result.label := v_rule.node_label;
    v_result.category := v_rule.node_category;
    v_result.maintenance_priority := v_rule.maintenance_priority;
    v_result.base_km_interval := v_rule.km_interval_base;
    v_result.base_month_interval := v_rule.month_interval_base;
    v_result.adapted_km_interval := v_adapted.adapted_km_interval;
    v_result.adapted_month_interval := v_adapted.adapted_month_interval;
    v_result.wear_factors_applied := v_adapted.wear_factors_applied;
    v_result.km_since_last := p_current_km - v_last_km;
    v_result.months_since_last := EXTRACT(EPOCH FROM (CURRENT_DATE - v_last_date)) / (30.44 * 24 * 60 * 60);
    v_result.km_progress_pct := v_risk.km_progress_pct;
    v_result.time_progress_pct := v_risk.time_progress_pct;
    v_result.risk_level := v_risk.risk_level::TEXT;
    v_result.risk_score := v_risk.risk_score;
    v_result.risk_message := v_risk.risk_message;
    v_result.urgency_color := v_risk.urgency_color;
    v_result.km_until_due := v_risk.km_until_due;
    v_result.days_until_due := v_risk.days_until_due;
    v_result.predicted_due_date := CURRENT_DATE + (v_risk.days_until_due || ' days')::INTERVAL;
    v_result.estimated_cost_min := v_rule.estimated_cost_min;
    v_result.estimated_cost_max := v_rule.estimated_cost_max;
    v_result.operations := v_rule.operations;

    -- Récupérer les pièces associées
    SELECT JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'part_id', p.node_id,
        'label', p.node_label,
        'pg_id', p.node_data->>'pg_id'
      )
    )
    INTO v_result.related_parts
    FROM kg_edges e
    JOIN kg_nodes p ON p.node_id = e.target_node_id AND p.node_type = 'Part'
    WHERE e.source_node_id = v_rule.node_id
      AND e.edge_type = 'REQUIRES_PART'
      AND e.status = 'active';

    RETURN NEXT v_result;
  END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. Données initiales: MaintenanceRule avec facteurs d'usure              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO kg_nodes (
  node_type, node_label, node_alias, node_category,
  km_interval_base, month_interval_base,
  wear_factor_urban, wear_factor_diesel, wear_factor_aggressive, wear_factor_heavy_load, wear_factor_extreme,
  risk_threshold_medium, risk_threshold_high, risk_threshold_critical, risk_slope,
  maintenance_priority, estimated_cost_min, estimated_cost_max,
  status, source_type, confidence_base, node_data
) VALUES
  -- Vidange moteur avec facteurs
  ('MaintenanceRule', 'Vidange moteur intelligente', 'vidange-smart', 'engine',
   15000, 12,  -- Base: 15000km / 12 mois
   0.7,   -- Urbain: -30% (plus fréquent)
   0.85,  -- Diesel: -15%
   0.8,   -- Agressif: -20%
   0.9,   -- Charge: -10%
   0.85,  -- Extrême: -15%
   0.75, 0.95, 1.15, 1.5,  -- Seuils risque et pente
   'important', 60, 150,
   'active', 'oem', 0.95,
   '{"operations": ["Vidange huile", "Filtre huile"], "oil_specs": {"essence": "5W30", "diesel": "5W30 C3"}}'::JSONB),

  -- Courroie distribution (critique)
  ('MaintenanceRule', 'Courroie de distribution', 'distribution-smart', 'engine',
   120000, 60,  -- Base: 120000km / 5 ans
   0.9,   -- Urbain: peu d'impact
   1.0,   -- Diesel: normal
   0.85,  -- Agressif: -15%
   0.95,  -- Charge: léger impact
   0.8,   -- Extrême: -20% (important!)
   0.7, 0.9, 1.05, 3.0,  -- Risque monte VITE après 90%
   'critical', 400, 900,
   'active', 'oem', 0.98,
   '{"operations": ["Courroie", "Galets tendeur/enrouleur", "Pompe à eau recommandée"], "warning": "CASSE = DESTRUCTION MOTEUR", "critical": true}'::JSONB),

  -- Freinage (sécurité)
  ('MaintenanceRule', 'Système de freinage', 'freinage-smart', 'safety',
   30000, 24,  -- Base: 30000km / 2 ans
   0.6,   -- Urbain: -40% (beaucoup de freinages)
   0.95,  -- Diesel: peu d'impact
   0.5,   -- Agressif: -50% (gros impact!)
   0.7,   -- Charge: -30%
   0.85,  -- Extrême: -15%
   0.7, 0.85, 1.0, 2.0,  -- Seuils serrés (sécurité)
   'critical', 0, 80,
   'active', 'oem', 0.95,
   '{"operations": ["Contrôle épaisseur plaquettes", "Contrôle disques", "Niveau/état liquide"], "min_thickness_mm": 3}'::JSONB),

  -- Filtres (entretien régulier)
  ('MaintenanceRule', 'Filtration moteur', 'filtres-smart', 'engine',
   30000, 24,  -- Base: 30000km / 2 ans
   0.7,   -- Urbain: -30% (pollution)
   0.75,  -- Diesel: -25% (suies)
   0.9,   -- Agressif: léger impact
   0.95,  -- Charge: peu d'impact
   0.7,   -- Extrême: -30% (poussière)
   0.8, 1.0, 1.3, 1.0,  -- Seuils standards
   'recommended', 40, 100,
   'active', 'oem', 0.90,
   '{"operations": ["Filtre à air", "Filtre habitacle", "Filtre carburant si applicable"]}'::JSONB),

  -- Climatisation
  ('MaintenanceRule', 'Climatisation', 'clim-smart', 'comfort',
   NULL, 24,  -- Base: tous les 2 ans (pas de km)
   0.8,   -- Urbain: -20% (utilisation fréquente)
   1.0,   -- Diesel: pas d'impact
   1.0,   -- Agressif: pas d'impact
   1.0,   -- Charge: pas d'impact
   0.7,   -- Extrême: -30% (forte chaleur)
   0.85, 1.1, 1.5, 0.8,  -- Seuils souples
   'optional', 80, 180,
   'active', 'manual', 0.85,
   '{"operations": ["Contrôle pression", "Recharge gaz", "Nettoyage évaporateur si nécessaire"], "gaz_types": ["R134a", "R1234yf"]}'::JSONB),

  -- Liquide de frein (temps-critique)
  ('MaintenanceRule', 'Liquide de frein', 'ldf-smart', 'safety',
   NULL, 24,  -- Base: tous les 2 ans (indépendant km)
   1.0,   -- Urbain: pas d'impact
   1.0,   -- Diesel: pas d'impact
   0.9,   -- Agressif: -10% (surchauffe freins)
   1.0,   -- Charge: pas d'impact
   0.85,  -- Extrême: -15% (humidité/chaleur)
   0.75, 0.9, 1.05, 2.5,  -- Très critique si dépassé
   'critical', 50, 100,
   'active', 'oem', 0.95,
   '{"operations": ["Purge circuit", "Remplacement DOT4/DOT5.1"], "warning": "Hygroscopique - absorbe l''humidité"}'::JSONB)
ON CONFLICT DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 11. Vue: Tableau de bord maintenance intelligente                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE VIEW kg_maintenance_risk_dashboard AS
SELECT
  mr.node_id AS rule_id,
  mr.node_label AS rule_name,
  mr.node_category AS category,
  mr.maintenance_priority AS priority,
  mr.km_interval_base,
  mr.month_interval_base,
  mr.wear_factor_urban,
  mr.wear_factor_diesel,
  mr.wear_factor_aggressive,
  mr.risk_threshold_medium,
  mr.risk_threshold_high,
  mr.risk_threshold_critical,
  mr.risk_slope,
  mr.estimated_cost_min,
  mr.estimated_cost_max
FROM kg_nodes mr
WHERE mr.node_type = 'MaintenanceRule'
  AND mr.status = 'active'
ORDER BY
  CASE mr.maintenance_priority
    WHEN 'critical' THEN 1
    WHEN 'important' THEN 2
    WHEN 'recommended' THEN 3
    ELSE 4
  END;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 12. RLS et Grants                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE kg_vehicle_usage_profiles ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir/modifier leur propre profil
CREATE POLICY "usage_profiles_own" ON kg_vehicle_usage_profiles
  FOR ALL TO authenticated
  USING (user_id = current_user OR user_id IS NULL);

-- Service role peut tout faire
CREATE POLICY "usage_profiles_service" ON kg_vehicle_usage_profiles
  FOR ALL TO service_role USING (true);

GRANT EXECUTE ON FUNCTION kg_calculate_adapted_interval TO authenticated;
GRANT EXECUTE ON FUNCTION kg_calculate_risk_level TO authenticated;
GRANT EXECUTE ON FUNCTION kg_get_smart_maintenance_schedule TO authenticated;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 13. Comments                                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON TABLE kg_vehicle_usage_profiles IS 'Profils d''utilisation véhicule pour calcul d''intervalles adaptés';

COMMENT ON COLUMN kg_nodes.km_interval_base IS 'Intervalle km de base (conditions normales) pour MaintenanceRule';
COMMENT ON COLUMN kg_nodes.wear_factor_urban IS 'Multiplicateur pour conduite urbaine (< 1 = intervalle réduit)';
COMMENT ON COLUMN kg_nodes.wear_factor_diesel IS 'Multiplicateur pour moteurs diesel';
COMMENT ON COLUMN kg_nodes.wear_factor_aggressive IS 'Multiplicateur pour conduite sportive/agressive';
COMMENT ON COLUMN kg_nodes.wear_factor_heavy_load IS 'Multiplicateur pour charge lourde fréquente';
COMMENT ON COLUMN kg_nodes.wear_factor_extreme IS 'Multiplicateur pour conditions extrêmes (montagne, climat rude)';
COMMENT ON COLUMN kg_nodes.risk_threshold_medium IS 'Seuil (0-1) pour passage en risque moyen';
COMMENT ON COLUMN kg_nodes.risk_threshold_high IS 'Seuil (0-1.5) pour passage en risque élevé';
COMMENT ON COLUMN kg_nodes.risk_threshold_critical IS 'Seuil (0-2) pour passage en risque critique';
COMMENT ON COLUMN kg_nodes.risk_slope IS 'Pente de dégradation (1=linéaire, >1=exponentiel)';

COMMENT ON FUNCTION kg_calculate_adapted_interval IS 'Calcule l''intervalle d''entretien adapté au profil d''utilisation';
COMMENT ON FUNCTION kg_calculate_risk_level IS 'Calcule le niveau de risque (low/medium/high/critical) pour un entretien';
COMMENT ON FUNCTION kg_get_smart_maintenance_schedule IS 'Retourne le planning d''entretien intelligent avec risques calculés';

COMMIT;
