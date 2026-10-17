import { ConfigService } from '@nestjs/config';
import { VideoDataService } from '../../src/modules/media-factory/services/video-data.service';

const version = '2026-10-14T10:00:00.000Z';
const row = {
  id: 1,
  brief_id: 'local-pilot',
  status: 'draft',
  updated_at: version,
  script_text: 'Original',
  approval_record: { stages: [] },
};

describe('manual script correction version', () => {
  let service: VideoDataService;
  let chain: Record<string, jest.Mock>;
  beforeEach(() => {
    service = new VideoDataService({
      get: (key: string) =>
        key === 'SUPABASE_URL' ? 'http://127.0.0.1:9' : 'local-test-no-key',
    } as ConfigService);
    chain = {};
    for (const name of ['from', 'select', 'eq', 'update'])
      chain[name] = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockResolvedValue({ data: row, error: null });
    Object.defineProperty(service, 'client', { get: () => chain });
  });
  const edit = { scriptText: 'Correction locale', expectedUpdatedAt: version };

  it('requires the version actually read by the editor before writing', async () => {
    await expect(
      service.updateProduction('local-pilot', { scriptText: 'Obsolete' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('refuses a stale browser even when no other write overlaps the request', async () => {
    chain.single.mockResolvedValue({
      data: { ...row, updated_at: '2026-10-14T10:01:00.000Z' },
      error: null,
    });
    await expect(
      service.updateProduction('local-pilot', edit),
    ).rejects.toMatchObject({ status: 409 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('checks the version atomically and leaves approvals untouched', async () => {
    await service.updateProduction('local-pilot', edit);
    expect(chain.eq).toHaveBeenCalledWith('updated_at', version);
    expect(chain.eq).toHaveBeenCalledWith('status', 'draft');
    expect(chain.update.mock.calls[0][0]).toEqual({
      script_text: edit.scriptText,
      script_generated_at: expect.any(String),
      script_model: 'manual',
      updated_at: expect.any(String),
      master_audio_url: null,
      quality_score: null,
      quality_flags: [],
      gate_results: null,
    });
    expect(chain.update.mock.calls[0][0].updated_at).not.toBe(version);
  });
  it('rejects a concurrent update returning no row', async () => {
    chain.single
      .mockResolvedValueOnce({ data: row, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
    await expect(
      service.updateProduction('local-pilot', edit),
    ).rejects.toMatchObject({ status: 409 });
  });
  it.each(['published', 'script_approved', 'rendering'])(
    'preserves %s content',
    async (status) => {
      chain.single.mockResolvedValue({ data: { ...row, status }, error: null });
      await expect(
        service.updateProduction('local-pilot', edit),
      ).rejects.toMatchObject({ status: 409 });
      expect(chain.update).not.toHaveBeenCalled();
    },
  );
  it('rejects status changes bundled with script edits', async () => {
    await expect(
      service.updateProduction('local-pilot', { ...edit, status: 'draft' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('does not disguise a storage outage as a missing production', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: '42703' } });
    await expect(
      service.updateProduction('local-pilot', edit),
    ).rejects.toMatchObject({ status: 503 });
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('reports an absent production', async () => {
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    await expect(
      service.updateProduction('local-pilot', edit),
    ).rejects.toMatchObject({ status: 404 });
  });
});
