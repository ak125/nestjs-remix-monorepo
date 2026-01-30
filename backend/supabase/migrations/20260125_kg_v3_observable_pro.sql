-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 🧠 KNOWLEDGE GRAPH v3.0 - Phase 1: Observable Pro + Contextes Normalisés
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 3 types d'inputs avec fiabilités différentes:
--   - symptom: Ressenti utilisateur (confidence 0.50-0.70)
--   - sign: Constat technicien (confidence 0.80-0.90)
--   - dtc: Code OBD électronique (confidence 0.92-0.98)
--
-- Contextes normalisés (taxonomie contrôlée, PAS de JSONB libre):
--   - ctx_phase: demarrage, ralenti, acceleration, freinage, virage, vitesse_stable, arret
--   - ctx_temp: froid, chaud, any
--   - ctx_speed: 0_30, 30_70, 70_110, 110_plus, any
--   - ctx_road: lisse, degradee, pluie, neige, any
--   - ctx_load: seul, charge, montee, descente, any
--
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BEGIN;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 1. Observable Pro: input_type + perception_channel + intensity            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Type d'input: symptom (subjectif), sign (objectif), dtc (électronique)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  input_type TEXT CHECK (input_type IN ('symptom', 'sign', 'dtc'));

-- Canal de perception
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  perception_channel TEXT CHECK (perception_channel IN (
    'visual',       -- Visuel (fumée, fuite, voyant)
    'auditory',     -- Auditif (bruit, claquement, sifflement)
    'olfactory',    -- Olfactif (odeur brûlée, essence)
    'tactile',      -- Tactile (vibrations, à-coups, volant dur)
    'electronic',   -- Électronique (DTC, valise OBD)
    'performance'   -- Performance (perte puissance, consommation)
  ));

-- Intensité perçue (1-5)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  intensity INT CHECK (intensity >= 1 AND intensity <= 5);

-- Niveau de risque (aligné avec RAG existant)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  risk_level TEXT CHECK (risk_level IN ('confort', 'securite', 'critique'));

-- Code DTC pour les observables électroniques (P0300, C1234, B0001, U0100...)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  dtc_code TEXT;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 2. Contextes Normalisés (taxonomie contrôlée)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Phase de conduite quand le symptôme apparaît
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  ctx_phase TEXT CHECK (ctx_phase IN (
    'demarrage',      -- Au démarrage moteur
    'ralenti',        -- Moteur au ralenti
    'acceleration',   -- En accélération
    'freinage',       -- Au freinage
    'virage',         -- En virage
    'vitesse_stable', -- Vitesse stabilisée
    'arret',          -- Véhicule à l'arrêt
    'any'             -- N'importe quand
  ));

-- Température moteur
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  ctx_temp TEXT CHECK (ctx_temp IN (
    'froid',  -- Moteur froid (< 60°C)
    'chaud',  -- Moteur chaud (> 80°C)
    'any'     -- Indifférent
  ));

-- Plage de vitesse (km/h)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  ctx_speed TEXT CHECK (ctx_speed IN (
    '0_30',      -- Ville lente
    '30_70',     -- Ville/route
    '70_110',    -- Route/autoroute
    '110_plus',  -- Autoroute
    'any'        -- Toutes vitesses
  ));

-- État de la route
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  ctx_road TEXT CHECK (ctx_road IN (
    'lisse',     -- Route en bon état
    'degradee',  -- Route dégradée, nids de poule
    'pluie',     -- Route mouillée
    'neige',     -- Route enneigée/verglacée
    'any'        -- Indifférent
  ));

-- Charge du véhicule
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  ctx_load TEXT CHECK (ctx_load IN (
    'seul',      -- Conducteur seul
    'charge',    -- Véhicule chargé (passagers/bagages)
    'montee',    -- En montée (côte)
    'descente',  -- En descente
    'any'        -- Indifférent
  ));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3. Extension des Node Types (incluant Fault Taxonomy)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Ajouter les nouveaux types de nodes (incluant FaultFamily, RootCause et Compatibility Layer)
ALTER TABLE kg_nodes DROP CONSTRAINT IF EXISTS kg_nodes_node_type_check;
ALTER TABLE kg_nodes ADD CONSTRAINT kg_nodes_node_type_check
  CHECK (node_type IN (
    'Vehicle',              -- Véhicule spécifique
    'System',               -- Système (freinage, refroidissement, etc.)
    'Observable',           -- Symptôme/Signe/DTC observable
    'Fault',                -- Panne/défaillance identifiée
    'Action',               -- Action de réparation
    'Part',                 -- Pièce de rechange
    'EngineFamily',         -- Famille moteur (K9K, PureTech, D4F...)
    'MaintenanceInterval',  -- Intervalle d'entretien
    'RecallCampaign',       -- Campagne de rappel constructeur
    'FaultFamily',          -- Catégorie métier de pannes (Freinage, Refroidissement...)
    'RootCause',            -- Cause racine (Surchauffe, Montage incorrect...)
    'PartFitment',          -- Compatibilité pièce/véhicule (year, oem_codes, ktype)
    'FaultPartLink'         -- Lien panne → pièce (priority, effectiveness)
  ));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3b. Champs spécifiques RootCause (Taxonomie des pannes)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Catégorie de cause racine
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  root_cause_category TEXT CHECK (root_cause_category IN (
    'usage',        -- Conduite agressive, surcharge
    'installation', -- Montage incorrect, couple non respecté
    'quality',      -- Pièce défectueuse, contrefaçon
    'wear',         -- Usure normale, kilométrage
    'external'      -- Accident, conditions extrêmes
  ));

-- Impact sur la garantie (crucial pour SAV)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  warranty_impact TEXT CHECK (warranty_impact IN (
    'applicable',      -- Garantie applicable
    'partial',         -- Garantie partielle
    'non_applicable'   -- Garantie non applicable
  ));

-- Fréquence observée de la cause
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  frequency TEXT CHECK (frequency IN (
    'rare',           -- < 5% des cas
    'occasional',     -- 5-20% des cas
    'frequent',       -- 20-50% des cas
    'very_frequent'   -- > 50% des cas
  ));

-- Préventable par le client
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  is_preventable BOOLEAN DEFAULT FALSE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3c. Champs spécifiques Action (Structurées et Réutilisables)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Type d'action
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  action_type TEXT CHECK (action_type IN (
    'controle',       -- Vérification visuelle/mesure
    'remplacement',   -- Changement de pièce
    'nettoyage',      -- Nettoyage/décalaminage
    'purge',          -- Purge circuit (frein, clim)
    'test_routier',   -- Essai sur route
    'reglage'         -- Réglage/calibration
  ));

-- Durée estimée
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  estimated_duration TEXT CHECK (estimated_duration IN (
    '15min', '30min', '45min', '1h', '1h30', '2h', '3h', '4h', '1j'
  ));

-- Urgence de l'action
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  urgency TEXT CHECK (urgency IN (
    'immediate',   -- À faire immédiatement (sécurité)
    'soon',        -- Dans les prochains jours
    'scheduled'    -- À planifier lors du prochain entretien
  ));

-- Niveau de sécurité (impact)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  safety_level TEXT CHECK (safety_level IN (
    'critical',    -- Impact sécurité direct
    'important',   -- Impact fiabilité/durabilité
    'normal'       -- Confort/esthétique
  ));

-- Prérequis (JSON array)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  prerequisites JSONB DEFAULT '[]';

-- Outils requis (JSON array)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  tools_required JSONB DEFAULT '[]';

-- Niveau de compétence requis
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  skill_level TEXT CHECK (skill_level IN (
    'diy',          -- Particulier avec bases
    'amateur',      -- Amateur éclairé
    'professional'  -- Professionnel uniquement
  ));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 3d. Compatibility Layer (PartFitment + FaultPartLink)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Champs spécifiques PartFitment (compatibilité pièce/véhicule)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  year_from INT CHECK (year_from >= 1970 AND year_from <= 2050);

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  year_to INT CHECK (year_to >= 1970 AND year_to <= 2050);

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  oem_codes TEXT[];  -- Codes OEM constructeur (ex: ["7701206339", "4246W5"])

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  ktype_ids INT[];   -- IDs TecDoc KType

-- Champs spécifiques FaultPartLink (lien panne → pièce)
ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  part_priority TEXT CHECK (part_priority IN (
    'primary',      -- Solution recommandée (meilleur rapport qualité/efficacité)
    'alternative',  -- Alternative valide (qualité équivalente)
    'budget'        -- Option économique (efficace mais moins durable)
  ));

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  effectiveness FLOAT CHECK (effectiveness >= 0 AND effectiveness <= 1);

ALTER TABLE kg_nodes ADD COLUMN IF NOT EXISTS
  replacement_type TEXT CHECK (replacement_type IN (
    'single',  -- Pièce unique
    'pair',    -- Par paire (freins, amortisseurs)
    'set',     -- Jeu complet (bougies x4)
    'kit'      -- Kit avec accessoires
  ));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 4. Index optimisés pour requêtes contextuelles                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Index pour codes DTC
CREATE INDEX IF NOT EXISTS idx_kg_nodes_dtc_code
  ON kg_nodes(dtc_code)
  WHERE dtc_code IS NOT NULL;

-- Index pour type d'input
CREATE INDEX IF NOT EXISTS idx_kg_nodes_input_type
  ON kg_nodes(input_type)
  WHERE node_type = 'Observable';

-- Index composite principal pour requêtes contextuelles
-- (le plus utilisé : "symptômes au freinage entre 70-110 km/h")
CREATE INDEX IF NOT EXISTS idx_kg_nodes_context_composite
  ON kg_nodes(ctx_phase, ctx_temp, ctx_speed)
  WHERE node_type = 'Observable' AND status = 'active';

-- Index secondaire par phase (recherche par phase uniquement)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_ctx_phase
  ON kg_nodes(ctx_phase)
  WHERE ctx_phase IS NOT NULL AND ctx_phase != 'any';

-- Index secondaire par vitesse (recherche shimmy, vibrations à haute vitesse)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_ctx_speed
  ON kg_nodes(ctx_speed)
  WHERE ctx_speed IS NOT NULL AND ctx_speed != 'any';

-- Index pour risk_level (priorisation des diagnostics)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_risk_level
  ON kg_nodes(risk_level)
  WHERE risk_level IS NOT NULL;

-- Index pour perception_channel (recherche par type de perception)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_perception
  ON kg_nodes(perception_channel)
  WHERE perception_channel IS NOT NULL;

-- Index pour Fault Taxonomy
CREATE INDEX IF NOT EXISTS idx_kg_nodes_fault_family
  ON kg_nodes(node_type)
  WHERE node_type = 'FaultFamily';

CREATE INDEX IF NOT EXISTS idx_kg_nodes_root_cause
  ON kg_nodes(node_type, root_cause_category)
  WHERE node_type = 'RootCause';

CREATE INDEX IF NOT EXISTS idx_kg_nodes_warranty
  ON kg_nodes(warranty_impact)
  WHERE warranty_impact IS NOT NULL;

-- Index pour Actions structurées
CREATE INDEX IF NOT EXISTS idx_kg_nodes_action_type
  ON kg_nodes(action_type)
  WHERE node_type = 'Action';

CREATE INDEX IF NOT EXISTS idx_kg_nodes_urgency
  ON kg_nodes(urgency)
  WHERE urgency IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kg_nodes_skill_level
  ON kg_nodes(skill_level)
  WHERE skill_level IS NOT NULL;

-- Index pour Compatibility Layer (recherche rapide compatibilité)
CREATE INDEX IF NOT EXISTS idx_kg_nodes_oem_codes
  ON kg_nodes USING GIN(oem_codes)
  WHERE oem_codes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kg_nodes_ktype_ids
  ON kg_nodes USING GIN(ktype_ids)
  WHERE ktype_ids IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kg_nodes_fitment_years
  ON kg_nodes(year_from, year_to)
  WHERE node_type = 'PartFitment';

CREATE INDEX IF NOT EXISTS idx_kg_nodes_part_priority
  ON kg_nodes(part_priority)
  WHERE node_type = 'FaultPartLink';

CREATE INDEX IF NOT EXISTS idx_kg_nodes_effectiveness
  ON kg_nodes(effectiveness DESC)
  WHERE node_type = 'FaultPartLink';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 5. Extension des Edge Types (incluant Fault Taxonomy)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Ajouter les nouveaux types de relations
ALTER TABLE kg_edges DROP CONSTRAINT IF EXISTS kg_edges_edge_type_check;
ALTER TABLE kg_edges ADD CONSTRAINT kg_edges_edge_type_check
  CHECK (edge_type IN (
    -- Relations Observable → Fault (3 niveaux de fiabilité)
    'INDICATES',         -- Symptom → Fault (poids faible 0.3-0.6)
    'CONFIRMS',          -- Sign → Fault (poids moyen-fort 0.6-0.85)
    'MANIFESTS_AS',      -- DTC → Fault (poids très fort 0.85-0.98)

    -- Relations existantes (conservées)
    'HAS_SYSTEM',        -- Vehicle → System
    'SHOWS_SYMPTOM',     -- System → Observable (legacy, garde pour compat)
    'CAUSES',            -- Observable → Fault (legacy, devient INDICATES)
    'CAUSED_BY',         -- Fault → Observable (reverse)
    'DIAGNOSED_BY',      -- Fault → Action
    'FIXED_BY',          -- Fault → Part
    'REQUIRES_PART',     -- Action → Part
    'COMPATIBLE_WITH',   -- Part → Vehicle
    'CORRELATES_WITH',   -- Observable ↔ Observable (co-occurrence)
    'OFTEN_WITH',        -- Fault ↔ Fault
    'PRECEDES',          -- Fault → Fault (cause racine)
    'MENTIONED_IN',      -- Node → Article
    'SIMILAR_TO',        -- Node → Node

    -- Relations spécificité véhicule
    'SPECIFIC_TO',       -- Edge/Node → EngineFamily (spécificité véhicule)
    'SCHEDULED_FOR',     -- MaintenanceInterval → EngineFamily
    'PREVENTS',          -- MaintenanceInterval → Fault (maintenance préventive)
    'AFFECTS',           -- RecallCampaign → EngineFamily
    'TRIGGERED_BY',      -- Fault → Fault (relation causale)

    -- Relations Fault Taxonomy
    'BELONGS_TO_FAMILY', -- Fault → FaultFamily (classification métier)
    'HAS_ROOT_CAUSE',    -- Fault → RootCause (explication causale)
    'OFTEN_CAUSED_BY',   -- RootCause → RootCause (chaîne causale)

    -- Relations Compatibility Layer (pièces ↔ véhicule)
    'HAS_PART_SOLUTION', -- Fault → FaultPartLink (lien vers solutions pièces)
    'COMPATIBLE_PART',   -- FaultPartLink → Part (pièce compatible)
    'FITS_ON',           -- Part → PartFitment (compatibilité véhicule)
    'FITMENT_FOR'        -- PartFitment → EngineFamily (famille moteur compatible)
  ));

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6. Table de référence des familles moteur (pour boost spécificité)        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS kg_engine_families (
  family_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code TEXT NOT NULL UNIQUE,  -- K9K, D4F, PureTech, HDi, etc.
  family_name TEXT NOT NULL,         -- 1.5 dCi, 1.2 PureTech, etc.
  manufacturer TEXT,                 -- Renault, PSA, Ford, etc.
  fuel_type TEXT CHECK (fuel_type IN ('essence', 'diesel', 'hybride', 'electrique')),
  displacement_cc INT,               -- Cylindrée en cm³
  common_issues JSONB,               -- Problèmes connus (EGR, turbo, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_kg_engine_families_code ON kg_engine_families(family_code);
CREATE INDEX IF NOT EXISTS idx_kg_engine_families_manufacturer ON kg_engine_families(manufacturer);

-- Données initiales des familles moteur courantes
INSERT INTO kg_engine_families (family_code, family_name, manufacturer, fuel_type, displacement_cc, common_issues)
VALUES
  ('K9K', '1.5 dCi', 'Renault-Nissan', 'diesel', 1461, '{"egr": "Encrassement fréquent", "injecteurs": "Fuite retour", "turbo": "Usure paliers"}'),
  ('D4F', '1.2 16v', 'Renault', 'essence', 1149, '{"bobines": "Défaillance", "distribution": "Chaîne à vérifier"}'),
  ('F4R', '2.0 16v', 'Renault', 'essence', 1998, '{"joints_spi": "Fuite huile", "bobines": "Défaillance"}'),
  ('PURETECH', '1.2 PureTech', 'PSA', 'essence', 1199, '{"courroie_distribution": "Usure prématurée", "pompe_huile": "Défaillance"}'),
  ('HDI', '1.6 HDi', 'PSA', 'diesel', 1560, '{"egr": "Encrassement", "fap": "Colmatage", "injecteurs": "Grippage"}'),
  ('BLUEHDI', '1.5 BlueHDi', 'PSA', 'diesel', 1499, '{"adblue": "Qualité requise", "fap": "Régénération"}'),
  ('THP', '1.6 THP', 'PSA-BMW', 'essence', 1598, '{"chaine_distribution": "Allongement", "turbo": "Casse"}'),
  ('ECOBOOST', '1.0 EcoBoost', 'Ford', 'essence', 999, '{"pompe_eau": "Fuite interne", "turbo": "Surchauffe"}'),
  ('TSI', '1.4 TSI', 'VAG', 'essence', 1390, '{"chaine_distribution": "Allongement", "pompe_hp": "Défaillance"}'),
  ('TDI', '2.0 TDI', 'VAG', 'diesel', 1968, '{"egr": "Encrassement", "volant_moteur": "Usure", "injecteurs": "Grippage"}')
ON CONFLICT (family_code) DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6b. Données initiales: FaultFamily (catégories métier)                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Insérer les familles de pannes si elles n'existent pas
INSERT INTO kg_nodes (node_type, node_label, node_alias, node_category, status, source_type, confidence_base, node_data)
VALUES
  ('FaultFamily', 'Freinage', 'freinage', 'safety', 'active', 'manual', 0.95, '{"description": "Système de freinage", "systems": ["disques", "plaquettes", "étriers", "flexibles", "liquide"]}'),
  ('FaultFamily', 'Refroidissement', 'refroidissement', 'engine', 'active', 'manual', 0.95, '{"description": "Système de refroidissement", "systems": ["radiateur", "pompe à eau", "thermostat", "durites", "ventilateur"]}'),
  ('FaultFamily', 'Allumage', 'allumage', 'engine', 'active', 'manual', 0.95, '{"description": "Système d''allumage", "systems": ["bougies", "bobines", "capteurs", "faisceau"]}'),
  ('FaultFamily', 'Alimentation', 'alimentation', 'engine', 'active', 'manual', 0.95, '{"description": "Système d''alimentation carburant", "systems": ["pompe", "injecteurs", "rampe", "filtre", "régulateur"]}'),
  ('FaultFamily', 'Transmission', 'transmission', 'drivetrain', 'active', 'manual', 0.95, '{"description": "Transmission et boîte de vitesses", "systems": ["embrayage", "boîte", "cardans", "différentiel"]}'),
  ('FaultFamily', 'Direction', 'direction', 'safety', 'active', 'manual', 0.95, '{"description": "Système de direction", "systems": ["crémaillère", "biellettes", "rotules", "pompe"]}'),
  ('FaultFamily', 'Suspension', 'suspension', 'comfort', 'active', 'manual', 0.95, '{"description": "Système de suspension", "systems": ["amortisseurs", "ressorts", "bras", "silent-blocs", "roulements"]}'),
  ('FaultFamily', 'Électricité', 'electricite', 'electrical', 'active', 'manual', 0.95, '{"description": "Système électrique", "systems": ["batterie", "alternateur", "démarreur", "faisceau", "fusibles"]}'),
  ('FaultFamily', 'Échappement', 'echappement', 'emissions', 'active', 'manual', 0.95, '{"description": "Système d''échappement", "systems": ["catalyseur", "FAP", "silencieux", "sondes", "EGR"]}'),
  ('FaultFamily', 'Climatisation', 'climatisation', 'comfort', 'active', 'manual', 0.95, '{"description": "Système de climatisation", "systems": ["compresseur", "condenseur", "évaporateur", "détendeur", "gaz"]}')
ON CONFLICT DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 6c. Données initiales: RootCause (causes racines courantes)               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Insérer les causes racines courantes
INSERT INTO kg_nodes (node_type, node_label, node_alias, root_cause_category, warranty_impact, frequency, is_preventable, status, source_type, confidence_base, node_data)
VALUES
  -- Causes liées à l'usage
  ('RootCause', 'Conduite agressive', 'conduite-agressive', 'usage', 'non_applicable', 'frequent', true, 'active', 'manual', 0.90, '{"advice": "Adopter une conduite souple, anticiper les freinages"}'),
  ('RootCause', 'Surcharge véhicule', 'surcharge', 'usage', 'non_applicable', 'occasional', true, 'active', 'manual', 0.90, '{"advice": "Respecter la charge maximale autorisée"}'),
  ('RootCause', 'Trajets courts répétés', 'trajets-courts', 'usage', 'non_applicable', 'frequent', true, 'active', 'manual', 0.85, '{"advice": "Effectuer régulièrement des trajets longs pour régénérer le FAP"}'),
  ('RootCause', 'Défaut d''entretien', 'defaut-entretien', 'usage', 'non_applicable', 'frequent', true, 'active', 'manual', 0.90, '{"advice": "Respecter les intervalles d''entretien constructeur"}'),

  -- Causes liées à l'installation
  ('RootCause', 'Montage incorrect', 'montage-incorrect', 'installation', 'applicable', 'occasional', false, 'active', 'manual', 0.95, '{"advice": "Confier le montage à un professionnel", "warranty_note": "Garantie applicable si montage professionnel défaillant"}'),
  ('RootCause', 'Couple de serrage non respecté', 'couple-serrage', 'installation', 'applicable', 'rare', false, 'active', 'manual', 0.95, '{"advice": "Utiliser une clé dynamométrique"}'),
  ('RootCause', 'Pièce incompatible', 'piece-incompatible', 'installation', 'non_applicable', 'rare', false, 'active', 'manual', 0.90, '{"advice": "Vérifier la compatibilité avant achat"}'),

  -- Causes liées à la qualité
  ('RootCause', 'Pièce défectueuse', 'piece-defectueuse', 'quality', 'applicable', 'rare', false, 'active', 'manual', 0.95, '{"advice": "Conserver la pièce pour expertise", "warranty_note": "Retour possible sous garantie"}'),
  ('RootCause', 'Contrefaçon', 'contrefacon', 'quality', 'non_applicable', 'rare', true, 'active', 'manual', 0.90, '{"advice": "Acheter chez des distributeurs agréés"}'),
  ('RootCause', 'Lot de fabrication défectueux', 'lot-defectueux', 'quality', 'applicable', 'rare', false, 'active', 'manual', 0.95, '{"advice": "Vérifier les campagnes de rappel"}'),

  -- Causes liées à l'usure
  ('RootCause', 'Usure normale', 'usure-normale', 'wear', 'non_applicable', 'very_frequent', false, 'active', 'manual', 0.95, '{"advice": "Remplacer selon les préconisations kilométriques"}'),
  ('RootCause', 'Kilométrage élevé', 'kilometrage-eleve', 'wear', 'non_applicable', 'frequent', false, 'active', 'manual', 0.90, '{"advice": "Prévoir un budget entretien adapté"}'),
  ('RootCause', 'Vieillissement', 'vieillissement', 'wear', 'non_applicable', 'frequent', false, 'active', 'manual', 0.90, '{"advice": "Remplacer les pièces selon leur âge même si kilométrage faible"}'),

  -- Causes externes
  ('RootCause', 'Accident/Choc', 'accident', 'external', 'non_applicable', 'rare', false, 'active', 'manual', 0.95, '{"advice": "Faire vérifier le véhicule après tout choc"}'),
  ('RootCause', 'Conditions climatiques extrêmes', 'conditions-extremes', 'external', 'non_applicable', 'rare', false, 'active', 'manual', 0.85, '{"advice": "Adapter l''entretien aux conditions d''utilisation"}'),
  ('RootCause', 'Carburant de mauvaise qualité', 'carburant-mauvais', 'external', 'non_applicable', 'occasional', true, 'active', 'manual', 0.85, '{"advice": "Privilégier les stations de confiance"}')
ON CONFLICT DO NOTHING;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 7. Vue pour diagnostic contextuel optimisé                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Vue des observables actifs avec contexte complet
CREATE OR REPLACE VIEW kg_observables_with_context AS
SELECT
  n.node_id,
  n.node_label,
  n.node_alias,
  n.input_type,
  n.perception_channel,
  n.intensity,
  n.risk_level,
  n.dtc_code,
  n.ctx_phase,
  n.ctx_temp,
  n.ctx_speed,
  n.ctx_road,
  n.ctx_load,
  n.confidence,
  n.confidence_base,
  n.source_type,
  n.sources,
  n.node_data
FROM kg_nodes n
WHERE n.node_type = 'Observable'
  AND n.status = 'active'
  AND n.valid_to IS NULL
  AND n.is_active = TRUE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 8. Fonction helper: Calcul de confidence selon input_type                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION kg_get_input_type_confidence(p_input_type TEXT)
RETURNS FLOAT AS $$
BEGIN
  RETURN CASE p_input_type
    WHEN 'dtc' THEN 0.95      -- Électronique: très fiable
    WHEN 'sign' THEN 0.85     -- Technicien: fiable
    WHEN 'symptom' THEN 0.60  -- Utilisateur: subjectif
    ELSE 0.75                 -- Défaut
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 9. Comments                                                               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

COMMENT ON COLUMN kg_nodes.input_type IS 'Type d''input: symptom (subjectif), sign (objectif), dtc (électronique)';
COMMENT ON COLUMN kg_nodes.perception_channel IS 'Canal de perception: visual, auditory, olfactory, tactile, electronic, performance';
COMMENT ON COLUMN kg_nodes.intensity IS 'Intensité perçue de 1 (léger) à 5 (très fort)';
COMMENT ON COLUMN kg_nodes.risk_level IS 'Niveau de risque: confort, securite, critique';
COMMENT ON COLUMN kg_nodes.dtc_code IS 'Code DTC standardisé (P0300, C1234, B0001, U0100...)';

COMMENT ON COLUMN kg_nodes.ctx_phase IS 'Phase de conduite: demarrage, ralenti, acceleration, freinage, virage, vitesse_stable, arret, any';
COMMENT ON COLUMN kg_nodes.ctx_temp IS 'Température moteur: froid, chaud, any';
COMMENT ON COLUMN kg_nodes.ctx_speed IS 'Plage de vitesse: 0_30, 30_70, 70_110, 110_plus, any';
COMMENT ON COLUMN kg_nodes.ctx_road IS 'État de la route: lisse, degradee, pluie, neige, any';
COMMENT ON COLUMN kg_nodes.ctx_load IS 'Charge véhicule: seul, charge, montee, descente, any';

COMMENT ON TABLE kg_engine_families IS 'Familles moteur pour boost spécificité véhicule dans les diagnostics';
COMMENT ON VIEW kg_observables_with_context IS 'Vue optimisée des observables actifs avec tous les champs de contexte';

-- Fault Taxonomy comments
COMMENT ON COLUMN kg_nodes.root_cause_category IS 'Catégorie de cause racine: usage, installation, quality, wear, external';
COMMENT ON COLUMN kg_nodes.warranty_impact IS 'Impact garantie: applicable, partial, non_applicable';
COMMENT ON COLUMN kg_nodes.frequency IS 'Fréquence observée: rare, occasional, frequent, very_frequent';
COMMENT ON COLUMN kg_nodes.is_preventable IS 'Si la cause peut être prévenue par le client';

-- Action structurée comments
COMMENT ON COLUMN kg_nodes.action_type IS 'Type d''action: controle, remplacement, nettoyage, purge, test_routier, reglage';
COMMENT ON COLUMN kg_nodes.estimated_duration IS 'Durée estimée: 15min, 30min, 45min, 1h, 1h30, 2h, 3h, 4h, 1j';
COMMENT ON COLUMN kg_nodes.urgency IS 'Urgence: immediate (sécurité), soon (jours), scheduled (prochain entretien)';
COMMENT ON COLUMN kg_nodes.safety_level IS 'Niveau sécurité: critical (direct), important (fiabilité), normal (confort)';
COMMENT ON COLUMN kg_nodes.prerequisites IS 'Prérequis (JSON array): ["Lever véhicule", "Vidanger circuit"]';
COMMENT ON COLUMN kg_nodes.tools_required IS 'Outils requis (JSON array): ["Clé dynamométrique", "Cric"]';
COMMENT ON COLUMN kg_nodes.skill_level IS 'Compétence: diy (particulier), amateur (éclairé), professional (pro)';

-- Compatibility Layer comments
COMMENT ON COLUMN kg_nodes.year_from IS 'Année de début de compatibilité (PartFitment)';
COMMENT ON COLUMN kg_nodes.year_to IS 'Année de fin de compatibilité (PartFitment)';
COMMENT ON COLUMN kg_nodes.oem_codes IS 'Codes OEM constructeur (PartFitment): ["7701206339", "4246W5"]';
COMMENT ON COLUMN kg_nodes.ktype_ids IS 'IDs TecDoc KType (PartFitment)';
COMMENT ON COLUMN kg_nodes.part_priority IS 'Priorité solution: primary (recommandé), alternative, budget';
COMMENT ON COLUMN kg_nodes.effectiveness IS 'Efficacité de la solution (0-1) pour FaultPartLink';
COMMENT ON COLUMN kg_nodes.replacement_type IS 'Type de remplacement: single, pair, set, kit';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 10. RPC: kg_get_compatible_parts_for_fault (Compatibility Layer)          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Fonction pour récupérer les pièces compatibles pour une panne donnée
CREATE OR REPLACE FUNCTION kg_get_compatible_parts_for_fault(
  p_fault_id UUID,
  p_engine_family_code TEXT DEFAULT NULL,
  p_vehicle_year INT DEFAULT NULL
)
RETURNS TABLE (
  part_link_id UUID,
  part_link_label TEXT,
  priority TEXT,
  effectiveness FLOAT,
  replacement_type TEXT,
  part_id UUID,
  part_label TEXT,
  pg_id INT,
  fitment_id UUID,
  fitment_label TEXT,
  year_from INT,
  year_to INT,
  oem_codes TEXT[],
  ktype_ids INT[],
  engine_families TEXT[],
  is_compatible BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH fault_part_links AS (
    -- 1. Trouver tous les FaultPartLink pour cette panne
    SELECT
      fpl.node_id AS link_id,
      fpl.node_label AS link_label,
      fpl.part_priority AS priority,
      fpl.effectiveness,
      fpl.replacement_type,
      e_link.target_node_id AS part_node_id
    FROM kg_nodes fpl
    JOIN kg_edges e_fault ON e_fault.target_node_id = fpl.node_id
      AND e_fault.source_node_id = p_fault_id
      AND e_fault.edge_type = 'HAS_PART_SOLUTION'
      AND e_fault.is_active = TRUE
    JOIN kg_edges e_link ON e_link.source_node_id = fpl.node_id
      AND e_link.edge_type = 'COMPATIBLE_PART'
      AND e_link.is_active = TRUE
    WHERE fpl.node_type = 'FaultPartLink'
      AND fpl.status = 'active'
      AND fpl.is_active = TRUE
  ),
  parts_with_fitment AS (
    -- 2. Récupérer les pièces et leurs compatibilités
    SELECT
      fpl.link_id,
      fpl.link_label,
      fpl.priority,
      fpl.effectiveness,
      fpl.replacement_type,
      p.node_id AS part_id,
      p.node_label AS part_label,
      (p.node_data->>'pg_id')::INT AS pg_id,
      pf.node_id AS fitment_id,
      pf.node_label AS fitment_label,
      pf.year_from,
      pf.year_to,
      pf.oem_codes,
      pf.ktype_ids,
      ARRAY_AGG(DISTINCT ef.family_code) FILTER (WHERE ef.family_code IS NOT NULL) AS engine_families,
      -- Vérifier compatibilité si critères fournis
      CASE
        WHEN p_engine_family_code IS NULL AND p_vehicle_year IS NULL THEN TRUE
        WHEN pf.node_id IS NULL THEN FALSE
        WHEN p_vehicle_year IS NOT NULL
          AND (pf.year_from IS NOT NULL AND p_vehicle_year < pf.year_from) THEN FALSE
        WHEN p_vehicle_year IS NOT NULL
          AND (pf.year_to IS NOT NULL AND p_vehicle_year > pf.year_to) THEN FALSE
        WHEN p_engine_family_code IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM kg_edges e_eng
            JOIN kg_engine_families ef2 ON ef2.family_code = p_engine_family_code
            WHERE e_eng.source_node_id = pf.node_id
              AND e_eng.edge_type = 'FITMENT_FOR'
              AND e_eng.is_active = TRUE
          ) THEN FALSE
        ELSE TRUE
      END AS is_compatible
    FROM fault_part_links fpl
    JOIN kg_nodes p ON p.node_id = fpl.part_node_id
      AND p.node_type = 'Part'
      AND p.status = 'active'
      AND p.is_active = TRUE
    LEFT JOIN kg_edges e_fits ON e_fits.source_node_id = p.node_id
      AND e_fits.edge_type = 'FITS_ON'
      AND e_fits.is_active = TRUE
    LEFT JOIN kg_nodes pf ON pf.node_id = e_fits.target_node_id
      AND pf.node_type = 'PartFitment'
      AND pf.status = 'active'
    LEFT JOIN kg_edges e_fam ON e_fam.source_node_id = pf.node_id
      AND e_fam.edge_type = 'FITMENT_FOR'
      AND e_fam.is_active = TRUE
    LEFT JOIN kg_engine_families ef ON ef.family_id = e_fam.target_node_id::UUID
      OR EXISTS (
        SELECT 1 FROM kg_nodes eng
        WHERE eng.node_id = e_fam.target_node_id
          AND eng.node_type = 'EngineFamily'
          AND eng.node_label = ef.family_code
      )
    GROUP BY
      fpl.link_id, fpl.link_label, fpl.priority, fpl.effectiveness, fpl.replacement_type,
      p.node_id, p.node_label, p.node_data,
      pf.node_id, pf.node_label, pf.year_from, pf.year_to, pf.oem_codes, pf.ktype_ids
  )
  SELECT
    pwf.link_id,
    pwf.link_label,
    pwf.priority,
    pwf.effectiveness,
    pwf.replacement_type,
    pwf.part_id,
    pwf.part_label,
    pwf.pg_id,
    pwf.fitment_id,
    pwf.fitment_label,
    pwf.year_from,
    pwf.year_to,
    pwf.oem_codes,
    pwf.ktype_ids,
    pwf.engine_families,
    pwf.is_compatible
  FROM parts_with_fitment pwf
  ORDER BY
    pwf.is_compatible DESC,
    CASE pwf.priority
      WHEN 'primary' THEN 1
      WHEN 'alternative' THEN 2
      WHEN 'budget' THEN 3
      ELSE 4
    END,
    pwf.effectiveness DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION kg_get_compatible_parts_for_fault IS
  'Retourne les pièces compatibles pour une panne, triées par priorité et compatibilité véhicule';

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ 11. Données initiales: Actions structurées (exemples)                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO kg_nodes (
  node_type, node_label, node_alias, node_category,
  action_type, estimated_duration, urgency, safety_level,
  prerequisites, tools_required, skill_level,
  status, source_type, confidence_base, node_data
) VALUES
  -- Actions de contrôle
  ('Action', 'Contrôle épaisseur plaquettes', 'controle-plaquettes', 'freinage',
   'controle', '15min', 'soon', 'critical',
   '["Démonter roue"]'::JSONB,
   '["Pied à coulisse", "Cric", "Chandelles"]'::JSONB,
   'amateur',
   'active', 'manual', 0.90,
   '{"steps": ["Lever véhicule", "Démonter roue", "Mesurer épaisseur", "Comparer à min (2mm)"], "threshold": "2mm minimum"}'::JSONB),

  ('Action', 'Contrôle niveau liquide de frein', 'controle-ldf', 'freinage',
   'controle', '5min', 'soon', 'critical',
   '[]'::JSONB,
   '[]'::JSONB,
   'diy',
   'active', 'manual', 0.95,
   '{"steps": ["Ouvrir capot", "Localiser bocal", "Vérifier niveau entre min/max"], "warning": "Ne jamais ouvrir si système ABS actif"}'::JSONB),

  -- Actions de remplacement
  ('Action', 'Remplacement disques et plaquettes AV', 'remplacement-disques-plaquettes-av', 'freinage',
   'remplacement', '1h30', 'immediate', 'critical',
   '["Démonter roue", "Repousser piston étrier"]'::JSONB,
   '["Clé dynamométrique", "Repousse-piston", "Cric", "Chandelles", "Tournevis"]'::JSONB,
   'professional',
   'active', 'manual', 0.95,
   '{"couples_serrage": {"roue": "110Nm", "etrier": "35Nm"}, "warning": "Purger après si circuit ouvert", "parts_needed": ["Disques AV", "Plaquettes AV"]}'::JSONB),

  ('Action', 'Remplacement filtre à air', 'remplacement-filtre-air', 'moteur',
   'remplacement', '15min', 'scheduled', 'normal',
   '[]'::JSONB,
   '["Tournevis", "Clé plate 10mm"]'::JSONB,
   'diy',
   'active', 'manual', 0.90,
   '{"steps": ["Ouvrir boîtier filtre", "Retirer ancien filtre", "Installer nouveau", "Refermer"], "interval": "30000km ou 2 ans"}'::JSONB),

  ('Action', 'Remplacement bougies allumage', 'remplacement-bougies', 'allumage',
   'remplacement', '45min', 'scheduled', 'important',
   '["Attendre moteur froid"]'::JSONB,
   '["Clé à bougie", "Jauge d''épaisseur", "Graisse cuivrée"]'::JSONB,
   'amateur',
   'active', 'manual', 0.90,
   '{"steps": ["Démonter cache moteur", "Débrancher bobines", "Dévisser bougies", "Vérifier gap", "Remonter"], "couples_serrage": {"bougie": "25Nm"}}'::JSONB),

  -- Actions de nettoyage
  ('Action', 'Nettoyage vanne EGR', 'nettoyage-egr', 'echappement',
   'nettoyage', '2h', 'soon', 'important',
   '["Démonter admission", "Débrancher capteurs"]'::JSONB,
   '["Nettoyant EGR", "Clés Torx", "Joints neufs"]'::JSONB,
   'professional',
   'active', 'manual', 0.85,
   '{"steps": ["Démonter vanne", "Nettoyer au décapant", "Vérifier membrane", "Remonter avec joints neufs"], "warning": "Attention aux joints"}'::JSONB),

  ('Action', 'Décalaminage moteur', 'decalaminage', 'moteur',
   'nettoyage', '1h', 'scheduled', 'important',
   '["Moteur chaud (80°C)"]'::JSONB,
   '["Kit décalaminage hydrogène", "Valise OBD"]'::JSONB,
   'professional',
   'active', 'manual', 0.80,
   '{"steps": ["Brancher machine", "Faire tourner 30min", "Tester route", "Vérifier codes défaut"]}'::JSONB),

  -- Actions de purge
  ('Action', 'Purge circuit de freinage', 'purge-freins', 'freinage',
   'purge', '30min', 'immediate', 'critical',
   '["Liquide de frein neuf DOT4", "Bocal à niveau"]'::JSONB,
   '["Clé à purge", "Tuyau transparent", "Bocal récupération"]'::JSONB,
   'amateur',
   'active', 'manual', 0.90,
   '{"steps": ["Remplir bocal", "Purger roue la plus éloignée", "Répéter jusqu''à liquide clair"], "order": ["ARD", "ARG", "AVD", "AVG"]}'::JSONB),

  ('Action', 'Recharge climatisation', 'recharge-clim', 'climatisation',
   'purge', '45min', 'scheduled', 'normal',
   '["Moteur arrêté", "Clim éteinte"]'::JSONB,
   '["Station de charge", "Gaz R134a ou R1234yf"]'::JSONB,
   'professional',
   'active', 'manual', 0.85,
   '{"steps": ["Récupérer ancien gaz", "Tirer au vide", "Recharger quantité constructeur"], "warning": "Gaz sous pression"}'::JSONB),

  -- Actions de test
  ('Action', 'Test routier freinage', 'test-routier-freins', 'freinage',
   'test_routier', '15min', 'immediate', 'critical',
   '["Réparation terminée", "Serrage vérifié"]'::JSONB,
   '[]'::JSONB,
   'diy',
   'active', 'manual', 0.95,
   '{"checklist": ["Freinage progressif", "Pas de vibration", "Pas de bruit", "Voyant éteint", "Trajectoire droite"]}'::JSONB),

  ('Action', 'Test routier post-embrayage', 'test-routier-embrayage', 'transmission',
   'test_routier', '20min', 'immediate', 'important',
   '["Remplacement embrayage terminé"]'::JSONB,
   '[]'::JSONB,
   'diy',
   'active', 'manual', 0.90,
   '{"checklist": ["Point de patinage correct", "Pas de vibrations", "Passages de vitesses fluides", "Pas de bruit"]} '::JSONB),

  -- Actions de réglage
  ('Action', 'Réglage parallélisme', 'reglage-parallelisme', 'direction',
   'reglage', '30min', 'soon', 'important',
   '["Pressions pneus correctes", "Véhicule à vide"]'::JSONB,
   '["Banc de géométrie"]'::JSONB,
   'professional',
   'active', 'manual', 0.95,
   '{"steps": ["Mesurer valeurs actuelles", "Comparer aux specs constructeur", "Ajuster biellettes"], "values": {"toe": "±0.5°", "camber": "±1°"}}'::JSONB),

  ('Action', 'Réglage hauteur de phares', 'reglage-phares', 'eclairage',
   'reglage', '15min', 'soon', 'important',
   '["Véhicule à plat", "Pressions correctes"]'::JSONB,
   '["Tournevis", "Régloscope ou mur"]'::JSONB,
   'amateur',
   'active', 'manual', 0.85,
   '{"steps": ["Placer à 10m du mur", "Marquer hauteur feux", "Ajuster vis de réglage"], "spec": "Faisceau 2cm sous marquage"}'::JSONB)
ON CONFLICT DO NOTHING;

COMMIT;
