import { Injectable, HttpException, Logger } from '@nestjs/common';
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
    try {
      const response = await fetch(`${this.ragUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.ragApiKey,
        },
        body: JSON.stringify({
          message: request.message,
          session_id: request.sessionId,
          context: request.context,
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

      return {
        answer: data.context || data.response || '',
        sources: data.sources || [],
        sessionId: data.session_id,
        confidence: data.truth_metadata?.composite_confidence ?? 0,
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

      return await response.json();
    } catch (error) {
      return {
        status: 'unhealthy',
        services: { rag: { status: 'down', error: getErrorMessage(error) } },
      };
    }
  }
}
