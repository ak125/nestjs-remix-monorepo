/**
 * AI-COS v2.31.0: Cartographer Controller
 * 
 * API REST pour l'Agent Cartographe:
 * - /dependency-graph - Graphe des dépendances
 * - /circular-deps - Dépendances circulaires
 * - /package-health - Santé des packages
 * - /architecture-drift - Dérives architecturales
 * - /bundle-analysis - Analyse des bundles
 * - /report - Rapport complet
 * - /kpis - KPIs cartographe
 * - /validate-pr - Validation PR
 * 
 * @module CartographerController
 * @version 2.31.0
 * @squad Tech Squad (T)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import {
  CartographerAgentService,
  DependencyGraph,
  CircularDependency,
  PackageHealthScore,
  ArchitectureDrift,
  BundleAnalysis,
  CartographerReport,
  CartographerKPIs,
} from '../services/cartographer-agent.service';
import {
  DailyDependencyScanSaga,
  PRArchitectureValidationSaga,
  WeeklyArchitectureReportSaga,
  BundleSizeMonitoringSaga,
  PRValidationPayload,
} from '../sagas/cartographer.sagas';

// ============================================
// DTOs
// ============================================

class GenerateGraphDto {
  forceRefresh?: boolean;
}

class ValidatePRDto {
  prNumber: number;
  prBranch: string;
  baseBranch: string;
  changedFiles: string[];
  author: string;
}

class GenerateReportDto {
  reportType?: 'daily' | 'weekly' | 'pr' | 'manual';
}

class TriggerSagaDto {
  sagaName: 'daily-scan' | 'weekly-report' | 'bundle-monitor';
}

// ============================================
// Controller
// ============================================

@ApiTags('AI-COS Cartographer')
@Controller('api/ai-cos/cartographer')
export class CartographerController {
  private readonly logger = new Logger(CartographerController.name);

  constructor(
    private readonly cartographer: CartographerAgentService,
    private readonly dailySaga: DailyDependencyScanSaga,
    private readonly prSaga: PRArchitectureValidationSaga,
    private readonly weeklySaga: WeeklyArchitectureReportSaga,
    private readonly bundleSaga: BundleSizeMonitoringSaga,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('cartographer') private readonly cartographerQueue: Queue,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // Dependency Graph Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('dependency-graph')
  @ApiOperation({ summary: 'Obtenir le graphe de dépendances du monorepo' })
  @ApiQuery({ name: 'forceRefresh', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Graphe de dépendances généré' })
  async getDependencyGraph(
    @Query('forceRefresh') forceRefresh?: string,
  ): Promise<DependencyGraph> {
    this.logger.log('📊 GET /dependency-graph');
    return await this.cartographer.generateDependencyGraph(forceRefresh === 'true');
  }

  @Get('dependency-graph/mermaid')
  @ApiOperation({ summary: 'Obtenir le diagramme Mermaid du graphe' })
  @ApiResponse({ status: 200, description: 'Diagramme Mermaid' })
  async getMermaidDiagram(): Promise<{ diagram: string }> {
    this.logger.log('📊 GET /dependency-graph/mermaid');
    const graph = await this.cartographer.generateDependencyGraph();
    return { diagram: graph.mermaidDiagram };
  }

  @Get('dependency-graph/d3')
  @ApiOperation({ summary: 'Obtenir les données D3.js du graphe' })
  @ApiResponse({ status: 200, description: 'Données D3.js' })
  async getD3Data(): Promise<DependencyGraph['d3Data']> {
    this.logger.log('📊 GET /dependency-graph/d3');
    const graph = await this.cartographer.generateDependencyGraph();
    return graph.d3Data;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Circular Dependencies Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('circular-deps')
  @ApiOperation({ summary: 'Détecter les dépendances circulaires' })
  @ApiResponse({ status: 200, description: 'Liste des dépendances circulaires' })
  async getCircularDependencies(): Promise<CircularDependency[]> {
    this.logger.log('🔄 GET /circular-deps');
    return await this.cartographer.detectCircularDependencies();
  }

  @Get('circular-deps/count')
  @ApiOperation({ summary: 'Compter les dépendances circulaires' })
  @ApiResponse({ status: 200, description: 'Nombre de dépendances circulaires' })
  async getCircularDependenciesCount(): Promise<{ count: number; critical: number }> {
    this.logger.log('🔄 GET /circular-deps/count');
    const deps = await this.cartographer.detectCircularDependencies();
    return {
      count: deps.length,
      critical: deps.filter(d => d.severity === 'critical').length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Package Health Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('package-health')
  @ApiOperation({ summary: 'Obtenir les scores de santé de tous les packages' })
  @ApiResponse({ status: 200, description: 'Scores de santé des packages' })
  async getPackageHealth(): Promise<PackageHealthScore[]> {
    this.logger.log('💊 GET /package-health');
    return await this.cartographer.calculatePackageHealth();
  }

  @Get('package-health/:packageName')
  @ApiOperation({ summary: 'Obtenir le score de santé d\'un package spécifique' })
  @ApiResponse({ status: 200, description: 'Score de santé du package' })
  @ApiResponse({ status: 404, description: 'Package non trouvé' })
  async getPackageHealthByName(
    @Param('packageName') packageName: string,
  ): Promise<PackageHealthScore | { error: string }> {
    this.logger.log(`💊 GET /package-health/${packageName}`);
    const healthScores = await this.cartographer.calculatePackageHealth();
    const found = healthScores.find(h => 
      h.packageName === packageName || 
      h.packageName.includes(packageName)
    );
    
    if (!found) {
      return { error: `Package ${packageName} non trouvé` };
    }
    
    return found;
  }

  @Get('package-health/summary')
  @ApiOperation({ summary: 'Obtenir un résumé de la santé des packages' })
  @ApiResponse({ status: 200, description: 'Résumé de la santé' })
  async getPackageHealthSummary(): Promise<{
    totalPackages: number;
    healthy: number;
    warning: number;
    critical: number;
    averageHealth: number;
  }> {
    this.logger.log('💊 GET /package-health/summary');
    const healthScores = await this.cartographer.calculatePackageHealth();
    
    return {
      totalPackages: healthScores.length,
      healthy: healthScores.filter(h => h.overallScore >= 80).length,
      warning: healthScores.filter(h => h.overallScore >= 50 && h.overallScore < 80).length,
      critical: healthScores.filter(h => h.overallScore < 50).length,
      averageHealth: healthScores.length > 0
        ? healthScores.reduce((sum, h) => sum + h.overallScore, 0) / healthScores.length
        : 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Architecture Drift Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('architecture-drift')
  @ApiOperation({ summary: 'Détecter les dérives architecturales' })
  @ApiResponse({ status: 200, description: 'Liste des dérives' })
  async getArchitectureDrift(): Promise<ArchitectureDrift[]> {
    this.logger.log('📐 GET /architecture-drift');
    return await this.cartographer.detectArchitectureDrift();
  }

  @Get('architecture-drift/by-type')
  @ApiOperation({ summary: 'Obtenir les dérives groupées par type' })
  @ApiResponse({ status: 200, description: 'Dérives groupées par type' })
  async getArchitectureDriftByType(): Promise<Record<string, ArchitectureDrift[]>> {
    this.logger.log('📐 GET /architecture-drift/by-type');
    const drifts = await this.cartographer.detectArchitectureDrift();
    
    return drifts.reduce((acc, drift) => {
      if (!acc[drift.driftType]) {
        acc[drift.driftType] = [];
      }
      acc[drift.driftType].push(drift);
      return acc;
    }, {} as Record<string, ArchitectureDrift[]>);
  }

  @Get('architecture-drift/critical')
  @ApiOperation({ summary: 'Obtenir uniquement les dérives critiques' })
  @ApiResponse({ status: 200, description: 'Dérives critiques' })
  async getCriticalDrifts(): Promise<ArchitectureDrift[]> {
    this.logger.log('📐 GET /architecture-drift/critical');
    const drifts = await this.cartographer.detectArchitectureDrift();
    return drifts.filter(d => d.severity === 'critical' || d.severity === 'high');
  }

  // ═══════════════════════════════════════════════════════════════════
  // Bundle Analysis Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('bundle-analysis')
  @ApiOperation({ summary: 'Analyser la taille des bundles' })
  @ApiResponse({ status: 200, description: 'Analyse des bundles' })
  async getBundleAnalysis(): Promise<BundleAnalysis[]> {
    this.logger.log('📦 GET /bundle-analysis');
    return await this.cartographer.analyzeBundleSizes();
  }

  @Get('bundle-analysis/:packageName')
  @ApiOperation({ summary: 'Analyser le bundle d\'un package spécifique' })
  @ApiResponse({ status: 200, description: 'Analyse du bundle' })
  async getBundleAnalysisByPackage(
    @Param('packageName') packageName: string,
  ): Promise<BundleAnalysis | { error: string }> {
    this.logger.log(`📦 GET /bundle-analysis/${packageName}`);
    const analyses = await this.cartographer.analyzeBundleSizes();
    const found = analyses.find(a => a.packageName === packageName);
    
    if (!found) {
      return { error: `Bundle ${packageName} non trouvé` };
    }
    
    return found;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Report Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('report')
  @ApiOperation({ summary: 'Obtenir le dernier rapport ou en générer un nouveau' })
  @ApiQuery({ name: 'fresh', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Rapport cartographe' })
  async getReport(
    @Query('fresh') fresh?: string,
  ): Promise<CartographerReport | null> {
    this.logger.log('📋 GET /report');
    
    if (fresh === 'true') {
      return await this.cartographer.generateReport('manual');
    }
    
    const lastReport = this.cartographer.getLastReport();
    if (!lastReport) {
      return await this.cartographer.generateReport('manual');
    }
    
    return lastReport;
  }

  @Post('report/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Générer un nouveau rapport' })
  @ApiBody({ type: GenerateReportDto })
  @ApiResponse({ status: 200, description: 'Rapport généré' })
  async generateReport(
    @Body() dto: GenerateReportDto,
  ): Promise<CartographerReport> {
    this.logger.log(`📋 POST /report/generate (type: ${dto.reportType || 'manual'})`);
    return await this.cartographer.generateReport(dto.reportType || 'manual');
  }

  // ═══════════════════════════════════════════════════════════════════
  // KPI Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('kpis')
  @ApiOperation({ summary: 'Obtenir les KPIs du cartographe' })
  @ApiResponse({ status: 200, description: 'KPIs cartographe' })
  async getKPIs(): Promise<CartographerKPIs> {
    this.logger.log('📈 GET /kpis');
    return await this.cartographer.getKPIs();
  }

  @Get('kpis/status')
  @ApiOperation({ summary: 'Obtenir le statut des KPIs vs objectifs' })
  @ApiResponse({ status: 200, description: 'Statut des KPIs' })
  async getKPIsStatus(): Promise<{
    kpis: CartographerKPIs;
    targets: Record<string, number>;
    status: Record<string, 'ok' | 'warning' | 'critical'>;
    overallStatus: 'healthy' | 'warning' | 'critical';
  }> {
    this.logger.log('📈 GET /kpis/status');
    const kpis = await this.cartographer.getKPIs();
    
    const targets = {
      circularDepsCount: 0,
      averagePackageHealth: 80,
      architectureDriftCount: 0,
      largestBundleSize: 500 * 1024,
      orphanPackagesCount: 5,
      outdatedDepsCount: 10,
      criticalIssuesCount: 0,
    };
    
    const status: Record<string, 'ok' | 'warning' | 'critical'> = {
      circularDepsCount: kpis.circularDepsCount === 0 ? 'ok' : kpis.circularDepsCount <= 2 ? 'warning' : 'critical',
      averagePackageHealth: kpis.averagePackageHealth >= 80 ? 'ok' : kpis.averagePackageHealth >= 60 ? 'warning' : 'critical',
      architectureDriftCount: kpis.architectureDriftCount === 0 ? 'ok' : kpis.architectureDriftCount <= 3 ? 'warning' : 'critical',
      largestBundleSize: kpis.largestBundleSize <= targets.largestBundleSize ? 'ok' : kpis.largestBundleSize <= targets.largestBundleSize * 1.2 ? 'warning' : 'critical',
      orphanPackagesCount: kpis.orphanPackagesCount <= targets.orphanPackagesCount ? 'ok' : 'warning',
      outdatedDepsCount: kpis.outdatedDepsCount <= targets.outdatedDepsCount ? 'ok' : 'warning',
      criticalIssuesCount: kpis.criticalIssuesCount === 0 ? 'ok' : 'critical',
    };
    
    const criticalCount = Object.values(status).filter(s => s === 'critical').length;
    const warningCount = Object.values(status).filter(s => s === 'warning').length;
    
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalCount > 0) overallStatus = 'critical';
    else if (warningCount > 2) overallStatus = 'warning';
    
    return { kpis, targets, status, overallStatus };
  }

  // ═══════════════════════════════════════════════════════════════════
  // PR Validation Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Post('validate-pr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Valider l\'architecture d\'une PR' })
  @ApiBody({ type: ValidatePRDto })
  @ApiResponse({ status: 200, description: 'Résultat de la validation' })
  async validatePR(@Body() dto: ValidatePRDto): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    this.logger.log(`🔍 POST /validate-pr (PR #${dto.prNumber})`);
    return await this.cartographer.validatePRArchitecture(dto.changedFiles);
  }

  @Post('validate-pr/queue')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ajouter une validation PR à la queue' })
  @ApiBody({ type: ValidatePRDto })
  @ApiResponse({ status: 202, description: 'Validation ajoutée à la queue' })
  async queuePRValidation(@Body() dto: ValidatePRDto): Promise<{ jobId: string; queued: boolean }> {
    this.logger.log(`🔍 POST /validate-pr/queue (PR #${dto.prNumber})`);
    
    const job = await this.cartographerQueue.add('pr-validation', {
      prNumber: dto.prNumber,
      prBranch: dto.prBranch,
      baseBranch: dto.baseBranch,
      changedFiles: dto.changedFiles,
      author: dto.author,
      requestedAt: new Date(),
    } as PRValidationPayload);
    
    return { jobId: String(job.id), queued: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  // SAGA Trigger Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Post('saga/trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déclencher manuellement une SAGA' })
  @ApiBody({ type: TriggerSagaDto })
  @ApiResponse({ status: 200, description: 'SAGA déclenchée' })
  async triggerSaga(@Body() dto: TriggerSagaDto): Promise<{ triggered: boolean; sagaName: string; jobId?: string }> {
    this.logger.log(`🚀 POST /saga/trigger (${dto.sagaName})`);
    
    const job = await this.cartographerQueue.add(dto.sagaName, {
      triggeredAt: new Date(),
      manual: true,
    });
    
    return {
      triggered: true,
      sagaName: dto.sagaName,
      jobId: String(job.id),
    };
  }

  @Post('saga/daily-scan')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déclencher le scan quotidien manuellement' })
  @ApiResponse({ status: 200, description: 'Scan quotidien lancé' })
  async triggerDailyScan(): Promise<any> {
    this.logger.log('🚀 POST /saga/daily-scan');
    return await this.dailySaga.execute();
  }

  @Post('saga/weekly-report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déclencher le rapport hebdomadaire manuellement' })
  @ApiResponse({ status: 200, description: 'Rapport hebdomadaire lancé' })
  async triggerWeeklyReport(): Promise<any> {
    this.logger.log('🚀 POST /saga/weekly-report');
    return await this.weeklySaga.execute();
  }

  @Post('saga/bundle-monitor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Déclencher le monitoring des bundles' })
  @ApiResponse({ status: 200, description: 'Monitoring bundles lancé' })
  async triggerBundleMonitor(): Promise<any> {
    this.logger.log('🚀 POST /saga/bundle-monitor');
    return await this.bundleSaga.execute();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Health & Status Endpoints
  // ═══════════════════════════════════════════════════════════════════

  @Get('health')
  @ApiOperation({ summary: 'Vérifier la santé de l\'agent cartographe' })
  @ApiResponse({ status: 200, description: 'Statut de santé' })
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastReportAt: Date | null;
    queueStatus: { waiting: number; active: number; completed: number; failed: number };
  }> {
    this.logger.log('🏥 GET /health');
    
    const lastReport = this.cartographer.getLastReport();
    const jobCounts = await this.cartographerQueue.getJobCounts();
    
    return {
      status: 'healthy',
      lastReportAt: lastReport?.generatedAt || null,
      queueStatus: {
        waiting: jobCounts.waiting,
        active: jobCounts.active,
        completed: jobCounts.completed,
        failed: jobCounts.failed,
      },
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Obtenir le statut complet du cartographe' })
  @ApiResponse({ status: 200, description: 'Statut complet' })
  async getStatus(): Promise<{
    agent: { id: string; name: string; squad: string; version: string };
    lastScan: Date | null;
    kpis: CartographerKPIs;
    capabilities: string[];
  }> {
    this.logger.log('📊 GET /status');
    
    const lastReport = this.cartographer.getLastReport();
    const kpis = await this.cartographer.getKPIs();
    
    return {
      agent: {
        id: 'A-CARTO',
        name: 'Cartographer Agent',
        squad: 'Tech Squad (T)',
        version: '2.31.0',
      },
      lastScan: lastReport?.generatedAt || null,
      kpis,
      capabilities: [
        'dependency-graph-generation',
        'circular-deps-detection',
        'package-health-scoring',
        'architecture-drift-detection',
        'bundle-analysis',
        'pr-validation',
      ],
    };
  }
}
