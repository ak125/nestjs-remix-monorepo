/**
 * Meta-Performance Agent Service - AI-COS v2.28.0
 * 
 * Performance Squad : Tech + Observabilité + UX
 * Budget: €45K | ROI: +25% conversion, -40% rebond
 * 
 * 15 Agents répartis en 3 piliers:
 * - Tech Perf (5): IA-CTO, IA-DevOps, Database Optimizer, Cache Optimizer, Bundle Optimizer
 * - Observability (5): APM Monitor, Log Analyzer, Trace Correlator, Alert Manager, SLO Tracker
 * - UX Perf (5): Performance Monitor, CWV Optimizer, Image Optimizer, Font Loader, Lazy Load Manager
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface PerformanceBudget {
  cwv: {
    lcp: number;      // ms - Largest Contentful Paint target
    fid: number;      // ms - First Input Delay target
    cls: number;      // score - Cumulative Layout Shift target
    inp: number;      // ms - Interaction to Next Paint target
  };
  backend: {
    ttfb: number;     // ms - Time to First Byte target
    apiP95: number;   // ms - API response P95 target
    apiP99: number;   // ms - API response P99 target
  };
  assets: {
    jsBundle: number;     // KB - Main JS bundle (gzip)
    cssBundle: number;    // KB - Main CSS bundle (gzip)
    totalWeight: number;  // KB - Total page weight
    maxRequests: number;  // Max HTTP requests
  };
  availability: {
    uptime: number;       // % - SLO target
    errorRate: number;    // % - Max error rate
  };
}

export interface CoreWebVitals {
  lcp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  fid: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  cls: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  inp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  ttfb: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
}

export interface SLOStatus {
  compliance: number;       // %
  errorBudgetRemaining: number; // %
  burnRate: number;         // multiplier (1.0 = on track)
  activeAlerts: number;
}

export interface PerformanceMetrics {
  // Core Web Vitals
  lighthouseScore: number;
  lcpP75: number;
  fidP75: number;
  clsP75: number;
  inpP75: number;
  ttfbP75: number;
  
  // Backend
  apiP95: number;
  apiP99: number;
  apiErrorRate: number;
  
  // Cache & DB
  cacheHitRate: number;
  dbQueryP95: number;
  slowQueries: number;
  
  // Assets
  jsBundleSize: number;
  cssBundleSize: number;
  totalPageWeight: number;
  
  // Observability
  mttd: number;  // Mean Time To Detect (min)
  mttr: number;  // Mean Time To Recover (min)
  
  // SLO
  sloCompliance: number;
}

export interface PerformanceAlert {
  alertId: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metric: string;
  currentValue: number;
  threshold: number;
  source: 'TECH' | 'OBSERVABILITY' | 'UX';
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface OptimizationRecommendation {
  id: string;
  pillar: 'TECH' | 'OBSERVABILITY' | 'UX';
  agent: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedImprovement: string;
  autoFixAvailable: boolean;
}

export type PerformancePillar = 'TECH' | 'OBSERVABILITY' | 'UX';

// ============================================================================
// META-PERFORMANCE AGENT SERVICE
// ============================================================================

@Injectable()
export class MetaPerformanceAgentService implements OnModuleInit {
  private readonly logger = new Logger('Meta-Performance');
  
  // Performance Budget (targets)
  private readonly performanceBudget: PerformanceBudget = {
    cwv: {
      lcp: 2500,    // 2.5s
      fid: 100,     // 100ms
      cls: 0.1,     // 0.1 score
      inp: 200      // 200ms
    },
    backend: {
      ttfb: 200,    // 200ms
      apiP95: 150,  // 150ms
      apiP99: 500   // 500ms
    },
    assets: {
      jsBundle: 200,      // 200KB
      cssBundle: 50,      // 50KB
      totalWeight: 1024,  // 1MB
      maxRequests: 50
    },
    availability: {
      uptime: 99.9,
      errorRate: 0.1
    }
  };

  // Current metrics
  private metrics: PerformanceMetrics;
  private sloStatus: SLOStatus;
  private activeAlerts: Map<string, PerformanceAlert> = new Map();
  private recommendations: OptimizationRecommendation[] = [];

  // Managed agents by pillar
  private readonly techPerfAgents = [
    'IA-CTO', 'IA-DevOps', 'Database Optimizer', 'Cache Optimizer', 'Bundle Optimizer'
  ];
  private readonly observabilityAgents = [
    'APM Monitor', 'Log Analyzer', 'Trace Correlator', 'Alert Manager', 'SLO Tracker'
  ];
  private readonly uxPerfAgents = [
    'Performance Monitor', 'CWV Optimizer', 'Image Optimizer', 'Font Loader', 'Lazy Load Manager'
  ];

  constructor(
    private readonly eventEmitter: EventEmitter2
  ) {
    this.initializeMetrics();
  }

  async onModuleInit() {
    this.logger.log('Meta-Performance Agent initialized');
    this.setupEventListeners();
  }

  // -------------------------------------------------------------------------
  // INITIALIZATION
  // -------------------------------------------------------------------------

  private initializeMetrics(): void {
    this.metrics = {
      lighthouseScore: 0,
      lcpP75: 0,
      fidP75: 0,
      clsP75: 0,
      inpP75: 0,
      ttfbP75: 0,
      apiP95: 0,
      apiP99: 0,
      apiErrorRate: 0,
      cacheHitRate: 0,
      dbQueryP95: 0,
      slowQueries: 0,
      jsBundleSize: 0,
      cssBundleSize: 0,
      totalPageWeight: 0,
      mttd: 0,
      mttr: 0,
      sloCompliance: 100
    };

    this.sloStatus = {
      compliance: 100,
      errorBudgetRemaining: 100,
      burnRate: 0,
      activeAlerts: 0
    };
  }

  private setupEventListeners(): void {
    // Listen for performance events from other squads
    this.eventEmitter.on('performance.alert', (alert: any) => {
      this.handlePerformanceAlert(alert);
    });

    this.eventEmitter.on('performance.metrics', (metrics: Partial<PerformanceMetrics>) => {
      this.updateMetrics(metrics);
    });

    this.eventEmitter.on('meta.PERFORMANCE', (event: any) => {
      this.handleMetaEvent(event);
    });

    this.logger.log('Event listeners configured');
  }

  // -------------------------------------------------------------------------
  // CORE WEB VITALS MONITORING
  // -------------------------------------------------------------------------

  /**
   * Collect and analyze Core Web Vitals from RUM data
   */
  async collectCoreWebVitals(): Promise<CoreWebVitals> {
    this.logger.debug('Collecting Core Web Vitals from RUM...');

    // In production, this would fetch from SpeedCurve/Vercel Analytics
    const cwv: CoreWebVitals = {
      lcp: this.rateMetric(this.metrics.lcpP75, this.performanceBudget.cwv.lcp, 4000),
      fid: this.rateMetric(this.metrics.fidP75, this.performanceBudget.cwv.fid, 300),
      cls: this.rateMetric(this.metrics.clsP75, this.performanceBudget.cwv.cls, 0.25),
      inp: this.rateMetric(this.metrics.inpP75, this.performanceBudget.cwv.inp, 500),
      ttfb: this.rateMetric(this.metrics.ttfbP75, this.performanceBudget.cwv.ttfb, 600)
    };

    // Check for degradations
    for (const [metric, data] of Object.entries(cwv)) {
      if (data.rating === 'poor') {
        await this.triggerCWVAlert(metric as keyof CoreWebVitals, data.value);
      }
    }

    return cwv;
  }

  private rateMetric(
    value: number, 
    goodThreshold: number, 
    poorThreshold: number
  ): { value: number; rating: 'good' | 'needs-improvement' | 'poor' } {
    let rating: 'good' | 'needs-improvement' | 'poor';
    
    if (value <= goodThreshold) {
      rating = 'good';
    } else if (value <= poorThreshold) {
      rating = 'needs-improvement';
    } else {
      rating = 'poor';
    }

    return { value, rating };
  }

  private async triggerCWVAlert(metric: keyof CoreWebVitals, value: number): Promise<void> {
    const alert: PerformanceAlert = {
      alertId: `cwv_${metric}_${Date.now()}`,
      severity: 'CRITICAL',
      metric: metric.toUpperCase(),
      currentValue: value,
      threshold: this.performanceBudget.cwv[metric as keyof typeof this.performanceBudget.cwv] as number,
      source: 'UX',
      timestamp: new Date(),
      resolved: false
    };

    this.activeAlerts.set(alert.alertId, alert);
    this.sloStatus.activeAlerts = this.activeAlerts.size;

    // Trigger CWV Fix SAGA
    await this.executeSaga_CWVFix(metric, value);
  }

  // -------------------------------------------------------------------------
  // SAGA WORKFLOWS
  // -------------------------------------------------------------------------

  /**
   * SAGA: Performance Regression Alert
   * Trigger: CWV ou API dégrade au-delà du budget
   */
  async executeSaga_PerformanceRegressionAlert(
    metric: string, 
    currentValue: number, 
    threshold: number
  ): Promise<void> {
    this.logger.warn(`SAGA: Performance Regression Alert - ${metric}: ${currentValue} > ${threshold}`);

    // Step 1: APM Monitor détecte dégradation
    const detection = await this.executeAgent('APM Monitor', 'detectDegradation', { metric, currentValue });
    
    // Step 2: Trace Correlator identifie root cause
    const rootCause = await this.executeAgent('Trace Correlator', 'findRootCause', { metric });
    
    // Step 3: Route vers agent spécialisé selon cause
    let fixResult;
    switch (rootCause.category) {
      case 'DATABASE':
        fixResult = await this.executeAgent('Database Optimizer', 'optimizeQuery', rootCause);
        break;
      case 'CACHE':
        fixResult = await this.executeAgent('Cache Optimizer', 'improveCacheStrategy', rootCause);
        break;
      case 'FRONTEND':
        fixResult = await this.executeAgent('Bundle Optimizer', 'reduceBundleSize', rootCause);
        break;
      case 'INFRA':
        fixResult = await this.executeAgent('IA-DevOps', 'scaleResources', rootCause);
        break;
      default:
        fixResult = { action: 'ESCALATE', reason: 'Unknown root cause' };
    }

    // Step 4: SLO Tracker vérifie recovery
    const recovery = await this.executeAgent('SLO Tracker', 'verifyRecovery', { metric, threshold });
    
    // Step 5: Log Analyzer documente incident
    await this.executeAgent('Log Analyzer', 'documentIncident', {
      metric, rootCause, fixResult, recovery
    });

    this.logger.log(`SAGA completed: ${metric} recovery = ${recovery.recovered}`);
  }

  /**
   * SAGA: Proactive Performance Optimization
   * Trigger: Hebdomadaire ou avant événement trafic
   */
  @Cron(CronExpression.EVERY_WEEK)
  async executeSaga_ProactiveOptimization(): Promise<void> {
    this.logger.log('SAGA: Proactive Performance Optimization - Weekly run');

    // Step 1: SLO Tracker analyse error budget restant
    const errorBudget = await this.executeAgent('SLO Tracker', 'analyzeErrorBudget', {});
    
    // Step 2: Performance Monitor audit Lighthouse CI
    const lighthouseAudit = await this.executeAgent('Performance Monitor', 'runLighthouseAudit', {
      urls: ['/', '/products', '/cart', '/checkout']
    });

    // Step 3: Database Optimizer slow query analysis
    const slowQueries = await this.executeAgent('Database Optimizer', 'analyzeSlowQueries', {});

    // Step 4: Bundle Optimizer bundle analysis
    const bundleAnalysis = await this.executeAgent('Bundle Optimizer', 'analyzeBundles', {});

    // Step 5: Image Optimizer scan nouvelles images
    const imageAnalysis = await this.executeAgent('Image Optimizer', 'scanImages', {});

    // Step 6: Cache Optimizer hit rate optimization
    const cacheAnalysis = await this.executeAgent('Cache Optimizer', 'analyzeHitRate', {});

    // Step 7: IA-CTO priorise top 5 optimisations
    const prioritized = await this.executeAgent('IA-CTO', 'prioritizeOptimizations', {
      errorBudget,
      lighthouseAudit,
      slowQueries,
      bundleAnalysis,
      imageAnalysis,
      cacheAnalysis
    });

    // Step 8: Création tickets Jira
    this.recommendations = prioritized.recommendations;
    for (const rec of prioritized.recommendations.slice(0, 5)) {
      await this.createOptimizationTicket(rec);
    }

    this.logger.log(`SAGA completed: ${prioritized.recommendations.length} recommendations, top 5 tickets created`);
  }

  /**
   * SAGA: Traffic Spike Preparation
   * Trigger: Événement planifié (Black Friday, soldes, campagne)
   */
  async executeSaga_TrafficSpikePreparation(event: {
    name: string;
    date: Date;
    expectedTrafficMultiplier: number;
  }): Promise<void> {
    this.logger.log(`SAGA: Traffic Spike Preparation for ${event.name}`);

    // Step 1: Meta-Performance reçoit alert J-7
    const daysUntil = Math.ceil((event.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 7) {
      this.logger.debug(`Event ${event.name} is ${daysUntil} days away, skipping preparation`);
      return;
    }

    // Step 2: IA-DevOps pre-scale infrastructure
    await this.executeAgent('IA-DevOps', 'preScaleInfrastructure', {
      multiplier: event.expectedTrafficMultiplier
    });

    // Step 3: Cache Optimizer warm cache produits phares
    await this.executeAgent('Cache Optimizer', 'warmCache', {
      categories: ['featured', 'bestsellers', 'promotions']
    });

    // Step 4: Database Optimizer read replicas activées
    await this.executeAgent('Database Optimizer', 'enableReadReplicas', {
      count: Math.ceil(event.expectedTrafficMultiplier)
    });

    // Step 5: Bundle Optimizer critical CSS inline
    await this.executeAgent('Bundle Optimizer', 'inlineCriticalCSS', {
      pages: ['/', '/products', '/cart', '/checkout']
    });

    // Step 6: Image Optimizer CDN prefetch
    await this.executeAgent('Image Optimizer', 'prefetchCDN', {
      categories: ['featured', 'promotions']
    });

    // Step 7: Alert Manager seuils alertes ajustés
    await this.executeAgent('Alert Manager', 'adjustThresholds', {
      multiplier: 1.5, // More tolerant during spike
      duration: '24h'
    });

    // Step 8: SLO Tracker error budget lock
    await this.executeAgent('SLO Tracker', 'lockErrorBudget', {
      reason: event.name,
      duration: '48h'
    });

    // Step 9: Load test simulation
    this.eventEmitter.emit('meta.TECH', {
      eventType: 'REQUEST',
      payload: {
        type: 'LOAD_TEST',
        targetRPS: event.expectedTrafficMultiplier * 100,
        duration: '10m'
      }
    });

    this.logger.log(`SAGA completed: Infrastructure prepared for ${event.name}`);
  }

  /**
   * SAGA: Core Web Vitals Fix
   * Trigger: CWV rouge détecté sur page critique
   */
  async executeSaga_CWVFix(metric: string, value: number): Promise<void> {
    this.logger.warn(`SAGA: CWV Fix for ${metric.toUpperCase()} = ${value}`);

    // Step 1: CWV Optimizer identifie page + métrique
    const analysis = await this.executeAgent('CWV Optimizer', 'analyzeMetric', { metric, value });
    
    let fixAgent: string;
    let fixAction: string;
    
    // Route to specialized agent based on metric
    switch (metric.toLowerCase()) {
      case 'lcp':
        fixAgent = 'Image Optimizer';
        fixAction = 'optimizeLCPElement';
        // Also involve Lazy Load Manager
        await this.executeAgent('Lazy Load Manager', 'prioritizeLCPElement', analysis);
        break;
      case 'fid':
      case 'inp':
        fixAgent = 'Bundle Optimizer';
        fixAction = 'deferNonCriticalJS';
        break;
      case 'cls':
        fixAgent = 'Font Loader';
        fixAction = 'fixFontDisplaySwap';
        // Also check image dimensions
        await this.executeAgent('Image Optimizer', 'addExplicitDimensions', analysis);
        break;
      default:
        fixAgent = 'CWV Optimizer';
        fixAction = 'genericOptimization';
    }

    // Step 2: Agent spécialisé analyse cause
    const fix = await this.executeAgent(fixAgent, fixAction, analysis);

    // Step 3: Génération PR automatique
    const pr = await this.generatePullRequest(fix);

    // Step 4: Performance Monitor Lighthouse CI validation
    const validation = await this.executeAgent('Performance Monitor', 'validateWithLighthouse', {
      branch: pr.branch,
      targetScore: 90
    });

    if (validation.score < 90) {
      this.logger.warn(`Lighthouse validation failed: ${validation.score}`);
      return;
    }

    // Step 5: A/B Test Bot test impact conversion
    this.eventEmitter.emit('meta.UX', {
      eventType: 'REQUEST',
      payload: {
        type: 'AB_TEST',
        variant: pr.branch,
        metric: 'conversion',
        duration: '7d'
      }
    });

    this.logger.log(`SAGA: CWV Fix PR created, awaiting A/B test results`);
  }

  /**
   * SAGA: Database Performance Audit
   * Trigger: Mensuel ou API P95 >150ms
   */
  @Cron('0 3 1 * *') // First day of month at 3am
  async executeSaga_DatabaseAudit(): Promise<void> {
    this.logger.log('SAGA: Database Performance Audit - Monthly run');

    // Step 1: Database Optimizer slow query log analysis
    const slowQueryAnalysis = await this.executeAgent('Database Optimizer', 'analyzeSlowQueryLog', {
      period: '30d'
    });

    // Step 2: Identification top 10 slow queries
    const top10 = slowQueryAnalysis.queries.slice(0, 10);

    // Step 3: Pour chaque query
    const optimizations = [];
    for (const query of top10) {
      // EXPLAIN ANALYZE
      const explain = await this.executeAgent('Database Optimizer', 'explainAnalyze', { query });
      
      // Index recommendation
      const indexRec = await this.executeAgent('Database Optimizer', 'recommendIndex', { query, explain });
      
      // Query rewrite si N+1
      if (explain.isN1Problem) {
        const rewrite = await this.executeAgent('Database Optimizer', 'rewriteQuery', { query });
        optimizations.push({ query, explain, indexRec, rewrite });
      } else {
        optimizations.push({ query, explain, indexRec });
      }
    }

    // Step 4: Cache Optimizer caching candidates
    const cacheCandidates = await this.executeAgent('Cache Optimizer', 'identifyCacheCandidates', {
      queries: top10
    });

    // Step 5: APM Monitor baseline avant/après
    const baseline = await this.executeAgent('APM Monitor', 'captureBaseline', {
      metrics: ['db_query_p95', 'db_query_p99', 'api_p95']
    });

    // Step 6: IA-CTO validation migrations
    const validated = await this.executeAgent('IA-CTO', 'validateMigrations', {
      optimizations,
      cacheCandidates,
      baseline
    });

    // Step 7: Déploiement progressif (canary 10%)
    if (validated.approved) {
      await this.executeAgent('IA-DevOps', 'canaryDeploy', {
        changes: validated.changes,
        percentage: 10
      });
    }

    this.logger.log(`SAGA completed: ${optimizations.length} query optimizations analyzed`);
  }

  // -------------------------------------------------------------------------
  // AGENT EXECUTION
  // -------------------------------------------------------------------------

  private async executeAgent(agentName: string, action: string, params: any): Promise<any> {
    this.logger.debug(`Executing ${agentName}.${action}()`);
    
    // In production, this would call actual agent services
    // For now, simulate responses
    await this.simulateAgentDelay();

    return {
      agent: agentName,
      action,
      success: true,
      result: {},
      timestamp: new Date()
    };
  }

  private async simulateAgentDelay(): Promise<void> {
    // Simulate agent processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // -------------------------------------------------------------------------
  // METRICS UPDATE
  // -------------------------------------------------------------------------

  updateMetrics(partial: Partial<PerformanceMetrics>): void {
    this.metrics = { ...this.metrics, ...partial };
    this.checkThresholds();
  }

  private checkThresholds(): void {
    // Check Lighthouse score
    if (this.metrics.lighthouseScore < 75) {
      this.createAlert('CRITICAL', 'lighthouse-score', this.metrics.lighthouseScore, 75, 'UX');
    } else if (this.metrics.lighthouseScore < 85) {
      this.createAlert('WARNING', 'lighthouse-score', this.metrics.lighthouseScore, 85, 'UX');
    }

    // Check API P95
    if (this.metrics.apiP95 > 500) {
      this.createAlert('CRITICAL', 'api-p95', this.metrics.apiP95, 500, 'TECH');
    } else if (this.metrics.apiP95 > 150) {
      this.createAlert('WARNING', 'api-p95', this.metrics.apiP95, 150, 'TECH');
    }

    // Check cache hit rate
    if (this.metrics.cacheHitRate < 80) {
      this.createAlert('CRITICAL', 'cache-hit-rate', this.metrics.cacheHitRate, 80, 'TECH');
    } else if (this.metrics.cacheHitRate < 95) {
      this.createAlert('WARNING', 'cache-hit-rate', this.metrics.cacheHitRate, 95, 'TECH');
    }

    // Check SLO compliance
    if (this.metrics.sloCompliance < 99) {
      this.createAlert('CRITICAL', 'slo-compliance', this.metrics.sloCompliance, 99, 'OBSERVABILITY');
    } else if (this.metrics.sloCompliance < 99.5) {
      this.createAlert('WARNING', 'slo-compliance', this.metrics.sloCompliance, 99.5, 'OBSERVABILITY');
    }
  }

  private createAlert(
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    metric: string,
    currentValue: number,
    threshold: number,
    source: PerformancePillar
  ): void {
    const alertId = `perf_${metric}_${Date.now()}`;
    
    if (!this.activeAlerts.has(alertId)) {
      const alert: PerformanceAlert = {
        alertId,
        severity,
        metric,
        currentValue,
        threshold,
        source,
        timestamp: new Date(),
        resolved: false
      };

      this.activeAlerts.set(alertId, alert);
      this.sloStatus.activeAlerts = this.activeAlerts.size;

      this.logger.warn(`Alert created: ${severity} - ${metric} = ${currentValue} (threshold: ${threshold})`);

      // Emit alert event
      this.eventEmitter.emit('performance.alert.created', alert);

      // Trigger regression alert SAGA if critical
      if (severity === 'CRITICAL') {
        this.executeSaga_PerformanceRegressionAlert(metric, currentValue, threshold);
      }
    }
  }

  // -------------------------------------------------------------------------
  // EVENT HANDLING
  // -------------------------------------------------------------------------

  private handlePerformanceAlert(alert: any): void {
    this.logger.log(`Received performance alert: ${JSON.stringify(alert)}`);
  }

  private handleMetaEvent(event: any): void {
    switch (event.payload?.type) {
      case 'TRAFFIC_SPIKE_ALERT':
        this.executeSaga_TrafficSpikePreparation(event.payload);
        break;
      case 'CWV_DEGRADATION':
        this.executeSaga_CWVFix(event.payload.metric, event.payload.value);
        break;
      case 'PERFORMANCE_AUDIT_REQUEST':
        this.executeSaga_ProactiveOptimization();
        break;
    }
  }

  // -------------------------------------------------------------------------
  // HELPER METHODS
  // -------------------------------------------------------------------------

  private async generatePullRequest(fix: any): Promise<{ branch: string; url: string }> {
    const branch = `perf/fix-${fix.metric}-${Date.now()}`;
    // In production, would use GitHub API
    return { branch, url: `https://github.com/repo/pull/new/${branch}` };
  }

  private async createOptimizationTicket(recommendation: OptimizationRecommendation): Promise<void> {
    // In production, would use Jira API
    this.logger.debug(`Creating ticket for: ${recommendation.description}`);
  }

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  getPerformanceBudget(): PerformanceBudget {
    return { ...this.performanceBudget };
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getSLOStatus(): SLOStatus {
    return { ...this.sloStatus };
  }

  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getRecommendations(): OptimizationRecommendation[] {
    return [...this.recommendations];
  }

  getManagedAgents(): { tech: string[]; observability: string[]; ux: string[] } {
    return {
      tech: [...this.techPerfAgents],
      observability: [...this.observabilityAgents],
      ux: [...this.uxPerfAgents]
    };
  }

  /**
   * Get dashboard data for Performance Squad
   */
  getDashboardData(): {
    cwv: CoreWebVitals;
    backend: { ttfb: number; apiP95: number; apiP99: number; errorRate: number };
    slo: SLOStatus;
    cache: { hitRate: number; dbP95: number; slowQueries: number };
    assets: { js: number; css: number; total: number };
    alerts: PerformanceAlert[];
  } {
    return {
      cwv: {
        lcp: this.rateMetric(this.metrics.lcpP75, 2500, 4000),
        fid: this.rateMetric(this.metrics.fidP75, 100, 300),
        cls: this.rateMetric(this.metrics.clsP75, 0.1, 0.25),
        inp: this.rateMetric(this.metrics.inpP75, 200, 500),
        ttfb: this.rateMetric(this.metrics.ttfbP75, 200, 600)
      },
      backend: {
        ttfb: this.metrics.ttfbP75,
        apiP95: this.metrics.apiP95,
        apiP99: this.metrics.apiP99,
        errorRate: this.metrics.apiErrorRate
      },
      slo: this.sloStatus,
      cache: {
        hitRate: this.metrics.cacheHitRate,
        dbP95: this.metrics.dbQueryP95,
        slowQueries: this.metrics.slowQueries
      },
      assets: {
        js: this.metrics.jsBundleSize,
        css: this.metrics.cssBundleSize,
        total: this.metrics.totalPageWeight
      },
      alerts: this.getActiveAlerts()
    };
  }

  /**
   * Trigger manual performance audit
   */
  async triggerAudit(type: 'FULL' | 'CWV' | 'DATABASE' | 'BUNDLE'): Promise<void> {
    switch (type) {
      case 'FULL':
        await this.executeSaga_ProactiveOptimization();
        break;
      case 'CWV':
        await this.collectCoreWebVitals();
        break;
      case 'DATABASE':
        await this.executeSaga_DatabaseAudit();
        break;
      case 'BUNDLE':
        await this.executeAgent('Bundle Optimizer', 'analyzeBundles', {});
        break;
    }
  }

  /**
   * Prepare for traffic spike event
   */
  async prepareForEvent(eventName: string, date: Date, expectedMultiplier: number): Promise<void> {
    await this.executeSaga_TrafficSpikePreparation({
      name: eventName,
      date,
      expectedTrafficMultiplier: expectedMultiplier
    });
  }
}
