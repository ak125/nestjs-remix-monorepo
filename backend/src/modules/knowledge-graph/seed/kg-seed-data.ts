/**
 * 🧠 Knowledge Graph Seed Data - AI-COS v2.8.0
 *
 * Données initiales pour le Knowledge Graph automobile
 * Contient les symptômes, pannes et pièces les plus courants
 */

import { CreateKgNodeDto } from '../kg.types';

// ═══════════════════════════════════════════════════════════════════════════
// SYSTÈMES AUTOMOBILES
// ═══════════════════════════════════════════════════════════════════════════

export const SYSTEMS: CreateKgNodeDto[] = [
  {
    node_type: 'System',
    node_label: 'Système injection',
    node_alias: 'injection',
    node_category: 'Moteur',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système EGR',
    node_alias: 'egr',
    node_category: 'Émissions',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système turbo',
    node_alias: 'turbo',
    node_category: 'Admission',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système freinage',
    node_alias: 'freins',
    node_category: 'Freinage',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système distribution',
    node_alias: 'distribution',
    node_category: 'Moteur',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système embrayage',
    node_alias: 'embrayage',
    node_category: 'Transmission',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système suspension',
    node_alias: 'suspension',
    node_category: 'Châssis',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système direction',
    node_alias: 'direction',
    node_category: 'Châssis',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système refroidissement',
    node_alias: 'refroidissement',
    node_category: 'Moteur',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'System',
    node_label: 'Système électrique',
    node_alias: 'electrique',
    node_category: 'Électrique',
    confidence: 1.0,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SYMPTÔMES (OBSERVABLES)
// ═══════════════════════════════════════════════════════════════════════════

export const OBSERVABLES: CreateKgNodeDto[] = [
  // Symptômes EGR
  {
    node_type: 'Observable',
    node_label: "Fumée noire à l'échappement",
    node_alias: 'fumee-noire',
    node_category: 'Visuel',
    node_data: { severity: 'medium', systems: ['egr', 'injection', 'turbo'] },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Perte de puissance',
    node_alias: 'perte-puissance',
    node_category: 'Performance',
    node_data: { severity: 'high', systems: ['egr', 'turbo', 'injection'] },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Voyant moteur allumé',
    node_alias: 'voyant-moteur',
    node_category: 'Électronique',
    node_data: {
      severity: 'medium',
      systems: ['injection', 'egr', 'electrique'],
    },
    confidence: 0.98,
    sources: ['TecDoc', 'RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Mode dégradé activé',
    node_alias: 'mode-degrade',
    node_category: 'Électronique',
    node_data: { severity: 'high', systems: ['egr', 'turbo', 'injection'] },
    confidence: 0.92,
    sources: ['TecDoc', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Ralenti instable',
    node_alias: 'ralenti-instable',
    node_category: 'Performance',
    node_data: { severity: 'medium', systems: ['egr', 'injection'] },
    confidence: 0.9,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Symptômes Turbo
  {
    node_type: 'Observable',
    node_label: "Sifflement à l'accélération",
    node_alias: 'sifflement-acceleration',
    node_category: 'Sonore',
    node_data: { severity: 'medium', systems: ['turbo'] },
    confidence: 0.94,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: "Fumée bleue à l'échappement",
    node_alias: 'fumee-bleue',
    node_category: 'Visuel',
    node_data: { severity: 'high', systems: ['turbo', 'moteur'] },
    confidence: 0.93,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Consommation huile excessive',
    node_alias: 'conso-huile',
    node_category: 'Consommation',
    node_data: { severity: 'high', systems: ['turbo', 'moteur'] },
    confidence: 0.91,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Symptômes Freins
  {
    node_type: 'Observable',
    node_label: 'Bruit au freinage',
    node_alias: 'bruit-freinage',
    node_category: 'Sonore',
    node_data: { severity: 'medium', systems: ['freins'] },
    confidence: 0.96,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Vibration pédale de frein',
    node_alias: 'vibration-pedale-frein',
    node_category: 'Mécanique',
    node_data: { severity: 'medium', systems: ['freins'] },
    confidence: 0.94,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Freinage inefficace',
    node_alias: 'freinage-inefficace',
    node_category: 'Performance',
    node_data: { severity: 'critical', systems: ['freins'] },
    confidence: 0.98,
    sources: ['TecDoc', 'RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Pédale de frein molle',
    node_alias: 'pedale-molle',
    node_category: 'Mécanique',
    node_data: { severity: 'high', systems: ['freins'] },
    confidence: 0.93,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Symptômes Distribution
  {
    node_type: 'Observable',
    node_label: 'Claquement moteur',
    node_alias: 'claquement-moteur',
    node_category: 'Sonore',
    node_data: { severity: 'high', systems: ['distribution', 'moteur'] },
    confidence: 0.92,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Moteur ne démarre pas',
    node_alias: 'pas-demarrage',
    node_category: 'Démarrage',
    node_data: {
      severity: 'critical',
      systems: ['distribution', 'electrique', 'injection'],
    },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Bruit de cliquetis au ralenti',
    node_alias: 'cliquetis-ralenti',
    node_category: 'Sonore',
    node_data: { severity: 'medium', systems: ['distribution'] },
    confidence: 0.88,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Symptômes Embrayage
  {
    node_type: 'Observable',
    node_label: 'Embrayage patine',
    node_alias: 'embrayage-patine',
    node_category: 'Transmission',
    node_data: { severity: 'high', systems: ['embrayage'] },
    confidence: 0.94,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Pédale embrayage dure',
    node_alias: 'pedale-embrayage-dure',
    node_category: 'Mécanique',
    node_data: { severity: 'medium', systems: ['embrayage'] },
    confidence: 0.91,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: "Bruit à l'embrayage",
    node_alias: 'bruit-embrayage',
    node_category: 'Sonore',
    node_data: { severity: 'medium', systems: ['embrayage'] },
    confidence: 0.89,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Symptômes Refroidissement
  {
    node_type: 'Observable',
    node_label: 'Surchauffe moteur',
    node_alias: 'surchauffe',
    node_category: 'Température',
    node_data: { severity: 'critical', systems: ['refroidissement'] },
    confidence: 0.97,
    sources: ['TecDoc', 'RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Fuite liquide refroidissement',
    node_alias: 'fuite-ldr',
    node_category: 'Visuel',
    node_data: { severity: 'high', systems: ['refroidissement'] },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Observable',
    node_label: 'Voyant température allumé',
    node_alias: 'voyant-temperature',
    node_category: 'Électronique',
    node_data: { severity: 'high', systems: ['refroidissement'] },
    confidence: 0.96,
    sources: ['TecDoc', 'RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PANNES (FAULTS)
// ═══════════════════════════════════════════════════════════════════════════

export const FAULTS: CreateKgNodeDto[] = [
  // Pannes EGR
  {
    node_type: 'Fault',
    node_label: 'Vanne EGR encrassée',
    node_alias: 'egr-encrassee',
    node_category: 'Émissions',
    node_data: {
      dtc_codes: ['P0401', 'P0402', 'P0403'],
      repair_difficulty: 'medium',
    },
    confidence: 0.94,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Vanne EGR bloquée ouverte',
    node_alias: 'egr-bloquee-ouverte',
    node_category: 'Émissions',
    node_data: { dtc_codes: ['P0402'], repair_difficulty: 'medium' },
    confidence: 0.92,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Vanne EGR bloquée fermée',
    node_alias: 'egr-bloquee-fermee',
    node_category: 'Émissions',
    node_data: { dtc_codes: ['P0401'], repair_difficulty: 'medium' },
    confidence: 0.91,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Pannes Turbo
  {
    node_type: 'Fault',
    node_label: 'Turbo HS',
    node_alias: 'turbo-hs',
    node_category: 'Admission',
    node_data: { dtc_codes: ['P0234', 'P0235'], repair_difficulty: 'hard' },
    confidence: 0.93,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Wastegate grippée',
    node_alias: 'wastegate-grippee',
    node_category: 'Admission',
    node_data: { dtc_codes: ['P0234'], repair_difficulty: 'medium' },
    confidence: 0.89,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Durite turbo percée',
    node_alias: 'durite-turbo-percee',
    node_category: 'Admission',
    node_data: { repair_difficulty: 'easy' },
    confidence: 0.91,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Pannes Freins
  {
    node_type: 'Fault',
    node_label: 'Plaquettes de frein usées',
    node_alias: 'plaquettes-usees',
    node_category: 'Freinage',
    node_data: { repair_difficulty: 'easy' },
    confidence: 0.97,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Disques de frein voilés',
    node_alias: 'disques-voiles',
    node_category: 'Freinage',
    node_data: { repair_difficulty: 'medium' },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Étrier de frein grippé',
    node_alias: 'etrier-grippe',
    node_category: 'Freinage',
    node_data: { repair_difficulty: 'medium' },
    confidence: 0.92,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Fuite liquide de frein',
    node_alias: 'fuite-ldf',
    node_category: 'Freinage',
    node_data: { repair_difficulty: 'medium' },
    confidence: 0.94,
    sources: ['TecDoc', 'RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Pannes Distribution
  {
    node_type: 'Fault',
    node_label: 'Courroie distribution usée',
    node_alias: 'courroie-usee',
    node_category: 'Moteur',
    node_data: { repair_difficulty: 'hard' },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Galet tendeur HS',
    node_alias: 'galet-tendeur-hs',
    node_category: 'Moteur',
    node_data: { repair_difficulty: 'hard' },
    confidence: 0.92,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Pompe à eau défaillante',
    node_alias: 'pompe-eau-hs',
    node_category: 'Refroidissement',
    node_data: { repair_difficulty: 'medium' },
    confidence: 0.93,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Pannes Embrayage
  {
    node_type: 'Fault',
    node_label: 'Kit embrayage usé',
    node_alias: 'kit-embrayage-use',
    node_category: 'Transmission',
    node_data: { repair_difficulty: 'hard' },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Butée embrayage HS',
    node_alias: 'butee-hs',
    node_category: 'Transmission',
    node_data: { repair_difficulty: 'hard' },
    confidence: 0.91,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Volant moteur bimasse HS',
    node_alias: 'volant-bimasse-hs',
    node_category: 'Transmission',
    node_data: { repair_difficulty: 'hard' },
    confidence: 0.9,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  // Pannes Refroidissement
  {
    node_type: 'Fault',
    node_label: 'Thermostat bloqué',
    node_alias: 'thermostat-bloque',
    node_category: 'Refroidissement',
    node_data: { repair_difficulty: 'easy' },
    confidence: 0.93,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Radiateur percé',
    node_alias: 'radiateur-perce',
    node_category: 'Refroidissement',
    node_data: { repair_difficulty: 'medium' },
    confidence: 0.94,
    sources: ['TecDoc', 'RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Fault',
    node_label: 'Durite fissurée',
    node_alias: 'durite-fissuree',
    node_category: 'Refroidissement',
    node_data: { repair_difficulty: 'easy' },
    confidence: 0.95,
    sources: ['TecDoc', 'RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const ACTIONS: CreateKgNodeDto[] = [
  {
    node_type: 'Action',
    node_label: 'Nettoyage vanne EGR',
    node_alias: 'nettoyage-egr',
    node_category: 'Entretien',
    node_data: { duration_hours: 1.5, skill_level: 'intermediate' },
    confidence: 0.95,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement vanne EGR',
    node_alias: 'remplacement-egr',
    node_category: 'Réparation',
    node_data: { duration_hours: 2, skill_level: 'intermediate' },
    confidence: 0.95,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement turbo',
    node_alias: 'remplacement-turbo',
    node_category: 'Réparation',
    node_data: { duration_hours: 4, skill_level: 'expert' },
    confidence: 0.95,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement plaquettes de frein',
    node_alias: 'remplacement-plaquettes',
    node_category: 'Entretien',
    node_data: { duration_hours: 1, skill_level: 'beginner' },
    confidence: 0.98,
    sources: ['RTA', 'Forum'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement disques de frein',
    node_alias: 'remplacement-disques',
    node_category: 'Réparation',
    node_data: { duration_hours: 1.5, skill_level: 'intermediate' },
    confidence: 0.96,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement kit distribution',
    node_alias: 'remplacement-distribution',
    node_category: 'Réparation',
    node_data: { duration_hours: 5, skill_level: 'expert' },
    confidence: 0.95,
    sources: ['RTA', 'Constructeur'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement kit embrayage',
    node_alias: 'remplacement-embrayage',
    node_category: 'Réparation',
    node_data: { duration_hours: 4, skill_level: 'expert' },
    confidence: 0.95,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Remplacement thermostat',
    node_alias: 'remplacement-thermostat',
    node_category: 'Réparation',
    node_data: { duration_hours: 1, skill_level: 'intermediate' },
    confidence: 0.94,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Action',
    node_label: 'Purge circuit refroidissement',
    node_alias: 'purge-refroidissement',
    node_category: 'Entretien',
    node_data: { duration_hours: 0.5, skill_level: 'beginner' },
    confidence: 0.95,
    sources: ['RTA'],
    validation_status: 'approved',
    created_by: 'seed',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PIÈCES
// ═══════════════════════════════════════════════════════════════════════════

export const PARTS: CreateKgNodeDto[] = [
  {
    node_type: 'Part',
    node_label: 'Vanne EGR',
    node_alias: 'vanne-egr',
    node_category: 'Émissions',
    node_data: { price_range: { min: 80, max: 350 }, gamme_id: '1137' },
    confidence: 0.95,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Turbocompresseur',
    node_alias: 'turbo',
    node_category: 'Admission',
    node_data: { price_range: { min: 300, max: 1500 }, gamme_id: '1240' },
    confidence: 0.95,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Plaquettes de frein avant',
    node_alias: 'plaquettes-av',
    node_category: 'Freinage',
    node_data: { price_range: { min: 20, max: 80 }, gamme_id: '135' },
    confidence: 0.98,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Disques de frein avant',
    node_alias: 'disques-av',
    node_category: 'Freinage',
    node_data: { price_range: { min: 40, max: 150 }, gamme_id: '145' },
    confidence: 0.97,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Étrier de frein',
    node_alias: 'etrier',
    node_category: 'Freinage',
    node_data: { price_range: { min: 80, max: 250 }, gamme_id: '155' },
    confidence: 0.95,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Kit distribution',
    node_alias: 'kit-distribution',
    node_category: 'Moteur',
    node_data: { price_range: { min: 100, max: 400 }, gamme_id: '120' },
    confidence: 0.96,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Pompe à eau',
    node_alias: 'pompe-eau',
    node_category: 'Refroidissement',
    node_data: { price_range: { min: 30, max: 120 }, gamme_id: '125' },
    confidence: 0.95,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Kit embrayage',
    node_alias: 'kit-embrayage',
    node_category: 'Transmission',
    node_data: { price_range: { min: 150, max: 500 }, gamme_id: '110' },
    confidence: 0.96,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Volant moteur bimasse',
    node_alias: 'volant-bimasse',
    node_category: 'Transmission',
    node_data: { price_range: { min: 300, max: 800 }, gamme_id: '115' },
    confidence: 0.94,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Thermostat',
    node_alias: 'thermostat',
    node_category: 'Refroidissement',
    node_data: { price_range: { min: 15, max: 60 }, gamme_id: '130' },
    confidence: 0.95,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
  {
    node_type: 'Part',
    node_label: 'Radiateur',
    node_alias: 'radiateur',
    node_category: 'Refroidissement',
    node_data: { price_range: { min: 80, max: 300 }, gamme_id: '140' },
    confidence: 0.94,
    sources: ['TecDoc'],
    validation_status: 'approved',
    created_by: 'seed',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING SYMPTÔMES → PANNES (EDGES)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Définition des relations entre symptômes et pannes
 * Format: [observable_alias, fault_alias, weight, confidence]
 */
export const SYMPTOM_FAULT_MAPPING: Array<[string, string, number, number]> = [
  // EGR
  ['fumee-noire', 'egr-encrassee', 0.9, 0.94],
  ['perte-puissance', 'egr-encrassee', 0.85, 0.92],
  ['voyant-moteur', 'egr-encrassee', 0.7, 0.88],
  ['mode-degrade', 'egr-encrassee', 0.8, 0.9],
  ['ralenti-instable', 'egr-encrassee', 0.75, 0.85],
  ['fumee-noire', 'egr-bloquee-ouverte', 0.85, 0.88],
  ['perte-puissance', 'egr-bloquee-fermee', 0.7, 0.82],

  // Turbo
  ['sifflement-acceleration', 'turbo-hs', 0.8, 0.88],
  ['fumee-bleue', 'turbo-hs', 0.9, 0.92],
  ['conso-huile', 'turbo-hs', 0.85, 0.9],
  ['perte-puissance', 'turbo-hs', 0.75, 0.85],
  ['sifflement-acceleration', 'durite-turbo-percee', 0.7, 0.8],
  ['perte-puissance', 'wastegate-grippee', 0.65, 0.78],

  // Freins
  ['bruit-freinage', 'plaquettes-usees', 0.95, 0.96],
  ['vibration-pedale-frein', 'disques-voiles', 0.9, 0.94],
  ['freinage-inefficace', 'plaquettes-usees', 0.8, 0.88],
  ['freinage-inefficace', 'fuite-ldf', 0.85, 0.9],
  ['pedale-molle', 'fuite-ldf', 0.9, 0.92],
  ['bruit-freinage', 'etrier-grippe', 0.6, 0.75],

  // Distribution
  ['claquement-moteur', 'courroie-usee', 0.7, 0.82],
  ['claquement-moteur', 'galet-tendeur-hs', 0.8, 0.85],
  ['cliquetis-ralenti', 'galet-tendeur-hs', 0.75, 0.8],
  ['pas-demarrage', 'courroie-usee', 0.5, 0.7],

  // Embrayage
  ['embrayage-patine', 'kit-embrayage-use', 0.95, 0.96],
  ['pedale-embrayage-dure', 'butee-hs', 0.8, 0.85],
  ['bruit-embrayage', 'butee-hs', 0.7, 0.82],
  ['bruit-embrayage', 'volant-bimasse-hs', 0.75, 0.84],

  // Refroidissement
  ['surchauffe', 'thermostat-bloque', 0.85, 0.9],
  ['surchauffe', 'radiateur-perce', 0.8, 0.88],
  ['surchauffe', 'pompe-eau-hs', 0.7, 0.82],
  ['fuite-ldr', 'radiateur-perce', 0.9, 0.94],
  ['fuite-ldr', 'durite-fissuree', 0.85, 0.92],
  ['fuite-ldr', 'pompe-eau-hs', 0.6, 0.78],
  ['voyant-temperature', 'thermostat-bloque', 0.8, 0.88],
  ['voyant-temperature', 'pompe-eau-hs', 0.75, 0.85],
];

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING PANNES → ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const FAULT_ACTION_MAPPING: Array<[string, string, number, number]> = [
  // EGR
  ['egr-encrassee', 'nettoyage-egr', 0.8, 0.9],
  ['egr-encrassee', 'remplacement-egr', 0.9, 0.95],
  ['egr-bloquee-ouverte', 'remplacement-egr', 0.95, 0.96],
  ['egr-bloquee-fermee', 'remplacement-egr', 0.95, 0.96],

  // Turbo
  ['turbo-hs', 'remplacement-turbo', 0.95, 0.97],
  ['wastegate-grippee', 'remplacement-turbo', 0.7, 0.82],

  // Freins
  ['plaquettes-usees', 'remplacement-plaquettes', 0.98, 0.99],
  ['disques-voiles', 'remplacement-disques', 0.95, 0.97],
  ['etrier-grippe', 'remplacement-disques', 0.5, 0.7],

  // Distribution
  ['courroie-usee', 'remplacement-distribution', 0.98, 0.99],
  ['galet-tendeur-hs', 'remplacement-distribution', 0.95, 0.97],
  ['pompe-eau-hs', 'remplacement-distribution', 0.6, 0.78],

  // Embrayage
  ['kit-embrayage-use', 'remplacement-embrayage', 0.98, 0.99],
  ['butee-hs', 'remplacement-embrayage', 0.95, 0.97],
  ['volant-bimasse-hs', 'remplacement-embrayage', 0.7, 0.82],

  // Refroidissement
  ['thermostat-bloque', 'remplacement-thermostat', 0.95, 0.97],
  ['thermostat-bloque', 'purge-refroidissement', 0.4, 0.6],
  ['radiateur-perce', 'purge-refroidissement', 0.3, 0.5],
  ['durite-fissuree', 'purge-refroidissement', 0.5, 0.7],
  ['pompe-eau-hs', 'remplacement-distribution', 0.8, 0.88],
];

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING PANNES → PIÈCES
// ═══════════════════════════════════════════════════════════════════════════

export const FAULT_PART_MAPPING: Array<[string, string, number, number]> = [
  // EGR
  ['egr-encrassee', 'vanne-egr', 0.9, 0.95],
  ['egr-bloquee-ouverte', 'vanne-egr', 0.98, 0.99],
  ['egr-bloquee-fermee', 'vanne-egr', 0.98, 0.99],

  // Turbo
  ['turbo-hs', 'turbo', 0.98, 0.99],
  ['wastegate-grippee', 'turbo', 0.85, 0.9],

  // Freins
  ['plaquettes-usees', 'plaquettes-av', 0.98, 0.99],
  ['disques-voiles', 'disques-av', 0.95, 0.97],
  ['etrier-grippe', 'etrier', 0.9, 0.94],

  // Distribution
  ['courroie-usee', 'kit-distribution', 0.98, 0.99],
  ['galet-tendeur-hs', 'kit-distribution', 0.95, 0.97],
  ['pompe-eau-hs', 'pompe-eau', 0.95, 0.97],

  // Embrayage
  ['kit-embrayage-use', 'kit-embrayage', 0.98, 0.99],
  ['butee-hs', 'kit-embrayage', 0.9, 0.94],
  ['volant-bimasse-hs', 'volant-bimasse', 0.95, 0.97],

  // Refroidissement
  ['thermostat-bloque', 'thermostat', 0.95, 0.97],
  ['radiateur-perce', 'radiateur', 0.95, 0.97],
];

// ═══════════════════════════════════════════════════════════════════════════
// ALL SEED DATA
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_NODES: CreateKgNodeDto[] = [
  ...SYSTEMS,
  ...OBSERVABLES,
  ...FAULTS,
  ...ACTIONS,
  ...PARTS,
];
