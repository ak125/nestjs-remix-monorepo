/**
 * Unit tests for RagProxyService.handleWebhookCompletion
 *
 * Tests: failed status, path resolution, gamme detection, event emission.
 * Pattern: Object.create + manual mocks (same as content-refresh.processor.test.ts).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Module mocks (must be before imports) ──

jest.mock('@nestjs/common', () => ({
  Injectable: () => () => undefined,
  HttpException: class extends Error {
    status: number;
    constructor(msg: string, status: number) {
      super(msg);
      this.status = status;
    }
  },
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  BadRequestException: class extends Error {},
  ConflictException: class extends Error {},
  NotFoundException: class extends Error {},
  OnModuleDestroy: () => () => undefined,
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn(),
}));

jest.mock('@nestjs/event-emitter', () => ({
  EventEmitter2: jest.fn(),
}));

jest.mock(
  '../../src/modules/rag-proxy/services/frontmatter-validator.service',
  () => ({
    FrontmatterValidatorService: jest.fn(),
  }),
);

jest.mock(
  '../../src/modules/rag-proxy/services/rag-cleanup.service',
  () => ({
    RagCleanupService: jest.fn(),
  }),
);

jest.mock(
  '../../src/modules/rag-proxy/services/webhook-audit.service',
  () => ({
    WebhookAuditService: jest.fn(),
  }),
);

jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn(),
}));

import { RagProxyService } from '../../src/modules/rag-proxy/rag-proxy.service';
import { RAG_INGESTION_COMPLETED } from '../../src/modules/rag-proxy/events/rag-ingestion.events';

describe('RagProxyService — handleWebhookCompletion', () => {
  let service: any;
  const mockEmit = jest.fn();
  const mockRecordWebhook = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();

    service = Object.create(RagProxyService.prototype);
    service.logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service.eventEmitter = { emit: mockEmit };
    service.webhookAuditService = { recordWebhook: mockRecordWebhook };

    // Mock private methods
    service.resolveGammesFromFiles = jest.fn().mockResolvedValue(
      new Map([
        [
          'disque-de-frein',
          ['/opt/automecanik/rag/knowledge/gammes/disque-de-frein.md'],
        ],
      ]),
    );
    service.detectAffectedGammes = jest.fn().mockReturnValue(
      new Map([['filtre-a-huile', []]]),
    );
    service.detectAffectedDiagnostics = jest.fn().mockReturnValue([]);
  });

  it('should return event_emitted=false when status is "failed"', async () => {
    const result = await service.handleWebhookCompletion({
      job_id: 'test-fail',
      source: 'web',
      status: 'failed',
    });

    expect(result.event_emitted).toBe(false);
    expect(result.gammes_detected).toEqual([]);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('should resolve relative file paths to absolute using RAG_KNOWLEDGE_PATH', async () => {
    process.env.RAG_KNOWLEDGE_PATH = '/test/knowledge';

    await service.handleWebhookCompletion({
      job_id: 'test-path',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });

    expect(service.resolveGammesFromFiles).toHaveBeenCalledWith([
      '/test/knowledge/gammes/disque-de-frein.md',
    ]);

    delete process.env.RAG_KNOWLEDGE_PATH;
  });

  it('should call resolveGammesFromFiles when files_created is provided', async () => {
    await service.handleWebhookCompletion({
      job_id: 'test-files',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });

    expect(service.resolveGammesFromFiles).toHaveBeenCalledTimes(1);
    expect(service.detectAffectedGammes).not.toHaveBeenCalled();
  });

  it('should fall back to detectAffectedGammes when files_created is empty', async () => {
    await service.handleWebhookCompletion({
      job_id: 'test-empty',
      source: 'web',
      status: 'done',
      files_created: [],
    });

    expect(service.resolveGammesFromFiles).not.toHaveBeenCalled();
    expect(service.detectAffectedGammes).toHaveBeenCalledTimes(1);
  });

  it('should emit RAG_INGESTION_COMPLETED event with correct payload', async () => {
    await service.handleWebhookCompletion({
      job_id: 'test-emit',
      source: 'pdf',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });

    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(
      RAG_INGESTION_COMPLETED,
      expect.objectContaining({
        jobId: 'test-emit',
        source: 'pdf',
        status: 'done',
        affectedGammes: ['disque-de-frein'],
      }),
    );
  });

  it('should include affectedDiagnostics in event when detected', async () => {
    service.detectAffectedDiagnostics = jest
      .fn()
      .mockReturnValue(['vibration-turbo', 'bruit-frein']);

    await service.handleWebhookCompletion({
      job_id: 'test-diag',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });

    const emittedEvent = mockEmit.mock.calls[0][1];
    expect(emittedEvent.affectedDiagnostics).toEqual([
      'vibration-turbo',
      'bruit-frein',
    ]);
  });

  it('should return gammes_detected array matching resolved gammes', async () => {
    service.resolveGammesFromFiles = jest.fn().mockResolvedValue(
      new Map([
        ['disque-de-frein', ['/path/a.md']],
        ['filtre-a-huile', ['/path/b.md']],
      ]),
    );

    const result = await service.handleWebhookCompletion({
      job_id: 'test-multi',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md', 'gammes/filtre-a-huile.md'],
    });

    expect(result.gammes_detected).toEqual(
      expect.arrayContaining(['disque-de-frein', 'filtre-a-huile']),
    );
    expect(result.gammes_detected.length).toBe(2);
    expect(result.event_emitted).toBe(true);
  });
});
