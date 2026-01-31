/**
 * SEO Types - Centralized exports
 *
 * This file exports all shared SEO types used across the SeoModule sub-modules.
 *
 * @see page-role.types.ts - PageRole definitions, URL patterns, link rules
 * @see seo-kpis.types.ts - KPIs per role (R1-R6)
 * @see seo-pilotage.types.ts - Weekly/monthly pilotage, auto-diagnostics
 */

// =====================================================
// PAGE ROLE - Core SEO classification system
// =====================================================
export {
  // Enums & Types
  PageRole,
  type PageRoleMeta,
  type UrlRolePattern,
  // Constants
  PAGE_ROLE_META,
  PAGE_ROLE_HIERARCHY,
  ALLOWED_LINKS,
  URL_ROLE_PATTERNS,
  // Functions
  getPageRoleFromUrl,
  isLinkAllowed,
  getRoleHierarchyRank,
  isRoleAbove,
} from './page-role.types';

// =====================================================
// SEO KPIS - Metrics per role
// =====================================================
export {
  // Types
  type KpiPeriod,
  type KpiTrend,
  type KpiHealth,
  type KpiSource,
  // Role-specific KPIs
  type R4ReferenceKpis,
  type R3BlogKpis,
  type R1RouterKpis,
  type R2ProductKpis,
  type R5DiagnosticKpis,
  type R6SupportKpis,
  type RoleKpis,
  type KpiAlert,
  // Dashboard
  type KpiDashboardSummary,
  type KpiDashboardConfig,
  // Query patterns (for GSC filtering)
  R4_QUERY_PATTERNS,
  R3_QUERY_PATTERNS,
  R1_QUERY_PATTERNS,
  R2_QUERY_PATTERNS,
  // Thresholds & Queries
  KPI_THRESHOLDS,
  KPI_QUERIES,
} from './seo-kpis.types';

// =====================================================
// SEO PILOTAGE - Monitoring & auto-diagnostics
// =====================================================
export {
  // Weekly types
  type GscPageMetrics,
  type PageMovement,
  type IndexationError,
  type WeeklyReport,
  type WeeklyAlert,
  // Monthly types
  type CannibalizationCluster,
  type ZombiePage,
  type MonthlyAction,
  type MonthlyReport,
  // Auto-diagnostics
  type AutoDiagnosticType,
  type AutoDiagnostic,
  type R3NoImpressionsRule,
  type RouterContaminationRule,
  type R4UnderperformingRule,
  // Cluster health
  type ClusterHealthStatus,
  type ClusterHealthScore,
  type ClusterHealthSummary,
  // Constants & Thresholds
  PILOTAGE_THRESHOLDS,
  AUTO_DECISION_RULES,
  PILOTAGE_QUERIES,
  CLUSTER_HEALTH_THRESHOLDS,
  // Functions
  detectAutoDiagnostics,
  getRecommendedActionForDiagnostic,
  getClusterHealthStatus,
  generateClusterRecommendations,
  // Formatters
  formatWeeklyAlertSlack,
  formatWeeklySummary,
  formatMonthlySummary,
  formatClusterHealthSlack,
} from './seo-pilotage.types';
