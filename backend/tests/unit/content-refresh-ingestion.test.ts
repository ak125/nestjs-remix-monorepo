/**
 * Unit tests for ContentRefreshService.onIngestionCompleted
 *
 * Tests: event listener for RAG_INGESTION_COMPLETED — gamme queueing, diagnostics queueing.
 * Pattern: Object.create + manual mocks (same as content-refresh.processor.test.ts).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Module mocks (must be before imports) ──

jest.mock('@nestjs/bull', () => ({
  Processor: () => () => undefined,
  Process: () => () => undefined,
  InjectQueue: () => () => undefined,
  OnQueueFailed: () => () => undefined,
  OnQueueError: () => () => undefined,
}));

jest.mock('@nestjs/common', () => ({
  Injectable: () => () => undefined,
  Optional: () => () => undefined,
  Module: () => () => undefined,
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: jest.fn(),
}));

jest.mock('@nestjs/event-emitter', () => ({
  OnEvent: () => () => undefined,
}));

jest.mock('../../src/database/services/supabase-base.service', () => ({
  SupabaseBaseService: class {
    protected client: any;
    protected configService: any;
    protected logger: any = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    constructor(..._args: any[]) {}
  },
}));

import { ContentRefreshService } from '../../src/modules/admin/services/content-refresh.service';
import type { RagIngestionCompletedEvent } from '../../src/modules/rag-proxy/events/rag-ingestion.events';

describe('ContentRefreshService — onIngestionCompleted', () => {
  let service: any;
  const mockQueueRefreshForGamme = jest
    .fn()
    .mockResolvedValue(['R1_pieces', 'R3_guide_achat']);
  const mockQueueRefreshForDiagnostic = jest
    .fn()
    .mockResolvedValue('R5_diagnostic');

  beforeEach(() => {
    jest.clearAllMocks();

    service = Object.create(ContentRefreshService.prototype);
    service.logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    service.queueRefreshForGamme = mockQueueRefreshForGamme;
    service.queueRefreshForDiagnostic = mockQueueRefreshForDiagnostic;
  });

  function makeEvent(
    overrides: Partial<RagIngestionCompletedEvent> = {},
  ): RagIngestionCompletedEvent {
    return {
      jobId: 'test-job-001',
      source: 'web',
      status: 'done',
      completedAt: Math.floor(Date.now() / 1000),
      affectedGammes: ['disque-de-frein'],
      affectedGammesMap: {
        'disque-de-frein': [
          '/opt/automecanik/rag/knowledge/gammes/disque-de-frein.md',
        ],
      },
      ...overrides,
    };
  }

  it('should skip when event.status is not "done"', async () => {
    await service.onIngestionCompleted(makeEvent({ status: 'failed' }));

    expect(mockQueueRefreshForGamme).not.toHaveBeenCalled();
  });

  it('should warn and return when affectedGammes is empty', async () => {
    await service.onIngestionCompleted(
      makeEvent({ affectedGammes: [], affectedGammesMap: {} }),
    );

    expect(service.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no affected gammes detected'),
    );
    expect(mockQueueRefreshForGamme).not.toHaveBeenCalled();
  });

  it('should call queueRefreshForGamme for each affected gamme', async () => {
    await service.onIngestionCompleted(
      makeEvent({
        affectedGammes: ['disque-de-frein', 'filtre-a-huile'],
        affectedGammesMap: {
          'disque-de-frein': ['/path/a.md'],
          'filtre-a-huile': ['/path/b.md'],
        },
      }),
    );

    expect(mockQueueRefreshForGamme).toHaveBeenCalledTimes(2);
    expect(mockQueueRefreshForGamme).toHaveBeenCalledWith(
      'disque-de-frein',
      'test-job-001',
      'rag_web_ingest',
      ['/path/a.md'],
    );
    expect(mockQueueRefreshForGamme).toHaveBeenCalledWith(
      'filtre-a-huile',
      'test-job-001',
      'rag_web_ingest',
      ['/path/b.md'],
    );
  });

  it('should pass supplementaryFiles from gammesMap to queue', async () => {
    const files = ['/knowledge/gammes/disque-de-frein.md', '/knowledge/guides/freinage.md'];
    await service.onIngestionCompleted(
      makeEvent({
        affectedGammes: ['disque-de-frein'],
        affectedGammesMap: { 'disque-de-frein': files },
      }),
    );

    expect(mockQueueRefreshForGamme).toHaveBeenCalledWith(
      'disque-de-frein',
      'test-job-001',
      'rag_web_ingest',
      files,
    );
  });

  it('should queue R5 diagnostic refresh when affectedDiagnostics exist', async () => {
    await service.onIngestionCompleted(
      makeEvent({
        affectedDiagnostics: ['vibration-turbo', 'bruit-frein'],
      }),
    );

    expect(mockQueueRefreshForDiagnostic).toHaveBeenCalledTimes(2);
    expect(mockQueueRefreshForDiagnostic).toHaveBeenCalledWith(
      'vibration-turbo',
      'test-job-001',
      'rag_web_ingest',
    );
    expect(mockQueueRefreshForDiagnostic).toHaveBeenCalledWith(
      'bruit-frein',
      'test-job-001',
      'rag_web_ingest',
    );
  });

  it('should not queue diagnostics when affectedDiagnostics is empty', async () => {
    await service.onIngestionCompleted(
      makeEvent({ affectedDiagnostics: [] }),
    );

    expect(mockQueueRefreshForDiagnostic).not.toHaveBeenCalled();
  });
});
