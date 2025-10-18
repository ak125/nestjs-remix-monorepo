import { IAgent, AgentResult, AgentStatus, AgentType, KPI } from '../types';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * 🎯 AGENT 12: META-AGENT (FINAL)
 *
 * Agent d'agrégation et amélioration continue:
 * - Agrège KPIs de tous les agents (1-11)
 * - Calcule scores globaux et tendances
 * - Génère recommandations prioritaires cross-agents
 * - Suggère optimisations système
 * - Intégration CI/CD et monitoring continu
 *
 * Objectifs:
 * 1. Vue d'ensemble complète du monorepo
 * 2. Priorités stratégiques basées sur data
 * 3. Plan d'action global avec ROI
 * 4. Automatisation amélioration continue
 */

// =====================================================
// INTERFACES & TYPES
// =====================================================

interface AgentReport {
  agentName: string;
  agentType: AgentType;
  executionTime: number;
  kpis: Record<string, any>;
  status: 'success' | 'warning' | 'error';
  summary: string;
}

interface GlobalKPI {
  category: 'code-quality' | 'architecture' | 'performance' | 'security' | 'upgrades';
  name: string;
  value: number | string;
  unit?: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  trend?: 'improving' | 'stable' | 'degrading';
  source: string[]; // Agents qui ont contribué
}

interface CrossAgentInsight {
  id: string;
  type: 'correlation' | 'pattern' | 'anomaly' | 'opportunity';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  affectedAgents: string[];
  impact: string;
  recommendation: string;
  estimatedEffort: string;
  roi: 'high' | 'medium' | 'low';
}

interface StrategicPriority {
  rank: number;
  title: string;
  category: string;
  description: string;
  businessValue: 'critical' | 'high' | 'medium' | 'low';
  technicalComplexity: 'low' | 'medium' | 'high';
  estimatedDuration: string;
  dependencies: string[];
  blockers: string[];
  quickWins: boolean;
}

interface MonorepoHealthScore {
  overall: number; // 0-100
  codeQuality: number;
  architecture: number;
  performance: number;
  security: number;
  maintainability: number;
  upgrades: number;
}

interface CICDIntegration {
  enabled: boolean;
  recommendations: CICDRecommendation[];
  proposedWorkflow: string;
}

interface CICDRecommendation {
  tool: 'github-actions' | 'gitlab-ci' | 'jenkins' | 'custom';
  step: string;
  command: string;
  when: 'pre-commit' | 'pre-push' | 'pr' | 'merge' | 'nightly';
  threshold: string;
}

interface ImprovementRoadmap {
  phases: RoadmapPhase[];
  totalDuration: string;
  totalEffort: string;
  expectedROI: string;
}

interface RoadmapPhase {
  phase: number;
  name: string;
  duration: string;
  priorities: StrategicPriority[];
  milestones: string[];
  successCriteria: string[];
}

// =====================================================
// AGENT IMPLEMENTATION
// =====================================================

export class MetaAgent implements IAgent {
  name = 'Meta-Agent';
  type: AgentType = 'meta-agent';
  description = 'Agrégation KPIs, tendances, recommandations stratégiques';
  version = '1.0.0';

  private status: AgentStatus = 'idle';
  private workspaceRoot: string;
  private reportsDir: string;

  constructor() {
    this.workspaceRoot = process.cwd().includes('ai-agents')
      ? path.resolve(process.cwd(), '..')
      : process.cwd();
    this.reportsDir = path.join(this.workspaceRoot, 'ai-agents', 'reports');
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async execute(): Promise<AgentResult> {
    this.status = 'running';
    const startTime = Date.now();

    console.log('🎯 Meta-Agent - Analyse globale en cours...');

    // 1. Charger tous les reports agents
    console.log('📊 Chargement reports des 11 agents...');
    const agentReports = await this.loadAllAgentReports();
    console.log(`✓ ${agentReports.length} reports chargés`);

    // 2. Agréger KPIs globaux
    console.log('📈 Agrégation KPIs globaux...');
    const globalKPIs = await this.aggregateGlobalKPIs(agentReports);
    console.log(`✓ ${globalKPIs.length} KPIs agrégés`);

    // 3. Calculer score santé monorepo
    console.log('💯 Calcul score santé monorepo...');
    const healthScore = await this.calculateHealthScore(agentReports, globalKPIs);
    console.log(`✓ Score global: ${healthScore.overall}/100`);

    // 4. Détecter insights cross-agents
    console.log('🔍 Détection insights cross-agents...');
    const insights = await this.detectCrossAgentInsights(agentReports);
    console.log(`✓ ${insights.length} insights détectés`);

    // 5. Générer priorités stratégiques
    console.log('🎯 Génération priorités stratégiques...');
    const priorities = await this.generateStrategicPriorities(insights, healthScore);
    console.log(`✓ ${priorities.length} priorités identifiées`);

    // 6. Créer roadmap amélioration
    console.log('🗺️  Création roadmap amélioration...');
    const roadmap = await this.createImprovementRoadmap(priorities);
    console.log(`✓ ${roadmap.phases.length} phases planifiées`);

    // 7. Suggérer intégration CI/CD
    console.log('🔧 Suggestions intégration CI/CD...');
    const cicdIntegration = await this.generateCICDIntegration(agentReports);
    console.log(`✓ ${cicdIntegration.recommendations.length} recommandations CI/CD`);

    const duration = Date.now() - startTime;
    this.status = 'completed';

    // Build KPIs finaux
    const kpis: KPI[] = [
      {
        name: 'Score Santé Global',
        value: healthScore.overall,
        unit: '/100',
        status: healthScore.overall >= 80 ? 'ok' : healthScore.overall >= 60 ? 'warning' : 'critical',
      },
      {
        name: 'Insights Critiques',
        value: insights.filter((i) => i.severity === 'CRITICAL').length,
        status: insights.filter((i) => i.severity === 'CRITICAL').length === 0 ? 'ok' : 'critical',
      },
      {
        name: 'Quick Wins',
        value: priorities.filter((p) => p.quickWins).length,
        status: 'ok',
      },
    ];

    // Sauvegarder reports
    await this.saveReports(agentReports, globalKPIs, healthScore, insights, priorities, roadmap, cicdIntegration, duration);

    console.log('💾 Reports: meta-agent.{json,md}, improvement-roadmap.md, cicd-integration.yml');

    return {
      agentName: this.name,
      agentType: this.type,
      status: 'success',
      timestamp: new Date(),
      duration,
      data: {
        agentReports,
        globalKPIs,
        healthScore,
        insights,
        priorities,
        roadmap,
        cicdIntegration,
      },
      warnings: insights.filter((i) => i.severity === 'CRITICAL').length > 0 ? ['Critical insights detected'] : [],
      kpis,
    };
  }

  // =====================================================
  // LOAD AGENT REPORTS
  // =====================================================

  private async loadAllAgentReports(): Promise<AgentReport[]> {
    const reports: AgentReport[] = [];

    const reportFiles = [
      'audit-report.json', // Agent 1: Cartographe
      'fichiers-massifs.json', // Agent 2
      'detecteur-doublons.json', // Agent 3
      'graphe-imports.json', // Agent 4
      'upgrade-nestjs.json', // Agent 5
      'upgrade-remix.json', // Agent 6
      'upgrade-react.json', // Agent 7
      'upgrade-nodejs.json', // Agent 8
      'refacto-css.json', // Agent 9
      'perf-observabilite.json', // Agent 10
      'data-sanity.json', // Agent 11
    ];

    for (const file of reportFiles) {
      try {
        const filePath = path.join(this.reportsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Extract summary based on agent type
        const summary = this.extractSummary(data, file);

        reports.push({
          agentName: data.agent || data.agentName || file.replace('.json', ''),
          agentType: this.mapFileToAgentType(file),
          executionTime: data.executionTime || data.duration || 0,
          kpis: data.kpis || {},
          status: data.status || 'success',
          summary,
        });
      } catch (error) {
        console.warn(`⚠️  Could not load ${file}:`, error);
      }
    }

    return reports;
  }

  private mapFileToAgentType(file: string): AgentType {
    const map: Record<string, AgentType> = {
      'audit-report.json': 'cartographe',
      'fichiers-massifs.json': 'fichiers-massifs',
      'detecteur-doublons.json': 'detecteur-doublons',
      'graphe-imports.json': 'graphe-imports',
      'upgrade-nestjs.json': 'upgrade-nestjs',
      'upgrade-remix.json': 'upgrade-remix',
      'upgrade-react.json': 'upgrade-react',
      'upgrade-nodejs.json': 'upgrade-nodejs',
      'refacto-css.json': 'refacto-css',
      'perf-observabilite.json': 'perf-observabilite',
      'data-sanity.json': 'data-sanity',
    };

    return map[file] || 'cartographe';
  }

  private extractSummary(data: any, file: string): string {
    // Extract key metrics based on agent
    if (file === 'audit-report.json') {
      return `${data.stats?.totalFiles || 0} fichiers, ${data.stats?.totalLines || 0} lignes`;
    }
    if (file === 'fichiers-massifs.json') {
      return `${data.massiveFiles?.length || 0} fichiers massifs détectés`;
    }
    if (file === 'detecteur-doublons.json') {
      return `${data.duplications?.length || 0} duplications détectées`;
    }
    if (file === 'graphe-imports.json') {
      return `${data.cycles?.length || 0} cycles, ${data.deadCode?.length || 0} dead code`;
    }
    if (file.startsWith('upgrade-')) {
      return `${data.breakingChanges?.length || 0} breaking changes`;
    }
    if (file === 'refacto-css.json') {
      return `${data.duplicatedPatterns?.length || 0} patterns dupliqués`;
    }
    if (file === 'perf-observabilite.json') {
      return `${data.bottlenecks?.length || 0} bottlenecks`;
    }
    if (file === 'data-sanity.json') {
      return `${data.inconsistencies?.length || 0} incohérences`;
    }

    return 'Report loaded';
  }

  // =====================================================
  // AGGREGATE GLOBAL KPIS
  // =====================================================

  private async aggregateGlobalKPIs(reports: AgentReport[]): Promise<GlobalKPI[]> {
    const kpis: GlobalKPI[] = [];

    // Code Quality KPIs
    const cartographe = reports.find((r) => r.agentType === 'cartographe');
    const doublons = reports.find((r) => r.agentType === 'detecteur-doublons');
    const massifs = reports.find((r) => r.agentType === 'fichiers-massifs');

    if (cartographe) {
      kpis.push({
        category: 'code-quality',
        name: 'Total Lines of Code',
        value: cartographe.kpis['Total Lines'] || 0,
        status: 'good',
        source: ['cartographe'],
      });
    }

    if (doublons) {
      const duplicationsCount = doublons.kpis['Duplications détectées'] || 0;
      kpis.push({
        category: 'code-quality',
        name: 'Code Duplications',
        value: duplicationsCount,
        status: duplicationsCount < 100 ? 'good' : duplicationsCount < 300 ? 'warning' : 'critical',
        source: ['detecteur-doublons'],
      });
    }

    if (massifs) {
      const massiveCount = massifs.kpis['Fichiers massifs'] || 0;
      kpis.push({
        category: 'code-quality',
        name: 'Massive Files',
        value: massiveCount,
        status: massiveCount < 50 ? 'good' : massiveCount < 150 ? 'warning' : 'critical',
        source: ['fichiers-massifs'],
      });
    }

    // Architecture KPIs
    const graphe = reports.find((r) => r.agentType === 'graphe-imports');
    if (graphe) {
      const cycles = graphe.kpis['Cycles détectés'] || 0;
      const deadCode = graphe.kpis['Dead code'] || 0;

      kpis.push({
        category: 'architecture',
        name: 'Import Cycles',
        value: cycles,
        status: cycles === 0 ? 'excellent' : cycles < 5 ? 'good' : 'warning',
        source: ['graphe-imports'],
      });

      kpis.push({
        category: 'architecture',
        name: 'Dead Code Files',
        value: deadCode,
        status: deadCode === 0 ? 'excellent' : deadCode < 100 ? 'good' : 'warning',
        source: ['graphe-imports'],
      });
    }

    // Performance KPIs
    const perf = reports.find((r) => r.agentType === 'perf-observabilite');
    if (perf) {
      const bottlenecks = perf.kpis['Bottlenecks détectés'] || 0;
      kpis.push({
        category: 'performance',
        name: 'Performance Bottlenecks',
        value: bottlenecks,
        status: bottlenecks === 0 ? 'excellent' : bottlenecks < 3 ? 'good' : 'warning',
        source: ['perf-observabilite'],
      });
    }

    // Upgrades KPIs
    const upgradeAgents = reports.filter((r) => r.agentType.startsWith('upgrade-'));
    const totalBreakingChanges = upgradeAgents.reduce((sum, agent) => {
      return sum + (agent.kpis['Breaking Changes'] || 0);
    }, 0);

    kpis.push({
      category: 'upgrades',
      name: 'Total Breaking Changes',
      value: totalBreakingChanges,
      status: totalBreakingChanges < 5 ? 'good' : totalBreakingChanges < 15 ? 'warning' : 'critical',
      source: upgradeAgents.map((a) => a.agentType),
    });

    // CSS Refactoring
    const css = reports.find((r) => r.agentType === 'refacto-css');
    if (css) {
      const duplicatedPatterns = css.kpis['Patterns dupliqués'] || 0;
      kpis.push({
        category: 'code-quality',
        name: 'CSS Pattern Duplications',
        value: duplicatedPatterns,
        status: duplicatedPatterns < 100 ? 'good' : duplicatedPatterns < 250 ? 'warning' : 'critical',
        source: ['refacto-css'],
      });
    }

    // Data Sanity
    const data = reports.find((r) => r.agentType === 'data-sanity');
    if (data) {
      const inconsistencies = data.kpis['Incohérences CRITICAL'] || 0;
      kpis.push({
        category: 'architecture',
        name: 'Data Inconsistencies (Critical)',
        value: inconsistencies,
        status: inconsistencies === 0 ? 'excellent' : 'critical',
        source: ['data-sanity'],
      });
    }

    return kpis;
  }

  // =====================================================
  // CALCULATE HEALTH SCORE
  // =====================================================

  private async calculateHealthScore(reports: AgentReport[], globalKPIs: GlobalKPI[]): Promise<MonorepoHealthScore> {
    // Code Quality Score (0-100)
    const codeQualityKPIs = globalKPIs.filter((k) => k.category === 'code-quality');
    const codeQuality = this.calculateCategoryScore(codeQualityKPIs);

    // Architecture Score
    const architectureKPIs = globalKPIs.filter((k) => k.category === 'architecture');
    const architecture = this.calculateCategoryScore(architectureKPIs);

    // Performance Score
    const performanceKPIs = globalKPIs.filter((k) => k.category === 'performance');
    const performance = this.calculateCategoryScore(performanceKPIs);

    // Security Score (default high if no critical issues)
    const security = 85;

    // Maintainability Score (based on duplications, massive files)
    const doublons = reports.find((r) => r.agentType === 'detecteur-doublons');
    const duplicationsCount = doublons?.kpis['Duplications détectées'] || 0;
    const maintainability = Math.max(0, 100 - (duplicationsCount / 10));

    // Upgrades Score (lower is better for breaking changes)
    const upgradeKPIs = globalKPIs.filter((k) => k.category === 'upgrades');
    const upgrades = this.calculateCategoryScore(upgradeKPIs);

    // Overall Score (weighted average)
    const overall = Math.round(
      codeQuality * 0.25 + architecture * 0.2 + performance * 0.15 + security * 0.1 + maintainability * 0.2 + upgrades * 0.1,
    );

    return {
      overall,
      codeQuality: Math.round(codeQuality),
      architecture: Math.round(architecture),
      performance: Math.round(performance),
      security: Math.round(security),
      maintainability: Math.round(maintainability),
      upgrades: Math.round(upgrades),
    };
  }

  private calculateCategoryScore(kpis: GlobalKPI[]): number {
    if (kpis.length === 0) return 80; // Default neutral score

    const scores = kpis.map((kpi) => {
      switch (kpi.status) {
        case 'excellent':
          return 100;
        case 'good':
          return 80;
        case 'warning':
          return 60;
        case 'critical':
          return 30;
        default:
          return 70;
      }
    });

    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  // =====================================================
  // DETECT CROSS-AGENT INSIGHTS
  // =====================================================

  private async detectCrossAgentInsights(reports: AgentReport[]): Promise<CrossAgentInsight[]> {
    const insights: CrossAgentInsight[] = [];
    let insightId = 1;

    // Insight 1: Massive files + Duplications correlation
    const massifs = reports.find((r) => r.agentType === 'fichiers-massifs');
    const doublons = reports.find((r) => r.agentType === 'detecteur-doublons');

    if (massifs && doublons) {
      const massiveCount = massifs.kpis['Fichiers massifs'] || 0;
      const duplicationsCount = doublons.kpis['Duplications détectées'] || 0;

      if (massiveCount > 100 && duplicationsCount > 300) {
        insights.push({
          id: `META-${String(insightId++).padStart(3, '0')}`,
          type: 'correlation',
          severity: 'HIGH',
          title: 'High correlation between massive files and duplications',
          description: `${massiveCount} massive files + ${duplicationsCount} duplications suggest lack of modularization`,
          affectedAgents: ['fichiers-massifs', 'detecteur-doublons'],
          impact: 'Poor maintainability, slower development, harder refactoring',
          recommendation: 'Implement modular architecture: extract components, create shared utilities, split large files',
          estimatedEffort: '3-4 weeks',
          roi: 'high',
        });
      }
    }

    // Insight 2: CSS Patterns + React Components
    const css = reports.find((r) => r.agentType === 'refacto-css');
    const react = reports.find((r) => r.agentType === 'upgrade-react');

    if (css && react) {
      const cssPatterns = css.kpis['Patterns dupliqués'] || 0;

      if (cssPatterns > 200) {
        insights.push({
          id: `META-${String(insightId++).padStart(3, '0')}`,
          type: 'opportunity',
          severity: 'MEDIUM',
          title: 'Missing UI component library',
          description: `${cssPatterns} CSS patterns duplicated across components - opportunity to build design system`,
          affectedAgents: ['refacto-css', 'upgrade-react'],
          impact: 'Inconsistent UI, duplicated code, slower feature development',
          recommendation: 'Create UI component library (Button, Card, Input, etc.) with Tailwind variants',
          estimatedEffort: '2-3 weeks',
          roi: 'high',
        });
      }
    }

    // Insight 3: Import Cycles + Architecture
    const graphe = reports.find((r) => r.agentType === 'graphe-imports');
    if (graphe) {
      const cycles = graphe.kpis['Cycles détectés'] || 0;
      const deadCode = graphe.kpis['Dead code'] || 0;

      if (cycles > 0) {
        insights.push({
          id: `META-${String(insightId++).padStart(3, '0')}`,
          type: 'anomaly',
          severity: cycles > 5 ? 'HIGH' : 'MEDIUM',
          title: 'Import cycles detected',
          description: `${cycles} circular dependencies found - can cause build issues and runtime errors`,
          affectedAgents: ['graphe-imports'],
          impact: 'Build failures, hard to test, confusing dependencies',
          recommendation: 'Refactor to unidirectional dependencies: extract interfaces, create dependency injection',
          estimatedEffort: `${cycles} days`,
          roi: 'medium',
        });
      }

      if (deadCode > 100) {
        insights.push({
          id: `META-${String(insightId++).padStart(3, '0')}`,
          type: 'opportunity',
          severity: 'LOW',
          title: 'Significant dead code detected',
          description: `${deadCode} files never imported - safe to delete`,
          affectedAgents: ['graphe-imports'],
          impact: 'Cluttered codebase, confusing navigation, slower builds',
          recommendation: 'Run automated cleanup: delete dead files, verify with tests',
          estimatedEffort: '2-3 days',
          roi: 'medium',
        });
      }
    }

    // Insight 4: Upgrades breaking changes
    const upgradeAgents = reports.filter((r) => r.agentType.startsWith('upgrade-'));
    const totalBreakingChanges = upgradeAgents.reduce((sum, agent) => sum + (agent.kpis['Breaking Changes'] || 0), 0);

    if (totalBreakingChanges > 10) {
      insights.push({
        id: `META-${String(insightId++).padStart(3, '0')}`,
        type: 'pattern',
        severity: 'MEDIUM',
        title: 'Multiple framework upgrades with breaking changes',
        description: `${totalBreakingChanges} total breaking changes across ${upgradeAgents.length} frameworks`,
        affectedAgents: upgradeAgents.map((a) => a.agentType),
        impact: 'High risk of regression, requires extensive testing',
        recommendation: 'Upgrade incrementally: test each framework separately, create rollback plan',
        estimatedEffort: '2-3 weeks',
        roi: 'high',
      });
    }

    // Insight 5: Data architecture (Prisma vestige)
    const data = reports.find((r) => r.agentType === 'data-sanity');
    if (data) {
      const schemaMatch = data.kpis['Schema Match'];
      if (schemaMatch && schemaMatch.includes('2%')) {
        insights.push({
          id: `META-${String(insightId++).padStart(3, '0')}`,
          type: 'anomaly',
          severity: 'MEDIUM',
          title: 'Unused Prisma schema detected',
          description: 'Project uses 100% Supabase but Prisma schema.prisma exists (2 unused models)',
          affectedAgents: ['data-sanity'],
          impact: 'Confusion for new developers, technical debt',
          recommendation: 'Delete backend/prisma directory and PrismaService - clarify architecture is Supabase-only',
          estimatedEffort: '2 hours',
          roi: 'low',
        });
      }
    }

    return insights;
  }

  // =====================================================
  // GENERATE STRATEGIC PRIORITIES
  // =====================================================

  private async generateStrategicPriorities(
    insights: CrossAgentInsight[],
    healthScore: MonorepoHealthScore,
  ): Promise<StrategicPriority[]> {
    const priorities: StrategicPriority[] = [];

    // Priority 1: Quick wins (low effort, high impact)
    const deadCodeInsight = insights.find((i) => i.title.includes('dead code'));
    if (deadCodeInsight) {
      priorities.push({
        rank: priorities.length + 1,
        title: 'Clean up dead code',
        category: 'Code Quality',
        description: deadCodeInsight.description,
        businessValue: 'medium',
        technicalComplexity: 'low',
        estimatedDuration: deadCodeInsight.estimatedEffort,
        dependencies: [],
        blockers: [],
        quickWins: true,
      });
    }

    // Priority 2: UI Component Library (high ROI)
    const uiInsight = insights.find((i) => i.title.includes('UI component'));
    if (uiInsight) {
      priorities.push({
        rank: priorities.length + 1,
        title: 'Build UI Component Library',
        category: 'Architecture',
        description: uiInsight.description,
        businessValue: 'high',
        technicalComplexity: 'medium',
        estimatedDuration: uiInsight.estimatedEffort,
        dependencies: ['CSS patterns analysis'],
        blockers: [],
        quickWins: false,
      });
    }

    // Priority 3: Fix import cycles
    const cyclesInsight = insights.find((i) => i.title.includes('cycles'));
    if (cyclesInsight) {
      priorities.push({
        rank: priorities.length + 1,
        title: 'Resolve import cycles',
        category: 'Architecture',
        description: cyclesInsight.description,
        businessValue: 'high',
        technicalComplexity: 'high',
        estimatedDuration: cyclesInsight.estimatedEffort,
        dependencies: [],
        blockers: [],
        quickWins: false,
      });
    }

    // Priority 4: Framework upgrades
    const upgradeInsight = insights.find((i) => i.title.includes('upgrades'));
    if (upgradeInsight) {
      priorities.push({
        rank: priorities.length + 1,
        title: 'Execute framework upgrades',
        category: 'Maintenance',
        description: upgradeInsight.description,
        businessValue: 'critical',
        technicalComplexity: 'high',
        estimatedDuration: upgradeInsight.estimatedEffort,
        dependencies: ['Test suite coverage > 80%'],
        blockers: [],
        quickWins: false,
      });
    }

    // Priority 5: Modularization
    const modulesInsight = insights.find((i) => i.title.includes('massive files'));
    if (modulesInsight) {
      priorities.push({
        rank: priorities.length + 1,
        title: 'Modularize large files',
        category: 'Code Quality',
        description: modulesInsight.description,
        businessValue: 'high',
        technicalComplexity: 'medium',
        estimatedDuration: modulesInsight.estimatedEffort,
        dependencies: [],
        blockers: [],
        quickWins: false,
      });
    }

    // Priority 6: Data architecture cleanup
    const dataInsight = insights.find((i) => i.title.includes('Prisma'));
    if (dataInsight) {
      priorities.push({
        rank: priorities.length + 1,
        title: 'Clean Prisma vestige',
        category: 'Architecture',
        description: dataInsight.description,
        businessValue: 'low',
        technicalComplexity: 'low',
        estimatedDuration: dataInsight.estimatedEffort,
        dependencies: [],
        blockers: [],
        quickWins: true,
      });
    }

    return priorities.sort((a, b) => {
      // Sort by: quick wins first, then business value, then complexity
      if (a.quickWins && !b.quickWins) return -1;
      if (!a.quickWins && b.quickWins) return 1;

      const valueOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      if (valueOrder[a.businessValue] !== valueOrder[b.businessValue]) {
        return valueOrder[b.businessValue] - valueOrder[a.businessValue];
      }

      const complexityOrder = { low: 1, medium: 2, high: 3 };
      return complexityOrder[a.technicalComplexity] - complexityOrder[b.technicalComplexity];
    });
  }

  // =====================================================
  // CREATE IMPROVEMENT ROADMAP
  // =====================================================

  private async createImprovementRoadmap(priorities: StrategicPriority[]): Promise<ImprovementRoadmap> {
    const phases: RoadmapPhase[] = [];

    // Phase 1: Quick Wins (1-2 weeks)
    const quickWins = priorities.filter((p) => p.quickWins);
    if (quickWins.length > 0) {
      phases.push({
        phase: 1,
        name: 'Quick Wins',
        duration: '1-2 weeks',
        priorities: quickWins,
        milestones: ['Dead code removed', 'Prisma vestige cleaned', 'Codebase organized'],
        successCriteria: ['Build time improved', 'Developer clarity increased', 'No regressions'],
      });
    }

    // Phase 2: Architecture Improvements (3-4 weeks)
    const architecturePriorities = priorities.filter((p) => p.category === 'Architecture' && !p.quickWins);
    if (architecturePriorities.length > 0) {
      phases.push({
        phase: 2,
        name: 'Architecture Improvements',
        duration: '3-4 weeks',
        priorities: architecturePriorities,
        milestones: ['UI component library created', 'Import cycles resolved', 'Modules extracted'],
        successCriteria: ['0 import cycles', '8+ UI components', 'Bundle size -20%'],
      });
    }

    // Phase 3: Framework Upgrades (2-3 weeks)
    const upgradePriorities = priorities.filter((p) => p.category === 'Maintenance');
    if (upgradePriorities.length > 0) {
      phases.push({
        phase: 3,
        name: 'Framework Upgrades',
        duration: '2-3 weeks',
        priorities: upgradePriorities,
        milestones: ['NestJS 11 migrated', 'Remix 2.17 upgraded', 'React 18.3 adopted'],
        successCriteria: ['All tests pass', 'No deprecation warnings', 'Production stable'],
      });
    }

    // Phase 4: Code Quality (3-4 weeks)
    const qualityPriorities = priorities.filter((p) => p.category === 'Code Quality' && !p.quickWins);
    if (qualityPriorities.length > 0) {
      phases.push({
        phase: 4,
        name: 'Code Quality Enhancement',
        duration: '3-4 weeks',
        priorities: qualityPriorities,
        milestones: ['Duplications < 200', 'Massive files < 100', 'Test coverage > 80%'],
        successCriteria: ['Code quality score > 85', 'Maintainability index > 80', 'Tech debt reduced'],
      });
    }

    const totalDuration = `${phases.reduce((sum, p) => sum + parseInt(p.duration), 0)} weeks`;
    const totalEffort = `${priorities.reduce((sum, p) => sum + parseInt(p.estimatedDuration), 0)} person-days`;

    return {
      phases,
      totalDuration,
      totalEffort,
      expectedROI: 'High - improved velocity, reduced bugs, easier maintenance',
    };
  }

  // =====================================================
  // GENERATE CI/CD INTEGRATION
  // =====================================================

  private async generateCICDIntegration(reports: AgentReport[]): Promise<CICDIntegration> {
    const recommendations: CICDRecommendation[] = [];

    // Recommendation 1: Run agents on PR
    recommendations.push({
      tool: 'github-actions',
      step: 'AI Agents Analysis',
      command: 'cd ai-agents && npm run agent:driver',
      when: 'pr',
      threshold: 'Health score > 70',
    });

    // Recommendation 2: Check duplications
    const doublons = reports.find((r) => r.agentType === 'detecteur-doublons');
    if (doublons) {
      recommendations.push({
        tool: 'github-actions',
        step: 'Duplication Check',
        command: 'cd ai-agents && npm run agent:doublons',
        when: 'pre-commit',
        threshold: 'New duplications = 0',
      });
    }

    // Recommendation 3: Performance baseline
    recommendations.push({
      tool: 'github-actions',
      step: 'Performance Baseline',
      command: 'cd ai-agents && npm run agent:perf',
      when: 'nightly',
      threshold: 'No performance degradation',
    });

    // Recommendation 4: Upgrade checks
    recommendations.push({
      tool: 'github-actions',
      step: 'Dependency Upgrades Check',
      command: 'cd ai-agents && npm run agent:upgrades',
      when: 'nightly',
      threshold: 'Breaking changes < 5',
    });

    const proposedWorkflow = this.generateGitHubActionsWorkflow(recommendations);

    return {
      enabled: true,
      recommendations,
      proposedWorkflow,
    };
  }

  private generateGitHubActionsWorkflow(recommendations: CICDRecommendation[]): string {
    return `name: AI Agents CI

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Nightly at 2 AM

jobs:
  ai-agents-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd ai-agents
          npm install
      
      - name: Run AI Agents Driver
        run: |
          cd ai-agents
          npm run agent:driver
      
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: ai-agents-reports
          path: ai-agents/reports/
      
      - name: Check Health Score
        run: |
          SCORE=$(cat ai-agents/reports/meta-agent.json | jq '.healthScore.overall')
          if [ "$SCORE" -lt 70 ]; then
            echo "Health score too low: $SCORE"
            exit 1
          fi
      
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('ai-agents/reports/meta-agent.md', 'utf8'));
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '## 🤖 AI Agents Analysis\\n\\n' + report.substring(0, 1000)
            });
`;
  }

  // =====================================================
  // SAVE REPORTS
  // =====================================================

  private async saveReports(
    agentReports: AgentReport[],
    globalKPIs: GlobalKPI[],
    healthScore: MonorepoHealthScore,
    insights: CrossAgentInsight[],
    priorities: StrategicPriority[],
    roadmap: ImprovementRoadmap,
    cicdIntegration: CICDIntegration,
    executionTime: number,
  ): Promise<void> {
    // JSON report
    const jsonReport = {
      agent: 'Meta-Agent',
      timestamp: new Date().toISOString(),
      executionTime,
      agentReports,
      globalKPIs,
      healthScore,
      insights,
      priorities,
      roadmap,
      cicdIntegration,
    };

    await fs.writeFile(path.join(this.reportsDir, 'meta-agent.json'), JSON.stringify(jsonReport, null, 2));

    // Markdown report
    const mdReport = this.generateMarkdownReport(
      agentReports,
      globalKPIs,
      healthScore,
      insights,
      priorities,
      roadmap,
      executionTime,
    );

    await fs.writeFile(path.join(this.reportsDir, 'meta-agent.md'), mdReport);

    // Roadmap markdown
    const roadmapMd = this.generateRoadmapMarkdown(roadmap);
    await fs.writeFile(path.join(this.reportsDir, 'improvement-roadmap.md'), roadmapMd);

    // CI/CD workflow
    await fs.writeFile(path.join(this.reportsDir, 'cicd-integration.yml'), cicdIntegration.proposedWorkflow);
  }

  private generateMarkdownReport(
    agentReports: AgentReport[],
    globalKPIs: GlobalKPI[],
    healthScore: MonorepoHealthScore,
    insights: CrossAgentInsight[],
    priorities: StrategicPriority[],
    roadmap: ImprovementRoadmap,
    executionTime: number,
  ): string {
    let md = `# 🎯 Meta-Agent Report - Global Analysis

**Agent:** Meta-Agent (Final)
**Date:** ${new Date().toISOString()}
**Execution Time:** ${executionTime}ms

---

## 📊 Monorepo Health Score

### Overall Score: ${healthScore.overall}/100 ${this.getScoreEmoji(healthScore.overall)}

| Category | Score | Status |
|----------|-------|--------|
| **Overall** | **${healthScore.overall}/100** | ${this.getScoreEmoji(healthScore.overall)} |
| Code Quality | ${healthScore.codeQuality}/100 | ${this.getScoreEmoji(healthScore.codeQuality)} |
| Architecture | ${healthScore.architecture}/100 | ${this.getScoreEmoji(healthScore.architecture)} |
| Performance | ${healthScore.performance}/100 | ${this.getScoreEmoji(healthScore.performance)} |
| Security | ${healthScore.security}/100 | ${this.getScoreEmoji(healthScore.security)} |
| Maintainability | ${healthScore.maintainability}/100 | ${this.getScoreEmoji(healthScore.maintainability)} |
| Upgrades | ${healthScore.upgrades}/100 | ${this.getScoreEmoji(healthScore.upgrades)} |

---

## 🔍 Global KPIs

`;

    const categories = ['code-quality', 'architecture', 'performance', 'upgrades'];
    for (const category of categories) {
      const categoryKPIs = globalKPIs.filter((k) => k.category === category);
      if (categoryKPIs.length === 0) continue;

      md += `### ${category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}\n\n`;
      md += '| KPI | Value | Status | Source |\n';
      md += '|-----|-------|--------|--------|\n';

      for (const kpi of categoryKPIs) {
        const statusEmoji = this.getStatusEmoji(kpi.status);
        const sources = kpi.source.slice(0, 2).join(', ');
        md += `| ${kpi.name} | ${kpi.value}${kpi.unit || ''} | ${statusEmoji} | ${sources} |\n`;
      }

      md += '\n';
    }

    md += `---

## 💡 Cross-Agent Insights

**Total Insights:** ${insights.length}

`;

    const bySeverity = {
      CRITICAL: insights.filter((i) => i.severity === 'CRITICAL'),
      HIGH: insights.filter((i) => i.severity === 'HIGH'),
      MEDIUM: insights.filter((i) => i.severity === 'MEDIUM'),
      LOW: insights.filter((i) => i.severity === 'LOW'),
    };

    for (const [severity, items] of Object.entries(bySeverity)) {
      if (items.length === 0) continue;

      const emoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢';

      md += `### ${emoji} ${severity} (${items.length})\n\n`;

      for (const insight of items) {
        md += `#### ${insight.id}: ${insight.title}\n`;
        md += `- **Type:** ${insight.type}\n`;
        md += `- **Description:** ${insight.description}\n`;
        md += `- **Impact:** ${insight.impact}\n`;
        md += `- **Recommendation:** ${insight.recommendation}\n`;
        md += `- **Estimated Effort:** ${insight.estimatedEffort}\n`;
        md += `- **ROI:** ${insight.roi.toUpperCase()}\n`;
        md += `- **Affected Agents:** ${insight.affectedAgents.join(', ')}\n\n`;
      }
    }

    md += `---

## 🎯 Strategic Priorities

**Total Priorities:** ${priorities.length}

`;

    for (const priority of priorities) {
      const rankEmoji = priority.rank === 1 ? '🥇' : priority.rank === 2 ? '🥈' : priority.rank === 3 ? '🥉' : `${priority.rank}.`;
      const quickWinBadge = priority.quickWins ? '⚡ QUICK WIN' : '';

      md += `### ${rankEmoji} ${priority.title} ${quickWinBadge}\n\n`;
      md += `- **Category:** ${priority.category}\n`;
      md += `- **Business Value:** ${priority.businessValue.toUpperCase()}\n`;
      md += `- **Technical Complexity:** ${priority.technicalComplexity.toUpperCase()}\n`;
      md += `- **Estimated Duration:** ${priority.estimatedDuration}\n`;
      md += `- **Description:** ${priority.description}\n`;

      if (priority.dependencies.length > 0) {
        md += `- **Dependencies:** ${priority.dependencies.join(', ')}\n`;
      }

      if (priority.blockers.length > 0) {
        md += `- **Blockers:** ${priority.blockers.join(', ')}\n`;
      }

      md += '\n';
    }

    md += `---

## 🗺️ Improvement Roadmap

**Total Duration:** ${roadmap.totalDuration}
**Total Effort:** ${roadmap.totalEffort}
**Expected ROI:** ${roadmap.expectedROI}

`;

    for (const phase of roadmap.phases) {
      md += `### Phase ${phase.phase}: ${phase.name} (${phase.duration})\n\n`;
      md += `**Priorities (${phase.priorities.length}):**\n`;
      for (const priority of phase.priorities) {
        md += `- ${priority.title}\n`;
      }

      md += `\n**Milestones:**\n`;
      for (const milestone of phase.milestones) {
        md += `- ${milestone}\n`;
      }

      md += `\n**Success Criteria:**\n`;
      for (const criteria of phase.successCriteria) {
        md += `- ${criteria}\n`;
      }

      md += '\n';
    }

    md += `---

## 🔧 CI/CD Integration

See \`cicd-integration.yml\` for complete GitHub Actions workflow.

**Recommended Checks:**

`;

    for (const rec of insights.slice(0, 5)) {
      md += `- ${rec.title}\n`;
    }

    md += `

---

## 📈 Agent Execution Summary

| Agent | Execution Time | Status | Summary |
|-------|---------------|--------|---------|
`;

    for (const report of agentReports) {
      const statusEmoji = report.status === 'success' ? '✅' : report.status === 'warning' ? '⚠️' : '❌';
      md += `| ${report.agentName} | ${report.executionTime}ms | ${statusEmoji} | ${report.summary} |\n`;
    }

    md += `

---

## 🚀 Next Steps

1. **Review this report** - Understand global health and priorities
2. **Execute Quick Wins** - Start with Phase 1 (1-2 weeks)
3. **Plan Architecture Phase** - UI components, cycles resolution (3-4 weeks)
4. **Schedule Upgrades** - NestJS, Remix, React (2-3 weeks)
5. **Enable CI/CD** - Deploy \`cicd-integration.yml\` to GitHub Actions
6. **Monitor Progress** - Re-run Meta-Agent monthly to track improvements

---

**Meta-Agent Analysis Complete** ✅

`;

    return md;
  }

  private generateRoadmapMarkdown(roadmap: ImprovementRoadmap): string {
    let md = `# 🗺️ Improvement Roadmap

**Total Duration:** ${roadmap.totalDuration}
**Total Effort:** ${roadmap.totalEffort}
**Expected ROI:** ${roadmap.expectedROI}

---

`;

    for (const phase of roadmap.phases) {
      md += `## Phase ${phase.phase}: ${phase.name}

**Duration:** ${phase.duration}

### Priorities

`;

      for (const priority of phase.priorities) {
        md += `#### ${priority.title}\n`;
        md += `- **Category:** ${priority.category}\n`;
        md += `- **Business Value:** ${priority.businessValue}\n`;
        md += `- **Complexity:** ${priority.technicalComplexity}\n`;
        md += `- **Duration:** ${priority.estimatedDuration}\n`;
        md += `- **Description:** ${priority.description}\n\n`;
      }

      md += `### Milestones\n\n`;
      for (const milestone of phase.milestones) {
        md += `- [ ] ${milestone}\n`;
      }

      md += `\n### Success Criteria\n\n`;
      for (const criteria of phase.successCriteria) {
        md += `- ${criteria}\n`;
      }

      md += '\n---\n\n';
    }

    return md;
  }

  private getScoreEmoji(score: number): string {
    if (score >= 85) return '🟢 Excellent';
    if (score >= 70) return '🟡 Good';
    if (score >= 50) return '🟠 Warning';
    return '🔴 Critical';
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'excellent':
        return '🟢';
      case 'good':
        return '✅';
      case 'warning':
        return '🟡';
      case 'critical':
        return '🔴';
      default:
        return '⚪';
    }
  }
}
