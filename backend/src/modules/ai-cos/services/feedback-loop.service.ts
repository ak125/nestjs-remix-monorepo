/**
 * AI-COS v2.30.0: Feedback Loop Service
 * 
 * Service centralisé pour la gestion des boucles de feedback:
 * - Mesure d'impact après chaque action
 * - Auto-ajustement de la confiance des agents
 * - Escalade vers IA-CEO et Human CEO
 * - Enregistrement des patterns d'apprentissage
 * 
 * @module FeedbackLoopService
 * @version 2.30.0
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';

// ============================================
// Types & Interfaces
// ============================================

export interface ActionContext {
  actionId: string;
  agentId: string;
  agentName: string;
  squadId: string;
  actionType: string;
  actionDescription: string;
  riskScore: number;
  budgetImpact?: number;
  strategicImpact?: boolean;
  metadata?: Record<string, any>;
}

export interface KPISnapshot {
  timestamp: Date;
  kpis: Record<string, number>;
  source: string;
}

export interface ImpactMeasurement {
  id: string;
  actionId: string;
  measurementType: '1h' | '4h' | '24h' | '7d' | '30d';
  kpisBaseline: Record<string, number>;
  kpisCurrent: Record<string, number>;
  kpisDelta: Record<string, number>;
  kpisDeltaPercent: Record<string, number>;
  impactScore: number;
  impactCategory: 'critical_negative' | 'negative' | 'neutral' | 'positive' | 'critical_positive';
  isPositive: boolean;
  thresholdBreached: boolean;
  autoActionTriggered: boolean;
}

export interface EscalationContext {
  actionContext: ActionContext;
  escalationReason: string;
  escalationSource: 'IA-CEO' | 'META-AGENT' | 'CIRCUIT-BREAKER' | 'FEEDBACK-LOOP';
  projectedKpis?: Record<string, number>;
  potentialRisks?: string[];
  urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  learningEventId?: string;
}

export interface EscalationResult {
  id: string;
  escalationLevel: 'CFO' | 'CEO' | 'BOARD';
  status: 'created' | 'pending' | 'notified';
  deadlineAt: Date;
  notificationsSent: string[];
}

export interface ValidationRequest {
  id: string;
  escalationId: string;
  humanCeoEmail: string;
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'expired';
  deadlineAt: Date;
  dashboardUrl: string;
}

export interface LearningEventInput {
  actionContext: ActionContext;
  kpisBefore: Record<string, number>;
  kpisAfter?: Record<string, number>;
  outcome: 'success' | 'failure' | 'neutral' | 'pending' | 'rollback';
  humanFeedback?: string;
  humanFeedbackReason?: string;
  patternName?: string;
}

export interface LearningEvent {
  id: string;
  agentId: string;
  squadId: string;
  actionType: string;
  outcome: string;
  impactScore: number | null;
  confidenceBefore: number;
  confidenceAfter: number | null;
  patternStored: boolean;
  createdAt: Date;
}

export interface AgentConfidence {
  agentId: string;
  agentName: string;
  squadId: string;
  confidenceScore: number;
  autonomyLevel: 'restricted' | 'standard' | 'elevated' | 'full';
  successRate7d: number;
  successRate30d: number;
  totalActions7d: number;
  totalActions30d: number;
}

export interface LearnedPattern {
  id: string;
  patternName: string;
  patternType: 'success' | 'failure' | 'optimization' | 'risk_mitigation';
  triggerConditions: Record<string, any>;
  actionTemplate: Record<string, any>;
  successRate: number;
  timesApplied: number;
  averageImpact: number;
  isActive: boolean;
}

// ============================================
// Configuration
// ============================================

const FEEDBACK_CONFIG = {
  // Seuils d'impact pour actions automatiques
  thresholds: {
    rollback: -20,        // Impact <= -20 → Rollback automatique
    warning: -10,         // Impact <= -10 → Alerte
    escalation: -15,      // Impact <= -15 → Escalade CEO
    positive: 10,         // Impact >= +10 → Pattern success
    criticalPositive: 25, // Impact >= +25 → Boost confiance
  },
  
  // Ajustement confiance
  confidence: {
    successBonus: 5,
    failurePenalty: -8,
    rollbackPenalty: -15,
    maxConfidence: 95,
    minConfidence: 10,
    decayRate: 0.5, // Decay mensuel si inactif
  },
  
  // Escalade
  escalation: {
    budgetThresholdCEO: 10000,    // >€10K → CEO
    budgetThresholdBoard: 50000,  // >€50K → Board
    riskThresholdCEO: 70,         // Risk >70 → CEO
    riskThresholdBoard: 90,       // Risk >90 → Board
    deadlineHoursCEO: 48,
    deadlineHoursBoard: 24,
    reminderHours: 12,
  },
  
  // Mesures d'impact
  measurements: {
    intervals: ['1h', '4h', '24h', '7d', '30d'] as const,
    autoSchedule: true,
  },
  
  // Notifications
  notifications: {
    channels: ['email', 'slack'] as const,
    slackWebhookEnv: 'AI_COS_SLACK_WEBHOOK',
  },
};

// ============================================
// Service Principal
// ============================================

@Injectable()
export class FeedbackLoopService implements OnModuleInit {
  private readonly logger = new Logger(FeedbackLoopService.name);
  
  constructor(
    private readonly supabase: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue('ai-cos-feedback') private readonly feedbackQueue: Queue,
  ) {}

  async onModuleInit() {
    this.logger.log('🔄 FeedbackLoopService initialized');
    this.subscribeToEvents();
  }

  // ============================================
  // 1. MESURE D'IMPACT
  // ============================================

  /**
   * Programme les mesures d'impact pour une action
   */
  async scheduleImpactMeasurements(
    actionId: string, 
    actionContext: ActionContext,
    kpisBaseline: Record<string, number>
  ): Promise<void> {
    this.logger.log(`📊 Scheduling impact measurements for action ${actionId}`);
    
    const measurements = FEEDBACK_CONFIG.measurements.intervals.map((interval) => ({
      actionId,
      agentId: actionContext.agentId,
      squadId: actionContext.squadId,
      measurementType: interval,
      kpisBaseline,
      scheduledAt: this.calculateScheduledTime(interval),
    }));

    // Insérer les mesures programmées
    const { error } = await this.supabase.client
      .from('ai_cos_impact_measurements')
      .insert(measurements);

    if (error) {
      this.logger.error(`Failed to schedule measurements: ${error.message}`);
      throw error;
    }

    // Programmer les jobs dans la queue
    for (const m of measurements) {
      const delay = new Date(m.scheduledAt).getTime() - Date.now();
      await this.feedbackQueue.add('measure-impact', {
        measurementId: null, // Will be set after insert
        actionId,
        measurementType: m.measurementType,
      }, { delay: Math.max(0, delay) });
    }

    this.eventEmitter.emit('ai-cos:measurements.scheduled', { actionId, count: measurements.length });
  }

  /**
   * Effectue une mesure d'impact
   */
  async measureImpact(
    actionId: string, 
    measurementType: '1h' | '4h' | '24h' | '7d' | '30d'
  ): Promise<ImpactMeasurement> {
    this.logger.log(`📈 Measuring ${measurementType} impact for action ${actionId}`);

    // Récupérer la mesure programmée
    const { data: measurement, error: fetchError } = await this.supabase.client
      .from('ai_cos_impact_measurements')
      .select('*')
      .eq('action_id', actionId)
      .eq('measurement_type', measurementType)
      .is('measured_at', null)
      .single();

    if (fetchError || !measurement) {
      throw new Error(`Measurement not found for action ${actionId}, type ${measurementType}`);
    }

    // Récupérer les KPIs actuels
    const currentKpis = await this.fetchCurrentKPIs(measurement.agent_id, measurement.squad_id);
    
    // Calculer les deltas
    const kpisDelta = this.calculateKPIDelta(measurement.kpis_baseline, currentKpis);
    const kpisDeltaPercent = this.calculateKPIDeltaPercent(measurement.kpis_baseline, currentKpis);
    const impactScore = this.calculateImpactScore(kpisDelta);
    const impactCategory = this.getImpactCategory(impactScore);

    // Vérifier seuils
    const thresholdBreached = impactScore <= FEEDBACK_CONFIG.thresholds.warning;
    let autoActionTriggered = false;
    let autoActionType: string | null = null;

    // Actions automatiques si seuils dépassés
    if (impactScore <= FEEDBACK_CONFIG.thresholds.rollback && measurementType === '1h') {
      autoActionTriggered = true;
      autoActionType = 'rollback';
      await this.triggerRollback(actionId, impactScore, kpisDelta);
    } else if (impactScore <= FEEDBACK_CONFIG.thresholds.escalation) {
      autoActionTriggered = true;
      autoActionType = 'escalation';
      await this.escalateNegativeImpact(actionId, impactScore, measurement);
    }

    // Mettre à jour la mesure
    const { data: updated, error: updateError } = await this.supabase.client
      .from('ai_cos_impact_measurements')
      .update({
        measured_at: new Date().toISOString(),
        kpis_current: currentKpis,
        kpis_delta: kpisDelta,
        kpis_delta_percent: kpisDeltaPercent,
        impact_score: impactScore,
        impact_category: impactCategory,
        is_positive: impactScore > 0,
        threshold_breached: thresholdBreached,
        auto_action_triggered: autoActionTriggered,
        auto_action_type: autoActionType,
      })
      .eq('id', measurement.id)
      .select()
      .single();

    if (updateError) {
      this.logger.error(`Failed to update measurement: ${updateError.message}`);
      throw updateError;
    }

    // Émettre événement
    this.eventEmitter.emit('ai-cos:impact.measured', {
      actionId,
      measurementType,
      impactScore,
      impactCategory,
      thresholdBreached,
      autoActionTriggered,
    });

    // Si impact positif significatif, enregistrer le pattern
    if (impactScore >= FEEDBACK_CONFIG.thresholds.positive) {
      await this.considerPatternStorage(actionId, impactScore, measurement);
    }

    return {
      id: updated.id,
      actionId,
      measurementType,
      kpisBaseline: measurement.kpis_baseline,
      kpisCurrent: currentKpis,
      kpisDelta,
      kpisDeltaPercent,
      impactScore,
      impactCategory,
      isPositive: impactScore > 0,
      thresholdBreached,
      autoActionTriggered,
    };
  }

  /**
   * Récupère l'historique des mesures d'impact
   */
  async getImpactHistory(actionId: string): Promise<ImpactMeasurement[]> {
    const { data, error } = await this.supabase.client
      .from('ai_cos_impact_measurements')
      .select('*')
      .eq('action_id', actionId)
      .order('measurement_type', { ascending: true });

    if (error) throw error;
    return data.map(this.mapToImpactMeasurement);
  }

  // ============================================
  // 2. AUTO-AJUSTEMENT CONFIANCE
  // ============================================

  /**
   * Ajuste la confiance d'un agent basé sur l'outcome
   */
  async adjustAgentConfidence(
    agentId: string,
    agentName: string,
    squadId: string,
    outcome: 'success' | 'failure' | 'neutral' | 'rollback',
    impactScore: number = 0,
    actionId?: string,
    learningEventId?: string
  ): Promise<AgentConfidence> {
    this.logger.log(`🎯 Adjusting confidence for agent ${agentId}: ${outcome}`);

    // Récupérer confiance actuelle
    const { data: current } = await this.supabase.client
      .from('ai_cos_agent_confidence')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const currentConfidence = current?.confidence_score ?? 50;
    
    // Calculer ajustement
    let adjustment = 0;
    let adjustmentReason = '';
    
    switch (outcome) {
      case 'success':
        adjustment = FEEDBACK_CONFIG.confidence.successBonus + (impactScore / 20);
        adjustmentReason = `Action réussie avec impact ${impactScore.toFixed(1)}`;
        break;
      case 'failure':
        adjustment = FEEDBACK_CONFIG.confidence.failurePenalty + (impactScore / 25);
        adjustmentReason = `Action échouée avec impact ${impactScore.toFixed(1)}`;
        break;
      case 'rollback':
        adjustment = FEEDBACK_CONFIG.confidence.rollbackPenalty;
        adjustmentReason = 'Action rollback - impact critique négatif';
        break;
      case 'neutral':
        adjustment = 0;
        adjustmentReason = 'Impact neutre - aucun ajustement';
        break;
    }

    // Appliquer limites
    const newConfidence = Math.max(
      FEEDBACK_CONFIG.confidence.minConfidence,
      Math.min(FEEDBACK_CONFIG.confidence.maxConfidence, currentConfidence + adjustment)
    );

    // Calculer stats rolling
    const stats = await this.calculateAgentStats(agentId);

    // Déterminer niveau d'autonomie
    const autonomyLevel = this.determineAutonomyLevel(newConfidence, stats.successRate7d);

    // Insérer nouvel enregistrement
    const { data: inserted, error } = await this.supabase.client
      .from('ai_cos_agent_confidence')
      .insert({
        agent_id: agentId,
        agent_name: agentName,
        squad_id: squadId,
        confidence_score: newConfidence,
        confidence_previous: currentConfidence,
        confidence_delta: adjustment,
        adjustment_reason: adjustmentReason,
        adjustment_type: `action_${outcome}`,
        adjustment_source: 'auto',
        action_id: actionId,
        learning_event_id: learningEventId,
        success_rate_7d: stats.successRate7d,
        success_rate_30d: stats.successRate30d,
        total_actions_7d: stats.totalActions7d,
        total_actions_30d: stats.totalActions30d,
        autonomy_level: autonomyLevel,
        autonomy_previous: current?.autonomy_level ?? 'standard',
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to adjust confidence: ${error.message}`);
      throw error;
    }

    // Émettre événement
    this.eventEmitter.emit('ai-cos:agent.confidence.updated', {
      agentId,
      previousConfidence: currentConfidence,
      newConfidence,
      adjustment,
      autonomyLevel,
      outcome,
    });

    return {
      agentId,
      agentName,
      squadId,
      confidenceScore: newConfidence,
      autonomyLevel,
      successRate7d: stats.successRate7d,
      successRate30d: stats.successRate30d,
      totalActions7d: stats.totalActions7d,
      totalActions30d: stats.totalActions30d,
    };
  }

  /**
   * Récupère la confiance actuelle d'un agent
   */
  async getAgentConfidence(agentId: string): Promise<AgentConfidence | null> {
    const { data, error } = await this.supabase.client
      .from('ai_cos_agent_confidence')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return {
      agentId: data.agent_id,
      agentName: data.agent_name,
      squadId: data.squad_id,
      confidenceScore: data.confidence_score,
      autonomyLevel: data.autonomy_level,
      successRate7d: data.success_rate_7d,
      successRate30d: data.success_rate_30d,
      totalActions7d: data.total_actions_7d,
      totalActions30d: data.total_actions_30d,
    };
  }

  // ============================================
  // 3. ESCALADE IA-CEO
  // ============================================

  /**
   * Escalade une action vers IA-CEO pour décision
   */
  async escalateToIACeo(context: EscalationContext): Promise<EscalationResult> {
    this.logger.warn(`🚨 Escalating to IA-CEO: ${context.escalationReason}`);

    // Déterminer niveau d'escalade
    const escalationLevel = this.determineEscalationLevel(context);
    const deadlineHours = escalationLevel === 'BOARD' 
      ? FEEDBACK_CONFIG.escalation.deadlineHoursBoard 
      : FEEDBACK_CONFIG.escalation.deadlineHoursCEO;
    
    const deadlineAt = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

    // Créer l'escalade
    const escalationId = `ESC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data: escalation, error } = await this.supabase.client
      .from('ai_cos_ceo_validations')
      .insert({
        escalation_id: escalationId,
        escalation_level: escalationLevel,
        escalation_reason: context.escalationReason,
        escalation_source: context.escalationSource,
        agent_id: context.actionContext.agentId,
        squad_id: context.actionContext.squadId,
        action_id: context.actionContext.actionId,
        action_type: context.actionContext.actionType,
        action_description: context.actionContext.actionDescription,
        budget_impact: context.actionContext.budgetImpact ?? 0,
        risk_score: context.actionContext.riskScore,
        strategic_impact: context.actionContext.strategicImpact ?? false,
        projected_kpis: context.projectedKpis ?? {},
        potential_risks: context.potentialRisks ?? [],
        status: 'pending',
        deadline_at: deadlineAt.toISOString(),
        learning_event_id: context.learningEventId,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create escalation: ${error.message}`);
      throw error;
    }

    // Envoyer notifications
    const notificationsSent = await this.sendEscalationNotifications(escalation, escalationLevel);

    // Émettre événement
    this.eventEmitter.emit('ai-cos:escalation.created', {
      escalationId,
      escalationLevel,
      deadlineAt,
      actionContext: context.actionContext,
    });

    return {
      id: escalation.id,
      escalationLevel,
      status: 'notified',
      deadlineAt,
      notificationsSent,
    };
  }

  // ============================================
  // 4. VALIDATION HUMAN CEO
  // ============================================

  /**
   * Demande validation au Human CEO
   */
  async requestHumanCeoValidation(
    escalationId: string,
    humanCeoEmail: string,
    deadline: Date
  ): Promise<ValidationRequest> {
    this.logger.log(`👔 Requesting Human CEO validation for ${escalationId}`);

    const { data: escalation, error: fetchError } = await this.supabase.client
      .from('ai_cos_ceo_validations')
      .select('*')
      .eq('escalation_id', escalationId)
      .single();

    if (fetchError || !escalation) {
      throw new Error(`Escalation ${escalationId} not found`);
    }

    // Mettre à jour avec les infos CEO
    const { error: updateError } = await this.supabase.client
      .from('ai_cos_ceo_validations')
      .update({
        human_ceo_email: humanCeoEmail,
        deadline_at: deadline.toISOString(),
      })
      .eq('id', escalation.id);

    if (updateError) throw updateError;

    // Envoyer notification directe
    await this.sendHumanCeoNotification(escalation, humanCeoEmail);

    // Programmer rappels
    await this.scheduleValidationReminders(escalation.id, deadline);

    // Émettre événement
    this.eventEmitter.emit('ai-cos:validation.required', {
      escalationId,
      humanCeoEmail,
      deadline,
    });

    return {
      id: escalation.id,
      escalationId,
      humanCeoEmail,
      status: 'pending',
      deadlineAt: deadline,
      dashboardUrl: `/admin/ai-cos/ceo/validations/${escalation.id}`,
    };
  }

  /**
   * Récupère les validations en attente pour le CEO
   */
  async getPendingValidations(humanCeoEmail?: string): Promise<any[]> {
    let query = this.supabase.client
      .from('v_ceo_pending_validations')
      .select('*');

    if (humanCeoEmail) {
      query = query.eq('human_ceo_email', humanCeoEmail);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Enregistre la décision du CEO
   */
  async recordCeoDecision(
    validationId: string,
    decision: 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'MODIFIED',
    reasoning: string,
    conditions?: Record<string, any>,
    humanCeoId?: string
  ): Promise<void> {
    this.logger.log(`📝 Recording CEO decision: ${decision} for ${validationId}`);

    const status = decision.toLowerCase() as 'approved' | 'rejected' | 'deferred';

    const { error } = await this.supabase.client
      .from('ai_cos_ceo_validations')
      .update({
        status,
        decision,
        decision_reasoning: reasoning,
        decision_conditions: conditions,
        decided_at: new Date().toISOString(),
        human_ceo_id: humanCeoId,
      })
      .eq('id', validationId);

    if (error) throw error;

    // Émettre événement
    this.eventEmitter.emit('ai-cos:validation.decided', {
      validationId,
      decision,
      reasoning,
    });

    // Si approuvé, exécuter l'action
    if (decision === 'APPROVED') {
      await this.executeApprovedAction(validationId, conditions);
    }
  }

  // ============================================
  // 5. ENREGISTREMENT APPRENTISSAGE
  // ============================================

  /**
   * Enregistre un événement d'apprentissage
   */
  async recordLearningEvent(event: LearningEventInput): Promise<LearningEvent> {
    this.logger.log(`🧠 Recording learning event for ${event.actionContext.agentId}`);

    // Récupérer confiance actuelle
    const currentConfidence = await this.getAgentConfidence(event.actionContext.agentId);
    const confidenceBefore = currentConfidence?.confidenceScore ?? 50;

    // Calculer delta KPIs si disponible
    let kpisDelta: Record<string, number> | null = null;
    let impactScore: number | null = null;

    if (event.kpisAfter) {
      kpisDelta = this.calculateKPIDelta(event.kpisBefore, event.kpisAfter);
      impactScore = this.calculateImpactScore(kpisDelta);
    }

    // Insérer l'événement
    const { data: inserted, error } = await this.supabase.client
      .from('ai_cos_learning_events')
      .insert({
        agent_id: event.actionContext.agentId,
        agent_name: event.actionContext.agentName,
        squad_id: event.actionContext.squadId,
        action_id: event.actionContext.actionId,
        action_type: event.actionContext.actionType,
        action_description: event.actionContext.actionDescription,
        risk_score: event.actionContext.riskScore,
        kpis_before: event.kpisBefore,
        kpis_after: event.kpisAfter,
        kpis_delta: kpisDelta,
        impact_score: impactScore,
        outcome: event.outcome,
        human_feedback: event.humanFeedback,
        human_feedback_reason: event.humanFeedbackReason,
        confidence_before: confidenceBefore,
        pattern_name: event.patternName,
        context: event.actionContext.metadata ?? {},
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to record learning event: ${error.message}`);
      throw error;
    }

    // Ajuster confiance si outcome final
    let confidenceAfter: number | null = null;
    if (event.outcome !== 'pending') {
      const updated = await this.adjustAgentConfidence(
        event.actionContext.agentId,
        event.actionContext.agentName,
        event.actionContext.squadId,
        event.outcome,
        impactScore ?? 0,
        event.actionContext.actionId,
        inserted.id
      );
      confidenceAfter = updated.confidenceScore;

      // Mettre à jour l'événement avec la nouvelle confiance
      await this.supabase.client
        .from('ai_cos_learning_events')
        .update({ confidence_after: confidenceAfter, confidence_delta: confidenceAfter - confidenceBefore })
        .eq('id', inserted.id);
    }

    // Émettre événement
    this.eventEmitter.emit('ai-cos:learning.recorded', {
      learningEventId: inserted.id,
      agentId: event.actionContext.agentId,
      outcome: event.outcome,
      impactScore,
    });

    return {
      id: inserted.id,
      agentId: event.actionContext.agentId,
      squadId: event.actionContext.squadId,
      actionType: event.actionContext.actionType,
      outcome: event.outcome,
      impactScore,
      confidenceBefore,
      confidenceAfter,
      patternStored: false,
      createdAt: new Date(inserted.created_at),
    };
  }

  // ============================================
  // 6. PATTERNS APPRIS
  // ============================================

  /**
   * Recherche des patterns similaires
   */
  async findSimilarPatterns(
    context: ActionContext,
    limit: number = 5
  ): Promise<LearnedPattern[]> {
    const { data, error } = await this.supabase.client
      .from('ai_cos_learned_patterns')
      .select('*')
      .eq('agent_id', context.agentId)
      .eq('is_active', true)
      .gte('success_rate', 70)
      .order('success_rate', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data.map((p) => ({
      id: p.id,
      patternName: p.pattern_name,
      patternType: p.pattern_type,
      triggerConditions: p.trigger_conditions,
      actionTemplate: p.action_template,
      successRate: p.success_rate,
      timesApplied: p.times_applied,
      averageImpact: p.average_impact ?? 0,
      isActive: p.is_active,
    }));
  }

  /**
   * Récupère tous les patterns d'un agent ou squad
   */
  async getLearnedPatterns(
    agentId?: string,
    squadId?: string,
    activeOnly: boolean = true
  ): Promise<LearnedPattern[]> {
    let query = this.supabase.client
      .from('ai_cos_learned_patterns')
      .select('*');

    if (agentId) query = query.eq('agent_id', agentId);
    if (squadId) query = query.eq('squad_id', squadId);
    if (activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query.order('success_rate', { ascending: false });
    if (error) throw error;

    return data.map((p) => ({
      id: p.id,
      patternName: p.pattern_name,
      patternType: p.pattern_type,
      triggerConditions: p.trigger_conditions,
      actionTemplate: p.action_template,
      successRate: p.success_rate,
      timesApplied: p.times_applied,
      averageImpact: p.average_impact ?? 0,
      isActive: p.is_active,
    }));
  }

  /**
   * Stocke un nouveau pattern appris
   */
  async storeLearnedPattern(
    agentId: string,
    squadId: string,
    patternName: string,
    patternType: 'success' | 'failure' | 'optimization' | 'risk_mitigation',
    triggerConditions: Record<string, any>,
    actionTemplate: Record<string, any>,
    expectedOutcome: string,
    learningEventId?: string
  ): Promise<LearnedPattern> {
    this.logger.log(`💾 Storing learned pattern: ${patternName}`);

    const { data, error } = await this.supabase.client
      .from('ai_cos_learned_patterns')
      .upsert({
        pattern_name: patternName,
        pattern_type: patternType,
        agent_id: agentId,
        squad_id: squadId,
        trigger_conditions: triggerConditions,
        action_template: actionTemplate,
        expected_outcome: expectedOutcome,
        times_applied: 1,
        success_count: patternType === 'success' ? 1 : 0,
        failure_count: patternType === 'failure' ? 1 : 0,
        is_active: true,
      }, { onConflict: 'pattern_name' })
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour l'événement d'apprentissage
    if (learningEventId) {
      await this.supabase.client
        .from('ai_cos_learning_events')
        .update({ pattern_stored: true, pattern_id: data.id, pattern_name: patternName })
        .eq('id', learningEventId);
    }

    // Émettre événement
    this.eventEmitter.emit('ai-cos:pattern.learned', {
      patternId: data.id,
      patternName,
      agentId,
    });

    return {
      id: data.id,
      patternName: data.pattern_name,
      patternType: data.pattern_type,
      triggerConditions: data.trigger_conditions,
      actionTemplate: data.action_template,
      successRate: data.success_rate ?? 100,
      timesApplied: data.times_applied,
      averageImpact: data.average_impact ?? 0,
      isActive: data.is_active,
    };
  }

  // ============================================
  // 7. CRONS & MAINTENANCE
  // ============================================

  /**
   * Vérifie les validations expirées (toutes les heures)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredValidations(): Promise<void> {
    this.logger.log('⏰ Checking for expired validations...');

    const { data: expired, error } = await this.supabase.client
      .from('ai_cos_ceo_validations')
      .select('*')
      .eq('status', 'pending')
      .lt('deadline_at', new Date().toISOString());

    if (error || !expired?.length) return;

    for (const validation of expired) {
      await this.supabase.client
        .from('ai_cos_ceo_validations')
        .update({
          status: 'auto-rejected',
          expired_at: new Date().toISOString(),
          decision: 'AUTO-REJECTED',
          decision_reasoning: 'Délai de validation dépassé sans réponse',
        })
        .eq('id', validation.id);

      this.eventEmitter.emit('ai-cos:validation.expired', { validationId: validation.id });

      // Escalader au Board si CEO n'a pas répondu
      if (validation.escalation_level === 'CEO') {
        await this.escalateToBoard(validation);
      }
    }

    this.logger.log(`⏰ Expired ${expired.length} validations`);
  }

  /**
   * Exécute les mesures d'impact programmées
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processScheduledMeasurements(): Promise<void> {
    const { data: due, error } = await this.supabase.client
      .from('v_impact_measurements_due')
      .select('*')
      .limit(50);

    if (error || !due?.length) return;

    for (const measurement of due) {
      try {
        await this.measureImpact(measurement.action_id, measurement.measurement_type);
      } catch (e) {
        this.logger.error(`Failed to process measurement ${measurement.id}: ${e.message}`);
      }
    }
  }

  /**
   * Decay confiance agents inactifs (hebdomadaire)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async decayInactiveAgentConfidence(): Promise<void> {
    this.logger.log('📉 Decaying inactive agent confidence...');

    // Agents sans action depuis 30 jours
    const { data: inactive } = await this.supabase.client
      .rpc('get_inactive_agents', { days: 30 });

    if (!inactive?.length) return;

    for (const agent of inactive) {
      const decay = FEEDBACK_CONFIG.confidence.decayRate;
      const newConfidence = Math.max(
        FEEDBACK_CONFIG.confidence.minConfidence,
        agent.confidence_score - decay
      );

      await this.supabase.client
        .from('ai_cos_agent_confidence')
        .insert({
          agent_id: agent.agent_id,
          agent_name: agent.agent_name,
          squad_id: agent.squad_id,
          confidence_score: newConfidence,
          confidence_previous: agent.confidence_score,
          confidence_delta: -decay,
          adjustment_reason: 'Decay pour inactivité (30+ jours)',
          adjustment_type: 'decay',
          adjustment_source: 'auto',
          autonomy_level: this.determineAutonomyLevel(newConfidence, 0),
        });
    }
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  private subscribeToEvents(): void {
    // Écouter les actions complétées pour programmer les mesures
    this.eventEmitter.on('ai-cos:action.completed', async (data: any) => {
      if (data.actionId && data.context && data.kpisBaseline) {
        await this.scheduleImpactMeasurements(data.actionId, data.context, data.kpisBaseline);
      }
    });
  }

  private calculateScheduledTime(interval: '1h' | '4h' | '24h' | '7d' | '30d'): string {
    const now = new Date();
    switch (interval) {
      case '1h': return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      case '4h': return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      case '24h': return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case '7d': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  }

  private async fetchCurrentKPIs(agentId: string, squadId: string): Promise<Record<string, number>> {
    // À implémenter: récupérer les KPIs actuels depuis les sources appropriées
    // Pour l'instant, retourne un placeholder
    return {
      revenue: 0,
      conversion_rate: 0,
      nps: 0,
      response_time: 0,
    };
  }

  private calculateKPIDelta(
    baseline: Record<string, number>,
    current: Record<string, number>
  ): Record<string, number> {
    const delta: Record<string, number> = {};
    for (const key of Object.keys(baseline)) {
      delta[key] = (current[key] ?? 0) - (baseline[key] ?? 0);
    }
    return delta;
  }

  private calculateKPIDeltaPercent(
    baseline: Record<string, number>,
    current: Record<string, number>
  ): Record<string, number> {
    const deltaPercent: Record<string, number> = {};
    for (const key of Object.keys(baseline)) {
      const base = baseline[key] ?? 0;
      const curr = current[key] ?? 0;
      deltaPercent[key] = base !== 0 ? ((curr - base) / Math.abs(base)) * 100 : 0;
    }
    return deltaPercent;
  }

  private calculateImpactScore(kpisDelta: Record<string, number>): number {
    let totalScore = 0;
    let count = 0;

    for (const [key, value] of Object.entries(kpisDelta)) {
      let weight = 1.0;
      if (key.includes('revenue') || key.includes('ca')) weight = 2.0;
      else if (key.includes('conversion') || key.includes('cvr')) weight = 1.8;
      else if (key.includes('nps') || key.includes('satisfaction')) weight = 1.5;
      else if (key.includes('cost') || key.includes('cout')) weight = -1.3;

      totalScore += value * weight;
      count++;
    }

    if (count === 0) return 0;
    return Math.max(-100, Math.min(100, totalScore / count));
  }

  private getImpactCategory(score: number): 'critical_negative' | 'negative' | 'neutral' | 'positive' | 'critical_positive' {
    if (score <= -20) return 'critical_negative';
    if (score <= -5) return 'negative';
    if (score <= 5) return 'neutral';
    if (score <= 20) return 'positive';
    return 'critical_positive';
  }

  private determineEscalationLevel(context: EscalationContext): 'CFO' | 'CEO' | 'BOARD' {
    const { budgetImpact = 0, riskScore } = context.actionContext;

    if (budgetImpact >= FEEDBACK_CONFIG.escalation.budgetThresholdBoard || riskScore >= FEEDBACK_CONFIG.escalation.riskThresholdBoard) {
      return 'BOARD';
    }
    if (budgetImpact >= FEEDBACK_CONFIG.escalation.budgetThresholdCEO || riskScore >= FEEDBACK_CONFIG.escalation.riskThresholdCEO) {
      return 'CEO';
    }
    return 'CFO';
  }

  private async calculateAgentStats(agentId: string): Promise<{
    successRate7d: number;
    successRate30d: number;
    totalActions7d: number;
    totalActions30d: number;
  }> {
    const { data } = await this.supabase.client
      .from('v_agent_performance_summary')
      .select('*')
      .eq('agent_id', agentId)
      .single();

    return {
      successRate7d: data?.success_rate ?? 50,
      successRate30d: data?.success_rate ?? 50,
      totalActions7d: data?.total_actions ?? 0,
      totalActions30d: data?.total_actions ?? 0,
    };
  }

  private determineAutonomyLevel(
    confidence: number,
    successRate: number
  ): 'restricted' | 'standard' | 'elevated' | 'full' {
    if (confidence < 30 || successRate < 40) return 'restricted';
    if (confidence < 60 || successRate < 70) return 'standard';
    if (confidence < 85 || successRate < 85) return 'elevated';
    return 'full';
  }

  private async triggerRollback(actionId: string, impactScore: number, kpisDelta: Record<string, number>): Promise<void> {
    this.logger.warn(`⚠️ Triggering rollback for action ${actionId} (impact: ${impactScore})`);
    
    this.eventEmitter.emit('ai-cos:action.rollback', {
      actionId,
      reason: 'Critical negative impact detected',
      impactScore,
      kpisDelta,
    });
  }

  private async escalateNegativeImpact(actionId: string, impactScore: number, measurement: any): Promise<void> {
    this.logger.warn(`⚠️ Escalating negative impact for action ${actionId}`);
    
    await this.escalateToIACeo({
      actionContext: {
        actionId,
        agentId: measurement.agent_id,
        agentName: 'Unknown',
        squadId: measurement.squad_id,
        actionType: 'impact_negative',
        actionDescription: `Action avec impact négatif: ${impactScore.toFixed(1)}`,
        riskScore: Math.abs(impactScore),
      },
      escalationReason: `Impact négatif détecté: ${impactScore.toFixed(1)}`,
      escalationSource: 'FEEDBACK-LOOP',
    });
  }

  private async considerPatternStorage(actionId: string, impactScore: number, measurement: any): Promise<void> {
    // Stocker pattern si impact positif significatif
    if (impactScore >= FEEDBACK_CONFIG.thresholds.criticalPositive) {
      const patternName = `success_${measurement.agent_id}_${Date.now()}`;
      
      await this.storeLearnedPattern(
        measurement.agent_id,
        measurement.squad_id,
        patternName,
        'success',
        { measurementType: measurement.measurement_type, baselineKpis: measurement.kpis_baseline },
        { actionId, impactScore },
        'High positive impact action',
      );
    }
  }

  private async sendEscalationNotifications(escalation: any, level: string): Promise<string[]> {
    const sent: string[] = [];

    // Email notification
    try {
      // TODO: Implement email sending
      sent.push('email');
    } catch (e) {
      this.logger.error(`Failed to send email notification: ${e.message}`);
    }

    // Slack notification
    try {
      const webhook = process.env[FEEDBACK_CONFIG.notifications.slackWebhookEnv];
      if (webhook) {
        // TODO: Implement Slack webhook
        sent.push('slack');
      }
    } catch (e) {
      this.logger.error(`Failed to send Slack notification: ${e.message}`);
    }

    return sent;
  }

  private async sendHumanCeoNotification(escalation: any, email: string): Promise<void> {
    // TODO: Implement direct CEO notification
    this.logger.log(`📧 Would send notification to ${email} for escalation ${escalation.id}`);
  }

  private async scheduleValidationReminders(validationId: string, deadline: Date): Promise<void> {
    const reminderTime = new Date(deadline.getTime() - FEEDBACK_CONFIG.escalation.reminderHours * 60 * 60 * 1000);
    
    await this.feedbackQueue.add('validation-reminder', { validationId }, {
      delay: Math.max(0, reminderTime.getTime() - Date.now()),
    });
  }

  private async executeApprovedAction(validationId: string, conditions?: Record<string, any>): Promise<void> {
    this.logger.log(`✅ Executing approved action for validation ${validationId}`);
    
    this.eventEmitter.emit('ai-cos:validation.approved', {
      validationId,
      conditions,
    });
  }

  private async escalateToBoard(validation: any): Promise<void> {
    this.logger.warn(`🚨 Escalating to Board: CEO did not respond to ${validation.id}`);
    
    await this.escalateToIACeo({
      actionContext: {
        actionId: validation.action_id,
        agentId: validation.agent_id,
        agentName: 'Unknown',
        squadId: validation.squad_id,
        actionType: validation.action_type,
        actionDescription: validation.action_description,
        riskScore: validation.risk_score,
        budgetImpact: validation.budget_impact,
      },
      escalationReason: `CEO n'a pas répondu dans les délais. Escalade automatique au Board.`,
      escalationSource: 'CIRCUIT-BREAKER',
      urgencyLevel: 'CRITICAL',
    });
  }

  private mapToImpactMeasurement(data: any): ImpactMeasurement {
    return {
      id: data.id,
      actionId: data.action_id,
      measurementType: data.measurement_type,
      kpisBaseline: data.kpis_baseline,
      kpisCurrent: data.kpis_current,
      kpisDelta: data.kpis_delta,
      kpisDeltaPercent: data.kpis_delta_percent,
      impactScore: data.impact_score,
      impactCategory: data.impact_category,
      isPositive: data.is_positive,
      thresholdBreached: data.threshold_breached,
      autoActionTriggered: data.auto_action_triggered,
    };
  }
}
