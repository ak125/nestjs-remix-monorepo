/**
 * VideoProductionController — Unit tests (P19).
 *
 * Tests: dashboard, productions CRUD, templates, assets.
 * Mock service: dataService.
 *
 * @see backend/src/modules/media-factory/controllers/video-production.controller.ts
 */

import { VideoProductionController } from '../../src/modules/media-factory/controllers/video-production.controller';

function createMockDataService() {
  return {
    getDashboardStats: jest.fn().mockResolvedValue({ total: 42, byStatus: { draft: 10 } }),
    listProductions: jest.fn().mockResolvedValue({ data: [{ briefId: 'b-1' }], total: 1 }),
    getProduction: jest.fn().mockResolvedValue({ briefId: 'b-1', status: 'draft' }),
    createProduction: jest.fn().mockResolvedValue({ briefId: 'b-new', status: 'draft' }),
    updateProduction: jest.fn().mockResolvedValue({ briefId: 'b-1', status: 'rendering' }),
    listTemplates: jest.fn().mockResolvedValue([{ templateId: 'tpl-1' }]),
    listAssets: jest.fn().mockResolvedValue([{ assetKey: 'asset-1' }]),
    createAsset: jest.fn().mockResolvedValue({ assetKey: 'new-asset' }),
    validateAsset: jest.fn().mockResolvedValue({ assetKey: 'asset-1', validated: true }),
  };
}

describe('VideoProductionController', () => {
  let controller: VideoProductionController;
  let mockDataService: ReturnType<typeof createMockDataService>;

  beforeEach(() => {
    mockDataService = createMockDataService();
    controller = new (VideoProductionController as any)(mockDataService);
  });

  // ── Dashboard ──

  it('getDashboard should delegate to getDashboardStats', async () => {
    const result = await controller.getDashboard();
    expect(mockDataService.getDashboardStats).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data.total).toBe(42);
    expect(result.timestamp).toBeDefined();
  });

  // ── Productions CRUD ──

  describe('listProductions', () => {
    it('should use default pagination when no params given', async () => {
      await controller.listProductions();
      expect(mockDataService.listProductions).toHaveBeenCalledWith(
        {},
        { page: 1, limit: 20, sortBy: 'created_at', sortOrder: 'desc' },
      );
    });

    it('should cap limit at 100', async () => {
      await controller.listProductions(undefined, '999');
      expect(mockDataService.listProductions).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ limit: 100 }),
      );
    });
  });

  it('getProduction should delegate briefId', async () => {
    const result = await controller.getProduction('b-1');
    expect(mockDataService.getProduction).toHaveBeenCalledWith('b-1');
    expect(result.success).toBe(true);
    expect(result.data.briefId).toBe('b-1');
  });

  it('createProduction should delegate body and return message', async () => {
    const body = { briefId: 'b-new', videoType: 'short', vertical: 'freinage' };
    const result = await controller.createProduction(body as any);
    expect(mockDataService.createProduction).toHaveBeenCalledWith(body);
    expect(result.success).toBe(true);
    expect(result.message).toContain('b-new');
  });

  it('updateProduction should delegate briefId and body', async () => {
    const body = { status: 'rendering' };
    const result = await controller.updateProduction('b-1', body as any);
    expect(mockDataService.updateProduction).toHaveBeenCalledWith('b-1', body);
    expect(result.success).toBe(true);
    expect(result.message).toContain('b-1');
  });

  // ── Templates ──

  it('listTemplates should delegate and return envelope', async () => {
    const result = await controller.listTemplates();
    expect(mockDataService.listTemplates).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  // ── Assets ──

  it('listAssets should parse validated=true as boolean', async () => {
    await controller.listAssets(undefined, 'true');
    expect(mockDataService.listAssets).toHaveBeenCalledWith({
      visualType: undefined,
      validated: true,
    });
  });

  it('validateAsset should delegate assetKey and validatedBy', async () => {
    const result = await controller.validateAsset('asset-1', { validatedBy: 'admin@test.com' });
    expect(mockDataService.validateAsset).toHaveBeenCalledWith('asset-1', 'admin@test.com');
    expect(result.success).toBe(true);
    expect(result.message).toContain('asset-1');
  });
});
