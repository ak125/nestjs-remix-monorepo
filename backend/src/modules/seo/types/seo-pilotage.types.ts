/**
 * ============================================
 * TABLE DE PILOTAGE SEO
 * ============================================
 *
 * Structure pour le monitoring hebdomadaire et mensuel
 * des performances SEO par rôle de page.
 */

import { PageRole } from './page-role.types';
import { KpiHealth, KpiTrend } from './seo-kpis.types';

// =====================================================
// PILOTAGE HEBDOMADAIRE (30 min)
// =====================================================

/**
 * Métriques GSC pour une page
 */
export interface GscPageMetrics {
  url: string;
  pageRole: PageRole | null;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
  // Variations vs semaine précédente
  impressionsDelta: number;
  clicksDelta: number;
  ctrDelta: number;
  positionDelta: number;
  // Statut
  trend: KpiTrend;
}

/**
 * Pages qui montent/baissent
 */
export interface PageMovement {
  url: string;
  pageRole: PageRole | null;
  metric: 'impressions' | 'clicks' | 'position';
  previousValue: number;
  currentValue: number;
  changePercent: number;
  direction: 'up' | 'down';
}

/**
 * Erreur d'indexation
 */
export interface IndexationError {
  url: string;
  pageRole: PageRole | null;
  errorType:
    | 'not_indexed'
    | 'crawl_error'
    | 'redirect'
    | 'soft_404'
    | 'blocked_robots'
    | 'noindex'
    | 'canonical_mismatch';
  firstDetected: Date;
  lastChecked: Date;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Rapport hebdomadaire complet
 */
export interface WeeklyReport {
  period: {
    start: Date;
    end: Date;
    weekNumber: number;
  };

  // Résumé global
  summary: {
    totalImpressions: number;
    totalClicks: number;
    avgCtr: number;
    avgPosition: number;
    impressionsDelta: number;
    clicksDelta: number;
    health: KpiHealth;
  };

  // Métriques par rôle
  byRole: Record<
    PageRole,
    {
      pageCount: number;
      impressions: number;
      clicks: number;
      avgCtr: number;
      avgPosition: number;
      trend: KpiTrend;
    }
  >;

  // Top movers
  topGainers: PageMovement[];
  topLosers: PageMovement[];

  // Erreurs d'indexation
  indexationErrors: IndexationError[];
  newErrors: number;
  resolvedErrors: number;

  // Alertes
  alerts: WeeklyAlert[];

  generatedAt: Date;
}

/**
 * Alerte hebdomadaire
 */
export interface WeeklyAlert {
  id: string;
  type:
    | 'traffic_drop'
    | 'position_drop'
    | 'indexation_issue'
    | 'crawl_budget'
    | 'new_competitor';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  affectedUrls: string[];
  recommendedAction: string;
}

// =====================================================
// PILOTAGE MENSUEL (2-3h)
// =====================================================

/**
 * Détection de cannibalisation
 * Plusieurs URLs qui rankent sur les mêmes requêtes
 */
export interface CannibalizationCluster {
  primaryQuery: string;
  searchVolume: number | null;
  urls: Array<{
    url: string;
    pageRole: PageRole | null;
    avgPosition: number;
    impressions: number;
    clicks: number;
  }>;
  // Recommandation
  recommendation: 'merge' | 'differentiate' | 'canonical' | 'noindex' | 'keep';
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Page "zombie" (faible valeur SEO)
 */
export interface ZombiePage {
  url: string;
  pageRole: PageRole | null;

  // Métriques des 90 derniers jours
  impressions90d: number;
  clicks90d: number;
  avgPosition90d: number;

  // Indicateurs de "zombification"
  reasons: Array<
    | 'low_impressions' // < 10 impressions/mois
    | 'zero_clicks' // 0 clics sur 90j
    | 'bad_position' // position > 50
    | 'no_backlinks' // 0 liens entrants
    | 'thin_content' // contenu < 300 mots
    | 'duplicate_content' // contenu dupliqué
    | 'orphan' // pas de liens internes
  >;

  // Score zombie (0-100, 100 = très zombie)
  zombieScore: number;

  // Recommandation
  recommendation:
    | 'delete'
    | 'merge'
    | 'improve'
    | 'noindex'
    | 'redirect'
    | 'keep';
  mergeTarget?: string;
  redirectTarget?: string;
}

/**
 * Action mensuelle à effectuer
 */
export interface MonthlyAction {
  id: string;
  type:
    | 'add_page'
    | 'merge_pages'
    | 'delete_page'
    | 'noindex'
    | 'redirect'
    | 'improve_content';
  priority: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  targetUrls: string[];
  description: string;
  deadline?: Date;
  status: 'pending' | 'in_progress' | 'done' | 'skipped';
}

/**
 * Rapport mensuel complet
 */
export interface MonthlyReport {
  period: {
    start: Date;
    end: Date;
    month: number;
    year: number;
  };

  // Résumé vs mois précédent
  summary: {
    totalImpressions: number;
    totalClicks: number;
    avgCtr: number;
    avgPosition: number;
    impressionsDeltaPercent: number;
    clicksDeltaPercent: number;
    indexedPages: number;
    indexedPagesChange: number;
    health: KpiHealth;
  };

  // Cannibalisation
  cannibalization: {
    clustersFound: number;
    highPriorityClusters: CannibalizationCluster[];
    estimatedTrafficLoss: number;
  };

  // Pages zombies
  zombiePages: {
    total: number;
    byRole: Record<PageRole, number>;
    topZombies: ZombiePage[];
    estimatedCrawlBudgetWaste: number;
  };

  // Couverture par rôle
  roleCoverage: Record<
    PageRole,
    {
      totalPages: number;
      indexedPages: number;
      indexedPercent: number;
      avgImpressions: number;
      avgClicks: number;
      avgPosition: number;
      zombieCount: number;
      cannibalizationCount: number;
    }
  >;

  // Actions recommandées
  actions: MonthlyAction[];

  // Comparaison M-1, M-3, M-12
  historicalComparison: {
    vsLastMonth: { impressions: number; clicks: number; position: number };
    vs3MonthsAgo: { impressions: number; clicks: number; position: number };
    vsLastYear: {
      impressions: number;
      clicks: number;
      position: number;
    } | null;
  };

  generatedAt: Date;
}

// =====================================================
// SEUILS DE DÉTECTION
// =====================================================

/**
 * Seuils pour détecter les anomalies
 */
export const PILOTAGE_THRESHOLDS = {
  // Hebdomadaire
  weekly: {
    /** Chute de trafic critique (%) */
    trafficDropCritical: -30,
    /** Chute de trafic warning (%) */
    trafficDropWarning: -15,
    /** Chute de position critique (positions) */
    positionDropCritical: 10,
    /** Chute de position warning (positions) */
    positionDropWarning: 5,
    /** Top movers à afficher */
    topMoversLimit: 10,
  },

  // Mensuel - Zombies
  zombies: {
    /** Impressions max sur 90j pour être "zombie" */
    maxImpressions90d: 30,
    /** Position min pour être "zombie" */
    minPosition: 50,
    /** Score zombie min pour recommander suppression */
    deleteThreshold: 80,
    /** Score zombie min pour recommander noindex */
    noindexThreshold: 60,
  },

  // Mensuel - Cannibalisation
  cannibalization: {
    /** Écart de position max entre URLs pour cannibalisation */
    positionGap: 20,
    /** Impressions min pour considérer la requête */
    minImpressions: 100,
    /** Nombre min d'URLs sur même requête */
    minUrlsPerQuery: 2,
  },
};

// =====================================================
// RÈGLES DE DÉCISION AUTOMATIQUE (ULTRA ROBUSTES)
// =====================================================

/**
 * Types de diagnostic automatique
 */
export type AutoDiagnosticType =
  | 'r3_no_impressions' // R3 sans impressions → enrichir ou fusionner
  | 'cannibalization' // 2+ pages sur même requête → clarifier rôle
  | 'router_contamination' // R1 attire requêtes symptômes → nettoyer
  | 'r4_underperforming'; // R4 ne ranke pas mais R3 oui → définition faible

/**
 * Diagnostic automatique d'une page
 */
export interface AutoDiagnostic {
  type: AutoDiagnosticType;
  severity: 'critical' | 'warning' | 'info';
  url: string;
  pageRole: PageRole | null;
  diagnosis: string;
  recommendedActions: string[];
  relatedUrls?: string[];
  metrics?: Record<string, number | string>;
}

/**
 * Règle: R3 sans impressions après X semaines
 * Diagnostic: Contenu R3 non pertinent ou mal ciblé
 */
export interface R3NoImpressionsRule {
  minWeeksWithoutImpressions: number; // Défaut: 4 semaines
  minImpressionThreshold: number; // Défaut: 10 impressions
}

/**
 * Règle: Détection de contamination R1 (routeur)
 * Si un routeur attire des requêtes "symptômes", il est contaminé
 */
export interface RouterContaminationRule {
  symptomKeywords: string[]; // Mots-clés symptômes
  maxSymptomQueriesPercent: number; // Max % de requêtes symptômes (défaut: 10%)
}

/**
 * Règle: R4 sous-performant vs R3
 * Si R4 ne ranke pas mais R3 sur même sujet oui → définition faible
 */
export interface R4UnderperformingRule {
  minR3Position: number; // Position max du R3 (défaut: 30)
  maxR4Position: number; // Position min du R4 (défaut: 50) - si > = problème
  minPositionGap: number; // Écart min (défaut: 20 positions)
}

/**
 * Configuration des règles de décision automatique
 */
export const AUTO_DECISION_RULES = {
  /**
   * R3 sans impressions après X semaines → ENRICHIR ou FUSIONNER
   */
  r3NoImpressions: {
    minWeeksWithoutImpressions: 4,
    minImpressionThreshold: 10,
    actions: [
      'Vérifier la pertinence du sujet',
      'Analyser les requêtes GSC des concurrents',
      'Enrichir avec du contenu plus ciblé',
      'OU fusionner avec un article R3 similaire performant',
    ],
  } as R3NoImpressionsRule & { actions: string[] },

  /**
   * 2+ pages cannibalisent → CLARIFIER rôle + maillage + titres
   */
  cannibalization: {
    minUrlsPerQuery: 2,
    minImpressions: 50,
    actions: [
      'Clarifier le rôle de chaque page (R1 ≠ R2 ≠ R3 ≠ R4)',
      'Ajuster le maillage interne (hiérarchie des rôles)',
      'Différencier les titles et H1',
      'OU fusionner si intentions identiques',
    ],
  },

  /**
   * Routeur R1 attire requêtes "symptômes" → ROUTEUR CONTAMINÉ
   */
  routerContamination: {
    symptomKeywords: [
      'bruit',
      'problème',
      'panne',
      'symptôme',
      'quand changer',
      'comment savoir',
      'usé',
      'cassé',
      'défaillant',
      'vibration',
      'claquement',
      'fuite',
      'pourquoi',
      'causes',
      'diagnostic',
    ],
    maxSymptomQueriesPercent: 10,
    actions: [
      'Supprimer le contenu symptôme/diagnostic du R1',
      'Créer/enrichir les pages R5 Diagnostic dédiées',
      'Mettre à jour le maillage R1 → R5',
      'Nettoyer les meta descriptions de mots symptômes',
    ],
  } as RouterContaminationRule & { actions: string[] },

  /**
   * R4 ne ranke pas mais R3 oui → R4 MANQUE de "définition tranchée"
   */
  r4Underperforming: {
    minR3Position: 30, // Le R3 doit être en top 30
    maxR4Position: 50, // Le R4 est au-delà de 50 = problème
    minPositionGap: 20, // Écart de 20+ positions = alerte
    actions: [
      'Renforcer la définition "tranchée" du R4 (qu\'EST-CE que c\'est)',
      'Ajouter plus de liens entrants vers R4 depuis R3 et R5',
      'Vérifier le Schema.org DefinedTerm',
      'Simplifier le contenu R4 (moins verbeux, plus canonique)',
    ],
  } as R4UnderperformingRule & { actions: string[] },
};

/**
 * Détecte les diagnostics automatiques pour une page
 */
export function detectAutoDiagnostics(
  url: string,
  pageRole: PageRole | null,
  metrics: {
    impressions: number;
    clicks: number;
    position: number;
    queries: string[];
    weeksWithoutImpressions?: number;
    relatedPages?: Array<{ url: string; role: PageRole; position: number }>;
  },
): AutoDiagnostic[] {
  const diagnostics: AutoDiagnostic[] = [];

  // === R3 sans impressions ===
  if (pageRole === PageRole.R3_BLOG) {
    const weeksNoImpressions = metrics.weeksWithoutImpressions ?? 0;
    if (
      weeksNoImpressions >=
        AUTO_DECISION_RULES.r3NoImpressions.minWeeksWithoutImpressions &&
      metrics.impressions <
        AUTO_DECISION_RULES.r3NoImpressions.minImpressionThreshold
    ) {
      diagnostics.push({
        type: 'r3_no_impressions',
        severity: 'warning',
        url,
        pageRole,
        diagnosis: `R3 sans impressions depuis ${weeksNoImpressions} semaines`,
        recommendedActions: AUTO_DECISION_RULES.r3NoImpressions.actions,
        metrics: { weeksNoImpressions, impressions: metrics.impressions },
      });
    }
  }

  // === Contamination R1 ===
  if (pageRole === PageRole.R1_ROUTER && metrics.queries.length > 0) {
    const symptomQueries = metrics.queries.filter((q) =>
      AUTO_DECISION_RULES.routerContamination.symptomKeywords.some((kw) =>
        q.toLowerCase().includes(kw),
      ),
    );
    const symptomPercent =
      (symptomQueries.length / metrics.queries.length) * 100;

    if (
      symptomPercent >
      AUTO_DECISION_RULES.routerContamination.maxSymptomQueriesPercent
    ) {
      diagnostics.push({
        type: 'router_contamination',
        severity: 'critical',
        url,
        pageRole,
        diagnosis: `R1 contaminé: ${symptomPercent.toFixed(1)}% de requêtes symptômes`,
        recommendedActions: AUTO_DECISION_RULES.routerContamination.actions,
        metrics: {
          symptomPercent: Math.round(symptomPercent),
          symptomQueries: symptomQueries.slice(0, 5).join(', '),
        },
      });
    }
  }

  // === R4 sous-performant vs R3 ===
  if (pageRole === PageRole.R4_REFERENCE && metrics.relatedPages) {
    const relatedR3 = metrics.relatedPages.find(
      (p) =>
        p.role === PageRole.R3_BLOG &&
        p.position <= AUTO_DECISION_RULES.r4Underperforming.minR3Position,
    );

    if (
      relatedR3 &&
      metrics.position > AUTO_DECISION_RULES.r4Underperforming.maxR4Position &&
      metrics.position - relatedR3.position >=
        AUTO_DECISION_RULES.r4Underperforming.minPositionGap
    ) {
      diagnostics.push({
        type: 'r4_underperforming',
        severity: 'warning',
        url,
        pageRole,
        diagnosis: `R4 position ${metrics.position.toFixed(1)} vs R3 position ${relatedR3.position.toFixed(1)}`,
        recommendedActions: AUTO_DECISION_RULES.r4Underperforming.actions,
        relatedUrls: [relatedR3.url],
        metrics: {
          r4Position: metrics.position,
          r3Position: relatedR3.position,
          gap: metrics.position - relatedR3.position,
        },
      });
    }
  }

  return diagnostics;
}

/**
 * Génère l'action recommandée pour un diagnostic
 */
export function getRecommendedActionForDiagnostic(
  diagnostic: AutoDiagnostic,
): string {
  switch (diagnostic.type) {
    case 'r3_no_impressions':
      return 'ENRICHIR contenu ou FUSIONNER avec article performant';
    case 'cannibalization':
      return 'CLARIFIER rôles + DIFFÉRENCIER titres';
    case 'router_contamination':
      return 'NETTOYER R1 + CRÉER pages R5 Diagnostic';
    case 'r4_underperforming':
      return 'RENFORCER définition R4 + AJOUTER liens entrants';
    default:
      return 'Analyser manuellement';
  }
}

// =====================================================
// REQUÊTES SQL POUR PILOTAGE
// =====================================================

/**
 * Requêtes SQL pour générer les rapports
 */
export const PILOTAGE_QUERIES = {
  /** Distribution des pages par rôle et statut d'indexation */
  roleIndexationStatus: `
    SELECT
      sp.page_role,
      COUNT(*) as total_pages,
      COUNT(*) FILTER (WHERE si.is_indexed = true) as indexed,
      COUNT(*) FILTER (WHERE si.is_indexed = false OR si.is_indexed IS NULL) as not_indexed,
      ROUND(
        COUNT(*) FILTER (WHERE si.is_indexed = true)::numeric /
        NULLIF(COUNT(*)::numeric, 0) * 100, 2
      ) as indexed_percent
    FROM __seo_page sp
    LEFT JOIN __seo_index_status si ON sp.url = si.url
    WHERE sp.page_role IS NOT NULL
    GROUP BY sp.page_role
    ORDER BY sp.page_role
  `,

  /** Pages avec erreurs d'indexation par rôle */
  indexationErrorsByRole: `
    SELECT
      sp.page_role,
      sp.url,
      sp.meta_robots,
      sp.canonical_url,
      si.is_indexed,
      si.last_crawl_at,
      si.crawl_count_30d
    FROM __seo_page sp
    LEFT JOIN __seo_index_status si ON sp.url = si.url
    WHERE sp.page_role IS NOT NULL
      AND (si.is_indexed = false OR si.is_indexed IS NULL)
      AND sp.is_indexable_hint = true
    ORDER BY sp.page_role, sp.url
    LIMIT 100
  `,

  /** Candidates zombies (pages à faible trafic) */
  zombieCandidates: `
    SELECT
      sp.url,
      sp.page_role,
      sp.temperature,
      si.is_indexed,
      si.crawl_count_30d,
      eh.entity_score,
      eh.inbound_links,
      eh.risk_flag
    FROM __seo_page sp
    LEFT JOIN __seo_index_status si ON sp.url = si.url
    LEFT JOIN __seo_entity_health eh ON sp.url = eh.url
    WHERE sp.page_role IS NOT NULL
      AND sp.temperature IN ('cold', 'exclude')
      AND (eh.entity_score < 20 OR eh.entity_score IS NULL)
    ORDER BY COALESCE(eh.entity_score, 0) ASC
    LIMIT 200
  `,

  /** Santé globale par rôle (pour dashboard) */
  roleHealthSummary: `
    SELECT
      sp.page_role,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE sp.temperature = 'hot') as hot,
      COUNT(*) FILTER (WHERE sp.temperature = 'stable') as stable,
      COUNT(*) FILTER (WHERE sp.temperature = 'cold') as cold,
      COUNT(*) FILTER (WHERE eh.risk_flag IS NOT NULL) as with_risk,
      AVG(COALESCE(eh.entity_score, 50)) as avg_score
    FROM __seo_page sp
    LEFT JOIN __seo_entity_health eh ON sp.url = eh.url
    WHERE sp.page_role IS NOT NULL
    GROUP BY sp.page_role
    ORDER BY sp.page_role
  `,

  /** Détection R1 contaminés (requêtes symptômes) */
  routerContamination: `
    -- Requête théorique: nécessite données GSC
    -- À adapter selon la table de données GSC disponible
    WITH symptom_keywords AS (
      SELECT unnest(ARRAY[
        'bruit', 'problème', 'panne', 'symptôme', 'quand changer',
        'comment savoir', 'usé', 'cassé', 'défaillant', 'vibration',
        'claquement', 'fuite', 'pourquoi', 'causes', 'diagnostic'
      ]) as keyword
    )
    SELECT
      sp.url,
      sp.page_role,
      COUNT(*) as total_queries,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM symptom_keywords sk
        WHERE gsc.query ILIKE '%' || sk.keyword || '%'
      )) as symptom_queries,
      ROUND(
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM symptom_keywords sk
          WHERE gsc.query ILIKE '%' || sk.keyword || '%'
        ))::numeric / NULLIF(COUNT(*)::numeric, 0) * 100, 2
      ) as symptom_percent
    FROM __seo_page sp
    JOIN gsc_query_data gsc ON sp.url = gsc.url  -- À adapter
    WHERE sp.page_role = 'R1'
    GROUP BY sp.url, sp.page_role
    HAVING COUNT(*) > 10
    ORDER BY symptom_percent DESC
  `,

  /** Détection R4 sous-performant vs R3 */
  r4UnderperformingVsR3: `
    -- Compare position R4 vs R3 sur mêmes sujets
    WITH page_positions AS (
      SELECT
        sp.url,
        sp.page_role,
        -- Extraire le slug principal (ex: /reference-auto/embrayage -> embrayage)
        REGEXP_REPLACE(sp.url, '^.*/([^/]+)/?$', '\\1') as topic_slug,
        gsc.avg_position
      FROM __seo_page sp
      JOIN gsc_aggregated gsc ON sp.url = gsc.url  -- À adapter
      WHERE sp.page_role IN ('R3', 'R4')
    )
    SELECT
      r4.url as r4_url,
      r4.topic_slug,
      r4.avg_position as r4_position,
      r3.url as r3_url,
      r3.avg_position as r3_position,
      r4.avg_position - r3.avg_position as position_gap
    FROM page_positions r4
    JOIN page_positions r3 ON r4.topic_slug = r3.topic_slug
    WHERE r4.page_role = 'R4'
      AND r3.page_role = 'R3'
      AND r4.avg_position > 50
      AND r3.avg_position <= 30
      AND (r4.avg_position - r3.avg_position) >= 20
    ORDER BY position_gap DESC
  `,

  /** R3 sans impressions (candidats enrichissement/fusion) */
  r3NoImpressions: `
    SELECT
      sp.url,
      sp.page_role,
      sp.created_at,
      EXTRACT(WEEK FROM NOW()) - EXTRACT(WEEK FROM sp.created_at) as weeks_since_creation,
      COALESCE(gsc.impressions_28d, 0) as impressions,
      COALESCE(gsc.clicks_28d, 0) as clicks
    FROM __seo_page sp
    LEFT JOIN gsc_aggregated gsc ON sp.url = gsc.url  -- À adapter
    WHERE sp.page_role = 'R3'
      AND sp.created_at < NOW() - INTERVAL '4 weeks'
      AND COALESCE(gsc.impressions_28d, 0) < 10
    ORDER BY impressions ASC
    LIMIT 50
  `,
};

// =====================================================
// TEMPLATES DE RAPPORT
// =====================================================

/**
 * Template Slack/Email pour alerte hebdomadaire
 */
export function formatWeeklyAlertSlack(alert: WeeklyAlert): string {
  const emoji =
    alert.severity === 'critical'
      ? '🚨'
      : alert.severity === 'warning'
        ? '⚠️'
        : 'ℹ️';
  return `${emoji} *${alert.type.replace(/_/g, ' ').toUpperCase()}*
${alert.message}
${alert.affectedUrls.length > 0 ? `Urls: ${alert.affectedUrls.slice(0, 3).join(', ')}${alert.affectedUrls.length > 3 ? ` (+${alert.affectedUrls.length - 3})` : ''}` : ''}
Action: ${alert.recommendedAction}`;
}

/**
 * Template pour résumé hebdomadaire
 */
export function formatWeeklySummary(report: WeeklyReport): string {
  const healthEmoji =
    report.summary.health === 'healthy'
      ? '✅'
      : report.summary.health === 'warning'
        ? '⚠️'
        : '🚨';

  return `📊 *Rapport SEO Semaine ${report.period.weekNumber}*
${healthEmoji} Santé: ${report.summary.health.toUpperCase()}

📈 Impressions: ${report.summary.totalImpressions.toLocaleString()} (${report.summary.impressionsDelta >= 0 ? '+' : ''}${report.summary.impressionsDelta}%)
🖱️ Clics: ${report.summary.totalClicks.toLocaleString()} (${report.summary.clicksDelta >= 0 ? '+' : ''}${report.summary.clicksDelta}%)
📍 Position moy: ${report.summary.avgPosition.toFixed(1)}

🔼 Top gainers: ${report.topGainers.length}
🔽 Top losers: ${report.topLosers.length}
❌ Erreurs indexation: ${report.indexationErrors.length} (${report.newErrors} nouvelles)

${report.alerts.length > 0 ? `⚡ ${report.alerts.length} alertes actives` : '✅ Aucune alerte'}`;
}

/**
 * Template pour résumé mensuel
 */
export function formatMonthlySummary(report: MonthlyReport): string {
  return `📊 *Rapport SEO Mensuel - ${report.period.month}/${report.period.year}*

📈 Performance globale:
• Impressions: ${report.summary.totalImpressions.toLocaleString()} (${report.summary.impressionsDeltaPercent >= 0 ? '+' : ''}${report.summary.impressionsDeltaPercent.toFixed(1)}%)
• Clics: ${report.summary.totalClicks.toLocaleString()} (${report.summary.clicksDeltaPercent >= 0 ? '+' : ''}${report.summary.clicksDeltaPercent.toFixed(1)}%)
• Position moyenne: ${report.summary.avgPosition.toFixed(1)}
• Pages indexées: ${report.summary.indexedPages} (${report.summary.indexedPagesChange >= 0 ? '+' : ''}${report.summary.indexedPagesChange})

🔀 Cannibalisation:
• ${report.cannibalization.clustersFound} clusters détectés
• ${report.cannibalization.highPriorityClusters.length} prioritaires
• Perte estimée: ~${report.cannibalization.estimatedTrafficLoss} clics/mois

🧟 Pages zombies:
• ${report.zombiePages.total} pages à faible valeur
• Budget crawl gaspillé: ~${report.zombiePages.estimatedCrawlBudgetWaste}%

📋 Actions recommandées: ${report.actions.length}
• Haute priorité: ${report.actions.filter((a) => a.priority === 'high').length}
• Moyenne priorité: ${report.actions.filter((a) => a.priority === 'medium').length}`;
}

// =====================================================
// PHASE 3.6: SCORE "SANTÉ DU CLUSTER" SEO
// =====================================================

/**
 * Statut de santé d'un cluster
 */
export type ClusterHealthStatus = 'excellent' | 'good' | 'warning' | 'critical';

/**
 * Seuils de configuration pour le score cluster
 */
export const CLUSTER_HEALTH_THRESHOLDS = {
  /** Nombre minimum de liens internes vers R4 */
  r4InboundLinksMin: 3,
  /** Nombre maximum de mots pour R1 Routeur */
  routerMaxWords: 200,
  /** Nombre minimum d'articles R3 par cluster */
  r3ArticlesMin: 3,
  /** Croissance MoM minimum (%) */
  impressionsMoMGrowthMin: 5,
};

/**
 * Score de santé d'un cluster SEO (par gamme)
 *
 * Un cluster = une gamme avec ses pages R1 (routeur), R2 (produit),
 * R3 (blog), R4 (référence) et R5 (diagnostic).
 *
 * Score final: 0-5 points (1 point par critère validé)
 */
export interface ClusterHealthScore {
  // Identification
  gammeId: number;
  gammeName: string;
  gammeSlug: string;

  // Score final (0-5)
  totalScore: number;
  maxScore: 5;
  healthStatus: ClusterHealthStatus;

  // Détail des 5 critères
  criteria: {
    /**
     * Critère 1: R4 reçoit ≥ N liens internes
     * Vérifie que la page référence est bien maillée
     */
    r4InboundLinks: {
      score: 0 | 1;
      actual: number;
      threshold: number;
      passed: boolean;
    };

    /**
     * Critère 2: Aucun conflit de rôle (severity: error)
     * Vérifie que les pages respectent leur rôle SEO
     */
    noRoleConflict: {
      score: 0 | 1;
      violationsCount: number;
      violations: Array<{
        url: string;
        type: string;
        message: string;
      }>;
      passed: boolean;
    };

    /**
     * Critère 3: R1 Routeur < 200 mots
     * Vérifie que le routeur reste léger (pas de contamination)
     */
    routerWordCount: {
      score: 0 | 1;
      actual: number;
      threshold: number;
      passed: boolean;
    };

    /**
     * Critère 4: R3 couvre ≥ 3 intentions longue traîne
     * Vérifie la couverture éditoriale du cluster
     */
    r3LongTailCoverage: {
      score: 0 | 1;
      articlesCount: number;
      threshold: number;
      articleUrls: string[];
      passed: boolean;
    };

    /**
     * Critère 5: Croissance impressions MoM ≥ 5%
     * Vérifie la dynamique de visibilité du cluster
     */
    impressionsMoM: {
      score: 0 | 1;
      currentImpressions: number;
      previousImpressions: number;
      changePercent: number;
      threshold: number;
      passed: boolean;
    };
  };

  // Recommandations basées sur les critères échoués
  recommendations: string[];

  // Metadata
  calculatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
}

/**
 * Détermine le statut de santé à partir du score (0-5)
 */
export function getClusterHealthStatus(score: number): ClusterHealthStatus {
  if (score === 5) return 'excellent';
  if (score >= 4) return 'good';
  if (score >= 2) return 'warning';
  return 'critical';
}

/**
 * Génère les recommandations basées sur les critères échoués
 */
export function generateClusterRecommendations(
  criteria: ClusterHealthScore['criteria'],
): string[] {
  const recommendations: string[] = [];

  if (!criteria.r4InboundLinks.passed) {
    const missing =
      criteria.r4InboundLinks.threshold - criteria.r4InboundLinks.actual;
    recommendations.push(
      `Ajouter ${missing} lien(s) vers la page R4 Référence depuis R3/R5`,
    );
  }

  if (!criteria.noRoleConflict.passed) {
    recommendations.push(
      `Corriger ${criteria.noRoleConflict.violationsCount} conflit(s) de rôle (contenu interdit pour le rôle)`,
    );
  }

  if (!criteria.routerWordCount.passed) {
    recommendations.push(
      `Réduire le R1 Routeur: ${criteria.routerWordCount.actual} mots → max ${criteria.routerWordCount.threshold} mots`,
    );
  }

  if (!criteria.r3LongTailCoverage.passed) {
    const missing =
      criteria.r3LongTailCoverage.threshold -
      criteria.r3LongTailCoverage.articlesCount;
    recommendations.push(
      `Créer ${missing} article(s) R3 supplémentaires pour couvrir les intentions longue traîne`,
    );
  }

  if (!criteria.impressionsMoM.passed) {
    const change = criteria.impressionsMoM.changePercent;
    if (change < 0) {
      recommendations.push(
        `Améliorer la visibilité: impressions en baisse de ${Math.abs(change).toFixed(1)}% MoM`,
      );
    } else {
      recommendations.push(
        `Croissance insuffisante: +${change.toFixed(1)}% MoM (objectif: +${criteria.impressionsMoM.threshold}%)`,
      );
    }
  }

  return recommendations;
}

/**
 * Résumé de tous les clusters pour le dashboard
 */
export interface ClusterHealthSummary {
  totalClusters: number;
  byStatus: Record<ClusterHealthStatus, number>;
  avgScore: number;
  criticalClusters: Array<{
    gammeId: number;
    gammeName: string;
    score: number;
    topIssue: string;
  }>;
  topPerformers: Array<{
    gammeId: number;
    gammeName: string;
    score: number;
    impressions: number;
  }>;
}

/**
 * Template Slack pour score cluster
 */
export function formatClusterHealthSlack(cluster: ClusterHealthScore): string {
  const statusEmoji = {
    excellent: '🟢',
    good: '🟡',
    warning: '🟠',
    critical: '🔴',
  };

  const criteriaList = [
    cluster.criteria.r4InboundLinks.passed ? '✅' : '❌',
    cluster.criteria.noRoleConflict.passed ? '✅' : '❌',
    cluster.criteria.routerWordCount.passed ? '✅' : '❌',
    cluster.criteria.r3LongTailCoverage.passed ? '✅' : '❌',
    cluster.criteria.impressionsMoM.passed ? '✅' : '❌',
  ].join(' ');

  return `${statusEmoji[cluster.healthStatus]} *${cluster.gammeName}* - Score: ${cluster.totalScore}/${cluster.maxScore}
Critères: ${criteriaList}
${cluster.recommendations.length > 0 ? `⚡ ${cluster.recommendations[0]}` : '✅ Tous les critères validés'}`;
}
