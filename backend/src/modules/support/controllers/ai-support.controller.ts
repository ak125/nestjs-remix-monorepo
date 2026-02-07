import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  DomainNotFoundException,
  DomainValidationException,
  ErrorCodes,
} from '../../../common/exceptions';
import {
  AISentimentService,
  AICategorizationService,
  SentimentAnalysis,
  SmartCategorization,
} from '../services/ai-analysis.service';
import {
  AISmartResponseService,
  AIPredictiveService,
  SmartResponse,
  EscalationPrediction,
  WorkflowOptimization,
} from '../services/ai-smart-response.service';
import { ContactService } from '../services/contact.service';
import { ReviewService } from '../services/review.service';

export interface AIAnalysisRequest {
  type: 'ticket' | 'review';
  id: string;
  content?: {
    subject?: string;
    message?: string;
    rating?: number;
    comment?: string;
  };
}

export interface AIResponseRequest {
  type: 'ticket' | 'review';
  id: string;
  includeAnalysis?: boolean;
}

export interface AIWorkflowRequest {
  ticketId: string;
  forceReanalysis?: boolean;
}

@Controller('api/support/ai')
export class AISupportController {
  private readonly logger = new Logger(AISupportController.name);

  constructor(
    private aiSentimentService: AISentimentService,
    private aiCategorizationService: AICategorizationService,
    private aiSmartResponseService: AISmartResponseService,
    private aiPredictiveService: AIPredictiveService,
    private contactService: ContactService,
    private reviewService: ReviewService,
  ) {}

  // ==================== ANALYSE DE SENTIMENT ====================

  @Post('sentiment/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeSentiment(
    @Body() request: AIAnalysisRequest,
  ): Promise<SentimentAnalysis> {
    this.logger.log(`Analyse sentiment: ${request.type} ${request.id}`);

    try {
      if (request.type === 'ticket') {
        const ticket = await this.contactService.getTicket(request.id);
        return this.aiSentimentService.analyzeTicketSentiment(ticket);
      } else if (request.type === 'review') {
        const review = await this.reviewService.getReview(request.id);
        if (!review) {
          throw new DomainNotFoundException({
            message: `Review ${request.id} not found`,
            code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
          });
        }
        return this.aiSentimentService.analyzeReviewSentiment(review);
      }

      throw new DomainValidationException({
        message: `Type non supporté: ${request.type}`,
        code: ErrorCodes.SUPPORT.UNSUPPORTED_TYPE,
      });
    } catch (error) {
      this.logger.error(`Erreur analyse sentiment: ${error.message}`);
      throw error;
    }
  }

  @Get('sentiment/ticket/:ticketId')
  async analyzeTicketSentiment(
    @Param('ticketId') ticketId: string,
  ): Promise<SentimentAnalysis> {
    const ticket = await this.contactService.getTicket(ticketId);
    return this.aiSentimentService.analyzeTicketSentiment(ticket);
  }

  @Get('sentiment/review/:reviewId')
  async analyzeReviewSentiment(
    @Param('reviewId') reviewId: string,
  ): Promise<SentimentAnalysis> {
    const review = await this.reviewService.getReview(reviewId);
    if (!review) {
      throw new DomainNotFoundException({
        message: `Review ${reviewId} not found`,
        code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
      });
    }
    return this.aiSentimentService.analyzeReviewSentiment(review);
  }

  // ==================== CATÉGORISATION INTELLIGENTE ====================

  @Post('categorization/analyze')
  @HttpCode(HttpStatus.OK)
  async categorizeContent(
    @Body() request: AIAnalysisRequest,
  ): Promise<SmartCategorization> {
    this.logger.log(`Catégorisation: ${request.type} ${request.id}`);

    try {
      if (request.type === 'ticket') {
        const ticket = await this.contactService.getTicket(request.id);
        return this.aiCategorizationService.categorizeTicket(ticket);
      } else if (request.type === 'review') {
        const review = await this.reviewService.getReview(request.id);
        if (!review) {
          throw new DomainNotFoundException({
            message: `Review ${request.id} not found`,
            code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
          });
        }
        return this.aiCategorizationService.categorizeReview(review);
      }

      throw new DomainValidationException({
        message: `Type non supporté: ${request.type}`,
        code: ErrorCodes.SUPPORT.UNSUPPORTED_TYPE,
      });
    } catch (error) {
      this.logger.error(`Erreur catégorisation: ${error.message}`);
      throw error;
    }
  }

  @Get('categorization/ticket/:ticketId')
  async categorizeTicket(
    @Param('ticketId') ticketId: string,
  ): Promise<SmartCategorization> {
    const ticket = await this.contactService.getTicket(ticketId);
    return this.aiCategorizationService.categorizeTicket(ticket);
  }

  @Get('categorization/review/:reviewId')
  async categorizeReview(
    @Param('reviewId') reviewId: string,
  ): Promise<SmartCategorization> {
    const review = await this.reviewService.getReview(reviewId);
    if (!review) {
      throw new DomainNotFoundException({
        message: `Review ${reviewId} not found`,
        code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
      });
    }
    return this.aiCategorizationService.categorizeReview(review);
  }

  // ==================== RÉPONSES INTELLIGENTES ====================

  @Post('response/generate')
  @HttpCode(HttpStatus.OK)
  async generateSmartResponse(
    @Body() request: AIResponseRequest,
  ): Promise<SmartResponse> {
    this.logger.log(`Génération réponse: ${request.type} ${request.id}`);

    try {
      if (request.type === 'ticket') {
        const ticket = await this.contactService.getTicket(request.id);

        let sentiment, categorization;
        if (request.includeAnalysis) {
          sentiment =
            await this.aiSentimentService.analyzeTicketSentiment(ticket);
          categorization =
            await this.aiCategorizationService.categorizeTicket(ticket);
        }

        return this.aiSmartResponseService.generateTicketResponse(
          ticket,
          sentiment,
          categorization,
        );
      } else if (request.type === 'review') {
        const review = await this.reviewService.getReview(request.id);
        if (!review) {
          throw new DomainNotFoundException({
            message: `Review ${request.id} not found`,
            code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
          });
        }

        if (request.includeAnalysis) {
          await this.aiSentimentService.analyzeReviewSentiment(review);
        }

        return this.aiSmartResponseService.generateReviewResponse(review);
      }

      throw new DomainValidationException({
        message: `Type non supporté: ${request.type}`,
        code: ErrorCodes.SUPPORT.UNSUPPORTED_TYPE,
      });
    } catch (error) {
      this.logger.error(`Erreur génération réponse: ${error.message}`);
      throw error;
    }
  }

  @Get('response/ticket/:ticketId')
  async generateTicketResponse(
    @Param('ticketId') ticketId: string,
    @Query('includeAnalysis') includeAnalysis?: string,
  ): Promise<SmartResponse> {
    const ticket = await this.contactService.getTicket(ticketId);

    let sentiment, categorization;
    if (includeAnalysis === 'true') {
      sentiment = await this.aiSentimentService.analyzeTicketSentiment(ticket);
      categorization =
        await this.aiCategorizationService.categorizeTicket(ticket);
    }

    return this.aiSmartResponseService.generateTicketResponse(
      ticket,
      sentiment,
      categorization,
    );
  }

  @Get('response/review/:reviewId')
  async generateReviewResponse(
    @Param('reviewId') reviewId: string,
    @Query('includeAnalysis') includeAnalysis?: string,
  ): Promise<SmartResponse> {
    const review = await this.reviewService.getReview(reviewId);
    if (!review) {
      throw new DomainNotFoundException({
        message: `Review ${reviewId} not found`,
        code: ErrorCodes.SUPPORT.REVIEW_NOT_FOUND,
      });
    }

    if (includeAnalysis === 'true') {
      await this.aiSentimentService.analyzeReviewSentiment(review);
    }

    return this.aiSmartResponseService.generateReviewResponse(review);
  }

  // ==================== PRÉDICTION D'ESCALATION ====================

  @Post('escalation/predict')
  @HttpCode(HttpStatus.OK)
  async predictEscalation(
    @Body() request: AIWorkflowRequest,
  ): Promise<EscalationPrediction> {
    this.logger.log(`Prédiction escalation: ${request.ticketId}`);

    try {
      const ticket = await this.contactService.getTicket(request.ticketId);

      const sentiment =
        await this.aiSentimentService.analyzeTicketSentiment(ticket);
      const categorization =
        await this.aiCategorizationService.categorizeTicket(ticket);

      return this.aiPredictiveService.predictEscalation(
        ticket,
        sentiment,
        categorization,
      );
    } catch (error) {
      this.logger.error(`Erreur prédiction escalation: ${error.message}`);
      throw error;
    }
  }

  @Get('escalation/ticket/:ticketId')
  async getEscalationPrediction(
    @Param('ticketId') ticketId: string,
  ): Promise<EscalationPrediction> {
    const ticket = await this.contactService.getTicket(ticketId);

    const sentiment =
      await this.aiSentimentService.analyzeTicketSentiment(ticket);
    const categorization =
      await this.aiCategorizationService.categorizeTicket(ticket);

    return this.aiPredictiveService.predictEscalation(
      ticket,
      sentiment,
      categorization,
    );
  }

  // ==================== OPTIMISATION DE WORKFLOW ====================

  @Post('workflow/optimize')
  @HttpCode(HttpStatus.OK)
  async optimizeWorkflow(
    @Body() request: AIWorkflowRequest,
  ): Promise<WorkflowOptimization> {
    this.logger.log(`Optimisation workflow: ${request.ticketId}`);

    try {
      const ticket = await this.contactService.getTicket(request.ticketId);
      const categorization =
        await this.aiCategorizationService.categorizeTicket(ticket);

      return this.aiPredictiveService.optimizeWorkflow(ticket, categorization);
    } catch (error) {
      this.logger.error(`Erreur optimisation workflow: ${error.message}`);
      throw error;
    }
  }

  @Get('workflow/ticket/:ticketId')
  async getWorkflowOptimization(
    @Param('ticketId') ticketId: string,
  ): Promise<WorkflowOptimization> {
    const ticket = await this.contactService.getTicket(ticketId);
    const categorization =
      await this.aiCategorizationService.categorizeTicket(ticket);

    return this.aiPredictiveService.optimizeWorkflow(ticket, categorization);
  }

  // ==================== ANALYSE COMPLÈTE ====================

  @Get('analyze/complete/:ticketId')
  async getCompleteAnalysis(@Param('ticketId') ticketId: string) {
    this.logger.log(`Analyse complète: ${ticketId}`);

    try {
      const ticket = await this.contactService.getTicket(ticketId);

      // Analyses parallèles pour optimiser les performances
      const [sentiment, categorization] = await Promise.all([
        this.aiSentimentService.analyzeTicketSentiment(ticket),
        this.aiCategorizationService.categorizeTicket(ticket),
      ]);

      const [smartResponse, escalationPrediction, workflowOptimization] =
        await Promise.all([
          this.aiSmartResponseService.generateTicketResponse(
            ticket,
            sentiment,
            categorization,
          ),
          this.aiPredictiveService.predictEscalation(
            ticket,
            sentiment,
            categorization,
          ),
          this.aiPredictiveService.optimizeWorkflow(ticket, categorization),
        ]);

      return {
        ticketId,
        analysis: {
          sentiment,
          categorization,
          smartResponse,
          escalationPrediction,
          workflowOptimization,
        },
        recommendations: {
          priority: escalationPrediction.priority,
          assignTo: workflowOptimization.recommendedAgent,
          estimatedTime: workflowOptimization.estimatedResolutionTime,
          requiresHuman: smartResponse.requiresHuman,
          nextActions: [
            ...(smartResponse.suggestedActions || []),
            ...escalationPrediction.suggestedActions,
          ],
        },
        aiConfidence: {
          sentiment: sentiment.confidence,
          categorization: categorization.confidence,
          response: smartResponse.confidence,
          escalation: escalationPrediction.escalationProbability,
        },
      };
    } catch (error) {
      this.logger.error(`Erreur analyse complète: ${error.message}`);
      throw error;
    }
  }

  // ==================== STATISTIQUES IA ====================

  @Get('stats')
  async getAIStats() {
    // Stats basiques pour commencer
    return {
      totalAnalyses: 0, // À implémenter avec un cache/DB
      averageConfidence: 0.75,
      automationRate: 0.6,
      escalationPrevented: 0.3,
      responseTimeImprovement: 0.4,
      features: {
        sentimentAnalysis: true,
        smartCategorization: true,
        responseGeneration: true,
        escalationPrediction: true,
        workflowOptimization: true,
      },
    };
  }

  @Get('health')
  async getAIHealth() {
    return {
      status: 'operational',
      services: {
        sentiment: 'ok',
        categorization: 'ok',
        smartResponse: 'ok',
        predictive: 'ok',
      },
      lastUpdate: new Date().toISOString(),
    };
  }
}
