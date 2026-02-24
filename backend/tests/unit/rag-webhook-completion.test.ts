/**
 * Unit tests for RagWebhookCompletionService.handleWebhookCompletion
 *
 * Tests: failed status, path resolution, gamme detection, event emission.
 * Updated for P1 split: tests target RagWebhookCompletionService (not the facade).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Module mocks (must be before imports) ──

jest.mock('@nestjs/common', () => ({
  Injectable: () => () => undefined,
  Optional: () => () => undefined,
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

import { RagWebhookCompletionService } from '../../src/modules/rag-proxy/services/rag-webhook-completion.service';
import { RAG_INGESTION_COMPLETED } from '../../src/modules/rag-proxy/events/rag-ingestion.events';

describe('RagWebhookCompletionService — handleWebhookCompletion', () => {
  let service: any;
  const mockEmit = jest.fn();
  const mockRecordWebhook = jest.fn().mockResolvedValue(undefined);
  const mockResolveGammesFromFiles = jest.fn();
  const mockDetectAffectedGammes = jest.fn();
  const mockDetectAffectedDiagnostics = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    service = Object.create(RagWebhookCompletionService.prototype);
    service.logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    service.eventEmitter = { emit: mockEmit };
    service.webhookAuditService = { recordWebhook: mockRecordWebhook };
    service.configService = {
      get: jest.fn((key: string) => {
        if (key === 'RAG_KNOWLEDGE_PATH')
          return '/opt/automecanik/rag/knowledge';
        return undefined;
      }),
    };
    service.ragGammeDetectionService = {
      resolveGammesFromFiles: mockResolveGammesFromFiles,
      detectAffectedGammes: mockDetectAffectedGammes,
      detectAffectedDiagnostics: mockDetectAffectedDiagnostics,
    };

    // Default mock returns
    mockResolveGammesFromFiles.mockResolvedValue(
      new Map([
        [
          'disque-de-frein',
          ['/opt/automecanik/rag/knowledge/gammes/disque-de-frein.md'],
        ],
      ]),
    );
    mockDetectAffectedGammes.mockReturnValue(
      new Map([['filtre-a-huile', []]]),
    );
    mockDetectAffectedDiagnostics.mockReturnValue([]);
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
    service.configService.get = jest.fn((key: string) => {
      if (key === 'RAG_KNOWLEDGE_PATH') return '/test/knowledge';
      return undefined;
    });

    await service.handleWebhookCompletion({
      job_id: 'test-path',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });

    expect(mockResolveGammesFromFiles).toHaveBeenCalledWith([
      '/test/knowledge/gammes/disque-de-frein.md',
    ]);
  });

  it('should call resolveGammesFromFiles when files_created is provided', async () => {
    await service.handleWebhookCompletion({
      job_id: 'test-files',
      source: 'web',
      status: 'done',
      files_created: ['gammes/disque-de-frein.md'],
    });

    expect(mockResolveGammesFromFiles).toHaveBeenCalledTimes(1);
    expect(mockDetectAffectedGammes).not.toHaveBeenCalled();
  });

  it('should fall back to detectAffectedGammes when files_created is empty', async () => {
    await service.handleWebhookCompletion({
      job_id: 'test-empty',
      source: 'web',
      status: 'done',
      files_created: [],
    });

    expect(mockResolveGammesFromFiles).not.toHaveBeenCalled();
    expect(mockDetectAffectedGammes).toHaveBeenCalledTimes(1);
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
    mockDetectAffectedDiagnostics.mockReturnValue([
      'vibration-turbo',
      'bruit-frein',
    ]);

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
    mockResolveGammesFromFiles.mockResolvedValue(
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
