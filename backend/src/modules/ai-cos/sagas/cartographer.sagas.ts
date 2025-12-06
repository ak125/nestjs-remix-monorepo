/**
 * AI-COS v2.31.0: Cartographer SAGAs
 * 
 * Orchestrations SAGA pour l'Agent Cartographe:
 * 1. Daily_Dependency_Scan - Scan quotidien des dépendances à 6h
 * 2. PR_Architecture_Validation - Validation architecture lors des PRs
 * 3. Weekly_Architecture_Report - Rapport hebdomadaire complet
 * 4. Bundle_Size_Monitoring - Surveillance taille des bundles
 * 
 * @module CartographerSagas
 * @version 2.31.0
 * @squad Tech Squad (T)
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { CartographerAgentService, CartographerReport, CartographerKPIs } from '../services/cartographer-agent.service';
import { SupabaseService } from '../../supabase/supabase.service';

// ============================================
// Types & Interfaces
// ============================================

export interface SagaContext {
  sagaId: string;
  sagaName: string;
  startedAt: Date;
  steps: SagaStep[];
  currentStepIndex: number;
  status: 'running' | 'completed' | 'failed' | 'compensating' | 'compensated';
  error?: string;
  result?: any;
}

export interface SagaStep {
  stepId: string;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'compensated';
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: string;
  compensationData?: any;
}

export interface PRValidationPayload {
  prNumber: number;
  prBranch: string;
  baseBranch: string;
  changedFiles: string[];
  author: string;
  requestedAt: Date;
}

export interface BundleAlertPayload {
  packageName: string;
  currentSize: number;
  previousSize: number;
  threshold: number;
  increase: number;
  increasePercent: number;
}

// ============================================
// SAGA 1: Daily Dependency Scan
// ============================================

@Injectable()
export class DailyDependencyScanSaga {
  private readonly logger = new Logger(DailyDependencyScanSaga.name);
  private readonly SAGA_NAME = 'DAILY_DEPENDENCY_SCAN';

  constructor(
    private readonly cartographer: CartographerAgentService,
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(): Promise<SagaContext> {
    const sagaId = `saga-daily-${Date.now()}`;
    const context: SagaContext = {
      sagaId,
      sagaName: this.SAGA_NAME,
      startedAt: new Date(),
      steps: [
        { stepId: 'step-1', stepName: 'init_scan', status: 'pending' },
        { stepId: 'step-2', stepName: 'generate_dependency_graph', status: 'pending' },
        { stepId: 'step-3', stepName: 'detect_circular_deps', status: 'pending' },
        { stepId: 'step-4', stepName: 'calculate_health_scores', status: 'pending' },
        { stepId: 'step-5', stepName: 'detect_architecture_drift', status: 'pending' },
        { stepId: 'step-6', stepName: 'generate_report', status: 'pending' },
        { stepId: 'step-7', stepName: 'save_to_database', status: 'pending' },
        { stepId: 'step-8', stepName: 'check_kpi_thresholds', status: 'pending' },
        { stepId: 'step-9', stepName: 'send_notifications', status: 'pending' },
      ],
      currentStepIndex: 0,
      status: 'running',
    };

    this.logger.log(`🚀 Démarrage SAGA ${this.SAGA_NAME} [${sagaId}]`);
    this.eventEmitter.emit('ai-cos.saga.started', { sagaId, sagaName: this.SAGA_NAME });

    try {
      // Step 1: Initialize scan
      await this.executeStep(context, 0, async () => {
        this.logger.log('📋 Initialisation du scan quotidien...');
        return { initialized: true, timestamp: new Date() };
      });

      // Step 2: Generate dependency graph
      const graph = await this.executeStep(context, 1, async () => {
        this.logger.log('📊 Génération du graphe de dépendances...');
        return await this.cartographer.generateDependencyGraph(true);
      });

      // Step 3: Detect circular dependencies
      const circularDeps = await this.executeStep(context, 2, async () => {
        this.logger.log('🔄 Détection des dépendances circulaires...');
        return await this.cartographer.detectCircularDependencies();
      });

      // Step 4: Calculate health scores
      const healthScores = await this.executeStep(context, 3, async () => {
        this.logger.log('💊 Calcul des scores de santé...');
        return await this.cartographer.calculatePackageHealth();
      });

      // Step 5: Detect architecture drift
      const drifts = await this.executeStep(context, 4, async () => {
        this.logger.log('📐 Détection des dérives architecturales...');
        return await this.cartographer.detectArchitectureDrift();
      });

      // Step 6: Generate report
      const report = await this.executeStep(context, 5, async () => {
        this.logger.log('📋 Génération du rapport...');
        return await this.cartographer.generateReport('daily');
      });

      // Step 7: Save to database
      await this.executeStep(context, 6, async () => {
        this.logger.log('💾 Sauvegarde en base de données...');
        return await this.saveSagaReport(sagaId, report);
      });

      // Step 8: Check KPI thresholds
      const alerts = await this.executeStep(context, 7, async () => {
        this.logger.log('📈 Vérification des seuils KPI...');
        return this.checkKPIThresholds(report.kpis);
      });

      // Step 9: Send notifications
      await this.executeStep(context, 8, async () => {
        this.logger.log('📧 Envoi des notifications...');
        return await this.sendNotifications(report, alerts);
      });

      context.status = 'completed';
      context.result = { reportId: report.id, kpis: report.kpis, alerts };

      this.logger.log(`✅ SAGA ${this.SAGA_NAME} terminée avec succès`);
      this.eventEmitter.emit('ai-cos.saga.completed', {
        sagaId,
        sagaName: this.SAGA_NAME,
        result: context.result,
      });

    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      
      this.logger.error(`❌ SAGA ${this.SAGA_NAME} échouée:`, error);
      
      // Compensation
      await this.compensate(context);
      
      this.eventEmitter.emit('ai-cos.saga.failed', {
        sagaId,
        sagaName: this.SAGA_NAME,
        error: context.error,
      });
    }

    return context;
  }

  private async executeStep<T>(
    context: SagaContext,
    stepIndex: number,
    executor: () => Promise<T>,
  ): Promise<T> {
    const step = context.steps[stepIndex];
    step.status = 'running';
    step.startedAt = new Date();
    context.currentStepIndex = stepIndex;

    try {
      const result = await executor();
      step.status = 'completed';
      step.completedAt = new Date();
      step.result = result;
      return result;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async compensate(context: SagaContext) {
    context.status = 'compensating';
    this.logger.log('🔄 Compensation SAGA en cours...');

    // Compensate from last completed step backwards
    for (let i = context.currentStepIndex; i >= 0; i--) {
      const step = context.steps[i];
      if (step.status === 'completed') {
        try {
          await this.compensateStep(step);
          step.status = 'compensated';
        } catch (error) {
          this.logger.error(`Erreur compensation step ${step.stepName}:`, error);
        }
      }
    }

    context.status = 'compensated';
  }

  private async compensateStep(step: SagaStep) {
    switch (step.stepName) {
      case 'save_to_database':
        // Could delete the saved report if needed
        break;
      case 'send_notifications':
        // Could send correction notification
        break;
      default:
        // Most steps don't need compensation
        break;
    }
  }

  private checkKPIThresholds(kpis: CartographerKPIs): string[] {
    const alerts: string[] = [];

    if (kpis.circularDepsCount > 0) {
      alerts.push(`CRITICAL: ${kpis.circularDepsCount} circular dependencies detected`);
    }
    if (kpis.averagePackageHealth < 70) {
      alerts.push(`WARNING: Average package health is ${kpis.averagePackageHealth}% (threshold: 70%)`);
    }
    if (kpis.architectureDriftCount > 5) {
      alerts.push(`WARNING: ${kpis.architectureDriftCount} architecture drifts detected`);
    }
    if (kpis.largestBundleSize > 500 * 1024) {
      alerts.push(`WARNING: Largest bundle is ${Math.round(kpis.largestBundleSize / 1024)}KB (threshold: 500KB)`);
    }
    if (kpis.criticalIssuesCount > 0) {
      alerts.push(`CRITICAL: ${kpis.criticalIssuesCount} critical issues found`);
    }

    return alerts;
  }

  private async saveSagaReport(sagaId: string, report: CartographerReport) {
    try {
      await this.supabase.client.from('ai_cos_saga_executions').insert({
        saga_id: sagaId,
        saga_name: this.SAGA_NAME,
        status: 'completed',
        report_id: report.id,
        kpis: report.kpis,
        executed_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn('Erreur sauvegarde saga report:', error);
    }
  }

  private async sendNotifications(report: CartographerReport, alerts: string[]) {
    if (alerts.length === 0) {
      return { sent: false, reason: 'no_alerts' };
    }

    this.eventEmitter.emit('ai-cos.cartographer.daily-alerts', {
      reportId: report.id,
      alerts,
      kpis: report.kpis,
      summary: report.summary,
    });

    return { sent: true, alertCount: alerts.length };
  }
}

// ============================================
// SAGA 2: PR Architecture Validation
// ============================================

@Injectable()
export class PRArchitectureValidationSaga {
  private readonly logger = new Logger(PRArchitectureValidationSaga.name);
  private readonly SAGA_NAME = 'PR_ARCHITECTURE_VALIDATION';

  constructor(
    private readonly cartographer: CartographerAgentService,
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(payload: PRValidationPayload): Promise<SagaContext> {
    const sagaId = `saga-pr-${payload.prNumber}-${Date.now()}`;
    const context: SagaContext = {
      sagaId,
      sagaName: this.SAGA_NAME,
      startedAt: new Date(),
      steps: [
        { stepId: 'step-1', stepName: 'fetch_pr_details', status: 'pending' },
        { stepId: 'step-2', stepName: 'analyze_changed_files', status: 'pending' },
        { stepId: 'step-3', stepName: 'check_circular_deps', status: 'pending' },
        { stepId: 'step-4', stepName: 'validate_imports', status: 'pending' },
        { stepId: 'step-5', stepName: 'check_forbidden_patterns', status: 'pending' },
        { stepId: 'step-6', stepName: 'generate_pr_report', status: 'pending' },
        { stepId: 'step-7', stepName: 'post_pr_comment', status: 'pending' },
      ],
      currentStepIndex: 0,
      status: 'running',
    };

    this.logger.log(`🔍 Validation architecture PR #${payload.prNumber} [${sagaId}]`);

    try {
      // Step 1: Fetch PR details
      await this.executeStep(context, 0, async () => {
        return {
          prNumber: payload.prNumber,
          branch: payload.prBranch,
          baseBranch: payload.baseBranch,
          filesCount: payload.changedFiles.length,
        };
      });

      // Step 2: Analyze changed files
      const analysis = await this.executeStep(context, 1, async () => {
        return this.analyzeChangedFiles(payload.changedFiles);
      });

      // Step 3: Check for new circular deps
      const circularCheck = await this.executeStep(context, 2, async () => {
        return await this.cartographer.detectCircularDependencies();
      });

      // Step 4: Validate imports
      const validation = await this.executeStep(context, 3, async () => {
        return await this.cartographer.validatePRArchitecture(payload.changedFiles);
      });

      // Step 5: Check forbidden patterns
      const patterns = await this.executeStep(context, 4, async () => {
        return this.checkForbiddenPatterns(payload.changedFiles);
      });

      // Step 6: Generate PR report
      const prReport = await this.executeStep(context, 5, async () => {
        return {
          prNumber: payload.prNumber,
          valid: validation.valid && patterns.valid,
          circularDepsCount: circularCheck.length,
          issues: [...validation.issues, ...patterns.issues],
          warnings: [...validation.warnings, ...patterns.warnings],
          recommendations: this.generatePRRecommendations(validation, patterns, analysis),
        };
      });

      // Step 7: Post PR comment
      await this.executeStep(context, 6, async () => {
        return await this.postPRComment(payload.prNumber, prReport);
      });

      context.status = 'completed';
      context.result = prReport;

      this.logger.log(`✅ Validation PR #${payload.prNumber}: ${prReport.valid ? 'PASS' : 'FAIL'}`);

      this.eventEmitter.emit('ai-cos.cartographer.pr-validated', {
        sagaId,
        prNumber: payload.prNumber,
        valid: prReport.valid,
        issues: prReport.issues.length,
      });

    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur validation PR #${payload.prNumber}:`, error);
    }

    return context;
  }

  private async executeStep<T>(
    context: SagaContext,
    stepIndex: number,
    executor: () => Promise<T>,
  ): Promise<T> {
    const step = context.steps[stepIndex];
    step.status = 'running';
    step.startedAt = new Date();

    try {
      const result = await executor();
      step.status = 'completed';
      step.completedAt = new Date();
      step.result = result;
      return result;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private analyzeChangedFiles(files: string[]): {
    packages: string[];
    hasBackendChanges: boolean;
    hasFrontendChanges: boolean;
    hasSharedTypesChanges: boolean;
  } {
    return {
      packages: [...new Set(files.map(f => f.split('/')[0]))],
      hasBackendChanges: files.some(f => f.startsWith('backend/')),
      hasFrontendChanges: files.some(f => f.startsWith('frontend/')),
      hasSharedTypesChanges: files.some(f => f.includes('shared-types')),
    };
  }

  private checkForbiddenPatterns(files: string[]): {
    valid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for forbidden file patterns
    for (const file of files) {
      if (file.includes('.env') && !file.includes('.env.example')) {
        issues.push(`Fichier .env modifié: ${file}`);
      }
      if (file.includes('secret') || file.includes('credential')) {
        warnings.push(`Fichier potentiellement sensible: ${file}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  private generatePRRecommendations(
    validation: { valid: boolean; issues: string[]; warnings: string[] },
    patterns: { valid: boolean; issues: string[]; warnings: string[] },
    analysis: any,
  ): string[] {
    const recommendations: string[] = [];

    if (validation.issues.length > 0) {
      recommendations.push('🔴 Résoudre les problèmes d\'architecture avant merge');
    }

    if (analysis.hasBackendChanges && analysis.hasFrontendChanges) {
      recommendations.push('⚠️ PR touche backend ET frontend - vérifier la cohérence des types partagés');
    }

    if (analysis.hasSharedTypesChanges) {
      recommendations.push('📦 Types partagés modifiés - rebuilder tous les packages dépendants');
    }

    return recommendations;
  }

  private async postPRComment(prNumber: number, report: any) {
    // This would integrate with GitHub API
    this.eventEmitter.emit('ai-cos.cartographer.pr-comment', {
      prNumber,
      report,
    });
    return { posted: true };
  }
}

// ============================================
// SAGA 3: Weekly Architecture Report
// ============================================

@Injectable()
export class WeeklyArchitectureReportSaga {
  private readonly logger = new Logger(WeeklyArchitectureReportSaga.name);
  private readonly SAGA_NAME = 'WEEKLY_ARCHITECTURE_REPORT';

  constructor(
    private readonly cartographer: CartographerAgentService,
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(): Promise<SagaContext> {
    const sagaId = `saga-weekly-${Date.now()}`;
    const context: SagaContext = {
      sagaId,
      sagaName: this.SAGA_NAME,
      startedAt: new Date(),
      steps: [
        { stepId: 'step-1', stepName: 'fetch_weekly_data', status: 'pending' },
        { stepId: 'step-2', stepName: 'generate_full_report', status: 'pending' },
        { stepId: 'step-3', stepName: 'compare_with_previous', status: 'pending' },
        { stepId: 'step-4', stepName: 'calculate_trends', status: 'pending' },
        { stepId: 'step-5', stepName: 'generate_visualizations', status: 'pending' },
        { stepId: 'step-6', stepName: 'create_executive_summary', status: 'pending' },
        { stepId: 'step-7', stepName: 'save_report', status: 'pending' },
        { stepId: 'step-8', stepName: 'distribute_report', status: 'pending' },
      ],
      currentStepIndex: 0,
      status: 'running',
    };

    this.logger.log(`📊 Génération rapport hebdomadaire [${sagaId}]`);

    try {
      // Step 1: Fetch weekly data
      const weeklyData = await this.executeStep(context, 0, async () => {
        return await this.fetchWeeklyData();
      });

      // Step 2: Generate full report
      const report = await this.executeStep(context, 1, async () => {
        return await this.cartographer.generateReport('weekly');
      });

      // Step 3: Compare with previous week
      const comparison = await this.executeStep(context, 2, async () => {
        return this.compareWithPrevious(report, weeklyData.previousReport);
      });

      // Step 4: Calculate trends
      const trends = await this.executeStep(context, 3, async () => {
        return this.calculateTrends(weeklyData.historicalData);
      });

      // Step 5: Generate visualizations
      const visualizations = await this.executeStep(context, 4, async () => {
        return this.generateVisualizations(report, trends);
      });

      // Step 6: Create executive summary
      const executiveSummary = await this.executeStep(context, 5, async () => {
        return this.createExecutiveSummary(report, comparison, trends);
      });

      // Step 7: Save report
      await this.executeStep(context, 6, async () => {
        return await this.saveWeeklyReport(sagaId, {
          report,
          comparison,
          trends,
          executiveSummary,
        });
      });

      // Step 8: Distribute report
      await this.executeStep(context, 7, async () => {
        return await this.distributeReport({
          report,
          comparison,
          trends,
          executiveSummary,
          visualizations,
        });
      });

      context.status = 'completed';
      context.result = { reportId: report.id, executiveSummary };

      this.logger.log(`✅ Rapport hebdomadaire généré: ${report.id}`);

    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Erreur rapport hebdomadaire:', error);
    }

    return context;
  }

  private async executeStep<T>(
    context: SagaContext,
    stepIndex: number,
    executor: () => Promise<T>,
  ): Promise<T> {
    const step = context.steps[stepIndex];
    step.status = 'running';
    step.startedAt = new Date();

    try {
      const result = await executor();
      step.status = 'completed';
      step.completedAt = new Date();
      step.result = result;
      return result;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private async fetchWeeklyData() {
    // Fetch previous reports from database
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    try {
      const { data: previousReports } = await this.supabase.client
        .from('ai_cos_cartographer_reports')
        .select('*')
        .gte('generated_at', oneWeekAgo.toISOString())
        .order('generated_at', { ascending: false });

      return {
        previousReport: previousReports?.[0] || null,
        historicalData: previousReports || [],
      };
    } catch {
      return { previousReport: null, historicalData: [] };
    }
  }

  private compareWithPrevious(current: CartographerReport, previous: any) {
    if (!previous) {
      return { hasComparison: false };
    }

    return {
      hasComparison: true,
      circularDepsChange: current.kpis.circularDepsCount - (previous.kpis?.circularDepsCount || 0),
      healthChange: current.kpis.averagePackageHealth - (previous.kpis?.averagePackageHealth || 0),
      driftChange: current.kpis.architectureDriftCount - (previous.kpis?.architectureDriftCount || 0),
      bundleChange: current.kpis.largestBundleSize - (previous.kpis?.largestBundleSize || 0),
    };
  }

  private calculateTrends(historicalData: any[]) {
    if (historicalData.length < 2) {
      return { hasTrends: false };
    }

    const healthValues = historicalData.map(d => d.kpis?.averagePackageHealth || 0);
    const avgHealth = healthValues.reduce((a, b) => a + b, 0) / healthValues.length;
    const healthTrend = healthValues[0] > avgHealth ? 'improving' : healthValues[0] < avgHealth ? 'degrading' : 'stable';

    return {
      hasTrends: true,
      healthTrend,
      averageHealth: avgHealth,
      dataPoints: historicalData.length,
    };
  }

  private generateVisualizations(report: CartographerReport, trends: any) {
    return {
      mermaidDiagram: report.dependencyGraph.mermaidDiagram,
      d3Data: report.dependencyGraph.d3Data,
      trendsChart: trends.hasTrends ? 'trend-data-available' : 'no-trend-data',
    };
  }

  private createExecutiveSummary(
    report: CartographerReport,
    comparison: any,
    trends: any,
  ): string {
    let summary = `# Rapport Architecture Hebdomadaire\n\n`;
    summary += `**Date:** ${report.generatedAt.toISOString().split('T')[0]}\n\n`;
    summary += `## Résumé\n`;
    summary += `- **Packages:** ${report.summary.totalPackages}\n`;
    summary += `- **Santé moyenne:** ${report.summary.averageHealthScore.toFixed(1)}%\n`;
    summary += `- **Dépendances circulaires:** ${report.kpis.circularDepsCount}\n`;
    summary += `- **Dérives architecturales:** ${report.kpis.architectureDriftCount}\n\n`;

    if (comparison.hasComparison) {
      summary += `## Évolution vs semaine précédente\n`;
      summary += `- Santé: ${comparison.healthChange > 0 ? '📈' : comparison.healthChange < 0 ? '📉' : '➡️'} ${comparison.healthChange > 0 ? '+' : ''}${comparison.healthChange.toFixed(1)}%\n`;
      summary += `- Deps circulaires: ${comparison.circularDepsChange > 0 ? '🔴' : comparison.circularDepsChange < 0 ? '🟢' : '⚪'} ${comparison.circularDepsChange}\n`;
    }

    if (report.recommendations.length > 0) {
      summary += `\n## Recommandations prioritaires\n`;
      report.recommendations.slice(0, 5).forEach((rec, i) => {
        summary += `${i + 1}. ${rec}\n`;
      });
    }

    return summary;
  }

  private async saveWeeklyReport(sagaId: string, data: any) {
    try {
      await this.supabase.client.from('ai_cos_weekly_reports').insert({
        saga_id: sagaId,
        report_id: data.report.id,
        executive_summary: data.executiveSummary,
        comparison: data.comparison,
        trends: data.trends,
        generated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn('Erreur sauvegarde weekly report:', error);
    }
  }

  private async distributeReport(fullReport: any) {
    this.eventEmitter.emit('ai-cos.cartographer.weekly-report-ready', {
      reportId: fullReport.report.id,
      executiveSummary: fullReport.executiveSummary,
      visualizations: fullReport.visualizations,
    });
    return { distributed: true };
  }
}

// ============================================
// SAGA 4: Bundle Size Monitoring
// ============================================

@Injectable()
export class BundleSizeMonitoringSaga {
  private readonly logger = new Logger(BundleSizeMonitoringSaga.name);
  private readonly SAGA_NAME = 'BUNDLE_SIZE_MONITORING';

  constructor(
    private readonly cartographer: CartographerAgentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(): Promise<SagaContext> {
    const sagaId = `saga-bundle-${Date.now()}`;
    const context: SagaContext = {
      sagaId,
      sagaName: this.SAGA_NAME,
      startedAt: new Date(),
      steps: [
        { stepId: 'step-1', stepName: 'analyze_bundles', status: 'pending' },
        { stepId: 'step-2', stepName: 'compare_baselines', status: 'pending' },
        { stepId: 'step-3', stepName: 'identify_bloat', status: 'pending' },
        { stepId: 'step-4', stepName: 'generate_recommendations', status: 'pending' },
        { stepId: 'step-5', stepName: 'check_thresholds', status: 'pending' },
        { stepId: 'step-6', stepName: 'alert_if_needed', status: 'pending' },
      ],
      currentStepIndex: 0,
      status: 'running',
    };

    this.logger.log(`📦 Monitoring taille bundles [${sagaId}]`);

    try {
      // Step 1: Analyze all bundles
      const bundles = await this.executeStep(context, 0, async () => {
        return await this.cartographer.analyzeBundleSizes();
      });

      // Step 2: Compare with baselines
      const comparison = await this.executeStep(context, 1, async () => {
        return this.compareWithBaselines(bundles);
      });

      // Step 3: Identify bloat
      const bloat = await this.executeStep(context, 2, async () => {
        return this.identifyBloat(bundles);
      });

      // Step 4: Generate recommendations
      const recommendations = await this.executeStep(context, 3, async () => {
        return this.generateBundleRecommendations(bundles, bloat);
      });

      // Step 5: Check thresholds
      const thresholdViolations = await this.executeStep(context, 4, async () => {
        return this.checkBundleThresholds(bundles);
      });

      // Step 6: Alert if needed
      await this.executeStep(context, 5, async () => {
        return await this.alertIfNeeded(thresholdViolations, bundles);
      });

      context.status = 'completed';
      context.result = {
        bundlesAnalyzed: bundles.length,
        violations: thresholdViolations.length,
        recommendations,
      };

      this.logger.log(`✅ Monitoring bundles terminé: ${bundles.length} bundles analysés`);

    } catch (error) {
      context.status = 'failed';
      context.error = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Erreur monitoring bundles:', error);
    }

    return context;
  }

  private async executeStep<T>(
    context: SagaContext,
    stepIndex: number,
    executor: () => Promise<T>,
  ): Promise<T> {
    const step = context.steps[stepIndex];
    step.status = 'running';
    step.startedAt = new Date();

    try {
      const result = await executor();
      step.status = 'completed';
      step.completedAt = new Date();
      step.result = result;
      return result;
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  private compareWithBaselines(bundles: any[]) {
    // Compare with stored baselines
    const baselines: Record<string, number> = {
      frontend: 500 * 1024, // 500KB
      backend: 1024 * 1024, // 1MB
    };

    return bundles.map(b => ({
      packageName: b.packageName,
      currentSize: b.totalSize,
      baselineSize: baselines[b.packageName] || 500 * 1024,
      overBaseline: b.totalSize > (baselines[b.packageName] || 500 * 1024),
      percentOver: ((b.totalSize / (baselines[b.packageName] || 500 * 1024)) - 1) * 100,
    }));
  }

  private identifyBloat(bundles: any[]) {
    const bloatItems: Array<{
      packageName: string;
      module: string;
      size: number;
      percentage: number;
    }> = [];

    for (const bundle of bundles) {
      // Modules taking > 10% are potential bloat
      const largeModules = bundle.modules?.filter((m: any) => m.percentage > 10) || [];
      for (const module of largeModules) {
        bloatItems.push({
          packageName: bundle.packageName,
          module: module.name,
          size: module.size,
          percentage: module.percentage,
        });
      }
    }

    return bloatItems;
  }

  private generateBundleRecommendations(bundles: any[], bloat: any[]): string[] {
    const recommendations: string[] = [];

    for (const bundle of bundles) {
      if (bundle.totalSize > 400 * 1024) {
        recommendations.push(`📦 ${bundle.packageName}: Considérer le code splitting (${Math.round(bundle.totalSize / 1024)}KB)`);
      }
    }

    if (bloat.length > 0) {
      recommendations.push(`🔍 ${bloat.length} modules volumineux identifiés - vérifier les imports`);
    }

    return recommendations;
  }

  private checkBundleThresholds(bundles: any[]): BundleAlertPayload[] {
    const violations: BundleAlertPayload[] = [];
    const thresholds: Record<string, number> = {
      frontend: 500 * 1024,
      backend: 1024 * 1024,
    };

    for (const bundle of bundles) {
      const threshold = thresholds[bundle.packageName] || 500 * 1024;
      if (bundle.totalSize > threshold) {
        violations.push({
          packageName: bundle.packageName,
          currentSize: bundle.totalSize,
          previousSize: 0, // Would need historical data
          threshold,
          increase: bundle.totalSize - threshold,
          increasePercent: ((bundle.totalSize / threshold) - 1) * 100,
        });
      }
    }

    return violations;
  }

  private async alertIfNeeded(violations: BundleAlertPayload[], bundles: any[]) {
    if (violations.length === 0) {
      return { alerted: false };
    }

    this.eventEmitter.emit('ai-cos.cartographer.bundle-alert', {
      violations,
      totalBundles: bundles.length,
      totalSize: bundles.reduce((sum, b) => sum + b.totalSize, 0),
    });

    return { alerted: true, violationCount: violations.length };
  }
}

// ============================================
// Queue Processor
// ============================================

@Processor('cartographer')
export class CartographerQueueProcessor {
  private readonly logger = new Logger(CartographerQueueProcessor.name);

  constructor(
    private readonly dailySaga: DailyDependencyScanSaga,
    private readonly prSaga: PRArchitectureValidationSaga,
    private readonly weeklySaga: WeeklyArchitectureReportSaga,
    private readonly bundleSaga: BundleSizeMonitoringSaga,
  ) {}

  @Process('daily-scan')
  async processDailyScan(job: Job) {
    this.logger.log(`📋 Processing daily scan job ${job.id}`);
    return await this.dailySaga.execute();
  }

  @Process('pr-validation')
  async processPRValidation(job: Job<PRValidationPayload>) {
    this.logger.log(`🔍 Processing PR validation job ${job.id} for PR #${job.data.prNumber}`);
    return await this.prSaga.execute(job.data);
  }

  @Process('weekly-report')
  async processWeeklyReport(job: Job) {
    this.logger.log(`📊 Processing weekly report job ${job.id}`);
    return await this.weeklySaga.execute();
  }

  @Process('bundle-monitor')
  async processBundleMonitor(job: Job) {
    this.logger.log(`📦 Processing bundle monitor job ${job.id}`);
    return await this.bundleSaga.execute();
  }
}

// ============================================
// Event Handlers
// ============================================

@Injectable()
export class CartographerEventHandlers {
  private readonly logger = new Logger(CartographerEventHandlers.name);

  constructor(
    @InjectQueue('cartographer') private readonly cartographerQueue: Queue,
    private readonly prSaga: PRArchitectureValidationSaga,
  ) {}

  @OnEvent('github.pr.opened')
  async handlePROpened(payload: { prNumber: number; changedFiles: string[]; branch: string; baseBranch: string; author: string }) {
    this.logger.log(`📥 PR #${payload.prNumber} opened - queueing architecture validation`);
    
    await this.cartographerQueue.add('pr-validation', {
      prNumber: payload.prNumber,
      prBranch: payload.branch,
      baseBranch: payload.baseBranch,
      changedFiles: payload.changedFiles,
      author: payload.author,
      requestedAt: new Date(),
    }, {
      priority: 1,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  @OnEvent('github.pr.synchronize')
  async handlePRSync(payload: { prNumber: number; changedFiles: string[] }) {
    this.logger.log(`🔄 PR #${payload.prNumber} synchronized - re-validating`);
    
    await this.cartographerQueue.add('pr-validation', {
      prNumber: payload.prNumber,
      changedFiles: payload.changedFiles,
      requestedAt: new Date(),
    }, {
      priority: 2,
    });
  }

  @OnEvent('build.completed')
  async handleBuildCompleted(payload: { buildType: string; success: boolean }) {
    if (payload.success && (payload.buildType === 'frontend' || payload.buildType === 'backend')) {
      this.logger.log(`✅ Build ${payload.buildType} completed - analyzing bundle`);
      
      await this.cartographerQueue.add('bundle-monitor', {
        buildType: payload.buildType,
        triggeredAt: new Date(),
      });
    }
  }
}

// ============================================
// Exports
// ============================================

export const CARTOGRAPHER_SAGAS = [
  DailyDependencyScanSaga,
  PRArchitectureValidationSaga,
  WeeklyArchitectureReportSaga,
  BundleSizeMonitoringSaga,
  CartographerQueueProcessor,
  CartographerEventHandlers,
];
