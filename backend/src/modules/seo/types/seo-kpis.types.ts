import { PageRole } from './page-role.types';

/**
 * ============================================
 * PLAN DE MESURE SEO PAR RÔLE
 * ============================================
 *
 * Chaque rôle a des KPIs spécifiques alignés sur son intention:
 * - R4 Référence: Autorité (définitions, requêtes "qu'est-ce que")
 * - R3 Blog: Longue traîne (symptômes, guides)
 * - R1 Routeur: Navigation (sélection véhicule)
 * - R2 Produit: Transaction (conversion, achat)
 * - R5 Diagnostic: Symptômes (orientation vers solution)
 * - R6 Support: Satisfaction (résolution)
 */

// =====================================================
// Types de base pour les KPIs
// =====================================================

/**
 * Période de mesure des KPIs
 */
export type KpiPeriod = '7d' | '30d' | '90d' | 'ytd' | 'custom';

/**
 * Tendance par rapport à la période précédente
 */
export type KpiTrend = 'up' | 'down' | 'stable';

/**
 * Statut de santé d'un KPI
 */
export type KpiHealth = 'healthy' | 'warning' | 'critical';

/**
 * Source de données pour le KPI
 */
export type KpiSource = 'gsc' | 'ga4' | 'internal' | 'supabase' | 'logs';

// =====================================================
// KPIs R4 RÉFÉRENCE (Autorité)
// =====================================================

/**
 * KPIs spécifiques aux pages R4 Référence
 * Objectif: Être LA source de vérité pour les définitions
 */
export interface R4ReferenceKpis {
  /** Impressions sur requêtes "définition", "qu'est-ce que", "rôle de" */
  definitionImpressions: number;
  /** Clics sur ces mêmes requêtes */
  definitionClicks: number;
  /** CTR sur requêtes définition (cible: >5%) */
  definitionCtr: number;
  /** Nombre de requêtes uniques positionnées */
  uniqueQueries: number;
  /** Position moyenne sur requêtes cibles */
  avgPosition: number;
  /** Stabilité des positions (écart-type sur 30j) */
  positionStability: number;
  /** Pages liées depuis R3/R5 (maillage entrant) */
  inboundLinksFromBlog: number;
  inboundLinksFromDiagnostic: number;
}

/**
 * Patterns de requêtes R4 (pour filtrer GSC)
 */
export const R4_QUERY_PATTERNS = [
  /définition/i,
  /qu'est[- ]ce qu[e']/i,
  /c'est quoi/i,
  /rôle (de|du|d')/i,
  /différence entre/i,
  /à quoi sert/i,
  /fonctionnement/i,
  /composant/i,
];

// =====================================================
// KPIs R3 BLOG/EXPERT (Longue traîne)
// =====================================================

/**
 * KPIs spécifiques aux pages R3 Blog/Expert
 * Objectif: Capter le trafic "symptômes" et "questions"
 */
export interface R3BlogKpis {
  /** Trafic total longue traîne */
  longTailTraffic: number;
  /** Sessions sur requêtes symptômes ("bruit de...", "vibration...") */
  symptomTraffic: number;
  /** Sessions sur requêtes temporelles ("quand changer...") */
  timingTraffic: number;
  /** Sessions sur requêtes pratiques ("peut-on rouler avec...") */
  practicalTraffic: number;
  /** CTR moyen (qualité du snippet) - cible: >3% */
  avgCtr: number;
  /** Pages par session (maillage efficace) - cible: >1.5 */
  pagesPerSession: number;
  /** Taux de rebond - cible: <60% */
  bounceRate: number;
  /** Clics vers R2 Produit (conversion maillage) */
  clicksToProduct: number;
  /** Clics vers R4 Référence (maillage ascendant) */
  clicksToReference: number;
}

/**
 * Patterns de requêtes R3 (pour filtrer GSC)
 */
export const R3_QUERY_PATTERNS = [
  /quand (changer|remplacer)/i,
  /comment (savoir|reconnaître|diagnostiquer)/i,
  /peut[- ]on (rouler|conduire)/i,
  /symptôme/i,
  /signe[s]? (de|d')/i,
  /bruit (de|du|d')/i,
  /vibration/i,
  /problème/i,
  /panne/i,
  /usure/i,
];

// =====================================================
// KPIs R1 ROUTEUR (Navigation/Sélection)
// =====================================================

/**
 * KPIs spécifiques aux pages R1 Routeur
 * Objectif: Guider vers le bon produit (R2)
 */
export interface R1RouterKpis {
  /** Trafic brand + navigation */
  brandNavigationTraffic: number;
  /** Sessions avec sélection de véhicule */
  vehicleSelectionSessions: number;
  /** Taux de passage vers R2 (clics internes) - cible: >40% */
  clickThroughToProduct: number;
  /** Nombre de pages R1 indexées */
  indexedPages: number;
  /** Ratio pages indexées vs soumises (bloat check) - cible: >90% */
  indexCoverageRatio: number;
  /** Position moyenne sur requêtes "[pièce] [marque]" */
  avgPositionBrandQueries: number;
  /** Temps moyen sur page (sélection rapide = bon) - cible: <30s */
  avgTimeOnPage: number;
}

/**
 * Patterns de requêtes R1 (pour filtrer GSC)
 */
export const R1_QUERY_PATTERNS = [
  /kit (d')?embrayage/i,
  /plaquette[s]? (de )?frein/i,
  /disque[s]? (de )?frein/i,
  /amortisseur/i,
  /filtre/i,
  // Combinaisons marque
  /(peugeot|renault|citroen|volkswagen|audi|bmw|mercedes)/i,
];

// =====================================================
// KPIs R2 PRODUIT (Transaction)
// =====================================================

/**
 * KPIs spécifiques aux pages R2 Produit
 * Objectif: Convertir (achat)
 */
export interface R2ProductKpis {
  /** Trafic transactionnel total */
  transactionalTraffic: number;
  /** Sessions sur requêtes "acheter" + véhicule */
  buyIntentTraffic: number;
  /** Sessions sur requêtes contenant modèle/motorisation */
  vehicleSpecificTraffic: number;
  /** Taux d'ajout au panier - cible: >5% */
  addToCartRate: number;
  /** Taux de checkout initié - cible: >2% */
  checkoutRate: number;
  /** Taux de conversion final - cible: >1% */
  conversionRate: number;
  /** Revenu généré */
  revenue: number;
  /** Position moyenne sur requêtes transactionnelles */
  avgPositionBuyQueries: number;
  /** Clics depuis R1 Routeur (qualité du maillage) */
  clicksFromRouter: number;
}

/**
 * Patterns de requêtes R2 (pour filtrer GSC)
 */
export const R2_QUERY_PATTERNS = [
  /acheter/i,
  /commander/i,
  /prix/i,
  /pas cher/i,
  /livraison/i,
  // Spécifique véhicule
  /\d{3}(\s|-)?(hdi|tdi|dci|tsi|tfsi)/i,
  /\d\.\d\s?(l|litres?)/i,
];

// =====================================================
// KPIs R5 DIAGNOSTIC (Symptômes)
// =====================================================

/**
 * KPIs spécifiques aux pages R5 Diagnostic
 * Objectif: Identifier le problème, orienter vers solution
 */
export interface R5DiagnosticKpis {
  /** Sessions sur requêtes symptômes */
  symptomTraffic: number;
  /** Clics vers R4 Référence (comprendre la pièce) */
  clicksToReference: number;
  /** Clics vers R1 Routeur (trouver la pièce) */
  clicksToRouter: number;
  /** Taux de résolution (session avec clic sortant pertinent) */
  resolutionRate: number;
  /** Position moyenne sur requêtes diagnostic */
  avgPosition: number;
  /** Temps sur page (lecture = engagement) - cible: >60s */
  avgTimeOnPage: number;
}

// =====================================================
// KPIs R6 SUPPORT (Satisfaction)
// =====================================================

/**
 * KPIs spécifiques aux pages R6 Support
 * Note: Ces pages sont souvent noindex, KPIs internes
 */
export interface R6SupportKpis {
  /** Visites totales */
  visits: number;
  /** Taux de ticket créé après visite (problème non résolu) - cible: <10% */
  ticketCreationRate: number;
  /** Temps moyen sur FAQ */
  avgTimeOnFaq: number;
  /** Recherches internes après visite (contenu insuffisant) */
  internalSearchRate: number;
}

// =====================================================
// Structure globale des KPIs par rôle
// =====================================================

/**
 * KPIs agrégés pour un rôle donné
 */
export interface RoleKpis {
  role: PageRole;
  period: KpiPeriod;
  health: KpiHealth;
  trend: KpiTrend;
  /** Score global 0-100 */
  score: number;
  /** KPIs spécifiques au rôle */
  metrics:
    | R4ReferenceKpis
    | R3BlogKpis
    | R1RouterKpis
    | R2ProductKpis
    | R5DiagnosticKpis
    | R6SupportKpis;
  /** Alertes actives */
  alerts: KpiAlert[];
  /** Dernière mise à jour */
  updatedAt: Date;
}

/**
 * Alerte KPI
 */
export interface KpiAlert {
  id: string;
  kpiName: string;
  currentValue: number;
  threshold: number;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: Date;
}

// =====================================================
// Seuils de décision par rôle
// =====================================================

/**
 * Seuils pour déclencher des alertes
 */
export const KPI_THRESHOLDS: Record<
  PageRole,
  Record<string, { warning: number; critical: number }>
> = {
  [PageRole.R4_REFERENCE]: {
    definitionCtr: { warning: 3, critical: 1 }, // CTR en %
    avgPosition: { warning: 10, critical: 20 }, // Position moyenne
    positionStability: { warning: 3, critical: 5 }, // Écart-type
  },
  [PageRole.R3_BLOG]: {
    avgCtr: { warning: 2, critical: 1 }, // CTR en %
    pagesPerSession: { warning: 1.2, critical: 1 }, // Pages/session
    bounceRate: { warning: 70, critical: 80 }, // Taux rebond %
  },
  [PageRole.R1_ROUTER]: {
    clickThroughToProduct: { warning: 30, critical: 20 }, // % passage vers R2
    indexCoverageRatio: { warning: 85, critical: 70 }, // % indexation
    avgTimeOnPage: { warning: 60, critical: 120 }, // Temps en secondes (trop long = confus)
  },
  [PageRole.R2_PRODUCT]: {
    addToCartRate: { warning: 3, critical: 1 }, // % ajout panier
    conversionRate: { warning: 0.5, critical: 0.2 }, // % conversion
    avgPositionBuyQueries: { warning: 15, critical: 30 }, // Position
  },
  [PageRole.R5_DIAGNOSTIC]: {
    resolutionRate: { warning: 50, critical: 30 }, // % résolution
    avgTimeOnPage: { warning: 30, critical: 15 }, // Temps lecture (trop court = abandon)
  },
  [PageRole.R6_SUPPORT]: {
    ticketCreationRate: { warning: 15, critical: 25 }, // % tickets (haut = mauvais)
  },
};

// =====================================================
// Requêtes SQL pour collecter les KPIs
// =====================================================

/**
 * Requêtes SQL pour dashboard KPIs
 */
export const KPI_QUERIES = {
  /** Distribution des pages par rôle */
  roleDistribution: `
    SELECT page_role, COUNT(*) as count
    FROM __seo_page
    WHERE page_role IS NOT NULL
    GROUP BY page_role
    ORDER BY page_role
  `,

  /** Pages indexées vs soumises par rôle */
  indexCoverage: `
    SELECT
      page_role,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_indexed = true) as indexed,
      ROUND(COUNT(*) FILTER (WHERE is_indexed = true)::numeric / COUNT(*)::numeric * 100, 2) as coverage_pct
    FROM __seo_page
    WHERE page_role IS NOT NULL
    GROUP BY page_role
  `,

  /** Température par rôle (corrélation crawl) */
  temperatureByRole: `
    SELECT
      page_role,
      temperature,
      COUNT(*) as count
    FROM __seo_page
    WHERE page_role IS NOT NULL
    GROUP BY page_role, temperature
    ORDER BY page_role, temperature
  `,

  /** Maillage santé (liens valides vs invalides) */
  linkHealthByRole: `
    SELECT
      source_role,
      target_role,
      COUNT(*) as link_count,
      CASE
        WHEN source_role = 'R1' AND target_role = 'R2' THEN 'valid'
        WHEN source_role = 'R2' AND target_role IN ('R4', 'R3') THEN 'valid'
        WHEN source_role = 'R3' AND target_role IN ('R4', 'R2') THEN 'valid'
        WHEN source_role = 'R4' AND target_role IN ('R3', 'R5', 'R1') THEN 'valid'
        WHEN source_role = 'R5' AND target_role IN ('R4', 'R1') THEN 'valid'
        ELSE 'invalid'
      END as validity
    FROM __seo_internal_links
    GROUP BY source_role, target_role
    ORDER BY source_role, target_role
  `,
};

// =====================================================
// Types pour le dashboard
// =====================================================

/**
 * Résumé du dashboard KPIs par rôle
 */
export interface KpiDashboardSummary {
  period: KpiPeriod;
  overallHealth: KpiHealth;
  overallScore: number;
  roleKpis: RoleKpis[];
  topAlerts: KpiAlert[];
  recommendations: string[];
  generatedAt: Date;
}

/**
 * Configuration du dashboard
 */
export interface KpiDashboardConfig {
  defaultPeriod: KpiPeriod;
  refreshIntervalMinutes: number;
  alertsEnabled: boolean;
  slackWebhook?: string;
  emailRecipients?: string[];
}
