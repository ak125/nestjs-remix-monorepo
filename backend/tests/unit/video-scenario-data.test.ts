import { ConfigService } from '@nestjs/config';
import { VideoDataService } from '../../src/modules/media-factory/services/video-data.service';

const scenario = {
  schemaVersion: 1,
  compositionId: 'NeChangePasTropVite',
  props: {
    hook: 'TEST: remaining narrative fields are validated by the renderer',
  },
};
const row = {
  id: 1,
  brief_id: 'pilot',
  status: 'draft',
  template_id: 'ne-change-pas-trop-vite',
  updated_at: '2026-10-13T00:00:00Z',
  scenario,
  approval_record: { stages: [] },
};
describe('scenario persistence boundary', () => {
  let service: VideoDataService;
  let chain: Record<string, jest.Mock>;
  beforeEach(() => {
    service = new VideoDataService({
      get: (k: string) =>
        k === 'SUPABASE_URL' ? 'https://unit.invalid' : 'unit-key',
    } as ConfigService);
    chain = {};
    for (const name of ['from', 'select', 'eq', 'update'])
      chain[name] = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: row, error: null });
    Object.defineProperty(service, 'client', { get: () => chain });
  });
  it('loads the scenario and preserves the existing approval record', async () => {
    expect(await service.getProduction('pilot')).toEqual(
      expect.objectContaining({
        scenario,
        approvalRecord: row.approval_record,
      }),
    );
  });
  it('maps legacy absence to null', async () => {
    chain.single.mockResolvedValue({
      data: { ...row, scenario: undefined },
      error: null,
    });
    expect(await service.getProduction('pilot')).toHaveProperty(
      'scenario',
      null,
    );
  });
  it('persists a draft scenario with an optimistic timestamp check', async () => {
    await service.updateProduction('pilot', {
      scenario,
      expectedUpdatedAt: row.updated_at,
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ scenario }),
    );
    expect(chain.eq).toHaveBeenCalledWith('updated_at', row.updated_at);
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty('approval_record');
  });
  it.each([
    { ...scenario, schemaVersion: 2 },
    { ...scenario, compositionId: 'TestCard' },
    { ...scenario, props: [] },
    { ...scenario, props: { audioUrl: 's3://forbidden' } },
    { ...scenario, props: { disclaimerText: 'generic' } },
  ])('rejects an invalid envelope before persistence', async (invalid) => {
    await expect(
      service.updateProduction('pilot', {
        scenario: invalid,
        expectedUpdatedAt: row.updated_at,
      }),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('refuses changes to non-draft productions', async () => {
    chain.single.mockResolvedValue({
      data: { ...row, status: 'approved' },
      error: null,
    });
    await expect(
      service.updateProduction('pilot', {
        scenario,
        expectedUpdatedAt: row.updated_at,
      }),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('refuses combining scenario mutation with an approval or status change', async () => {
    await expect(
      service.updateProduction('pilot', {
        scenario,
        status: 'approved',
      }),
    ).rejects.toThrow();
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('reports a concurrent edit as conflict, not success', async () => {
    chain.single
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    await expect(
      service.updateProduction('pilot', {
        scenario,
        expectedUpdatedAt: row.updated_at,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('clears a scenario without deleting historical approvals', async () => {
    await service.updateProduction('pilot', {
      scenario: null,
      expectedUpdatedAt: row.updated_at,
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: null }),
    );
    expect(chain.eq).toHaveBeenCalledWith('status', 'draft');
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty('approval_record');
  });
  it.each(['read', 'write'])(
    'reports a %s schema failure as unavailable',
    async (phase) => {
      const error = { code: '42703', message: 'column absent' };
      if (phase === 'write')
        chain.single.mockResolvedValueOnce({ data: row, error: null });
      chain.single.mockResolvedValueOnce({ data: null, error });
      await expect(
        service.updateProduction('pilot', {
          scenario,
          expectedUpdatedAt: row.updated_at,
        }),
      ).rejects.toMatchObject({ status: 503 });
      if (phase === 'read') expect(chain.update).not.toHaveBeenCalled();
    },
  );
});
