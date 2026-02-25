/**
 * VideoGateCheckController — Unit tests (P19).
 *
 * Tests: validateGates, checkArtefacts, getProductionGates.
 * Mock services: gatesService, dataService.
 *
 * @see backend/src/modules/media-factory/controllers/video-gate-check.controller.ts
 */

import { VideoGateCheckController } from '../../src/modules/media-factory/controllers/video-gate-check.controller';

function createMocks() {
  const mockGatesService = {
    checkArtefacts: jest.fn(),
    runAllGates: jest.fn(),
  };
  const mockDataService = {
    getProduction: jest.fn(),
  };
  return { mockGatesService, mockDataService };
}

describe('VideoGateCheckController', () => {
  let controller: VideoGateCheckController;
  let mocks: ReturnType<typeof createMocks>;

  beforeEach(() => {
    mocks = createMocks();
    controller = new (VideoGateCheckController as any)(
      mocks.mockGatesService,
      mocks.mockDataService,
    );
  });

  // ── validateGates ──

  describe('validateGates', () => {
    const fakeBody = { brief: {}, claims: [], evidencePack: [], disclaimerPlan: {}, approvalRecord: {} };

    it('should return canPublish=true when artefacts pass and gates pass', async () => {
      mocks.mockGatesService.checkArtefacts.mockReturnValue({
        canProceed: true,
        missingArtefacts: [],
      });
      mocks.mockGatesService.runAllGates.mockReturnValue({
        canPublish: true,
        gates: [{ name: 'truth', verdict: 'PASS' }],
        flags: [],
      });

      const result = await controller.validateGates(fakeBody as any);
      expect(result.success).toBe(true);
      expect(result.canPublish).toBe(true);
      expect(result.gates).toHaveLength(1);
      expect(result.message).toContain('ready to publish');
    });

    it('should return canPublish=false when artefacts are missing', async () => {
      mocks.mockGatesService.checkArtefacts.mockReturnValue({
        canProceed: false,
        missingArtefacts: ['disclaimerPlan', 'approvalRecord'],
      });

      const result = await controller.validateGates(fakeBody as any);
      expect(result.success).toBe(false);
      expect(result.canPublish).toBe(false);
      expect(result.gates).toBeNull();
      expect(result.message).toContain('disclaimerPlan');
      expect(result.flags).toContain('MISSING_ARTEFACTS:disclaimerPlan,approvalRecord');
      // runAllGates should NOT be called
      expect(mocks.mockGatesService.runAllGates).not.toHaveBeenCalled();
    });

    it('should return canPublish=false when artefacts pass but gates fail', async () => {
      mocks.mockGatesService.checkArtefacts.mockReturnValue({
        canProceed: true,
        missingArtefacts: [],
      });
      mocks.mockGatesService.runAllGates.mockReturnValue({
        canPublish: false,
        gates: [
          { name: 'truth', verdict: 'FAIL' },
          { name: 'safety', verdict: 'PASS' },
        ],
        flags: ['GATE_FAIL:truth', 'UNSOURCED_CLAIMS'],
      });

      const result = await controller.validateGates(fakeBody as any);
      expect(result.success).toBe(true);
      expect(result.canPublish).toBe(false);
      expect(result.message).toContain('1 gate(s) failed');
    });
  });

  // ── checkArtefacts ──

  describe('checkArtefacts', () => {
    it('should return canProceed=true when all artefacts present', async () => {
      mocks.mockGatesService.checkArtefacts.mockReturnValue({
        canProceed: true,
        missingArtefacts: [],
      });

      const result = await controller.checkArtefacts({} as any);
      expect(result.success).toBe(true);
      expect(result.data.canProceed).toBe(true);
      expect(result.message).toBe('All 5 artefacts present');
    });

    it('should list missing artefacts in message', async () => {
      mocks.mockGatesService.checkArtefacts.mockReturnValue({
        canProceed: false,
        missingArtefacts: ['claims', 'evidencePack'],
      });

      const result = await controller.checkArtefacts({} as any);
      expect(result.data.canProceed).toBe(false);
      expect(result.message).toContain('claims');
      expect(result.message).toContain('evidencePack');
    });
  });

  // ── getProductionGates ──

  describe('getProductionGates', () => {
    it('should delegate to dataService and return gate fields', async () => {
      mocks.mockDataService.getProduction.mockResolvedValue({
        briefId: 'brief-001',
        status: 'qa',
        gateResults: { truth: 'PASS' },
        qualityScore: 85,
        qualityFlags: ['MISSING_DISCLAIMER'],
      });

      const result = await controller.getProductionGates('brief-001');
      expect(mocks.mockDataService.getProduction).toHaveBeenCalledWith('brief-001');
      expect(result.success).toBe(true);
      expect(result.data.briefId).toBe('brief-001');
      expect(result.data.gateResults).toEqual({ truth: 'PASS' });
      expect(result.data.qualityScore).toBe(85);
      expect(result.timestamp).toBeDefined();
    });
  });
});
