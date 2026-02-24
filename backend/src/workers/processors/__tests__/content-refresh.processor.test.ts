/**
 * Unit tests for ContentRefreshProcessor — RAG-as-Optional-Overlay
 *
 * Validates that missing RAG data produces 'skipped' (neutral),
 * NOT 'failed'. Only genuine quality issues or exceptions produce 'failed'.
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

jest.mock('../../../database/services/supabase-base.service', () => ({
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

jest.mock(
  '../../../modules/admin/services/buying-guide-enricher.service',
  () => ({
    BuyingGuideEnricherService: jest.fn(),
  }),
);

jest.mock('../../../modules/admin/services/conseil-enricher.service', () => ({
  ConseilEnricherService: jest.fn(),
}));

jest.mock('../../../modules/seo/services/reference.service', () => ({
  ReferenceService: jest.fn(),
}));

jest.mock('../../../modules/seo/services/diagnostic.service', () => ({
  DiagnosticService: jest.fn(),
}));

jest.mock('../../../modules/admin/services/brief-gates.service', () => ({
  BriefGatesService: jest.fn(),
}));

jest.mock('../../../modules/admin/services/hard-gates.service', () => ({
  HardGatesService: jest.fn(),
}));

jest.mock('../../../modules/admin/services/section-compiler.service', () => ({
  SectionCompilerService: jest.fn(),
}));

jest.mock('../../../config/content-section-policy', () => ({
  pageTypeToRole: jest.fn().mockReturnValue('R4'),
  POLICY_VERSION: 'v1-test',
}));

jest.mock('@nestjs/event-emitter', () => ({
  EventEmitter2: jest.fn(),
  OnEvent: () => () => undefined,
}));

jest.mock('../../../modules/rag-proxy/rag-proxy.service', () => ({
  RagProxyService: jest.fn(),
}));

// ── Now import the processor ──

import { ContentRefreshProcessor } from '../content-refresh.processor';
import type { ContentRefreshResult } from '../../types/content-refresh.types';

// ── Test helpers ──

const mockSupabaseUpdate = jest.fn().mockReturnValue({
  eq: jest.fn().mockResolvedValue({ error: null }),
});

const mockSupabaseFrom = jest.fn().mockReturnValue({
  update: mockSupabaseUpdate,
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      neq: jest.fn().mockReturnValue({
        neq: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    }),
    single: jest.fn().mockResolvedValue({ data: null }),
  }),
});

const mockBuyingGuideEnricher = { enrich: jest.fn() };
const mockConseilEnricher = { enrichSingle: jest.fn() };
const mockReferenceService = { refreshSingleGamme: jest.fn() };
const mockDiagnosticService = { refreshFromRag: jest.fn() };
const mockConfigService = {
  get: jest.fn((_key: string, defaultVal?: string) => {
    return defaultVal ?? '';
  }),
};

let processor: any;

beforeAll(() => {
  processor = Object.create(ContentRefreshProcessor.prototype);
  processor.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  processor.client = { from: mockSupabaseFrom };
  processor.configService = mockConfigService;
  processor.buyingGuideEnricher = mockBuyingGuideEnricher;
  processor.conseilEnricher = mockConseilEnricher;
  processor.referenceService = mockReferenceService;
  processor.diagnosticService = mockDiagnosticService;
  processor.gammeLocksInProgress = new Set<number>();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseUpdate.mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });
  mockConfigService.get.mockImplementation(
    (_key: string, defaultVal?: string) => {
      return defaultVal ?? '';
    },
  );
});

function makeJob(
  overrides: Partial<{
    refreshLogId: number;
    pgId: number;
    pgAlias: string;
    pageType: string;
  }>,
) {
  return {
    data: {
      refreshLogId: 1,
      pgId: 100,
      pgAlias: 'filtre-a-huile',
      pageType: 'R4_reference',
      ...overrides,
    },
  } as any;
}

// ── Tests ──

describe('ContentRefreshProcessor — RAG-as-Optional-Overlay', () => {
  // Test 1: R4 sans RAG → skipped
  it('should set status=skipped when R4 reference has no RAG file', async () => {
    mockReferenceService.refreshSingleGamme.mockResolvedValue({
      created: false,
      updated: false,
      skipped: true,
    });

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({ pageType: 'R4_reference', pgAlias: 'filtre-a-huile' }),
    );

    expect(result.status).toBe('skipped');
    expect(result.qualityScore).toBeNull();
    expect(result.qualityFlags).toContain('NO_RAG_DATA_AVAILABLE');
    expect(result.errorMessage).toBeUndefined();
  });

  // Test 2: R4 avec RAG (created) → draft
  it('should set status=draft when R4 reference creates new entry', async () => {
    mockReferenceService.refreshSingleGamme.mockResolvedValue({
      created: true,
      updated: false,
      skipped: false,
    });

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({ pageType: 'R4_reference', pgAlias: 'disque-de-frein' }),
    );

    expect(result.status).toBe('draft');
    expect(result.qualityScore).toBe(80);
    expect(result.qualityFlags).toContain('NEW_ENTRY_CREATED');
  });

  // Test 3: R3_conseils sans RAG (NO_RAG_DOC) → skipped
  it('should set status=skipped when R3 conseils has no RAG doc', async () => {
    mockConseilEnricher.enrichSingle.mockResolvedValue({
      status: 'skipped',
      score: 0,
      flags: [],
      sectionsCreated: 0,
      sectionsUpdated: 0,
      reason: 'NO_RAG_DOC',
    });

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({ pageType: 'R3_conseils', pgAlias: 'filtre-a-huile' }),
    );

    expect(result.status).toBe('skipped');
    expect(result.qualityScore).toBeNull();
  });

  // Test 4: R3_conseils avec RAG mais qualité < 70 → failed (vrai échec)
  it('should set status=failed when R3 conseils has RAG but quality is low', async () => {
    mockConseilEnricher.enrichSingle.mockResolvedValue({
      status: 'failed',
      score: 45,
      flags: ['MISSING_PROCEDURE', 'FAQ_TOO_SMALL'],
      sectionsCreated: 0,
      sectionsUpdated: 0,
      reason: 'QUALITY_BELOW_THRESHOLD',
    });

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({ pageType: 'R3_conseils', pgAlias: 'disque-de-frein' }),
    );

    expect(result.status).toBe('failed');
    expect(result.qualityScore).toBe(45);
  });

  // Test 5: R1 toutes sections skippées → skipped
  it('should set status=skipped when R1 buying guide has all sections skipped', async () => {
    mockBuyingGuideEnricher.enrich.mockResolvedValue([
      {
        pgId: '100',
        sections: {},
        averageConfidence: 0,
        updated: false,
        sectionsUpdated: 0,
        skippedSections: [
          'anti_mistakes',
          'selection_criteria',
          'decision_tree',
          'use_cases',
        ],
      },
    ]);

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({ pageType: 'R1_pieces', pgAlias: 'filtre-a-huile' }),
    );

    expect(result.status).toBe('skipped');
    expect(result.qualityScore).toBeNull();
    expect(result.qualityFlags).toEqual(
      expect.arrayContaining([
        'SKIPPED_ANTI_MISTAKES',
        'SKIPPED_SELECTION_CRITERIA',
      ]),
    );
  });

  // Test 6: R1 avec RAG partiel (avgConf 0.65) → failed (genuine low quality)
  it('should set status=failed when R1 has partial RAG overlay with low confidence', async () => {
    mockBuyingGuideEnricher.enrich.mockResolvedValue([
      {
        pgId: '100',
        sections: { anti_mistakes: {}, selection_criteria: {} },
        averageConfidence: 0.65,
        updated: true,
        sectionsUpdated: 2,
        skippedSections: ['decision_tree'],
      },
    ]);

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({
        pageType: 'R3_guide_achat',
        pgAlias: 'disque-de-frein',
      }),
    );

    // avgConf 0.65 < 0.8 → score 60, 60 < 70 → genuine failed
    expect(result.status).toBe('failed');
    expect(result.qualityScore).toBe(60);
  });

  // Test 7: skipped → PAS d'updates secondaires
  it('should NOT update dependent tables when status is skipped', async () => {
    mockReferenceService.refreshSingleGamme.mockResolvedValue({
      created: false,
      updated: false,
      skipped: true,
    });

    await processor.handleContentRefresh(
      makeJob({ pageType: 'R4_reference', pgAlias: 'filtre-a-huile' }),
    );

    // Only __rag_content_refresh_log should be touched, never __seo_reference
    const fromCalls = mockSupabaseFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(fromCalls).not.toContain('__seo_reference');
    expect(fromCalls).not.toContain('__seo_gamme_purchase_guide');
  });

  // Test 8: Exception runtime → failed avec EXCEPTION flag
  it('should set status=failed with EXCEPTION flag on runtime error', async () => {
    mockReferenceService.refreshSingleGamme.mockRejectedValue(
      new Error('Connection timeout'),
    );

    const result: ContentRefreshResult = await processor.handleContentRefresh(
      makeJob({ pageType: 'R4_reference', pgAlias: 'disque-de-frein' }),
    );

    expect(result.status).toBe('failed');
    expect(result.qualityScore).toBe(0);
    expect(result.qualityFlags).toContain('EXCEPTION');
    expect(result.errorMessage).toContain('Connection timeout');
  });

  // Test 9: R5 sans RAG doc → skipped
  it('should set status=skipped when R5 diagnostic has no RAG doc', async () => {
    mockDiagnosticService.refreshFromRag.mockResolvedValue({
      skipped: true,
      updated: false,
      confidence: 0,
      flags: ['NO_DIAGNOSTIC_RAG_DOC'],
    });

    const result: ContentRefreshResult = await processor.handleContentRefresh({
      data: {
        refreshLogId: 1,
        diagnosticSlug: 'vibration-turbo',
        pageType: 'R5_diagnostic',
      },
    } as any);

    expect(result.status).toBe('skipped');
    expect(result.qualityScore).toBeNull();
    expect(result.qualityFlags).toContain('NO_DIAGNOSTIC_RAG_DOC');
  });

  // Test 10: R5 avec RAG doc → draft
  it('should set status=draft when R5 diagnostic has RAG data', async () => {
    mockDiagnosticService.refreshFromRag.mockResolvedValue({
      skipped: false,
      updated: true,
      confidence: 0.85,
      flags: ['SYMPTOMS_UPDATED', 'CAUSES_UPDATED', 'ACTIONS_UPDATED'],
    });

    const result: ContentRefreshResult = await processor.handleContentRefresh({
      data: {
        refreshLogId: 1,
        diagnosticSlug: 'bruit-embrayage',
        pageType: 'R5_diagnostic',
      },
    } as any);

    expect(result.status).toBe('draft');
    expect(result.qualityScore).toBe(85);
    expect(result.qualityFlags).toContain('SYMPTOMS_UPDATED');
  });
});
