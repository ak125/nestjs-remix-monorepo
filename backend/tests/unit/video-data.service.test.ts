/**
 * VideoDataService — Unit tests (P15c).
 *
 * Tests CRUD for productions, assets, templates, and dashboard stats.
 * Strategy: mock Supabase client chain (same pattern as video-job-retry-guard.test.ts).
 */

import { NotFoundException } from '@nestjs/common';
import { VideoDataService } from '../../src/modules/media-factory/services/video-data.service';

// ─── Mock Supabase chain builder ─────────────────────────────

function chainMock(result: { data: unknown; error: unknown; count?: number }) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.ilike = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.range = jest.fn().mockResolvedValue(result);
  chain.limit = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

// ─── Fake DB rows ────────────────────────────────────────────

function fakeProductionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    brief_id: 'brief-001',
    video_type: 'short',
    vertical: 'freinage',
    gamme_alias: 'disque-frein',
    pg_id: 42,
    status: 'draft',
    template_id: 'test-card',
    knowledge_contract: null,
    claim_table: [],
    evidence_pack: [],
    disclaimer_plan: null,
    approval_record: null,
    quality_score: null,
    quality_flags: [],
    gate_results: null,
    created_by: 'user-001',
    created_at: '2026-02-24T00:00:00Z',
    updated_at: '2026-02-24T00:00:00Z',
    ...overrides,
  };
}

function fakeAssetRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    asset_key: 'disque-frein-photo-01',
    visual_type: 'product_photo',
    truth_dependency: 'illustration',
    tags: ['freinage', 'disque'],
    file_path: '/uploads/disque-01.jpg',
    validated: false,
    validated_by: null,
    created_at: '2026-02-24T00:00:00Z',
    ...overrides,
  };
}

// ─── Config mock ─────────────────────────────────────────────

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
    };
    return map[key] ?? 'mock-value';
  }),
  getOrThrow: jest.fn().mockReturnValue('mock-value'),
};

// ─── Tests ───────────────────────────────────────────────────

describe('VideoDataService', () => {
  let service: VideoDataService;

  beforeEach(() => {
    service = new (VideoDataService as any)(mockConfigService);
  });

  // ── Productions ──

  describe('getProduction', () => {
    it('should return mapped production when found', async () => {
      const row = fakeProductionRow();
      const chain = chainMock({ data: row, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.getProduction('brief-001');

      expect(result.briefId).toBe('brief-001');
      expect(result.videoType).toBe('short');
      expect(result.vertical).toBe('freinage');
      expect(result.gammeAlias).toBe('disque-frein');
      expect(result.pgId).toBe(42);
      expect(result.status).toBe('draft');
    });

    it('should throw NotFoundException when not found', async () => {
      const chain = chainMock({ data: null, error: { message: 'not found' } });
      Object.defineProperty(service, 'client', { get: () => chain });

      await expect(service.getProduction('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createProduction', () => {
    it('should insert with correct snake_case fields and return mapped', async () => {
      const row = fakeProductionRow();
      const chain = chainMock({ data: row, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.createProduction({
        briefId: 'brief-001',
        videoType: 'short',
        vertical: 'freinage',
        gammeAlias: 'disque-frein',
        pgId: 42,
        createdBy: 'user-001',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          brief_id: 'brief-001',
          video_type: 'short',
          vertical: 'freinage',
          gamme_alias: 'disque-frein',
          pg_id: 42,
          status: 'draft',
          created_by: 'user-001',
        }),
      );
      expect(result.briefId).toBe('brief-001');
    });

    it('should throw on Supabase insert error', async () => {
      const chain = chainMock({
        data: null,
        error: { message: 'unique violation' },
      });
      // Override single to return error with proper data shape
      chain.single = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'unique violation' },
      });
      Object.defineProperty(service, 'client', { get: () => chain });

      await expect(
        service.createProduction({
          briefId: 'brief-001',
          videoType: 'short',
          vertical: 'freinage',
          createdBy: 'user-001',
        }),
      ).rejects.toBeDefined();
    });
  });

  describe('updateProduction', () => {
    it('should apply partial updates and return mapped production', async () => {
      const row = fakeProductionRow({
        status: 'ready_for_publish',
        quality_score: 4.5,
      });
      const chain = chainMock({ data: row, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.updateProduction('brief-001', {
        status: 'ready_for_publish',
        qualityScore: 4.5,
      });

      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready_for_publish',
          quality_score: 4.5,
        }),
      );
      expect(result.status).toBe('ready_for_publish');
      expect(result.qualityScore).toBe(4.5);
    });

    it('should throw NotFoundException when production not found', async () => {
      const chain = chainMock({ data: null, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      await expect(
        service.updateProduction('nonexistent', { status: 'ready_for_publish' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listProductions', () => {
    it('should return paginated data with total', async () => {
      const rows = [fakeProductionRow(), fakeProductionRow({ id: 2 })];
      const chain = chainMock({ data: rows, error: null, count: 5 });
      // range() returns the full result including count
      chain.range = jest.fn().mockResolvedValue({
        data: rows,
        error: null,
        count: 5,
      });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.listProductions(
        {},
        { page: 1, limit: 10 },
      );

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.data[0].briefId).toBe('brief-001');
    });

    it('should apply filters (status, vertical, videoType, search)', async () => {
      const chain = chainMock({ data: [], error: null, count: 0 });
      chain.range = jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });
      Object.defineProperty(service, 'client', { get: () => chain });

      await service.listProductions(
        {
          status: 'draft',
          vertical: 'freinage',
          videoType: 'short',
          search: 'disque',
        },
        { page: 1, limit: 10 },
      );

      // Should call eq for status, vertical, videoType and ilike for search
      expect(chain.eq).toHaveBeenCalledWith('status', 'draft');
      expect(chain.eq).toHaveBeenCalledWith('vertical', 'freinage');
      expect(chain.eq).toHaveBeenCalledWith('video_type', 'short');
      expect(chain.ilike).toHaveBeenCalledWith('brief_id', '%disque%');
    });
  });

  // ── Assets ──

  describe('listAssets', () => {
    it('should return mapped assets', async () => {
      const rows = [fakeAssetRow()];
      const chain = chainMock({ data: null, error: null });
      // order() is chained after query building, then resolves
      chain.order = jest.fn().mockResolvedValue({ data: rows, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.listAssets({});

      expect(result).toHaveLength(1);
      expect(result[0].assetKey).toBe('disque-frein-photo-01');
      expect(result[0].visualType).toBe('product_photo');
      expect(result[0].tags).toEqual(['freinage', 'disque']);
    });
  });

  describe('createAsset', () => {
    it('should insert with defaults and return mapped asset', async () => {
      const row = fakeAssetRow();
      const chain = chainMock({ data: row, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.createAsset({
        assetKey: 'disque-frein-photo-01',
        visualType: 'product_photo',
      });

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_key: 'disque-frein-photo-01',
          visual_type: 'product_photo',
          truth_dependency: 'illustration',
          tags: [],
          file_path: null,
        }),
      );
      expect(result.assetKey).toBe('disque-frein-photo-01');
    });
  });

  describe('validateAsset', () => {
    it('should update validated and validated_by fields', async () => {
      const row = fakeAssetRow({ validated: true, validated_by: 'admin-01' });
      const chain = chainMock({ data: row, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.validateAsset(
        'disque-frein-photo-01',
        'admin-01',
      );

      expect(chain.update).toHaveBeenCalledWith({
        validated: true,
        validated_by: 'admin-01',
      });
      expect(result.validated).toBe(true);
      expect(result.validatedBy).toBe('admin-01');
    });

    it('should throw NotFoundException when asset not found', async () => {
      const chain = chainMock({ data: null, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      await expect(
        service.validateAsset('nonexistent', 'admin-01'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── Dashboard ──

  describe('getDashboardStats', () => {
    it('should count productions by status', async () => {
      const rows = [
        { status: 'draft' },
        { status: 'draft' },
        { status: 'ready_for_publish' },
        { status: 'published' },
      ];
      const chain = chainMock({ data: null, error: null });
      chain.select = jest.fn().mockResolvedValue({ data: rows, error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.getDashboardStats();

      expect(result.total).toBe(4);
      expect(result.byStatus).toEqual({
        draft: 2,
        ready_for_publish: 1,
        published: 1,
      });
    });

    it('should return empty stats on Supabase error', async () => {
      const chain = chainMock({ data: null, error: null });
      chain.select = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'connection timeout' },
      });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.getDashboardStats();

      expect(result.total).toBe(0);
      expect(result.byStatus).toEqual({});
    });
  });

  // ── Templates ──

  describe('listTemplates', () => {
    it('should fall back to code registry when DB is empty', async () => {
      const chain = chainMock({ data: null, error: null });
      chain.order = jest.fn().mockResolvedValue({ data: [], error: null });
      Object.defineProperty(service, 'client', { get: () => chain });

      const result = await service.listTemplates();

      expect(result).toHaveLength(3);
      expect(result[0].templateId).toBeDefined();
      expect(result[0].structure).toHaveProperty('compositionId');
      expect(result[0].structure).toHaveProperty('source', 'code_registry');
    });
  });
});
