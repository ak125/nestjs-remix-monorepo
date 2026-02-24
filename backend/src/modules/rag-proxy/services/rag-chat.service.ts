import {
  Injectable,
  HttpException,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, ChatResponseDto } from '../dto/chat.dto';
import { ExternalServiceException } from '../../../common/exceptions';
import { getErrorMessage } from '../../../common/utils/error.utils';
import { RagCircuitBreakerService } from './rag-circuit-breaker.service';

@Injectable()
export class RagChatService implements OnModuleDestroy {
  private readonly logger = new Logger(RagChatService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;

  private readonly supportedUserIntents = [
    'define',
    'choose',
    'do',
    'maintain',
    'compare',
    'cost',
    'policy',
    'troubleshoot',
    'fitment',
  ] as const;

  private readonly intentStats = new Map<
    string,
    { count: number; confidenceSum: number; lastSeenAt: string }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreaker: RagCircuitBreakerService,
  ) {
    this.ragUrl = this.configService.getOrThrow<string>('RAG_SERVICE_URL');
    this.ragApiKey = this.configService.getOrThrow<string>('RAG_API_KEY');
  }

  onModuleDestroy() {
    this.intentStats.clear();
    this.logger.log('RagChatService destroyed, intent stats cleared');
  }

  /**
   * Forward chat request to RAG service.
   */
  async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
    this.circuitBreaker.cbGuard();
    const startTime = Date.now();
    try {
      const existingRouting = this.extractRoutingFromContext(request.context);
      const routing = existingRouting || this.classifyIntent(request.message);
      const vehicleContext = {
        ...(request.context || {}),
        intent_routing: routing,
      };

      // Etage 1+2: filtres retrieval selon intent
      const retrievalFilters = this.buildRetrievalFilters(routing.userIntent);

      const response = await fetch(`${this.ragUrl}/chat/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RAG-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          message: request.message,
          session_id: request.sessionId,
          locale: 'fr',
          vehicle_context: vehicleContext,
          filters: retrievalFilters,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `RAG service error: ${response.status} - ${errorText}`,
        );
        throw new ExternalServiceException({
          message: 'RAG service error',
          serviceName: 'rag',
        });
      }

      const data = await response.json();

      this.circuitBreaker.cbSuccess();
      const duration = Date.now() - startTime;
      const confidence = data.truth_metadata?.composite_confidence ?? 0;
      this.recordIntentMetric(routing.userIntent, confidence);
      this.logger.log(
        `RAG chat: ${duration}ms | user_intent=${routing.userIntent} | family=${routing.intentFamily} | guardrails=${data.passed_guardrails} | type=${data.query_type} | confidence=${data.truth_metadata?.composite_confidence}`,
      );
      if (duration > 3000) {
        this.logger.warn(
          `RAG response slow: ${duration}ms (threshold: 3000ms)`,
        );
      }

      return {
        answer: data.response || '',
        sources: data.sources || [],
        sessionId: data.session_id,
        confidence,
        citations: data.citations || [],
        queryType: data.query_type || null,
        passedGuardrails: data.passed_guardrails ?? false,
        refusalReason: data.refusal_reason || null,
        responseMode:
          (data.response_mode as 'answer' | 'partial' | 'clarify') ||
          (data.clarify_questions?.length ? 'clarify' : 'answer'),
        needsClarification:
          Boolean(data.needs_clarification) ||
          Boolean(data.truth_metadata?.needs_clarification) ||
          (Array.isArray(data.clarify_questions) &&
            data.clarify_questions.length > 0),
        clarifyQuestions: Array.isArray(data.clarify_questions)
          ? data.clarify_questions.slice(0, 2)
          : [],
        sourcesCitation:
          typeof data.sources_citation === 'string'
            ? data.sources_citation
            : '',
        truthMetadata:
          data.truth_metadata && typeof data.truth_metadata === 'object'
            ? data.truth_metadata
            : {},
      };
    } catch (error) {
      if (error instanceof HttpException) {
        // Circuit-open exceptions are HttpExceptions — don't count them again
        if (
          !(
            error instanceof ExternalServiceException &&
            error.code === 'EXTERNAL.CIRCUIT_OPEN'
          )
        ) {
          this.circuitBreaker.cbFailure();
        }
        throw error;
      }

      this.circuitBreaker.cbFailure();
      this.logger.error(
        `Failed to call RAG service: ${getErrorMessage(error)}`,
      );
      throw new ExternalServiceException({
        message: 'Failed to connect to RAG service',
        serviceName: 'rag',
      });
    }
  }

  /**
   * Stream chat response via SSE.
   * Calls /chat/v2 (blocking), then emits the response progressively.
   */
  async chatStream(request: ChatRequestDto, res: Response): Promise<void> {
    try {
      const chatResponse = await this.chat(request);

      // Metadata first (immediate)
      this.sseWrite(res, 'metadata', {
        sessionId: chatResponse.sessionId,
        queryType: chatResponse.queryType,
        confidence: chatResponse.confidence,
        responseMode: chatResponse.responseMode || 'answer',
        needsClarification: chatResponse.needsClarification || false,
        clarifyQuestions: chatResponse.clarifyQuestions || [],
        sourcesCitation: chatResponse.sourcesCitation || '',
        truthMetadata: chatResponse.truthMetadata || {},
      });

      // Stream answer word-by-word
      const words = chatResponse.answer.split(/(\s+)/);
      for (const word of words) {
        if (word) {
          this.sseWrite(res, 'chunk', { text: word });
          await this.delay(30);
        }
      }

      // Sources after text
      if (chatResponse.sources?.length) {
        this.sseWrite(res, 'sources', { sources: chatResponse.sources });
      }

      // Done
      this.sseWrite(res, 'done', { confidence: chatResponse.confidence });
      res.end();
    } catch (error) {
      this.logger.error(`SSE stream error: ${getErrorMessage(error)}`);
      this.sseWrite(res, 'error', { message: 'Service indisponible' });
      res.end();
    }
  }

  getIntentStats(): {
    totalMessages: number;
    generatedAt: string;
    intents: Array<{
      userIntent: string;
      volume: number;
      averageConfidence: number;
      lastSeenAt: string | null;
    }>;
  } {
    const intents = this.supportedUserIntents.map((intent) => {
      const stat = this.intentStats.get(intent);
      if (!stat) {
        return {
          userIntent: intent,
          volume: 0,
          averageConfidence: 0,
          lastSeenAt: null,
        };
      }
      return {
        userIntent: intent,
        volume: stat.count,
        averageConfidence: stat.count > 0 ? stat.confidenceSum / stat.count : 0,
        lastSeenAt: stat.lastSeenAt,
      };
    });

    return {
      totalMessages: intents.reduce((sum, item) => sum + item.volume, 0),
      generatedAt: new Date().toISOString(),
      intents,
    };
  }

  private sseWrite(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractRoutingFromContext(
    context: ChatRequestDto['context'] | undefined,
  ): {
    userIntent: string;
    intentFamily: string;
    pageIntent: string;
  } | null {
    if (!context || typeof context !== 'object') {
      return null;
    }
    const routing = (context as Record<string, unknown>).intent_routing;
    if (!routing || typeof routing !== 'object') {
      return null;
    }
    const userIntent = (routing as Record<string, unknown>).userIntent;
    const intentFamily = (routing as Record<string, unknown>).intentFamily;
    const pageIntent = (routing as Record<string, unknown>).pageIntent;
    if (
      typeof userIntent !== 'string' ||
      typeof intentFamily !== 'string' ||
      typeof pageIntent !== 'string'
    ) {
      return null;
    }
    return { userIntent, intentFamily, pageIntent };
  }

  private classifyIntent(message: string): {
    userIntent: string;
    intentFamily: string;
    pageIntent: string;
  } {
    const text = message.trim().toLowerCase();
    const has = (patterns: RegExp[]) => patterns.some((p) => p.test(text));

    const map = (
      userIntent: string,
      intentFamily: string,
      pageIntent: string,
    ) => ({
      userIntent,
      intentFamily,
      pageIntent,
    });

    if (
      has([
        /\bcompatibilite\b/,
        /\bcompatible\b/,
        /\bvin\b/,
        /\bimmatriculation\b/,
        /\bmon vehicule\b/,
      ])
    ) {
      return map('fitment', 'catalog', 'selection');
    }

    if (
      has([
        /\bdiagnosti/,
        /\bpanne\b/,
        /\bsymptome\b/,
        /\bbruit\b/,
        /\bvibration\b/,
        /\bvoyant\b/,
        /\bne demarre pas\b/,
      ])
    ) {
      return map('troubleshoot', 'diagnostic', 'diagnosis');
    }

    if (
      has([
        /\blivraison\b/,
        /\bretour\b/,
        /\bgaranti/,
        /\brembourse/,
        /\bcgv\b/,
        /\bdelai\b/,
      ])
    ) {
      return map('policy', 'knowledge', 'support');
    }

    if (
      has([/\bprix\b/, /\bcout\b/, /\bcombien\b/, /\btarif\b/, /\bpromo\b/])
    ) {
      return map('cost', 'catalog', 'purchase');
    }

    if (
      has([
        /\bcompar/,
        /\bdifference\b/,
        /\bversus\b/,
        /\bvs\b/,
        /\bmeilleur\b/,
      ])
    ) {
      return map('compare', 'knowledge', 'education');
    }

    if (
      has([
        /\bentretien\b/,
        /\bmaintenance\b/,
        /\bintervalle\b/,
        /\bquand changer\b/,
        /\bfrequence\b/,
      ])
    ) {
      return map('maintain', 'knowledge', 'education');
    }

    if (
      has([
        /\bcomment faire\b/,
        /\bcomment remplacer\b/,
        /\btutoriel\b/,
        /\bhow to\b/,
        /\binstaller\b/,
        /\bmonter\b/,
      ])
    ) {
      return map('do', 'knowledge', 'education');
    }

    if (
      has([
        /\bc'?est quoi\b/,
        /\bdefinition\b/,
        /\bque signifie\b/,
        /\bveut dire\b/,
      ])
    ) {
      return map('define', 'knowledge', 'definition');
    }

    return map('choose', 'catalog', 'selection');
  }

  /**
   * Build retrieval filters based on user intent.
   * Etage 1: default L1+L2 only.
   * Etage 2: intent-based opening (troubleshoot->L3, policy->policy docs).
   */
  private buildRetrievalFilters(userIntent: string): Record<string, unknown> {
    const filters: Record<string, unknown> = {
      truth_levels: ['L1', 'L2'],
    };

    switch (userIntent) {
      case 'troubleshoot':
        filters.truth_levels = ['L1', 'L2', 'L3'];
        break;
      case 'policy':
        filters.include_categories = ['knowledge/policy', 'knowledge/faq'];
        break;
      case 'cost':
        filters.include_categories = ['knowledge/faq'];
        break;
    }

    return filters;
  }

  private recordIntentMetric(userIntent: string, confidence: number): void {
    const now = new Date().toISOString();
    const key = this.supportedUserIntents.includes(userIntent as never)
      ? userIntent
      : 'choose';
    const previous = this.intentStats.get(key) || {
      count: 0,
      confidenceSum: 0,
      lastSeenAt: now,
    };
    this.intentStats.set(key, {
      count: previous.count + 1,
      confidenceSum: previous.confidenceSum + confidence,
      lastSeenAt: now,
    });
  }
}
