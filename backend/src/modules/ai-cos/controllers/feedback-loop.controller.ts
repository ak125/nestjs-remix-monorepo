/**
 * AI-COS v2.30.0: Feedback Loop API Controller
 * 
 * Endpoints pour la gestion des boucles de feedback:
 * - Mesure d'impact
 * - Escalades CEO
 * - Validations Human CEO
 * - Patterns appris
 * - Confiance agents
 * 
 * @module FeedbackLoopController
 * @version 2.30.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { FeedbackLoopService, ActionContext, EscalationContext } from '../services/feedback-loop.service';
import {
  ActionImpactMeasurementSaga,
  CeoEscalationValidationSaga,
  AgentSelfAdjustmentSaga,
} from '../sagas/feedback-loop.sagas';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

// ============================================
// DTOs
// ============================================

export class MeasureImpactDto {
  actionId: string;
  measurementType: '1h' | '4h' | '24h' | '7d' | '30d';
}

export class ScheduleMeasurementsDto {
  actionId: string;
  actionContext: ActionContext;
  kpisBaseline: Record<string, number>;
}

export class EscalateDto {
  actionContext: ActionContext;
  escalationReason: string;
  projectedKpis?: Record<string, number>;
  potentialRisks?: string[];
  urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class RequestValidationDto {
  escalationId: string;
  humanCeoEmail: string;
  deadlineHours?: number;
}

export class CeoDecisionDto {
  decision: 'APPROVED' | 'REJECTED' | 'DEFERRED' | 'MODIFIED';
  reasoning: string;
  conditions?: Record<string, any>;
}

export class RecordLearningDto {
  actionContext: ActionContext;
  kpisBefore: Record<string, number>;
  kpisAfter?: Record<string, number>;
  outcome: 'success' | 'failure' | 'neutral' | 'pending' | 'rollback';
  humanFeedback?: string;
  humanFeedbackReason?: string;
  patternName?: string;
}

export class StorePatternDto {
  agentId: string;
  squadId: string;
  patternName: string;
  patternType: 'success' | 'failure' | 'optimization' | 'risk_mitigation';
  triggerConditions: Record<string, any>;
  actionTemplate: Record<string, any>;
  expectedOutcome: string;
}

export class TriggerAdjustmentDto {
  agentId: string;
  agentName: string;
  squadId: string;
}

// ============================================
// Controller
// ============================================

@ApiTags('AI-COS Feedback Loop')
@ApiBearerAuth()
@Controller('api/ai-cos/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackLoopController {
  private readonly logger = new Logger(FeedbackLoopController.name);

  constructor(
    private readonly feedbackLoop: FeedbackLoopService,
    private readonly impactSaga: ActionImpactMeasurementSaga,
    private readonly ceoSaga: CeoEscalationValidationSaga,
    private readonly adjustmentSaga: AgentSelfAdjustmentSaga,
  ) {}

  // ============================================
  // Impact Measurement Endpoints
  // ============================================

  @Post('actions/:actionId/schedule-measurements')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Programme les mesures d\'impact pour une action' })
  @ApiParam({ name: 'actionId', description: 'ID de l\'action' })
  @ApiResponse({ status: 201, description: 'Mesures programmées' })
  async scheduleMeasurements(
    @Param('actionId') actionId: string,
    @Body() dto: ScheduleMeasurementsDto,
  ) {
    this.logger.log(`Scheduling measurements for action ${actionId}`);

    const saga = await this.impactSaga.execute(actionId, dto.actionContext, dto.kpisBaseline);

    return {
      success: true,
      message: 'Mesures d\'impact programmées',
      sagaId: saga.id,
      measurements: ['1h', '4h', '24h', '7d', '30d'],
    };
  }

  @Post('actions/:actionId/measure-impact')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Déclenche une mesure d\'impact immédiate' })
  @ApiParam({ name: 'actionId', description: 'ID de l\'action' })
  @ApiResponse({ status: 200, description: 'Mesure effectuée' })
  async measureImpact(
    @Param('actionId') actionId: string,
    @Body() dto: MeasureImpactDto,
  ) {
    this.logger.log(`Measuring ${dto.measurementType} impact for action ${actionId}`);

    try {
      const result = await this.feedbackLoop.measureImpact(actionId, dto.measurementType);
      return {
        success: true,
        measurement: result,
      };
    } catch (error) {
      throw new BadRequestException(`Impossible de mesurer l'impact: ${error.message}`);
    }
  }

  @Get('actions/:actionId/impact-history')
  @Roles('admin', 'ai-cos', 'ceo')
  @ApiOperation({ summary: 'Récupère l\'historique des mesures d\'impact' })
  @ApiParam({ name: 'actionId', description: 'ID de l\'action' })
  @ApiResponse({ status: 200, description: 'Historique des mesures' })
  async getImpactHistory(@Param('actionId') actionId: string) {
    const history = await this.feedbackLoop.getImpactHistory(actionId);
    return {
      actionId,
      measurements: history,
      count: history.length,
    };
  }

  // ============================================
  // Escalation Endpoints
  // ============================================

  @Post('escalate/ceo')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Escalade une action vers IA-CEO' })
  @ApiResponse({ status: 201, description: 'Escalade créée' })
  async escalateToCeo(@Body() dto: EscalateDto) {
    this.logger.log(`Escalating to CEO: ${dto.escalationReason}`);

    const context: EscalationContext = {
      actionContext: dto.actionContext,
      escalationReason: dto.escalationReason,
      escalationSource: 'META-AGENT',
      projectedKpis: dto.projectedKpis,
      potentialRisks: dto.potentialRisks,
      urgencyLevel: dto.urgencyLevel,
    };

    const result = await this.feedbackLoop.escalateToIACeo(context);

    return {
      success: true,
      escalation: result,
      message: `Escaladé au ${result.escalationLevel}`,
    };
  }

  @Post('escalate/human-ceo')
  @Roles('admin', 'ai-cos', 'ia-ceo')
  @ApiOperation({ summary: 'Demande validation au Human CEO' })
  @ApiResponse({ status: 201, description: 'Demande de validation créée' })
  async requestHumanCeoValidation(@Body() dto: RequestValidationDto) {
    this.logger.log(`Requesting Human CEO validation for ${dto.escalationId}`);

    const deadlineHours = dto.deadlineHours ?? 48;
    const deadline = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

    const result = await this.feedbackLoop.requestHumanCeoValidation(
      dto.escalationId,
      dto.humanCeoEmail,
      deadline,
    );

    return {
      success: true,
      validation: result,
      message: `Validation demandée à ${dto.humanCeoEmail}`,
    };
  }

  // ============================================
  // CEO Validation Endpoints
  // ============================================

  @Get('ceo/pending-validations')
  @Roles('admin', 'ceo')
  @ApiOperation({ summary: 'Liste les validations en attente pour le CEO' })
  @ApiQuery({ name: 'email', required: false, description: 'Filtrer par email CEO' })
  @ApiResponse({ status: 200, description: 'Liste des validations en attente' })
  async getPendingValidations(@Query('email') email?: string) {
    const validations = await this.feedbackLoop.getPendingValidations(email);
    
    return {
      pending: validations,
      count: validations.length,
      urgentCount: validations.filter((v: any) => v.urgency === 'URGENT' || v.urgency === 'HIGH').length,
    };
  }

  @Get('ceo/validations/:id')
  @Roles('admin', 'ceo')
  @ApiOperation({ summary: 'Détails d\'une validation' })
  @ApiParam({ name: 'id', description: 'ID de la validation' })
  @ApiResponse({ status: 200, description: 'Détails de la validation' })
  async getValidationDetails(@Param('id') id: string) {
    const validations = await this.feedbackLoop.getPendingValidations();
    const validation = validations.find((v: any) => v.id === id);

    if (!validation) {
      throw new NotFoundException(`Validation ${id} non trouvée`);
    }

    return { validation };
  }

  @Put('ceo/validations/:id/decision')
  @Roles('admin', 'ceo')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enregistre la décision du CEO' })
  @ApiParam({ name: 'id', description: 'ID de la validation' })
  @ApiResponse({ status: 200, description: 'Décision enregistrée' })
  async recordCeoDecision(
    @Param('id') validationId: string,
    @Body() dto: CeoDecisionDto,
    @CurrentUser() user: any,
  ) {
    this.logger.log(`Recording CEO decision for ${validationId}: ${dto.decision}`);

    await this.feedbackLoop.recordCeoDecision(
      validationId,
      dto.decision,
      dto.reasoning,
      dto.conditions,
      user?.id,
    );

    return {
      success: true,
      message: `Décision ${dto.decision} enregistrée`,
      validationId,
      decision: dto.decision,
    };
  }

  // ============================================
  // Learning Endpoints
  // ============================================

  @Post('learning/record')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Enregistre un événement d\'apprentissage' })
  @ApiResponse({ status: 201, description: 'Événement enregistré' })
  async recordLearningEvent(@Body() dto: RecordLearningDto) {
    this.logger.log(`Recording learning event for ${dto.actionContext.agentId}`);

    const event = await this.feedbackLoop.recordLearningEvent(dto);

    return {
      success: true,
      learningEvent: event,
    };
  }

  @Get('learning/patterns')
  @Roles('admin', 'ai-cos', 'ceo')
  @ApiOperation({ summary: 'Liste les patterns appris' })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'squadId', required: false })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Liste des patterns' })
  async getLearnedPatterns(
    @Query('agentId') agentId?: string,
    @Query('squadId') squadId?: string,
    @Query('activeOnly') activeOnly?: boolean,
  ) {
    const patterns = await this.feedbackLoop.getLearnedPatterns(
      agentId,
      squadId,
      activeOnly !== false,
    );

    return {
      patterns,
      count: patterns.length,
    };
  }

  @Post('learning/patterns')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Stocke un nouveau pattern appris' })
  @ApiResponse({ status: 201, description: 'Pattern stocké' })
  async storePattern(@Body() dto: StorePatternDto) {
    this.logger.log(`Storing pattern: ${dto.patternName}`);

    const pattern = await this.feedbackLoop.storeLearnedPattern(
      dto.agentId,
      dto.squadId,
      dto.patternName,
      dto.patternType,
      dto.triggerConditions,
      dto.actionTemplate,
      dto.expectedOutcome,
    );

    return {
      success: true,
      pattern,
    };
  }

  @Get('learning/similar-patterns')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Recherche des patterns similaires' })
  @ApiResponse({ status: 200, description: 'Patterns similaires' })
  async findSimilarPatterns(@Body() context: ActionContext) {
    const patterns = await this.feedbackLoop.findSimilarPatterns(context);

    return {
      patterns,
      count: patterns.length,
    };
  }

  // ============================================
  // Agent Confidence Endpoints
  // ============================================

  @Get('agents/:agentId/confidence')
  @Roles('admin', 'ai-cos', 'ceo')
  @ApiOperation({ summary: 'Récupère la confiance actuelle d\'un agent' })
  @ApiParam({ name: 'agentId', description: 'ID de l\'agent' })
  @ApiResponse({ status: 200, description: 'Confiance de l\'agent' })
  async getAgentConfidence(@Param('agentId') agentId: string) {
    const confidence = await this.feedbackLoop.getAgentConfidence(agentId);

    if (!confidence) {
      return {
        agentId,
        confidenceScore: 50,
        autonomyLevel: 'standard',
        message: 'Agent sans historique, valeurs par défaut',
      };
    }

    return { confidence };
  }

  @Post('agents/:agentId/trigger-adjustment')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Déclenche un auto-ajustement de l\'agent' })
  @ApiParam({ name: 'agentId', description: 'ID de l\'agent' })
  @ApiResponse({ status: 200, description: 'Ajustement déclenché' })
  async triggerAgentAdjustment(
    @Param('agentId') agentId: string,
    @Body() dto: TriggerAdjustmentDto,
  ) {
    this.logger.log(`Triggering self-adjustment for agent ${agentId}`);

    const saga = await this.adjustmentSaga.execute(
      dto.agentId,
      dto.agentName,
      dto.squadId,
    );

    return {
      success: true,
      sagaId: saga.id,
      status: saga.status,
      context: saga.context,
    };
  }

  // ============================================
  // Dashboard Endpoints
  // ============================================

  @Get('dashboard/summary')
  @Roles('admin', 'ai-cos', 'ceo')
  @ApiOperation({ summary: 'Résumé du dashboard feedback loop' })
  @ApiResponse({ status: 200, description: 'Résumé du dashboard' })
  async getDashboardSummary() {
    const pendingValidations = await this.feedbackLoop.getPendingValidations();
    const patterns = await this.feedbackLoop.getLearnedPatterns(undefined, undefined, true);

    return {
      pendingValidations: {
        total: pendingValidations.length,
        urgent: pendingValidations.filter((v: any) => v.urgency === 'URGENT').length,
        high: pendingValidations.filter((v: any) => v.urgency === 'HIGH').length,
        normal: pendingValidations.filter((v: any) => v.urgency === 'NORMAL').length,
      },
      learnedPatterns: {
        total: patterns.length,
        successPatterns: patterns.filter(p => p.patternType === 'success').length,
        avgSuccessRate: patterns.length > 0 
          ? patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length 
          : 0,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  @Get('dashboard/agent-performance')
  @Roles('admin', 'ai-cos', 'ceo')
  @ApiOperation({ summary: 'Performance des agents' })
  @ApiQuery({ name: 'squadId', required: false })
  @ApiResponse({ status: 200, description: 'Performance des agents' })
  async getAgentPerformance(@Query('squadId') squadId?: string) {
    // Cette méthode utiliserait la vue v_agent_performance_summary
    // Pour l'instant, retourne une structure exemple
    return {
      message: 'Endpoint à compléter avec données réelles',
      squadId,
    };
  }

  // ============================================
  // SAGA Status Endpoints
  // ============================================

  @Get('sagas/:sagaId/status')
  @Roles('admin', 'ai-cos')
  @ApiOperation({ summary: 'Statut d\'une SAGA' })
  @ApiParam({ name: 'sagaId', description: 'ID de la SAGA' })
  @ApiResponse({ status: 200, description: 'Statut de la SAGA' })
  async getSagaStatus(@Param('sagaId') sagaId: string) {
    // Implémenter la récupération du statut de la SAGA
    return {
      sagaId,
      message: 'SAGA status endpoint - à compléter',
    };
  }
}
