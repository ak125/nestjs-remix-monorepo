/**
 * RagProxyController Tests
 *
 * Tests the controller layer with mocked RagProxyService.
 * Uses supertest for HTTP-level assertions on the isolated controller.
 * 3 tests: health + chat + search.
 *
 * @see backend/src/modules/rag-proxy/rag-proxy.controller.ts
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RagProxyController } from '../../src/modules/rag-proxy/rag-proxy.controller';
import { RagProxyService } from '../../src/modules/rag-proxy/rag-proxy.service';

describe('RagProxyController', () => {
  let app: INestApplication;

  const mockRagProxyService = {
    health: jest.fn(),
    chat: jest.fn(),
    search: jest.fn(),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagProxyController],
      providers: [
        { provide: RagProxyService, useValue: mockRagProxyService },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/rag/health should return health status', async () => {
    const healthResponse = {
      status: 'healthy',
      services: {
        rag: { status: 'up' },
        corpus: { total_documents: 230 },
      },
    };

    mockRagProxyService.health.mockResolvedValueOnce(healthResponse);

    const response = await request(app.getHttpServer())
      .get('/api/rag/health')
      .expect(200);

    expect(response.body).toEqual(healthResponse);
    expect(mockRagProxyService.health).toHaveBeenCalledTimes(1);
  });

  it('POST /api/rag/chat should forward chat request', async () => {
    const chatResponse = {
      answer: 'Voici la réponse.',
      sources: ['source.md'],
      sessionId: 'sess-1',
      confidence: 0.85,
    };

    mockRagProxyService.chat.mockResolvedValueOnce(chatResponse);

    const response = await request(app.getHttpServer())
      .post('/api/rag/chat')
      .send({ message: 'Question test' })
      .expect(200);

    expect(response.body).toEqual(chatResponse);
    expect(mockRagProxyService.chat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Question test' }),
    );
  });

  it('POST /api/rag/search should forward search request', async () => {
    const searchResponse = {
      results: [{ title: 'Result', content: 'Content', score: 0.9 }],
      query: 'test query',
      total: 1,
    };

    mockRagProxyService.search.mockResolvedValueOnce(searchResponse);

    const response = await request(app.getHttpServer())
      .post('/api/rag/search')
      .send({ query: 'test query' })
      .expect(200);

    expect(response.body).toEqual(searchResponse);
    expect(mockRagProxyService.search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'test query' }),
    );
  });
});
