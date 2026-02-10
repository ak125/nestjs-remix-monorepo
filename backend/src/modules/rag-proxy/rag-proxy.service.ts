import { Injectable, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ExternalServiceException } from '../../common/exceptions';
import { ConfigService } from '@nestjs/config';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';
import { SearchRequestDto, SearchResponseDto } from './dto/search.dto';
import { getErrorMessage } from '../../common/utils/error.utils';

@Injectable()
export class RagProxyService {
  private readonly logger = new Logger(RagProxyService.name);
  private readonly ragUrl: string;
  private readonly ragApiKey: string;

  constructor(private readonly configService: ConfigService) {
    // URL externe obligatoire - le RAG est sur un serveur SÉPARÉ (pas Docker local)
    this.ragUrl = this.configService.getOrThrow<string>('RAG_SERVICE_URL');
    this.ragApiKey = this.configService.getOrThrow<string>('RAG_API_KEY');

    this.logger.log(`RAG Service URL: ${this.ragUrl}`);
  }

  /**
   * Forward chat request to RAG service.
   */
  async chat(request: ChatRequestDto): Promise<ChatResponseDto> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.ragUrl}/chat/v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          message: request.message,
          session_id: request.sessionId,
          locale: 'fr',
          vehicle_context: request.context || null,
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

      const duration = Date.now() - startTime;
      this.logger.log(
        `RAG chat: ${duration}ms | guardrails=${data.passed_guardrails} | type=${data.query_type} | confidence=${data.truth_metadata?.composite_confidence}`,
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
        confidence: data.truth_metadata?.composite_confidence ?? 0,
        citations: data.citations || [],
        queryType: data.query_type || null,
        passedGuardrails: data.passed_guardrails ?? false,
        refusalReason: data.refusal_reason || null,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

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

  private sseWrite(res: Response, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Forward search request to RAG service.
   */
  async search(request: SearchRequestDto): Promise<SearchResponseDto> {
    try {
      const response = await fetch(`${this.ragUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          query: request.query,
          limit: request.limit || 10,
          filters: request.filters,
        }),
      });

      if (!response.ok) {
        throw new ExternalServiceException({
          message: 'RAG search error',
          serviceName: 'rag',
        });
      }

      const data = await response.json();

      return {
        results: data.results || [],
        query: data.query,
        total: data.total || 0,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(`Failed to call RAG search: ${getErrorMessage(error)}`);
      throw new ExternalServiceException({
        message: 'Failed to connect to RAG service',
        serviceName: 'rag',
      });
    }
  }

  /**
   * Check RAG service health.
   */
  async health(): Promise<{
    status: string;
    services: Record<string, unknown>;
  }> {
    try {
      const response = await fetch(`${this.ragUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          status: 'unhealthy',
          services: {
            rag: { status: 'down', error: `HTTP ${response.status}` },
          },
        };
      }

      const result = await response.json();

      // Enrich with corpus stats
      try {
        const statsResp = await fetch(`${this.ragUrl}/api/knowledge/stats`, {
          headers: { 'X-API-Key': this.ragApiKey },
        });
        if (statsResp.ok) {
          const stats = await statsResp.json();
          result.services = result.services || {};
          result.services.corpus = {
            total_documents: stats.total_documents,
            by_truth_level: stats.by_truth_level,
          };
        }
      } catch {
        /* stats non-critical */
      }

      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        services: { rag: { status: 'down', error: getErrorMessage(error) } },
      };
    }
  }
}
