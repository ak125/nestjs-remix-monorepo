/**
 * AI-COS v2.30.0: Feedback Loop SAGAs
 * 
 * 3 SAGAs orchestrant les boucles de feedback:
 * 1. Action_Impact_Measurement - Mesure delta KPIs à 1h/24h/7d
 * 2. CEO_Escalation_Validation - Workflow validation Human CEO
 * 3. Agent_Self_Adjustment - Auto-ajustement confiance ±5pts
 * 
 * @module FeedbackLoopSagas
 * @version 2.30.0
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { FeedbackLoopService, ActionContext, EscalationContext } from './feedback-loop.service';
import { SupabaseService } from '../../supabase/supabase.service';

// ============================================
// Types & Interfaces
// ============================================

export interface SagaStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'compensated';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: any;
}

export interface SagaState {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed' | 'compensating';
  steps: SagaStep[];
  context: Record<string, any>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ImpactMeasurementSagaContext {
  actionId: string;
  actionContext: ActionContext;
  kpisBaseline: Record<string, number>;
  measurements: {
    type: '1h' | '4h' | '24h' | '7d' | '30d';
    scheduled: boolean;
    measured: boolean;
    impactScore?: number;
    result?: any;
  }[];
}

export interface CeoEscalationSagaContext {
  escalationId: string;
  actionContext: ActionContext;
  escalationLevel: 'CFO' | 'CEO' | 'BOARD';
  notificationsSent: string[];
  validationStatus: 'pending' | 'approved' | 'rejected' | 'expired';
  humanCeoEmail?: string;
  deadline: Date;
  remindersSent: number;
}

export interface AgentAdjustmentSagaContext {
  agentId: string;
  agentName: string;
  squadId: string;
  outcomesAnalyzed: number;
  successRate: number;
  previousConfidence: number;
  newConfidence: number;
  previousAutonomy: string;
  newAutonomy: string;
  adjustmentApplied: boolean;
}

// ============================================
// SAGA 1: Action Impact Measurement
// ============================================

@Injectable()
export class ActionImpactMeasurementSaga {
  private readonly logger = new Logger(ActionImpactMeasurementSaga.name);
  private activeSagas: Map<string, SagaState> = new Map();

  constructor(
    private readonly feedbackLoop: FeedbackLoopService,
    private readonly eventEmitter: EventEmitter2,
    private readonly supabase: SupabaseService,
    @InjectQueue('ai-cos-feedback') private readonly feedbackQueue: Queue,
  ) {}

  /**
   * Démarre la SAGA de mesure d'impact pour une action
   */
  async execute(actionId: string, context: ActionContext, kpisBaseline: Record<string, number>): Promise<SagaState> {
    const sagaId = `SAGA-IMPACT-${actionId}-${Date.now()}`;
    this.logger.log(`🚀 Starting Impact Measurement SAGA: ${sagaId}`);

    const saga: SagaState = {
      id: sagaId,
      name: 'Action_Impact_Measurement',
      status: 'running',
      steps: [
        { name: 'schedule_measurements', status: 'pending' },
        { name: 'measure_1h', status: 'pending' },
        { name: 'evaluate_1h_impact', status: 'pending' },
        { name: 'measure_24h', status: 'pending' },
        { name: 'evaluate_24h_impact', status: 'pending' },
        { name: 'measure_7d', status: 'pending' },
        { name: 'final_evaluation', status: 'pending' },
        { name: 'update_confidence', status: 'pending' },
        { name: 'store_pattern', status: 'pending' },
      ],
      context: {
        actionId,
        actionContext: context,
        kpisBaseline,
        measurements: [],
      } as ImpactMeasurementSagaContext,
      startedAt: new Date(),
    };

    this.activeSagas.set(sagaId, saga);

    try {
      // Step 1: Schedule all measurements
      await this.executeStep(saga, 0, async () => {
        await this.feedbackLoop.scheduleImpactMeasurements(actionId, context, kpisBaseline);
        saga.context.measurements = [
          { type: '1h', scheduled: true, measured: false },
          { type: '4h', scheduled: true, measured: false },
          { type: '24h', scheduled: true, measured: false },
          { type: '7d', scheduled: true, measured: false },
          { type: '30d', scheduled: true, measured: false },
        ];
        return { scheduled: 5 };
      });

      // Les steps suivants seront déclenchés par les jobs de la queue
      // Schedule les jobs pour les mesures
      await this.scheduleNextMeasurement(sagaId, '1h', 60 * 60 * 1000);

      this.logger.log(`✅ SAGA ${sagaId} - Measurements scheduled, waiting for execution`);

    } catch (error) {
      await this.compensate(saga, error);
    }

    return saga;
  }

  /**
   * Continue la SAGA après une mesure
   */
  @OnEvent('ai-cos:impact.measured')
  async onImpactMeasured(data: { actionId: string; measurementType: string; impactScore: number; thresholdBreached: boolean; autoActionTriggered: boolean }) {
    // Trouver la SAGA active pour cette action
    const saga = Array.from(this.activeSagas.values()).find(
      s => s.context.actionId === data.actionId && s.status === 'running'
    );

    if (!saga) return;

    this.logger.log(`📊 SAGA ${saga.id} - Received measurement ${data.measurementType}: ${data.impactScore}`);

    const ctx = saga.context as ImpactMeasurementSagaContext;
    const measurement = ctx.measurements.find(m => m.type === data.measurementType);
    if (measurement) {
      measurement.measured = true;
      measurement.impactScore = data.impactScore;
    }

    // Évaluer l'impact selon le type de mesure
    switch (data.measurementType) {
      case '1h':
        await this.evaluate1hImpact(saga, data);
        await this.scheduleNextMeasurement(saga.id, '24h', 23 * 60 * 60 * 1000);
        break;
      case '24h':
        await this.evaluate24hImpact(saga, data);
        await this.scheduleNextMeasurement(saga.id, '7d', 6 * 24 * 60 * 60 * 1000);
        break;
      case '7d':
        await this.evaluateFinal(saga, data);
        break;
    }
  }

  private async evaluate1hImpact(saga: SagaState, data: any): Promise<void> {
    const stepIndex = saga.steps.findIndex(s => s.name === 'evaluate_1h_impact');
    
    await this.executeStep(saga, stepIndex, async () => {
      const ctx = saga.context as ImpactMeasurementSagaContext;

      // Si impact critique négatif, déclencher rollback
      if (data.impactScore <= -20) {
        this.logger.warn(`⚠️ SAGA ${saga.id} - Critical negative impact at 1h: ${data.impactScore}`);
        
        this.eventEmitter.emit('ai-cos:saga.rollback-required', {
          sagaId: saga.id,
          actionId: ctx.actionId,
          reason: 'Critical negative impact at 1h measurement',
          impactScore: data.impactScore,
        });

        // Compenser
        await this.compensate(saga, new Error('Critical negative impact - rollback triggered'));
        return { action: 'rollback', reason: 'Critical negative impact' };
      }

      // Si impact modérément négatif, alerter
      if (data.impactScore <= -10) {
        this.logger.warn(`⚠️ SAGA ${saga.id} - Negative impact at 1h: ${data.impactScore}`);
        
        await this.feedbackLoop.escalateToIACeo({
          actionContext: ctx.actionContext,
          escalationReason: `Impact négatif à 1h: ${data.impactScore.toFixed(1)}`,
          escalationSource: 'FEEDBACK-LOOP',
        });

        return { action: 'escalate', reason: 'Moderate negative impact' };
      }

      return { action: 'continue', impactScore: data.impactScore };
    });
  }

  private async evaluate24hImpact(saga: SagaState, data: any): Promise<void> {
    const stepIndex = saga.steps.findIndex(s => s.name === 'evaluate_24h_impact');
    
    await this.executeStep(saga, stepIndex, async () => {
      const ctx = saga.context as ImpactMeasurementSagaContext;
      const measurement1h = ctx.measurements.find(m => m.type === '1h');

      // Comparer avec la mesure à 1h
      const trend = data.impactScore - (measurement1h?.impactScore ?? 0);

      if (data.impactScore <= -15 && trend < 0) {
        // Impact négatif et tendance descendante
        this.logger.warn(`⚠️ SAGA ${saga.id} - Worsening impact at 24h: ${data.impactScore} (trend: ${trend})`);
        
        return { 
          action: 'escalate', 
          reason: 'Worsening impact at 24h',
          trend,
        };
      }

      return { action: 'continue', impactScore: data.impactScore, trend };
    });
  }

  private async evaluateFinal(saga: SagaState, data: any): Promise<void> {
    const ctx = saga.context as ImpactMeasurementSagaContext;

    // Step: Final evaluation
    const evalStepIndex = saga.steps.findIndex(s => s.name === 'final_evaluation');
    await this.executeStep(saga, evalStepIndex, async () => {
      const allMeasurements = ctx.measurements.filter(m => m.measured);
      const avgImpact = allMeasurements.reduce((sum, m) => sum + (m.impactScore ?? 0), 0) / allMeasurements.length;

      return {
        averageImpact: avgImpact,
        measurementsCount: allMeasurements.length,
        finalImpact: data.impactScore,
      };
    });

    // Step: Update confidence
    const confStepIndex = saga.steps.findIndex(s => s.name === 'update_confidence');
    await this.executeStep(saga, confStepIndex, async () => {
      const outcome = data.impactScore > 5 ? 'success' : data.impactScore < -5 ? 'failure' : 'neutral';
      
      const updated = await this.feedbackLoop.adjustAgentConfidence(
        ctx.actionContext.agentId,
        ctx.actionContext.agentName,
        ctx.actionContext.squadId,
        outcome,
        data.impactScore,
        ctx.actionId,
      );

      return { outcome, newConfidence: updated.confidenceScore };
    });

    // Step: Store pattern si impact positif
    const patternStepIndex = saga.steps.findIndex(s => s.name === 'store_pattern');
    await this.executeStep(saga, patternStepIndex, async () => {
      if (data.impactScore >= 15) {
        const patternName = `success_${ctx.actionContext.agentId}_${ctx.actionContext.actionType}_${Date.now()}`;
        
        await this.feedbackLoop.storeLearnedPattern(
          ctx.actionContext.agentId,
          ctx.actionContext.squadId,
          patternName,
          'success',
          { actionType: ctx.actionContext.actionType, kpisBaseline: ctx.kpisBaseline },
          { impactScore: data.impactScore },
          'High positive impact validated at 7d',
        );

        return { patternStored: true, patternName };
      }

      return { patternStored: false };
    });

    // Complete SAGA
    saga.status = 'completed';
    saga.completedAt = new Date();
    this.logger.log(`✅ SAGA ${saga.id} completed successfully`);

    this.eventEmitter.emit('ai-cos:saga.completed', {
      sagaId: saga.id,
      sagaName: saga.name,
      actionId: ctx.actionId,
      finalImpact: data.impactScore,
    });
  }

  private async scheduleNextMeasurement(sagaId: string, type: string, delay: number): Promise<void> {
    await this.feedbackQueue.add('saga-continue-measurement', {
      sagaId,
      measurementType: type,
    }, { delay });
  }

  private async executeStep(saga: SagaState, stepIndex: number, fn: () => Promise<any>): Promise<void> {
    const step = saga.steps[stepIndex];
    if (!step) return;

    step.status = 'running';
    step.startedAt = new Date();

    try {
      step.result = await fn();
      step.status = 'completed';
      step.completedAt = new Date();
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      throw error;
    }
  }

  private async compensate(saga: SagaState, error: Error): Promise<void> {
    saga.status = 'compensating';
    saga.error = error.message;
    this.logger.warn(`🔄 Compensating SAGA ${saga.id}: ${error.message}`);

    // Compensation: annuler les mesures programmées
    const ctx = saga.context as ImpactMeasurementSagaContext;

    // Marquer les steps comme compensées
    for (const step of saga.steps) {
      if (step.status === 'completed') {
        step.status = 'compensated';
      }
    }

    saga.status = 'failed';
    saga.completedAt = new Date();

    this.eventEmitter.emit('ai-cos:saga.failed', {
      sagaId: saga.id,
      sagaName: saga.name,
      actionId: ctx.actionId,
      error: error.message,
    });
  }
}

// ============================================
// SAGA 2: CEO Escalation & Validation
// ============================================

@Injectable()
export class CeoEscalationValidationSaga {
  private readonly logger = new Logger(CeoEscalationValidationSaga.name);
  private activeSagas: Map<string, SagaState> = new Map();

  constructor(
    private readonly feedbackLoop: FeedbackLoopService,
    private readonly eventEmitter: EventEmitter2,
    private readonly supabase: SupabaseService,
    @InjectQueue('ai-cos-feedback') private readonly feedbackQueue: Queue,
  ) {}

  /**
   * Démarre la SAGA d'escalade et validation CEO
   */
  async execute(context: EscalationContext, humanCeoEmail: string): Promise<SagaState> {
    const sagaId = `SAGA-CEO-${context.actionContext.actionId}-${Date.now()}`;
    this.logger.log(`🚀 Starting CEO Escalation SAGA: ${sagaId}`);

    const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h par défaut

    const saga: SagaState = {
      id: sagaId,
      name: 'CEO_Escalation_Validation',
      status: 'running',
      steps: [
        { name: 'analyze_escalation', status: 'pending' },
        { name: 'determine_level', status: 'pending' },
        { name: 'create_escalation', status: 'pending' },
        { name: 'send_notifications', status: 'pending' },
        { name: 'wait_validation', status: 'pending' },
        { name: 'process_decision', status: 'pending' },
        { name: 'execute_or_reject', status: 'pending' },
      ],
      context: {
        escalationId: null,
        actionContext: context.actionContext,
        escalationLevel: null,
        notificationsSent: [],
        validationStatus: 'pending',
        humanCeoEmail,
        deadline,
        remindersSent: 0,
      } as CeoEscalationSagaContext,
      startedAt: new Date(),
    };

    this.activeSagas.set(sagaId, saga);

    try {
      // Step 1: Analyze escalation context
      await this.executeStep(saga, 0, async () => {
        const { budgetImpact = 0, riskScore, strategicImpact } = context.actionContext;
        
        return {
          budgetImpact,
          riskScore,
          strategicImpact,
          urgency: context.urgencyLevel ?? 'MEDIUM',
          requiresBoard: budgetImpact >= 50000 || riskScore >= 90,
        };
      });

      // Step 2: Determine escalation level
      await this.executeStep(saga, 1, async () => {
        const analysis = saga.steps[0].result;
        let level: 'CFO' | 'CEO' | 'BOARD' = 'CEO';

        if (analysis.requiresBoard) {
          level = 'BOARD';
        } else if (analysis.budgetImpact < 10000 && analysis.riskScore < 70) {
          level = 'CFO';
        }

        (saga.context as CeoEscalationSagaContext).escalationLevel = level;
        return { level, reasoning: `Budget: ${analysis.budgetImpact}€, Risk: ${analysis.riskScore}` };
      });

      // Step 3: Create escalation in database
      await this.executeStep(saga, 2, async () => {
        const result = await this.feedbackLoop.escalateToIACeo(context);
        (saga.context as CeoEscalationSagaContext).escalationId = result.id;
        return result;
      });

      // Step 4: Send notifications
      await this.executeStep(saga, 3, async () => {
        const ctx = saga.context as CeoEscalationSagaContext;
        
        const validation = await this.feedbackLoop.requestHumanCeoValidation(
          ctx.escalationId,
          humanCeoEmail,
          ctx.deadline,
        );

        ctx.notificationsSent.push('email', 'slack');
        return { notificationsSent: ctx.notificationsSent, dashboardUrl: validation.dashboardUrl };
      });

      // Step 5 sera complété via événement (wait_validation)
      // Programmer un job pour vérifier le timeout
      await this.feedbackQueue.add('check-validation-timeout', {
        sagaId,
        deadline: deadline.toISOString(),
      }, { delay: 48 * 60 * 60 * 1000 }); // 48h

      // Programmer un rappel à 12h
      await this.feedbackQueue.add('send-validation-reminder', {
        sagaId,
      }, { delay: 12 * 60 * 60 * 1000 }); // 12h

      this.logger.log(`✅ SAGA ${sagaId} - Waiting for CEO validation`);

    } catch (error) {
      await this.compensate(saga, error);
    }

    return saga;
  }

  /**
   * Réception de la décision du CEO
   */
  @OnEvent('ai-cos:validation.decided')
  async onValidationDecided(data: { validationId: string; decision: string; reasoning: string }) {
    const saga = Array.from(this.activeSagas.values()).find(
      s => (s.context as CeoEscalationSagaContext).escalationId === data.validationId && s.status === 'running'
    );

    if (!saga) return;

    this.logger.log(`📝 SAGA ${saga.id} - Received CEO decision: ${data.decision}`);

    const ctx = saga.context as CeoEscalationSagaContext;
    ctx.validationStatus = data.decision.toLowerCase() as any;

    // Complete step 5: wait_validation
    await this.executeStep(saga, 4, async () => {
      return { decision: data.decision, reasoning: data.reasoning };
    });

    // Step 6: Process decision
    await this.executeStep(saga, 5, async () => {
      return {
        approved: data.decision === 'APPROVED',
        deferred: data.decision === 'DEFERRED',
        rejected: data.decision === 'REJECTED',
      };
    });

    // Step 7: Execute or reject
    await this.executeStep(saga, 6, async () => {
      if (data.decision === 'APPROVED') {
        this.eventEmitter.emit('ai-cos:action.execute', {
          actionId: ctx.actionContext.actionId,
          approvedBy: 'HUMAN-CEO',
        });
        return { executed: true };
      } else if (data.decision === 'DEFERRED') {
        // Reprogrammer la validation
        const newDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        ctx.deadline = newDeadline;
        return { deferred: true, newDeadline };
      } else {
        this.eventEmitter.emit('ai-cos:action.rejected', {
          actionId: ctx.actionContext.actionId,
          rejectedBy: 'HUMAN-CEO',
          reason: data.reasoning,
        });
        return { rejected: true, reason: data.reasoning };
      }
    });

    // Complete SAGA
    saga.status = 'completed';
    saga.completedAt = new Date();
    this.logger.log(`✅ SAGA ${saga.id} completed: ${data.decision}`);

    this.eventEmitter.emit('ai-cos:saga.completed', {
      sagaId: saga.id,
      sagaName: saga.name,
      decision: data.decision,
    });
  }

  /**
   * Timeout de validation expiré
   */
  @OnEvent('ai-cos:validation.expired')
  async onValidationExpired(data: { validationId: string }) {
    const saga = Array.from(this.activeSagas.values()).find(
      s => (s.context as CeoEscalationSagaContext).escalationId === data.validationId
    );

    if (!saga || saga.status !== 'running') return;

    this.logger.warn(`⏰ SAGA ${saga.id} - Validation expired`);

    const ctx = saga.context as CeoEscalationSagaContext;

    // Si CEO, escalader au Board
    if (ctx.escalationLevel === 'CEO') {
      this.logger.warn(`🚨 Escalading to BOARD due to CEO timeout`);
      
      // Créer nouvelle SAGA pour le Board
      await this.execute(
        {
          actionContext: ctx.actionContext,
          escalationReason: `CEO n'a pas répondu. Escalade automatique au Board.`,
          escalationSource: 'CIRCUIT-BREAKER',
          urgencyLevel: 'CRITICAL',
        },
        process.env.BOARD_EMAIL ?? 'board@automecanik.com',
      );
    }

    // Fail current SAGA
    saga.status = 'failed';
    saga.error = 'Validation timeout expired';
    saga.completedAt = new Date();

    this.eventEmitter.emit('ai-cos:saga.failed', {
      sagaId: saga.id,
      sagaName: saga.name,
      reason: 'timeout',
    });
  }

  private async executeStep(saga: SagaState, stepIndex: number, fn: () => Promise<any>): Promise<void> {
    const step = saga.steps[stepIndex];
    if (!step) return;

    step.status = 'running';
    step.startedAt = new Date();

    try {
      step.result = await fn();
      step.status = 'completed';
      step.completedAt = new Date();
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      throw error;
    }
  }

  private async compensate(saga: SagaState, error: Error): Promise<void> {
    saga.status = 'compensating';
    saga.error = error.message;
    this.logger.warn(`🔄 Compensating SAGA ${saga.id}: ${error.message}`);

    const ctx = saga.context as CeoEscalationSagaContext;

    // Compensation: Annuler l'escalade si créée
    if (ctx.escalationId) {
      await this.supabase.client
        .from('ai_cos_ceo_validations')
        .update({ status: 'cancelled', decision_reasoning: `SAGA compensated: ${error.message}` })
        .eq('id', ctx.escalationId);
    }

    saga.status = 'failed';
    saga.completedAt = new Date();

    this.eventEmitter.emit('ai-cos:saga.failed', {
      sagaId: saga.id,
      sagaName: saga.name,
      error: error.message,
    });
  }
}

// ============================================
// SAGA 3: Agent Self-Adjustment
// ============================================

@Injectable()
export class AgentSelfAdjustmentSaga {
  private readonly logger = new Logger(AgentSelfAdjustmentSaga.name);
  private activeSagas: Map<string, SagaState> = new Map();

  constructor(
    private readonly feedbackLoop: FeedbackLoopService,
    private readonly eventEmitter: EventEmitter2,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Démarre la SAGA d'auto-ajustement pour un agent
   */
  async execute(agentId: string, agentName: string, squadId: string): Promise<SagaState> {
    const sagaId = `SAGA-ADJUST-${agentId}-${Date.now()}`;
    this.logger.log(`🚀 Starting Agent Self-Adjustment SAGA: ${sagaId}`);

    const saga: SagaState = {
      id: sagaId,
      name: 'Agent_Self_Adjustment',
      status: 'running',
      steps: [
        { name: 'collect_outcomes', status: 'pending' },
        { name: 'calculate_success_rate', status: 'pending' },
        { name: 'evaluate_adjustment', status: 'pending' },
        { name: 'apply_adjustment', status: 'pending' },
        { name: 'notify_meta_agent', status: 'pending' },
        { name: 'log_adjustment', status: 'pending' },
        { name: 'update_agent_config', status: 'pending' },
      ],
      context: {
        agentId,
        agentName,
        squadId,
        outcomesAnalyzed: 0,
        successRate: 0,
        previousConfidence: 0,
        newConfidence: 0,
        previousAutonomy: 'standard',
        newAutonomy: 'standard',
        adjustmentApplied: false,
      } as AgentAdjustmentSagaContext,
      startedAt: new Date(),
    };

    this.activeSagas.set(sagaId, saga);

    try {
      // Step 1: Collect last 10 outcomes
      await this.executeStep(saga, 0, async () => {
        const { data: outcomes } = await this.supabase.client
          .from('ai_cos_learning_events')
          .select('outcome, impact_score, created_at')
          .eq('agent_id', agentId)
          .in('outcome', ['success', 'failure', 'rollback'])
          .order('created_at', { ascending: false })
          .limit(10);

        (saga.context as AgentAdjustmentSagaContext).outcomesAnalyzed = outcomes?.length ?? 0;
        return { outcomes, count: outcomes?.length ?? 0 };
      });

      // Step 2: Calculate success rate
      await this.executeStep(saga, 1, async () => {
        const outcomes = saga.steps[0].result.outcomes ?? [];
        const successes = outcomes.filter((o: any) => o.outcome === 'success').length;
        const total = outcomes.filter((o: any) => ['success', 'failure'].includes(o.outcome)).length;
        
        const successRate = total > 0 ? (successes / total) * 100 : 50;
        (saga.context as AgentAdjustmentSagaContext).successRate = successRate;

        return { successes, total, successRate };
      });

      // Step 3: Evaluate adjustment
      await this.executeStep(saga, 2, async () => {
        const ctx = saga.context as AgentAdjustmentSagaContext;
        const currentConfidence = await this.feedbackLoop.getAgentConfidence(agentId);
        ctx.previousConfidence = currentConfidence?.confidenceScore ?? 50;
        ctx.previousAutonomy = currentConfidence?.autonomyLevel ?? 'standard';

        let adjustmentType: string;
        let adjustmentDelta: number;

        if (ctx.successRate < 40) {
          // Performance très faible → réduire autonomie
          adjustmentType = 'reduce_autonomy';
          adjustmentDelta = -15;
        } else if (ctx.successRate < 60) {
          // Performance faible → légère réduction
          adjustmentType = 'slight_reduction';
          adjustmentDelta = -5;
        } else if (ctx.successRate >= 90) {
          // Excellente performance → augmenter autonomie
          adjustmentType = 'increase_autonomy';
          adjustmentDelta = 10;
        } else if (ctx.successRate >= 75) {
          // Bonne performance → légère augmentation
          adjustmentType = 'slight_increase';
          adjustmentDelta = 5;
        } else {
          // Performance normale
          adjustmentType = 'no_change';
          adjustmentDelta = 0;
        }

        return { adjustmentType, adjustmentDelta, currentConfidence: ctx.previousConfidence };
      });

      // Step 4: Apply adjustment
      await this.executeStep(saga, 3, async () => {
        const ctx = saga.context as AgentAdjustmentSagaContext;
        const { adjustmentType, adjustmentDelta } = saga.steps[2].result;

        if (adjustmentDelta === 0) {
          ctx.newConfidence = ctx.previousConfidence;
          ctx.newAutonomy = ctx.previousAutonomy;
          ctx.adjustmentApplied = false;
          return { applied: false, reason: 'No adjustment needed' };
        }

        // Calculer nouvelle confiance
        ctx.newConfidence = Math.max(10, Math.min(95, ctx.previousConfidence + adjustmentDelta));

        // Déterminer nouvelle autonomie
        if (ctx.newConfidence < 30) ctx.newAutonomy = 'restricted';
        else if (ctx.newConfidence < 60) ctx.newAutonomy = 'standard';
        else if (ctx.newConfidence < 85) ctx.newAutonomy = 'elevated';
        else ctx.newAutonomy = 'full';

        // Insérer l'ajustement
        await this.supabase.client
          .from('ai_cos_agent_confidence')
          .insert({
            agent_id: agentId,
            agent_name: agentName,
            squad_id: squadId,
            confidence_score: ctx.newConfidence,
            confidence_previous: ctx.previousConfidence,
            confidence_delta: adjustmentDelta,
            adjustment_reason: `Auto-ajustement SAGA: ${adjustmentType} (success rate: ${ctx.successRate.toFixed(1)}%)`,
            adjustment_type: adjustmentType,
            adjustment_source: 'auto',
            success_rate_7d: ctx.successRate,
            autonomy_level: ctx.newAutonomy,
            autonomy_previous: ctx.previousAutonomy,
          });

        ctx.adjustmentApplied = true;
        return { applied: true, adjustmentType, adjustmentDelta, newConfidence: ctx.newConfidence, newAutonomy: ctx.newAutonomy };
      });

      // Step 5: Notify Meta-Agent
      await this.executeStep(saga, 4, async () => {
        const ctx = saga.context as AgentAdjustmentSagaContext;

        if (!ctx.adjustmentApplied) {
          return { notified: false };
        }

        this.eventEmitter.emit('ai-cos:agent.autonomy.changed', {
          agentId,
          squadId,
          previousAutonomy: ctx.previousAutonomy,
          newAutonomy: ctx.newAutonomy,
          confidenceDelta: ctx.newConfidence - ctx.previousConfidence,
        });

        return { notified: true };
      });

      // Step 6: Log adjustment
      await this.executeStep(saga, 5, async () => {
        const ctx = saga.context as AgentAdjustmentSagaContext;

        await this.feedbackLoop.recordLearningEvent({
          actionContext: {
            actionId: `SAGA-${sagaId}`,
            agentId,
            agentName,
            squadId,
            actionType: 'self_adjustment',
            actionDescription: `Auto-ajustement confiance: ${ctx.previousConfidence} → ${ctx.newConfidence}`,
            riskScore: 0,
          },
          kpisBefore: { confidence: ctx.previousConfidence },
          kpisAfter: { confidence: ctx.newConfidence },
          outcome: ctx.adjustmentApplied ? 'success' : 'neutral',
        });

        return { logged: true };
      });

      // Step 7: Update agent config
      await this.executeStep(saga, 6, async () => {
        const ctx = saga.context as AgentAdjustmentSagaContext;

        // Si autonomie a changé, mettre à jour la config de l'agent
        if (ctx.previousAutonomy !== ctx.newAutonomy) {
          this.eventEmitter.emit('ai-cos:agent.config.update', {
            agentId,
            config: {
              autonomyLevel: ctx.newAutonomy,
              maxBudgetAutonomous: this.getAutonomyBudgetLimit(ctx.newAutonomy),
              requiresApproval: ctx.newAutonomy === 'restricted',
            },
          });
        }

        return { configUpdated: ctx.previousAutonomy !== ctx.newAutonomy };
      });

      // Complete SAGA
      saga.status = 'completed';
      saga.completedAt = new Date();
      
      const ctx = saga.context as AgentAdjustmentSagaContext;
      this.logger.log(`✅ SAGA ${sagaId} completed: ${ctx.previousConfidence} → ${ctx.newConfidence} (${ctx.previousAutonomy} → ${ctx.newAutonomy})`);

      this.eventEmitter.emit('ai-cos:saga.completed', {
        sagaId: saga.id,
        sagaName: saga.name,
        agentId,
        adjustmentApplied: ctx.adjustmentApplied,
        newConfidence: ctx.newConfidence,
        newAutonomy: ctx.newAutonomy,
      });

    } catch (error) {
      await this.compensate(saga, error);
    }

    return saga;
  }

  private getAutonomyBudgetLimit(autonomy: string): number {
    switch (autonomy) {
      case 'restricted': return 100;
      case 'standard': return 1000;
      case 'elevated': return 5000;
      case 'full': return 10000;
      default: return 1000;
    }
  }

  private async executeStep(saga: SagaState, stepIndex: number, fn: () => Promise<any>): Promise<void> {
    const step = saga.steps[stepIndex];
    if (!step) return;

    step.status = 'running';
    step.startedAt = new Date();

    try {
      step.result = await fn();
      step.status = 'completed';
      step.completedAt = new Date();
    } catch (error) {
      step.status = 'failed';
      step.error = error.message;
      throw error;
    }
  }

  private async compensate(saga: SagaState, error: Error): Promise<void> {
    saga.status = 'compensating';
    saga.error = error.message;
    this.logger.warn(`🔄 Compensating SAGA ${saga.id}: ${error.message}`);

    const ctx = saga.context as AgentAdjustmentSagaContext;

    // Compensation: Restaurer la confiance précédente si modifiée
    if (ctx.adjustmentApplied && ctx.previousConfidence !== ctx.newConfidence) {
      await this.supabase.client
        .from('ai_cos_agent_confidence')
        .insert({
          agent_id: ctx.agentId,
          agent_name: ctx.agentName,
          squad_id: ctx.squadId,
          confidence_score: ctx.previousConfidence,
          confidence_previous: ctx.newConfidence,
          confidence_delta: ctx.previousConfidence - ctx.newConfidence,
          adjustment_reason: `SAGA Compensation: Restauration confiance après erreur`,
          adjustment_type: 'compensation',
          adjustment_source: 'auto',
          autonomy_level: ctx.previousAutonomy,
        });
    }

    saga.status = 'failed';
    saga.completedAt = new Date();

    this.eventEmitter.emit('ai-cos:saga.failed', {
      sagaId: saga.id,
      sagaName: saga.name,
      agentId: ctx.agentId,
      error: error.message,
    });
  }
}

// ============================================
// Queue Processor
// ============================================

@Processor('ai-cos-feedback')
export class FeedbackLoopQueueProcessor {
  private readonly logger = new Logger(FeedbackLoopQueueProcessor.name);

  constructor(
    private readonly feedbackLoop: FeedbackLoopService,
    private readonly impactSaga: ActionImpactMeasurementSaga,
    private readonly ceoSaga: CeoEscalationValidationSaga,
    private readonly adjustmentSaga: AgentSelfAdjustmentSaga,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('measure-impact')
  async handleMeasureImpact(job: Job<{ actionId: string; measurementType: string }>) {
    this.logger.log(`Processing measure-impact job: ${job.data.actionId} - ${job.data.measurementType}`);
    
    try {
      await this.feedbackLoop.measureImpact(job.data.actionId, job.data.measurementType as any);
    } catch (error) {
      this.logger.error(`Failed to measure impact: ${error.message}`);
      throw error;
    }
  }

  @Process('check-validation-timeout')
  async handleValidationTimeout(job: Job<{ sagaId: string; deadline: string }>) {
    const deadline = new Date(job.data.deadline);
    
    if (new Date() >= deadline) {
      this.logger.warn(`Validation timeout for SAGA ${job.data.sagaId}`);
      this.eventEmitter.emit('ai-cos:validation.timeout', { sagaId: job.data.sagaId });
    }
  }

  @Process('send-validation-reminder')
  async handleValidationReminder(job: Job<{ sagaId: string }>) {
    this.logger.log(`Sending validation reminder for SAGA ${job.data.sagaId}`);
    this.eventEmitter.emit('ai-cos:validation.reminder', { sagaId: job.data.sagaId });
  }

  @Process('saga-continue-measurement')
  async handleSagaContinueMeasurement(job: Job<{ sagaId: string; measurementType: string }>) {
    this.logger.log(`Continuing measurement for SAGA ${job.data.sagaId}: ${job.data.measurementType}`);
    // Le traitement est géré par l'événement ai-cos:impact.measured
  }

  @Process('agent-self-adjustment')
  async handleAgentSelfAdjustment(job: Job<{ agentId: string; agentName: string; squadId: string }>) {
    this.logger.log(`Processing agent self-adjustment: ${job.data.agentId}`);
    
    try {
      await this.adjustmentSaga.execute(job.data.agentId, job.data.agentName, job.data.squadId);
    } catch (error) {
      this.logger.error(`Failed to adjust agent: ${error.message}`);
      throw error;
    }
  }
}

// ============================================
// Module Export
// ============================================

export const FEEDBACK_SAGA_PROVIDERS = [
  ActionImpactMeasurementSaga,
  CeoEscalationValidationSaga,
  AgentSelfAdjustmentSaga,
  FeedbackLoopQueueProcessor,
];
