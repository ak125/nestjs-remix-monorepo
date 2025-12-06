/**
 * Meta-Agent Service - AI-COS v2.27.0
 * 
 * Orchestration & Synchronisation des Squads via Meta-Agents
 * Budget: €193K | ROI: +40% efficacité, -60% latence
 * 
 * 7 Meta-Agents:
 * - Meta-Commerce (E-Commerce Squad, 7 agents) - €28K
 * - Meta-Marketing (Marketing Squad, 6 agents) - €25K
 * - Meta-Customer (Customer Squad, 6 agents) - €30K
 * - Meta-Tech (Tech Squad, 22 agents) - €35K
 * - Meta-Infra (Infrastructure Squad, 5 agents) - €22K
 * - Meta-Security (Resilience Squad, 6 agents) - €28K
 * - Meta-UX (UX Squad, 6 agents) - €25K
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type SquadType = 
  | 'E_COMMERCE' | 'MARKETING' | 'CUSTOMER' 
  | 'TECH' | 'INFRA' | 'SECURITY' | 'UX';

export type EventPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type EventType = 'SYNC' | 'REQUEST' | 'NOTIFY' | 'ESCALATE';
export type SagaStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'COMPENSATING' | 'FAILED';

export interface MetaAgentEvent {
  eventId: string;
  timestamp: Date;
  sourceSquad: SquadType;
  targetSquads: SquadType[];
  eventType: EventType;
  payload: any;
  priority: EventPriority;
  sagaId?: string;
}

export interface SagaStep {
  stepId: string;
  agentName: string;
  action: string;
  status: SagaStatus;
  result?: any;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  compensationAction?: string;
}

export interface Saga {
  sagaId: string;
  name: string;
  squad: SquadType;
  status: SagaStatus;
  steps: SagaStep[];
  currentStepIndex: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ConflictResolution {
  conflictId: string;
  description: string;
  agents: string[];
  resolution: string;
  resolvedAt: Date;
  autoResolved: boolean;
}

export interface EscalationRequest {
  escalationId: string;
  sourceSquad: SquadType;
  targetLevel: 'CFO' | 'CEO' | 'BOARD';
  reason: string;
  context: any;
  budgetImpact?: number;
  createdAt: Date;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface SquadHealth {
  squad: SquadType;
  healthScore: number; // 0-100
  activeAgents: number;
  totalAgents: number;
  pendingSagas: number;
  avgResponseTime: number; // ms
  lastHeartbeat: Date;
  issues: string[];
}

export interface MetaAgentMetrics {
  squadSyncLatency: number; // Target <100ms
  sagaCompletionRate: number; // Target >98%
  conflictResolutionTime: number; // Target <5min
  escalationAccuracy: number; // Target >95%
  patternReuseRate: number; // Target >60%
}

// ============================================================================
// ABSTRACT BASE META-AGENT
// ============================================================================

@Injectable()
export abstract class BaseMetaAgent implements OnModuleInit {
  protected readonly logger: Logger;
  protected readonly squadType: SquadType;
  protected readonly managedAgents: string[];
  
  protected activeSagas: Map<string, Saga> = new Map();
  protected conflictHistory: ConflictResolution[] = [];
  protected escalationQueue: EscalationRequest[] = [];
  protected patterns: Map<string, any> = new Map();
  protected health: SquadHealth;
  protected metrics: MetaAgentMetrics;

  constructor(
    protected readonly eventEmitter: EventEmitter2,
    squadType: SquadType,
    managedAgents: string[]
  ) {
    this.squadType = squadType;
    this.managedAgents = managedAgents;
    this.logger = new Logger(`Meta-${squadType}`);
    
    this.health = {
      squad: squadType,
      healthScore: 100,
      activeAgents: managedAgents.length,
      totalAgents: managedAgents.length,
      pendingSagas: 0,
      avgResponseTime: 0,
      lastHeartbeat: new Date(),
      issues: []
    };
    
    this.metrics = {
      squadSyncLatency: 0,
      sagaCompletionRate: 100,
      conflictResolutionTime: 0,
      escalationAccuracy: 100,
      patternReuseRate: 0
    };
  }

  async onModuleInit() {
    this.logger.log(`Initializing Meta-Agent for ${this.squadType} Squad`);
    this.setupEventListeners();
    this.startHealthMonitoring();
  }

  // -------------------------------------------------------------------------
  // EVENT BUS - Redis Streams Integration
  // -------------------------------------------------------------------------

  protected setupEventListeners(): void {
    // Listen for events targeting this squad
    this.eventEmitter.on(`meta.${this.squadType}`, (event: MetaAgentEvent) => {
      this.handleIncomingEvent(event);
    });

    // Listen for broadcast events
    this.eventEmitter.on('meta.BROADCAST', (event: MetaAgentEvent) => {
      if (event.targetSquads.includes(this.squadType) || event.targetSquads.includes('ALL' as SquadType)) {
        this.handleIncomingEvent(event);
      }
    });

    this.logger.log(`Event listeners configured for ${this.squadType}`);
  }

  protected async handleIncomingEvent(event: MetaAgentEvent): Promise<void> {
    const startTime = Date.now();
    
    try {
      switch (event.eventType) {
        case 'SYNC':
          await this.handleSyncEvent(event);
          break;
        case 'REQUEST':
          await this.handleRequestEvent(event);
          break;
        case 'NOTIFY':
          await this.handleNotifyEvent(event);
          break;
        case 'ESCALATE':
          await this.handleEscalateEvent(event);
          break;
      }
      
      // Update sync latency metric
      this.metrics.squadSyncLatency = Date.now() - startTime;
    } catch (error) {
      this.logger.error(`Error handling event ${event.eventId}: ${error.message}`);
    }
  }

  protected async handleSyncEvent(event: MetaAgentEvent): Promise<void> {
    this.logger.debug(`SYNC event from ${event.sourceSquad}: ${JSON.stringify(event.payload)}`);
    // Override in subclass for specific sync logic
  }

  protected async handleRequestEvent(event: MetaAgentEvent): Promise<void> {
    this.logger.debug(`REQUEST event from ${event.sourceSquad}: ${JSON.stringify(event.payload)}`);
    // Override in subclass for specific request handling
  }

  protected async handleNotifyEvent(event: MetaAgentEvent): Promise<void> {
    this.logger.debug(`NOTIFY event from ${event.sourceSquad}: ${JSON.stringify(event.payload)}`);
    // Override in subclass for specific notification handling
  }

  protected async handleEscalateEvent(event: MetaAgentEvent): Promise<void> {
    this.logger.warn(`ESCALATE event from ${event.sourceSquad}: ${JSON.stringify(event.payload)}`);
    // Handle escalation from other squads
  }

  protected emitEvent(event: Omit<MetaAgentEvent, 'eventId' | 'timestamp' | 'sourceSquad'>): void {
    const fullEvent: MetaAgentEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      sourceSquad: this.squadType,
      ...event
    };

    if (event.targetSquads.length === 1) {
      this.eventEmitter.emit(`meta.${event.targetSquads[0]}`, fullEvent);
    } else {
      this.eventEmitter.emit('meta.BROADCAST', fullEvent);
    }
  }

  // -------------------------------------------------------------------------
  // SAGA ORCHESTRATION
  // -------------------------------------------------------------------------

  protected async createSaga(name: string, steps: Omit<SagaStep, 'stepId' | 'status'>[]): Promise<Saga> {
    const saga: Saga = {
      sagaId: `saga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      squad: this.squadType,
      status: 'PENDING',
      steps: steps.map((step, index) => ({
        stepId: `step_${index}`,
        ...step,
        status: 'PENDING' as SagaStatus
      })),
      currentStepIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.activeSagas.set(saga.sagaId, saga);
    this.health.pendingSagas = this.activeSagas.size;
    
    this.logger.log(`Created SAGA ${saga.sagaId}: ${name} with ${steps.length} steps`);
    return saga;
  }

  protected async executeSaga(sagaId: string): Promise<boolean> {
    const saga = this.activeSagas.get(sagaId);
    if (!saga) {
      this.logger.error(`SAGA ${sagaId} not found`);
      return false;
    }

    saga.status = 'IN_PROGRESS';
    saga.updatedAt = new Date();

    try {
      for (let i = saga.currentStepIndex; i < saga.steps.length; i++) {
        const step = saga.steps[i];
        saga.currentStepIndex = i;
        
        step.status = 'IN_PROGRESS';
        step.startedAt = new Date();

        try {
          this.logger.debug(`Executing step ${step.stepId}: ${step.agentName} -> ${step.action}`);
          step.result = await this.executeAgentAction(step.agentName, step.action);
          step.status = 'COMPLETED';
          step.completedAt = new Date();
        } catch (error) {
          step.status = 'FAILED';
          step.error = error.message;
          
          // Trigger compensation
          await this.compensateSaga(saga, i);
          return false;
        }
      }

      saga.status = 'COMPLETED';
      saga.completedAt = new Date();
      saga.updatedAt = new Date();
      
      // Update metrics
      this.updateSagaMetrics(true);
      
      // Store successful pattern
      await this.storePattern(saga.name, saga);
      
      this.logger.log(`SAGA ${sagaId} completed successfully`);
      return true;
    } catch (error) {
      this.logger.error(`SAGA ${sagaId} failed: ${error.message}`);
      return false;
    }
  }

  protected async compensateSaga(saga: Saga, failedStepIndex: number): Promise<void> {
    this.logger.warn(`Compensating SAGA ${saga.sagaId} from step ${failedStepIndex}`);
    saga.status = 'COMPENSATING';
    saga.updatedAt = new Date();

    // Execute compensation in reverse order
    for (let i = failedStepIndex - 1; i >= 0; i--) {
      const step = saga.steps[i];
      if (step.compensationAction) {
        try {
          await this.executeAgentAction(step.agentName, step.compensationAction);
          this.logger.debug(`Compensated step ${step.stepId}`);
        } catch (error) {
          this.logger.error(`Compensation failed for step ${step.stepId}: ${error.message}`);
        }
      }
    }

    saga.status = 'FAILED';
    saga.updatedAt = new Date();
    this.updateSagaMetrics(false);
  }

  protected async executeAgentAction(agentName: string, action: string): Promise<any> {
    // This would be overridden or use dependency injection for actual agent calls
    this.logger.debug(`Executing ${agentName}.${action}()`);
    // Simulate action execution
    return { success: true, agent: agentName, action };
  }

  private updateSagaMetrics(success: boolean): void {
    const completed = Array.from(this.activeSagas.values())
      .filter(s => s.status === 'COMPLETED').length;
    const total = Array.from(this.activeSagas.values())
      .filter(s => ['COMPLETED', 'FAILED'].includes(s.status)).length;
    
    if (total > 0) {
      this.metrics.sagaCompletionRate = (completed / total) * 100;
    }
  }

  // -------------------------------------------------------------------------
  // CONFLICT RESOLUTION
  // -------------------------------------------------------------------------

  async resolveConflict(agents: string[], description: string): Promise<ConflictResolution> {
    const startTime = Date.now();
    
    const resolution: ConflictResolution = {
      conflictId: `conflict_${Date.now()}`,
      description,
      agents,
      resolution: '',
      resolvedAt: new Date(),
      autoResolved: true
    };

    // Try auto-resolution strategies
    if (await this.tryPriorityBasedResolution(agents, description, resolution)) {
      // Success
    } else if (await this.tryResourceSharingResolution(agents, description, resolution)) {
      // Success
    } else if (await this.trySequentialResolution(agents, description, resolution)) {
      // Success
    } else {
      // Manual escalation needed
      resolution.autoResolved = false;
      resolution.resolution = 'ESCALATED_TO_BOARD';
      await this.escalateToBoard({
        reason: `Unresolved conflict: ${description}`,
        context: { agents, description },
        budgetImpact: 0
      });
    }

    this.conflictHistory.push(resolution);
    this.metrics.conflictResolutionTime = Date.now() - startTime;
    
    this.logger.log(`Conflict resolved: ${resolution.resolution} (auto: ${resolution.autoResolved})`);
    return resolution;
  }

  protected async tryPriorityBasedResolution(
    agents: string[], 
    description: string, 
    resolution: ConflictResolution
  ): Promise<boolean> {
    // Check if one agent has higher priority
    resolution.resolution = `Priority-based: ${agents[0]} takes precedence`;
    return true;
  }

  protected async tryResourceSharingResolution(
    agents: string[], 
    description: string, 
    resolution: ConflictResolution
  ): Promise<boolean> {
    resolution.resolution = `Resource sharing between ${agents.join(' & ')}`;
    return true;
  }

  protected async trySequentialResolution(
    agents: string[], 
    description: string, 
    resolution: ConflictResolution
  ): Promise<boolean> {
    resolution.resolution = `Sequential execution: ${agents.join(' -> ')}`;
    return true;
  }

  // -------------------------------------------------------------------------
  // ESCALATION LOGIC
  // -------------------------------------------------------------------------

  async evaluateEscalation(context: {
    budgetImpact?: number;
    crossSquadImpact?: SquadType[];
    strategicImpact?: boolean;
    healthScore?: number;
    incidentDuration?: number; // minutes
  }): Promise<'NONE' | 'CFO' | 'CEO' | 'BOARD'> {
    const { budgetImpact = 0, crossSquadImpact = [], strategicImpact = false, healthScore = 100, incidentDuration = 0 } = context;

    // Board vote required
    if (budgetImpact > 50000) return 'BOARD';

    // CEO escalation
    if (budgetImpact > 10000) return 'CEO';
    if (strategicImpact) return 'CEO';
    if (healthScore < 50) return 'CEO';
    if (incidentDuration > 120) return 'CEO'; // >2h unresolved

    // CFO escalation
    if (budgetImpact > 2000 && budgetImpact <= 10000) return 'CFO';
    if (crossSquadImpact.length >= 2) return 'CFO';

    // No escalation - autonomous handling
    return 'NONE';
  }

  async escalateToBoard(request: Omit<EscalationRequest, 'escalationId' | 'sourceSquad' | 'targetLevel' | 'createdAt' | 'status'>): Promise<void> {
    const targetLevel = await this.evaluateEscalation({
      budgetImpact: request.budgetImpact
    });

    if (targetLevel === 'NONE') {
      this.logger.debug('Escalation not required');
      return;
    }

    const escalation: EscalationRequest = {
      escalationId: `esc_${Date.now()}`,
      sourceSquad: this.squadType,
      targetLevel,
      ...request,
      createdAt: new Date(),
      status: 'PENDING'
    };

    this.escalationQueue.push(escalation);
    
    // Emit escalation event to Board
    this.emitEvent({
      targetSquads: ['BOARD' as SquadType],
      eventType: 'ESCALATE',
      payload: escalation,
      priority: 'HIGH'
    });

    this.logger.warn(`Escalated to ${targetLevel}: ${request.reason}`);
  }

  // -------------------------------------------------------------------------
  // HEALTH MONITORING
  // -------------------------------------------------------------------------

  protected startHealthMonitoring(): void {
    // Heartbeat every 30 seconds
    setInterval(() => {
      this.checkSquadHealth();
    }, 30000);
  }

  protected async checkSquadHealth(): Promise<void> {
    this.health.lastHeartbeat = new Date();
    this.health.issues = [];

    // Check agent availability
    const activeAgents = await this.countActiveAgents();
    this.health.activeAgents = activeAgents;
    
    if (activeAgents < this.managedAgents.length * 0.8) {
      this.health.issues.push(`Low agent availability: ${activeAgents}/${this.managedAgents.length}`);
    }

    // Check pending sagas
    const staleSagas = Array.from(this.activeSagas.values())
      .filter(s => s.status === 'IN_PROGRESS' && 
        (Date.now() - s.updatedAt.getTime()) > 300000); // >5 min
    
    if (staleSagas.length > 0) {
      this.health.issues.push(`${staleSagas.length} stale SAGAs detected`);
    }

    // Calculate health score
    this.health.healthScore = this.calculateHealthScore();

    // Escalate if critical
    if (this.health.healthScore < 50) {
      await this.escalateToBoard({
        reason: `Squad health critical: ${this.health.healthScore}/100`,
        context: this.health
      });
    }
  }

  protected async countActiveAgents(): Promise<number> {
    // Would check actual agent health in production
    return this.managedAgents.length;
  }

  protected calculateHealthScore(): number {
    let score = 100;

    // Deduct for agent unavailability
    const agentRatio = this.health.activeAgents / this.health.totalAgents;
    score -= (1 - agentRatio) * 30;

    // Deduct for issues
    score -= this.health.issues.length * 10;

    // Deduct for low saga completion rate
    if (this.metrics.sagaCompletionRate < 98) {
      score -= (98 - this.metrics.sagaCompletionRate) * 2;
    }

    // Deduct for high sync latency
    if (this.metrics.squadSyncLatency > 100) {
      score -= Math.min(20, (this.metrics.squadSyncLatency - 100) / 10);
    }

    return Math.max(0, Math.min(100, score));
  }

  // -------------------------------------------------------------------------
  // PATTERN LEARNING
  // -------------------------------------------------------------------------

  protected async storePattern(name: string, saga: Saga): Promise<void> {
    const patternKey = `${this.squadType}:${name}`;
    const existingPattern = this.patterns.get(patternKey);

    if (existingPattern) {
      existingPattern.successCount++;
      existingPattern.lastUsed = new Date();
    } else {
      this.patterns.set(patternKey, {
        name,
        steps: saga.steps.map(s => ({ agent: s.agentName, action: s.action })),
        successCount: 1,
        createdAt: new Date(),
        lastUsed: new Date()
      });
    }

    // Update pattern reuse rate
    this.updatePatternMetrics();
    
    this.logger.debug(`Pattern stored: ${patternKey}`);
  }

  protected async findPattern(name: string): Promise<any | null> {
    const patternKey = `${this.squadType}:${name}`;
    return this.patterns.get(patternKey) || null;
  }

  protected updatePatternMetrics(): void {
    const totalPatterns = this.patterns.size;
    const reusedPatterns = Array.from(this.patterns.values())
      .filter(p => p.successCount > 1).length;
    
    if (totalPatterns > 0) {
      this.metrics.patternReuseRate = (reusedPatterns / totalPatterns) * 100;
    }
  }

  // -------------------------------------------------------------------------
  // ABSTRACT METHODS - To be implemented by Squad-specific agents
  // -------------------------------------------------------------------------

  abstract getSquadAgents(): string[];
  abstract handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void>;

  // -------------------------------------------------------------------------
  // PUBLIC API
  // -------------------------------------------------------------------------

  getHealth(): SquadHealth {
    return { ...this.health };
  }

  getMetrics(): MetaAgentMetrics {
    return { ...this.metrics };
  }

  getActiveSagas(): Saga[] {
    return Array.from(this.activeSagas.values());
  }
}

// ============================================================================
// META-COMMERCE (E-Commerce Squad)
// ============================================================================

@Injectable()
export class MetaCommerceAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'E_COMMERCE', [
      'Growth IA',
      'Pricing Bot',
      'IA-Stock',
      'IA-Merch',
      'IA-Customs',
      'IA-Transport',
      'IA-Partners'
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'STOCK_RUPTURE') {
      await this.handleStockRupture(event.payload);
    } else if (event.payload.type === 'NEW_PRODUCT_LAUNCH') {
      await this.orchestrateProductLaunch(event.payload);
    }
  }

  /**
   * SAGA: New Product Launch
   */
  async orchestrateProductLaunch(product: { sku: string; category: string; supplier: string }): Promise<boolean> {
    const saga = await this.createSaga('New_Product_Launch', [
      { agentName: 'IA-Stock', action: 'forecastDemand', compensationAction: 'cancelForecast' },
      { agentName: 'IA-Partners', action: 'negotiateSupplier', compensationAction: 'cancelNegotiation' },
      { agentName: 'IA-Customs', action: 'calculateDuties', compensationAction: 'voidDutyCalculation' },
      { agentName: 'Pricing Bot', action: 'calculateOptimalPrice', compensationAction: 'revertPrice' },
      { agentName: 'IA-Merch', action: 'createBundles', compensationAction: 'removeBundles' },
      { agentName: 'Growth IA', action: 'setupABTest', compensationAction: 'cancelABTest' }
    ]);

    saga.metadata = { product };
    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Stock Crisis Response
   */
  async handleStockRupture(context: { sku: string; daysRemaining: number }): Promise<boolean> {
    // Notify Meta-Marketing to pause campaigns
    this.emitEvent({
      targetSquads: ['MARKETING'],
      eventType: 'NOTIFY',
      payload: { type: 'PAUSE_CAMPAIGNS', sku: context.sku, reason: 'STOCK_RUPTURE' },
      priority: 'HIGH'
    });

    const saga = await this.createSaga('Stock_Crisis_Response', [
      { agentName: 'IA-Stock', action: 'confirmRupture' },
      { agentName: 'IA-Partners', action: 'createEmergencyPO', compensationAction: 'cancelPO' },
      { agentName: 'IA-Transport', action: 'arrangeExpressShipping', compensationAction: 'cancelShipping' },
      { agentName: 'Pricing Bot', action: 'adjustPriceIfNeeded' },
      { agentName: 'IA-Merch', action: 'suggestAlternatives' }
    ]);

    saga.metadata = { context };
    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-MARKETING (Marketing Squad)
// ============================================================================

@Injectable()
export class MetaMarketingAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'MARKETING', [
      'IA-CMO',
      'IA-SEO',
      'IA-Ads',
      'IA-Social',
      'Content Bot',
      'Campaign Optimizer'
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'PAUSE_CAMPAIGNS') {
      await this.pauseCampaignsForProduct(event.payload.sku);
    } else if (event.payload.type === 'CRISIS_DETECTED') {
      await this.handleCrisisCommunication(event.payload);
    }
  }

  async pauseCampaignsForProduct(sku: string): Promise<void> {
    this.logger.warn(`Pausing campaigns for SKU: ${sku}`);
    await this.executeAgentAction('IA-Ads', `pauseCampaigns:${sku}`);
    await this.executeAgentAction('IA-Social', `pausePosts:${sku}`);
  }

  /**
   * SAGA: Omnichannel Campaign
   */
  async orchestrateOmnichannelCampaign(brief: { name: string; budget: number; channels: string[] }): Promise<boolean> {
    const saga = await this.createSaga('Omnichannel_Campaign', [
      { agentName: 'IA-CMO', action: 'validateBrief', compensationAction: 'archiveBrief' },
      { agentName: 'Content Bot', action: 'createAssets', compensationAction: 'archiveAssets' },
      { agentName: 'IA-SEO', action: 'optimizeLandingPages' },
      { agentName: 'IA-Ads', action: 'launchPaidCampaigns', compensationAction: 'stopCampaigns' },
      { agentName: 'IA-Social', action: 'distributeSocial', compensationAction: 'deletePosts' },
      { agentName: 'Campaign Optimizer', action: 'monitorAndAdjust' }
    ]);

    saga.metadata = { brief };
    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Crisis Communication
   */
  async handleCrisisCommunication(crisis: { type: string; severity: string }): Promise<boolean> {
    const saga = await this.createSaga('Crisis_Communication', [
      { agentName: 'IA-Social', action: 'detectSentiment' },
      { agentName: 'IA-Ads', action: 'pauseAllCampaigns', compensationAction: 'resumeCampaigns' },
      { agentName: 'IA-CMO', action: 'prepareResponseMessage' },
      { agentName: 'Content Bot', action: 'generateOfficialStatement' },
      { agentName: 'IA-Social', action: 'monitorPostCrisis' }
    ]);

    // Escalate to CEO
    await this.escalateToBoard({
      reason: `Marketing crisis: ${crisis.type}`,
      context: crisis
    });

    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-CUSTOMER (Customer Squad)
// ============================================================================

@Injectable()
export class MetaCustomerAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'CUSTOMER', [
      'IA-CX360',
      'IA-CRM',
      'IA-Sales',
      'Support Bot',
      'Feedback Analyzer',
      'NPS Tracker'
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'VIP_CHURN_RISK') {
      await this.handleVIPChurnPrevention(event.payload);
    } else if (event.payload.type === 'NEW_CUSTOMER') {
      await this.orchestrateOnboarding(event.payload);
    }
  }

  /**
   * SAGA: VIP Churn Prevention
   */
  async handleVIPChurnPrevention(customer: { customerId: string; churnScore: number; cltv: number }): Promise<boolean> {
    const saga = await this.createSaga('VIP_Churn_Prevention', [
      { agentName: 'IA-CRM', action: 'confirmChurnRisk' },
      { agentName: 'IA-CX360', action: 'analyzeSatisfactionHistory' },
      { agentName: 'IA-Sales', action: 'personalizedContact', compensationAction: 'logContactAttempt' },
      { agentName: 'IA-CRM', action: 'prepareWinBackOffer', compensationAction: 'archiveOffer' },
      { agentName: 'NPS Tracker', action: 'schedulePostActionSurvey' }
    ]);

    saga.metadata = { customer };

    // If CLTV > €5000, escalate
    if (customer.cltv > 5000) {
      await this.escalateToBoard({
        reason: `High-value customer churn risk: €${customer.cltv} CLTV`,
        context: customer,
        budgetImpact: customer.cltv * 0.1 // 10% retention cost
      });
    }

    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Customer 360 Onboarding
   */
  async orchestrateOnboarding(customer: { customerId: string; type: 'B2C' | 'B2B' }): Promise<boolean> {
    const steps = [
      { agentName: 'IA-CRM', action: 'enrichProfile' },
      { agentName: 'IA-CX360', action: 'startWelcomeJourney' },
      { agentName: 'Support Bot', action: 'introduceAssistant' }
    ];

    // B2B gets human contact
    if (customer.type === 'B2B') {
      steps.push({ agentName: 'IA-Sales', action: 'scheduleFirstContact' });
    }

    steps.push({ agentName: 'NPS Tracker', action: 'scheduleDay30Survey' });

    const saga = await this.createSaga('Customer_360_Onboarding', steps);
    saga.metadata = { customer };
    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-TECH (Tech Squad)
// ============================================================================

@Injectable()
export class MetaTechAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'TECH', [
      'IA-CTO',
      'Code Review Bot',
      'Refactor Agent',
      'Dependency Scanner',
      'Test Coverage Bot',
      'Doc Generator',
      // + 16 autres agents techniques
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'CRITICAL_BUG') {
      await this.handleCriticalBugFix(event.payload);
    } else if (event.payload.type === 'TECH_DEBT_SPRINT') {
      await this.orchestrateTechDebtSprint(event.payload);
    }
  }

  /**
   * SAGA: Critical Bug Fix
   */
  async handleCriticalBugFix(incident: { id: string; severity: string; component: string }): Promise<boolean> {
    // Notify all squads
    this.emitEvent({
      targetSquads: ['E_COMMERCE', 'MARKETING', 'CUSTOMER', 'INFRA', 'SECURITY', 'UX'],
      eventType: 'NOTIFY',
      payload: { type: 'INCIDENT_ACTIVE', incident },
      priority: 'CRITICAL'
    });

    const saga = await this.createSaga('Critical_Bug_Fix', [
      { agentName: 'IA-CTO', action: 'analyzeRootCause' },
      { agentName: 'Code Review Bot', action: 'acceleratedReview' },
      { agentName: 'Test Coverage Bot', action: 'runRegressionTests', compensationAction: 'rollbackDeployment' },
      { agentName: 'Doc Generator', action: 'generatePostMortem' }
    ]);

    saga.metadata = { incident };
    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Tech Debt Sprint
   */
  async orchestrateTechDebtSprint(sprint: { focus: string[]; budget: number }): Promise<boolean> {
    const saga = await this.createSaga('Tech_Debt_Sprint', [
      { agentName: 'IA-CTO', action: 'prioritizeDebt' },
      { agentName: 'Refactor Agent', action: 'executeRefactoring', compensationAction: 'revertChanges' },
      { agentName: 'Dependency Scanner', action: 'updateDependencies', compensationAction: 'rollbackUpdates' },
      { agentName: 'Code Review Bot', action: 'validateQuality' },
      { agentName: 'Doc Generator', action: 'updateDocumentation' }
    ]);

    saga.metadata = { sprint };
    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-INFRA (Infrastructure Squad)
// ============================================================================

@Injectable()
export class MetaInfraAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'INFRA', [
      'IA-DevOps',
      'Cache Optimizer',
      'Database Optimizer',
      'Container Orchestrator',
      'Network Monitor'
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'TRAFFIC_SPIKE') {
      await this.handleAutoScaling(event.payload);
    } else if (event.payload.type === 'INFRASTRUCTURE_INCIDENT') {
      await this.handleInfraIncident(event.payload);
    }
  }

  /**
   * SAGA: Auto Scaling Event
   */
  async handleAutoScaling(traffic: { currentLoad: number; predictedPeak: number }): Promise<boolean> {
    // Notify Meta-Commerce about capacity
    this.emitEvent({
      targetSquads: ['E_COMMERCE'],
      eventType: 'NOTIFY',
      payload: { type: 'CAPACITY_UPDATE', scaling: 'UP', traffic },
      priority: 'HIGH'
    });

    const saga = await this.createSaga('Auto_Scaling_Event', [
      { agentName: 'Network Monitor', action: 'confirmTrafficSpike' },
      { agentName: 'Container Orchestrator', action: 'scaleUpPods', compensationAction: 'scaleDownPods' },
      { agentName: 'Cache Optimizer', action: 'warmCache' },
      { agentName: 'Database Optimizer', action: 'expandConnectionPool', compensationAction: 'reduceConnectionPool' },
      { agentName: 'IA-DevOps', action: 'enhancedMonitoring' }
    ]);

    saga.metadata = { traffic };
    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Infrastructure Incident
   */
  async handleInfraIncident(incident: { type: string; severity: string; component: string }): Promise<boolean> {
    const saga = await this.createSaga('Infrastructure_Incident', [
      { agentName: 'IA-DevOps', action: 'diagnosticAuto' },
      { agentName: 'Container Orchestrator', action: 'attemptRemediation', compensationAction: 'failover' },
      { agentName: 'Network Monitor', action: 'notifyStakeholders' },
      { agentName: 'IA-DevOps', action: 'generatePostMortem' }
    ]);

    saga.metadata = { incident };

    // Escalate if critical
    if (incident.severity === 'CRITICAL') {
      await this.escalateToBoard({
        reason: `Infrastructure incident: ${incident.type}`,
        context: incident
      });
    }

    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-SECURITY (Resilience Squad)
// ============================================================================

@Injectable()
export class MetaSecurityAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'SECURITY', [
      'IA-CISO',
      'Security Scanner',
      'Compliance Auditor',
      'Secrets Manager',
      'Penetration Tester',
      'Incident Responder'
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'SECURITY_BREACH') {
      await this.handleSecurityIncident(event.payload);
    } else if (event.payload.type === 'COMPLIANCE_AUDIT') {
      await this.orchestrateComplianceAudit(event.payload);
    } else if (event.payload.type === 'CVE_CRITICAL') {
      // Notify Meta-Tech for urgent patching
      this.emitEvent({
        targetSquads: ['TECH'],
        eventType: 'REQUEST',
        payload: { type: 'URGENT_PATCH', cve: event.payload.cve },
        priority: 'CRITICAL'
      });
    }
  }

  /**
   * SAGA: Security Incident Response
   */
  async handleSecurityIncident(breach: { type: string; severity: string; dataImpacted: boolean }): Promise<boolean> {
    // CRITICAL: Notify all squads
    this.emitEvent({
      targetSquads: ['E_COMMERCE', 'MARKETING', 'CUSTOMER', 'TECH', 'INFRA', 'UX'],
      eventType: 'ESCALATE',
      payload: { type: 'SECURITY_WAR_ROOM', breach },
      priority: 'CRITICAL'
    });

    const saga = await this.createSaga('Security_Incident_Response', [
      { agentName: 'Incident Responder', action: 'containment' },
      { agentName: 'Secrets Manager', action: 'rotateCredentials' },
      { agentName: 'IA-CISO', action: 'forensicsAndReport' },
      { agentName: 'Compliance Auditor', action: 'assessRGPDNotification' }
    ]);

    saga.metadata = { breach };

    // Always escalate security incidents to CEO
    await this.escalateToBoard({
      reason: `Security breach: ${breach.type}`,
      context: breach,
      budgetImpact: breach.dataImpacted ? 50000 : 10000 // RGPD fines
    });

    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Compliance Audit
   */
  async orchestrateComplianceAudit(audit: { type: 'QUARTERLY' | 'ANNUAL'; frameworks: string[] }): Promise<boolean> {
    const saga = await this.createSaga('Compliance_Audit', [
      { agentName: 'Compliance Auditor', action: 'checkPCIDSS' },
      { agentName: 'Security Scanner', action: 'scanVulnerabilities' },
      { agentName: 'Penetration Tester', action: 'executeIntrusionTest' },
      { agentName: 'IA-CISO', action: 'consolidateReport' }
    ]);

    saga.metadata = { audit };
    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-UX (UX Squad)
// ============================================================================

@Injectable()
export class MetaUXAgent extends BaseMetaAgent {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, 'UX', [
      'IA-CPO',
      'IA-Designer',
      'MobileAccessibilityAgent',
      'A/B Test Bot',
      'Performance Monitor',
      'Accessibility Bot'
    ]);
  }

  getSquadAgents(): string[] {
    return this.managedAgents;
  }

  async handleSquadSpecificEvent(event: MetaAgentEvent): Promise<void> {
    if (event.payload.type === 'NPS_LOW') {
      await this.prioritizeUXFriction(event.payload);
    } else if (event.payload.type === 'DESIGN_SYSTEM_UPDATE') {
      await this.orchestrateDesignSystemUpdate(event.payload);
    }
  }

  /**
   * Triggered by Meta-Customer when NPS < 30
   */
  async prioritizeUXFriction(context: { npsScore: number; topPainPoints: string[] }): Promise<void> {
    this.logger.warn(`NPS critical: ${context.npsScore}. Prioritizing UX friction analysis.`);
    await this.orchestrateUXImprovement({
      trigger: 'NPS_CRITICAL',
      painPoints: context.topPainPoints
    });
  }

  /**
   * SAGA: UX Improvement Cycle
   */
  async orchestrateUXImprovement(context: { trigger: string; painPoints: string[] }): Promise<boolean> {
    const saga = await this.createSaga('UX_Improvement_Cycle', [
      { agentName: 'IA-CPO', action: 'identifyFriction' },
      { agentName: 'IA-Designer', action: 'createMockup' },
      { agentName: 'Accessibility Bot', action: 'validateWCAG' },
      { agentName: 'A/B Test Bot', action: 'setupVariantTest', compensationAction: 'cancelTest' },
      { agentName: 'Performance Monitor', action: 'measureCWVImpact' },
      { agentName: 'IA-CPO', action: 'deployIfWinner' }
    ]);

    saga.metadata = { context };
    return this.executeSaga(saga.sagaId);
  }

  /**
   * SAGA: Design System Update
   */
  async orchestrateDesignSystemUpdate(update: { tokens: string[]; source: string }): Promise<boolean> {
    const saga = await this.createSaga('Design_System_Update', [
      { agentName: 'IA-Designer', action: 'exportTokens' },
      { agentName: 'Accessibility Bot', action: 'validateContrast' },
      { agentName: 'MobileAccessibilityAgent', action: 'testMobile' },
      { agentName: 'Performance Monitor', action: 'deployStorybook' }
    ]);

    saga.metadata = { update };
    return this.executeSaga(saga.sagaId);
  }
}

// ============================================================================
// META-AGENT ORCHESTRATOR SERVICE
// ============================================================================

@Injectable()
export class MetaAgentOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger('MetaAgentOrchestrator');
  
  private metaAgents: Map<SquadType, BaseMetaAgent> = new Map();

  constructor(
    private readonly metaCommerce: MetaCommerceAgent,
    private readonly metaMarketing: MetaMarketingAgent,
    private readonly metaCustomer: MetaCustomerAgent,
    private readonly metaTech: MetaTechAgent,
    private readonly metaInfra: MetaInfraAgent,
    private readonly metaSecurity: MetaSecurityAgent,
    private readonly metaUX: MetaUXAgent
  ) {}

  async onModuleInit() {
    this.metaAgents.set('E_COMMERCE', this.metaCommerce);
    this.metaAgents.set('MARKETING', this.metaMarketing);
    this.metaAgents.set('CUSTOMER', this.metaCustomer);
    this.metaAgents.set('TECH', this.metaTech);
    this.metaAgents.set('INFRA', this.metaInfra);
    this.metaAgents.set('SECURITY', this.metaSecurity);
    this.metaAgents.set('UX', this.metaUX);

    this.logger.log('Meta-Agent Orchestrator initialized with 7 Squad Meta-Agents');
  }

  getMetaAgent(squad: SquadType): BaseMetaAgent | undefined {
    return this.metaAgents.get(squad);
  }

  getAllHealth(): Record<SquadType, SquadHealth> {
    const health: Record<string, SquadHealth> = {};
    for (const [squad, agent] of this.metaAgents) {
      health[squad] = agent.getHealth();
    }
    return health as Record<SquadType, SquadHealth>;
  }

  getAllMetrics(): Record<SquadType, MetaAgentMetrics> {
    const metrics: Record<string, MetaAgentMetrics> = {};
    for (const [squad, agent] of this.metaAgents) {
      metrics[squad] = agent.getMetrics();
    }
    return metrics as Record<SquadType, MetaAgentMetrics>;
  }

  getGlobalHealthScore(): number {
    const healths = Object.values(this.getAllHealth());
    return healths.reduce((sum, h) => sum + h.healthScore, 0) / healths.length;
  }
}
