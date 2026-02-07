import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { RpcGateService } from '../../../security/rpc-gate/rpc-gate.service';
import { DatabaseException, ErrorCodes } from '../../../common/exceptions';
import { PageRole } from '../types/page-role.types';
import {
  WeeklyReport,
  MonthlyReport,
  ZombiePage,
  CannibalizationCluster,
  IndexationError,
  WeeklyAlert,
  MonthlyAction,
  PILOTAGE_QUERIES,
  // Auto-diagnostics
  AutoDiagnostic,
  AutoDiagnosticType,
  AUTO_DECISION_RULES,
  detectAutoDiagnostics,
  getRecommendedActionForDiagnostic,
} from '../types/seo-pilotage.types';
import { KpiHealth } from '../types/seo-kpis.types';

/**
 * Résultat de l'analyse automatique des diagnostics SEO
 */
export interface AutoDiagnosticsReport {
  generatedAt: Date;
  totalDiagnostics: number;
  bySeverity: {
    critical: number;
    warning: number;
    info: number;
  };
  byType: Record<AutoDiagnosticType, number>;
  diagnostics: AutoDiagnostic[];
  topActions: string[];
}

/**
 * Service de Pilotage SEO
 *
 * Génère les rapports hebdomadaires et mensuels pour le monitoring SEO.
 * Source des données: tables __seo_*, GSC (via logs), index status.
 */
@Injectable()
export class SeoPilotageService extends SupabaseBaseService {
  protected override readonly logger = new Logger(SeoPilotageService.name);

  constructor(rpcGate: RpcGateService) {
    super();
    this.rpcGate = rpcGate;
  }

  /**
   * 🛡️ SÉCURITÉ: Valide que la requête SQL est READ-ONLY
   * Refuse: DELETE, UPDATE, INSERT, DROP, TRUNCATE, ALTER, GRANT, REVOKE
   * Refuse: Multiple statements (;)
   * Limite: 5000 caractères max
   */
  private validateReadOnlyQuery(sql: string): void {
    const MAX_QUERY_LENGTH = 5000;

    // 1. Vérifier longueur
    if (sql.length > MAX_QUERY_LENGTH) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.SQL_INJECTION,
        message: `SQL query exceeds max length (${MAX_QUERY_LENGTH} chars)`,
      });
    }

    // 2. Vérifier statements multiples (après suppression des strings)
    const sqlWithoutStrings = sql.replace(/'[^']*'/g, '');
    if (sqlWithoutStrings.includes(';')) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.SQL_INJECTION,
        message: 'Multiple SQL statements are not allowed',
      });
    }

    // 3. Vérifier que c'est SELECT ou EXPLAIN uniquement
    const trimmedSql = sql.trim().toUpperCase();
    const allowedPrefixes = ['SELECT', 'EXPLAIN', 'WITH'];
    const startsWithAllowed = allowedPrefixes.some((prefix) =>
      trimmedSql.startsWith(prefix),
    );

    if (!startsWithAllowed) {
      throw new DatabaseException({
        code: ErrorCodes.SEO.SQL_INJECTION,
        message: 'Only SELECT, EXPLAIN, and WITH queries are allowed',
      });
    }

    // 4. Vérifier absence de mots-clés dangereux
    const dangerousKeywords = [
      'DELETE',
      'UPDATE',
      'INSERT',
      'DROP',
      'TRUNCATE',
      'ALTER',
      'GRANT',
      'REVOKE',
      'CREATE',
    ];

    for (const keyword of dangerousKeywords) {
      // Regex: mot-clé comme token isolé (pas dans un identifiant)
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(sqlWithoutStrings)) {
        throw new DatabaseException({
          code: ErrorCodes.SEO.SQL_INJECTION,
          message: `Dangerous SQL keyword detected: ${keyword}`,
        });
      }
    }
  }

  // =====================================================
  // RAPPORT HEBDOMADAIRE
  // =====================================================

  /**
   * Génère le rapport hebdomadaire (30 min review)
   */
  async generateWeeklyReport(): Promise<WeeklyReport> {
    this.logger.log('📊 Génération rapport hebdomadaire...');

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Dimanche
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // 1. Récupérer santé par rôle
    const roleHealth = await this.getRoleHealthSummary();

    // 2. Récupérer erreurs d'indexation
    const indexationErrors = await this.getIndexationErrors();

    // 3. Générer alertes
    const alerts = this.generateWeeklyAlerts(roleHealth, indexationErrors);

    // 4. Construire le rapport
    const report: WeeklyReport = {
      period: {
        start: weekStart,
        end: weekEnd,
        weekNumber: this.getWeekNumber(now),
      },
      summary: {
        totalImpressions: 0, // TODO: Intégrer GSC API
        totalClicks: 0,
        avgCtr: 0,
        avgPosition: 0,
        impressionsDelta: 0,
        clicksDelta: 0,
        health: this.calculateOverallHealth(roleHealth),
      },
      byRole: this.buildRoleMetrics(roleHealth),
      topGainers: [], // TODO: Calculer depuis GSC data
      topLosers: [],
      indexationErrors,
      newErrors: indexationErrors.filter(
        (e) => e.firstDetected > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      ).length,
      resolvedErrors: 0,
      alerts,
      generatedAt: new Date(),
    };

    this.logger.log(`✅ Rapport hebdomadaire généré: ${alerts.length} alertes`);
    return report;
  }

  /**
   * Récupère la santé par rôle depuis la DB
   * 🛡️ Utilise callRpc() via RPC Safety Gate avec validation SQL
   */
  private async getRoleHealthSummary(): Promise<
    Array<{
      page_role: PageRole;
      total: number;
      hot: number;
      stable: number;
      cold: number;
      with_risk: number;
      avg_score: number;
    }>
  > {
    const sql = PILOTAGE_QUERIES.roleHealthSummary;

    // 🛡️ Validation AVANT envoi - refuse requêtes non-SELECT
    this.validateReadOnlyQuery(sql);

    // 🛡️ Appel via RPC Safety Gate
    const { data, error } = await this.callRpc<any>(
      'exec_sql',
      { sql },
      {
        source: 'admin',
        role: 'service_role',
      },
    );

    if (error) {
      this.logger.error('Erreur récupération santé par rôle:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Récupère les erreurs d'indexation
   */
  private async getIndexationErrors(): Promise<IndexationError[]> {
    const { data, error } = await this.supabase
      .from('__seo_page')
      .select(
        `
        url,
        page_role,
        meta_robots,
        canonical_url,
        is_indexable_hint,
        created_at
      `,
      )
      .eq('is_indexable_hint', true)
      .limit(100);

    if (error) {
      this.logger.error('Erreur récupération erreurs indexation:', error);
      return [];
    }

    // Pour l'instant, on simule les erreurs basées sur meta_robots
    return (data || [])
      .filter((page) => page.meta_robots?.includes('noindex'))
      .map((page) => ({
        url: page.url,
        pageRole: page.page_role as PageRole | null,
        errorType: 'noindex' as const,
        firstDetected: new Date(page.created_at),
        lastChecked: new Date(),
        severity: 'warning' as const,
      }));
  }

  /**
   * Génère les alertes hebdomadaires
   */
  private generateWeeklyAlerts(
    roleHealth: Array<{
      page_role: PageRole;
      with_risk: number;
      avg_score: number;
    }>,
    indexationErrors: IndexationError[],
  ): WeeklyAlert[] {
    const alerts: WeeklyAlert[] = [];

    // Alerte: Rôles avec beaucoup de risques
    for (const role of roleHealth) {
      if (role.with_risk > 10) {
        alerts.push({
          id: `risk-${role.page_role}`,
          type: 'indexation_issue',
          severity: role.with_risk > 50 ? 'critical' : 'warning',
          message: `${role.with_risk} pages ${role.page_role} avec risques détectés`,
          affectedUrls: [],
          recommendedAction:
            'Auditer les pages et corriger les problèmes de maillage/canoniques',
        });
      }
    }

    // Alerte: Nouvelles erreurs d'indexation
    const newErrors = indexationErrors.filter(
      (e) => e.firstDetected > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    if (newErrors.length > 5) {
      alerts.push({
        id: 'new-indexation-errors',
        type: 'indexation_issue',
        severity: newErrors.length > 20 ? 'critical' : 'warning',
        message: `${newErrors.length} nouvelles erreurs d'indexation cette semaine`,
        affectedUrls: newErrors.slice(0, 5).map((e) => e.url),
        recommendedAction:
          'Vérifier les causes et corriger (robots.txt, noindex, redirects)',
      });
    }

    return alerts;
  }

  // =====================================================
  // RAPPORT MENSUEL
  // =====================================================

  /**
   * Génère le rapport mensuel (2-3h review)
   */
  async generateMonthlyReport(): Promise<MonthlyReport> {
    this.logger.log('📊 Génération rapport mensuel...');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 1. Détecter les pages zombies
    const zombiePages = await this.detectZombiePages();

    // 2. Détecter la cannibalisation
    const cannibalization = await this.detectCannibalization();

    // 3. Récupérer couverture par rôle
    const roleCoverage = await this.getRoleCoverage();

    // 4. Générer actions recommandées
    const actions = this.generateMonthlyActions(zombiePages, cannibalization);

    const report: MonthlyReport = {
      period: {
        start: monthStart,
        end: monthEnd,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      summary: {
        totalImpressions: 0,
        totalClicks: 0,
        avgCtr: 0,
        avgPosition: 0,
        impressionsDeltaPercent: 0,
        clicksDeltaPercent: 0,
        indexedPages: roleCoverage.reduce(
          (sum, r) => sum + (r.indexedPages || 0),
          0,
        ),
        indexedPagesChange: 0,
        health: 'healthy',
      },
      cannibalization: {
        clustersFound: cannibalization.length,
        highPriorityClusters: cannibalization.filter(
          (c) => c.priority === 'high',
        ),
        estimatedTrafficLoss: 0,
      },
      zombiePages: {
        total: zombiePages.length,
        byRole: this.countZombiesByRole(zombiePages),
        topZombies: zombiePages.slice(0, 20),
        estimatedCrawlBudgetWaste: this.estimateCrawlBudgetWaste(zombiePages),
      },
      roleCoverage: this.buildRoleCoverageMap(roleCoverage),
      actions,
      historicalComparison: {
        vsLastMonth: { impressions: 0, clicks: 0, position: 0 },
        vs3MonthsAgo: { impressions: 0, clicks: 0, position: 0 },
        vsLastYear: null,
      },
      generatedAt: new Date(),
    };

    this.logger.log(
      `✅ Rapport mensuel: ${zombiePages.length} zombies, ${cannibalization.length} cannibalisations`,
    );
    return report;
  }

  /**
   * Détecte les pages zombies
   */
  private async detectZombiePages(): Promise<ZombiePage[]> {
    const { data, error } = await this.supabase
      .from('__seo_page')
      .select(
        `
        url,
        page_role,
        temperature
      `,
      )
      .in('temperature', ['cold', 'exclude'])
      .limit(200);

    if (error) {
      this.logger.error('Erreur détection zombies:', error);
      return [];
    }

    return (data || []).map((page) => ({
      url: page.url,
      pageRole: page.page_role as PageRole | null,
      impressions90d: 0,
      clicks90d: 0,
      avgPosition90d: 100,
      reasons: ['low_impressions'] as ZombiePage['reasons'],
      zombieScore: page.temperature === 'exclude' ? 90 : 60,
      recommendation: page.temperature === 'exclude' ? 'noindex' : 'improve',
    }));
  }

  /**
   * Détecte la cannibalisation (URLs sur mêmes requêtes)
   * Note: Nécessite intégration GSC pour données réelles
   */
  private async detectCannibalization(): Promise<CannibalizationCluster[]> {
    // Pour l'instant, retourne vide - nécessite intégration GSC
    // TODO: Implémenter avec données GSC réelles
    return [];
  }

  /**
   * Récupère la couverture par rôle
   */
  private async getRoleCoverage(): Promise<
    Array<{
      page_role: PageRole;
      totalPages: number;
      indexedPages: number;
    }>
  > {
    const { data, error } = await this.supabase
      .from('__seo_page')
      .select('page_role')
      .not('page_role', 'is', null);

    if (error) {
      this.logger.error('Erreur récupération couverture:', error);
      return [];
    }

    // Compter par rôle
    const counts = new Map<PageRole, number>();
    for (const row of data || []) {
      const role = row.page_role as PageRole;
      counts.set(role, (counts.get(role) || 0) + 1);
    }

    return Array.from(counts.entries()).map(([role, count]) => ({
      page_role: role,
      totalPages: count,
      indexedPages: Math.floor(count * 0.85), // Estimation 85% indexé
    }));
  }

  /**
   * Génère les actions mensuelles recommandées
   */
  private generateMonthlyActions(
    zombies: ZombiePage[],
    cannibalization: CannibalizationCluster[],
  ): MonthlyAction[] {
    const actions: MonthlyAction[] = [];

    // Actions pour zombies critiques
    const criticalZombies = zombies.filter((z) => z.zombieScore >= 80);
    if (criticalZombies.length > 0) {
      actions.push({
        id: 'zombies-critical',
        type: 'noindex',
        priority: 'high',
        effort: 'low',
        impact: 'medium',
        targetUrls: criticalZombies.slice(0, 10).map((z) => z.url),
        description: `Passer ${criticalZombies.length} pages zombies en noindex pour économiser le crawl budget`,
        status: 'pending',
      });
    }

    // Actions pour zombies à améliorer
    const improvableZombies = zombies.filter(
      (z) =>
        z.zombieScore >= 50 &&
        z.zombieScore < 80 &&
        z.recommendation === 'improve',
    );
    if (improvableZombies.length > 0) {
      actions.push({
        id: 'zombies-improve',
        type: 'improve_content',
        priority: 'medium',
        effort: 'high',
        impact: 'high',
        targetUrls: improvableZombies.slice(0, 5).map((z) => z.url),
        description: `Améliorer ${improvableZombies.length} pages à potentiel (contenu + maillage)`,
        status: 'pending',
      });
    }

    // Actions pour cannibalisation
    for (const cluster of cannibalization.filter(
      (c) => c.priority === 'high',
    )) {
      actions.push({
        id: `cannib-${cluster.primaryQuery.replace(/\s+/g, '-')}`,
        type: cluster.recommendation === 'merge' ? 'merge_pages' : 'redirect',
        priority: 'high',
        effort: 'medium',
        impact: 'high',
        targetUrls: cluster.urls.map((u) => u.url),
        description: `Résoudre cannibalisation sur "${cluster.primaryQuery}": ${cluster.reasoning}`,
        status: 'pending',
      });
    }

    return actions;
  }

  // =====================================================
  // HELPERS
  // =====================================================

  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  private calculateOverallHealth(
    roleHealth: Array<{ avg_score: number; with_risk: number }>,
  ): KpiHealth {
    if (roleHealth.length === 0) return 'healthy';

    const avgScore =
      roleHealth.reduce((sum, r) => sum + (r.avg_score || 50), 0) /
      roleHealth.length;
    const totalRisks = roleHealth.reduce(
      (sum, r) => sum + (r.with_risk || 0),
      0,
    );

    if (avgScore < 30 || totalRisks > 100) return 'critical';
    if (avgScore < 50 || totalRisks > 50) return 'warning';
    return 'healthy';
  }

  private buildRoleMetrics(
    roleHealth: Array<{
      page_role: PageRole;
      total: number;
      hot: number;
      stable: number;
    }>,
  ): WeeklyReport['byRole'] {
    const result = {} as WeeklyReport['byRole'];

    for (const role of Object.values(PageRole)) {
      const data = roleHealth.find((r) => r.page_role === role);
      result[role] = {
        pageCount: data?.total || 0,
        impressions: 0,
        clicks: 0,
        avgCtr: 0,
        avgPosition: 0,
        trend: 'stable',
      };
    }

    return result;
  }

  private countZombiesByRole(zombies: ZombiePage[]): Record<PageRole, number> {
    const result = {} as Record<PageRole, number>;
    for (const role of Object.values(PageRole)) {
      result[role] = zombies.filter((z) => z.pageRole === role).length;
    }
    return result;
  }

  private estimateCrawlBudgetWaste(zombies: ZombiePage[]): number {
    // Estimation: chaque zombie consomme ~0.1% du budget crawl
    return Math.min(zombies.length * 0.1, 30);
  }

  private buildRoleCoverageMap(
    coverage: Array<{
      page_role: PageRole;
      totalPages: number;
      indexedPages: number;
    }>,
  ): MonthlyReport['roleCoverage'] {
    const result = {} as MonthlyReport['roleCoverage'];

    for (const role of Object.values(PageRole)) {
      const data = coverage.find((c) => c.page_role === role);
      result[role] = {
        totalPages: data?.totalPages || 0,
        indexedPages: data?.indexedPages || 0,
        indexedPercent: data ? (data.indexedPages / data.totalPages) * 100 : 0,
        avgImpressions: 0,
        avgClicks: 0,
        avgPosition: 0,
        zombieCount: 0,
        cannibalizationCount: 0,
      };
    }

    return result;
  }

  // =====================================================
  // DIAGNOSTICS AUTOMATIQUES (RÈGLES ULTRA ROBUSTES)
  // =====================================================

  /**
   * Génère le rapport de diagnostics automatiques
   * Détecte: R3 sans impressions, R1 contaminé, R4 sous-performant, cannibalisation
   */
  async generateAutoDiagnosticsReport(): Promise<AutoDiagnosticsReport> {
    this.logger.log('🔍 Génération rapport diagnostics automatiques...');

    const diagnostics: AutoDiagnostic[] = [];

    // 1. Détecter les R1 contaminés (requêtes symptômes)
    const routerContamination = await this.detectRouterContamination();
    diagnostics.push(...routerContamination);

    // 2. Détecter les R3 sans impressions
    const r3NoImpressions = await this.detectR3NoImpressions();
    diagnostics.push(...r3NoImpressions);

    // 3. Détecter les R4 sous-performants vs R3
    const r4Underperforming = await this.detectR4Underperforming();
    diagnostics.push(...r4Underperforming);

    // Compter par sévérité
    const bySeverity = {
      critical: diagnostics.filter((d) => d.severity === 'critical').length,
      warning: diagnostics.filter((d) => d.severity === 'warning').length,
      info: diagnostics.filter((d) => d.severity === 'info').length,
    };

    // Compter par type
    const byType = {} as Record<AutoDiagnosticType, number>;
    for (const d of diagnostics) {
      byType[d.type] = (byType[d.type] || 0) + 1;
    }

    // Top actions recommandées (unique)
    const topActions = Array.from(
      new Set(diagnostics.map((d) => getRecommendedActionForDiagnostic(d))),
    );

    const report: AutoDiagnosticsReport = {
      generatedAt: new Date(),
      totalDiagnostics: diagnostics.length,
      bySeverity,
      byType,
      diagnostics: diagnostics.sort((a, b) => {
        // Trier par sévérité (critical > warning > info)
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      topActions,
    };

    this.logger.log(
      `✅ Rapport diagnostics: ${diagnostics.length} problèmes (${bySeverity.critical} critiques)`,
    );
    return report;
  }

  /**
   * Détecte les routeurs R1 contaminés par des requêtes symptômes
   * Règle: Si > 10% des requêtes sont des "symptômes", le routeur est contaminé
   */
  private async detectRouterContamination(): Promise<AutoDiagnostic[]> {
    const diagnostics: AutoDiagnostic[] = [];

    // Récupérer les pages R1 depuis la DB
    const { data: r1Pages, error } = await this.supabase
      .from('__seo_page')
      .select('url, page_role')
      .eq('page_role', 'R1')
      .limit(100);

    if (error || !r1Pages) {
      this.logger.warn(
        'Impossible de récupérer les pages R1 pour contamination check',
      );
      return [];
    }

    // Pour chaque R1, simuler la détection de requêtes symptômes
    // NOTE: En production, ceci serait alimenté par les données GSC réelles
    for (const page of r1Pages) {
      // Simulation: vérifier si l'URL contient des mots symptômes
      const urlLower = page.url.toLowerCase();
      const hasSymptomInUrl =
        AUTO_DECISION_RULES.routerContamination.symptomKeywords.some((kw) =>
          urlLower.includes(kw),
        );

      if (hasSymptomInUrl) {
        diagnostics.push({
          type: 'router_contamination',
          severity: 'critical',
          url: page.url,
          pageRole: page.page_role as PageRole,
          diagnosis:
            'URL R1 contient des mots symptômes - risque de contamination',
          recommendedActions: AUTO_DECISION_RULES.routerContamination.actions,
          metrics: { urlContainsSymptom: 'true' },
        });
      }
    }

    return diagnostics;
  }

  /**
   * Détecte les pages R3 sans impressions depuis X semaines
   * Règle: Si R3 créé depuis > 4 semaines et < 10 impressions → enrichir ou fusionner
   */
  private async detectR3NoImpressions(): Promise<AutoDiagnostic[]> {
    const diagnostics: AutoDiagnostic[] = [];
    const weeksThreshold =
      AUTO_DECISION_RULES.r3NoImpressions.minWeeksWithoutImpressions;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - weeksThreshold * 7);

    // Récupérer les pages R3 créées avant le seuil
    const { data: r3Pages, error } = await this.supabase
      .from('__seo_page')
      .select('url, page_role, created_at')
      .eq('page_role', 'R3')
      .lt('created_at', cutoffDate.toISOString())
      .limit(50);

    if (error || !r3Pages) {
      this.logger.warn(
        'Impossible de récupérer les pages R3 pour check impressions',
      );
      return [];
    }

    // Pour chaque R3, créer un diagnostic (en prod, filtrer par impressions GSC)
    for (const page of r3Pages) {
      const createdAt = new Date(page.created_at);
      const weeksSinceCreation = Math.floor(
        (Date.now() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000),
      );

      // Simulation: marquer comme diagnostic si créé depuis longtemps
      // En production, ceci serait filtré par impressions GSC < 10
      if (weeksSinceCreation >= weeksThreshold * 2) {
        // Vieux articles prioritaires
        diagnostics.push({
          type: 'r3_no_impressions',
          severity: 'warning',
          url: page.url,
          pageRole: page.page_role as PageRole,
          diagnosis: `R3 créé depuis ${weeksSinceCreation} semaines - vérifier les impressions GSC`,
          recommendedActions: AUTO_DECISION_RULES.r3NoImpressions.actions,
          metrics: { weeksSinceCreation, minWeeksRequired: weeksThreshold },
        });
      }
    }

    return diagnostics;
  }

  /**
   * Détecte les pages R4 sous-performantes vs R3 équivalentes
   * Règle: Si R4 position > 50 et R3 position < 30 sur même sujet → R4 manque de définition
   */
  private async detectR4Underperforming(): Promise<AutoDiagnostic[]> {
    const diagnostics: AutoDiagnostic[] = [];

    // Récupérer les pages R4 et R3
    const { data: pages, error } = await this.supabase
      .from('__seo_page')
      .select('url, page_role')
      .in('page_role', ['R3', 'R4'])
      .limit(200);

    if (error || !pages) {
      this.logger.warn(
        'Impossible de récupérer les pages R3/R4 pour comparaison',
      );
      return [];
    }

    const r4Pages = pages.filter((p) => p.page_role === 'R4');
    const r3Pages = pages.filter((p) => p.page_role === 'R3');

    // Pour chaque R4, chercher un R3 sur un sujet similaire
    for (const r4 of r4Pages) {
      // Extraire le slug du R4 (ex: /reference-auto/embrayage → embrayage)
      const r4Slug =
        r4.url
          .split('/')
          .pop()
          ?.replace(/\.html$/, '') || '';

      // Chercher un R3 avec un slug similaire
      const matchingR3 = r3Pages.find((r3) => {
        const r3Slug =
          r3.url
            .split('/')
            .pop()
            ?.replace(/\.html$/, '') || '';
        return r3Slug.includes(r4Slug) || r4Slug.includes(r3Slug);
      });

      if (matchingR3) {
        // En production, comparer les positions réelles depuis GSC
        // Ici on simule un diagnostic pour les R4 qui ont un R3 équivalent
        diagnostics.push({
          type: 'r4_underperforming',
          severity: 'warning',
          url: r4.url,
          pageRole: r4.page_role as PageRole,
          diagnosis: `R4 a un R3 équivalent: ${matchingR3.url} - vérifier positions GSC`,
          recommendedActions: AUTO_DECISION_RULES.r4Underperforming.actions,
          relatedUrls: [matchingR3.url],
          metrics: { r3Url: matchingR3.url },
        });
      }
    }

    return diagnostics;
  }

  /**
   * Méthode publique pour obtenir un diagnostic rapide sur une URL spécifique
   */
  async diagnoseUrl(url: string): Promise<AutoDiagnostic[]> {
    // Récupérer les infos de la page
    const { data: page, error } = await this.supabase
      .from('__seo_page')
      .select('url, page_role, temperature, created_at')
      .eq('url', url)
      .single();

    if (error || !page) {
      this.logger.warn(`Page non trouvée: ${url}`);
      return [];
    }

    // Simuler les métriques (en prod, récupérer depuis GSC)
    const metrics = {
      impressions: 0,
      clicks: 0,
      position: 50,
      queries: [] as string[],
      weeksWithoutImpressions: 4,
    };

    // Utiliser la fonction de détection centralisée
    return detectAutoDiagnostics(
      url,
      page.page_role as PageRole | null,
      metrics,
    );
  }
}
