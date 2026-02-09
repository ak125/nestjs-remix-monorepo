/**
 * RagProxyService Unit Tests
 *
 * Tests the HTTP proxy layer between NestJS backend and external FastAPI RAG service.
 * 10 tests: chat (4) + search (3) + health (3).
 *
 * Strategy: mock global.fetch since the service uses native fetch (not HttpService).
 *
 * @see backend/src/modules/rag-proxy/rag-proxy.service.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { RagProxyService } from '../../src/modules/rag-proxy/rag-proxy.service';

describe('RagProxyService', () => {
  let service: RagProxyService;
  let mockFetch: jest.Mock;

  const MOCK_RAG_URL = 'http://mock-rag:8000';
  const MOCK_API_KEY = 'test-api-key-123';

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const config: Record<string, string> = {
        RAG_SERVICE_URL: MOCK_RAG_URL,
        RAG_API_KEY: MOCK_API_KEY,
      };
      const value = config[key];
      if (!value) throw new Error(`Missing config: ${key}`);
      return value;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock global.fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagProxyService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RagProxyService>(RagProxyService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ========================================
  // chat() — 4 tests
  // ========================================

  describe('chat()', () => {
    const chatRequest = {
      message: 'Quel filtre à huile pour Clio 3 ?',
      sessionId: 'session-abc-123',
    };

    const mockRagResponse = {
      response: 'Pour une Clio 3, je recommande le filtre Purflux LS867B.',
      sources: ['gammes/filtre-a-huile.md'],
      session_id: 'session-abc-123',
      truth_metadata: { composite_confidence: 0.92 },
      citations: ['Source: RAG Knowledge Base'],
      query_type: 'on_topic',
      passed_guardrails: true,
      refusal_reason: null,
    };

    it('should return a formatted ChatResponseDto on valid request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRagResponse,
      });

      const result = await service.chat(chatRequest);

      expect(result).toEqual({
        answer: 'Pour une Clio 3, je recommande le filtre Purflux LS867B.',
        sources: ['gammes/filtre-a-huile.md'],
        sessionId: 'session-abc-123',
        confidence: 0.92,
        citations: ['Source: RAG Knowledge Base'],
        queryType: 'on_topic',
        passedGuardrails: true,
        refusalReason: null,
      });
    });

    it('should throw ExternalServiceException when RAG returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      await expect(service.chat(chatRequest)).rejects.toThrow(HttpException);
    });

    it('should throw ExternalServiceException on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(service.chat(chatRequest)).rejects.toThrow(HttpException);
    });

    it('should send X-API-Key header and locale: fr', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockRagResponse,
      });

      await service.chat(chatRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_RAG_URL}/chat/v2`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': MOCK_API_KEY,
            'Content-Type': 'application/json',
          }),
        }),
      );

      // Verify locale in body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.locale).toBe('fr');
      expect(body.message).toBe(chatRequest.message);
      expect(body.session_id).toBe(chatRequest.sessionId);
    });
  });

  // ========================================
  // search() — 3 tests
  // ========================================

  describe('search()', () => {
    const searchRequest = {
      query: 'plaquettes de frein avant',
      limit: 5,
    };

    const mockSearchResponse = {
      results: [
        {
          title: 'Plaquettes de frein',
          content: 'Les plaquettes de frein sont...',
          sourcePath: 'gammes/plaquettes-de-frein.md',
          sourceType: 'knowledge',
          category: 'freinage',
          score: 0.95,
        },
      ],
      query: 'plaquettes de frein avant',
      total: 1,
    };

    it('should return a SearchResponseDto on valid request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const result = await service.search(searchRequest);

      expect(result).toEqual({
        results: mockSearchResponse.results,
        query: 'plaquettes de frein avant',
        total: 1,
      });
    });

    it('should throw ExternalServiceException when RAG returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(service.search(searchRequest)).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw ExternalServiceException on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      await expect(service.search(searchRequest)).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ========================================
  // health() — 3 tests
  // ========================================

  describe('health()', () => {
    it('should return healthy status with corpus stats', async () => {
      // First call: /health
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          services: { rag: { status: 'up' } },
        }),
      });

      // Second call: /api/knowledge/stats
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          total_documents: 230,
          by_truth_level: { L1: 10, L2: 4, L3: 216 },
        }),
      });

      const result = await service.health();

      expect(result.status).toBe('healthy');
      expect(result.services.corpus).toEqual({
        total_documents: 230,
        by_truth_level: { L1: 10, L2: 4, L3: 216 },
      });
    });

    it('should return unhealthy when RAG service returns non-200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      const result = await service.health();

      expect(result.status).toBe('unhealthy');
      expect(result.services.rag).toEqual(
        expect.objectContaining({ status: 'down' }),
      );
    });

    it('should return healthy without corpus stats when stats endpoint fails', async () => {
      // First call: /health OK
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'healthy',
          services: { rag: { status: 'up' } },
        }),
      });

      // Second call: /api/knowledge/stats FAILS
      mockFetch.mockRejectedValueOnce(new Error('Stats unavailable'));

      const result = await service.health();

      expect(result.status).toBe('healthy');
      // corpus should NOT be present (stats failed gracefully)
      expect(result.services.corpus).toBeUndefined();
    });
  });
});
