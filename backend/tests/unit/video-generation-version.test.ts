import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { ScriptGeneratorService } from '../../src/modules/media-factory/services/script-generator.service';
import { VideoDataService } from '../../src/modules/media-factory/services/video-data.service';

const version = '2026-10-14T10:00:00.000Z';
const config = {
  get: (key: string) =>
    ({
      SUPABASE_URL: 'https://unit.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'unit-key',
    })[key],
} as ConfigService;

describe('generation and alternate edits revision contract (offline)', () => {
  let row: Record<string, unknown>;
  let service: ScriptGeneratorService;
  let data: VideoDataService;
  let generate: jest.SpyInstance;
  let beforeWrite: () => void;
  let failRead: boolean;
  let failWrite: boolean;
  const input = {
    briefId: 'pilot',
    videoType: 'short',
    vertical: 'freinage',
    regenerate: true,
    expectedUpdatedAt: version,
  };
  beforeEach(() => {
    row = {
      id: 1,
      brief_id: 'pilot',
      status: 'draft',
      updated_at: version,
      script_text: 'Original',
      video_type: 'short',
      vertical: 'freinage',
      gamme_alias: null,
      master_audio_url: 'old.mp3',
      quality_score: 90,
      gate_results: ['old'],
      quality_flags: [],
      approval_record: { stages: [] },
      template_id: 'ne-change-pas-trop-vite',
    };
    beforeWrite = () => undefined;
    failRead = failWrite = false;
    const client = createClient('https://unit.invalid', 'unit-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url, init) => {
          const writing = init?.method === 'PATCH';
          if (writing) beforeWrite();
          if (writing ? failWrite : failRead)
            return new Response(JSON.stringify({ code: '42703' }), {
              status: 400,
            });
          const matches = [...new URL(String(url)).searchParams].every(
            ([key, value]) => key === 'select' || value === `eq.${row[key]}`,
          );
          if (writing && matches)
            Object.assign(row, JSON.parse(String(init!.body)));
          const single = new Headers(init?.headers)
            .get('Accept')
            ?.includes('object+json');
          return new Response(
            JSON.stringify(
              single
                ? matches
                  ? row
                  : { code: 'PGRST116' }
                : matches
                  ? [row]
                  : [],
            ),
            { status: single && !matches ? 406 : 200 },
          );
        },
      },
    });
    service = new ScriptGeneratorService(config);
    data = new VideoDataService(config);
    for (const instance of [service, data])
      Object.defineProperty(instance, 'client', { get: () => client });
    generate = jest
      .spyOn(
        service as unknown as { callGroq: () => Promise<string> },
        'callGroq',
      )
      .mockResolvedValue(JSON.stringify({ script_text: 'Generated' }));
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network forbidden'));
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects an outdated generation request before provider work', async () => {
    row.updated_at = '2026-10-14T11:00:00.000Z';
    await expect(service.generateScript(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(['published', 'rendering', 'script_approved'])(
    'refuses generation in %s',
    async (status) => {
      row.status = status;
      await expect(service.generateScript(input)).rejects.toMatchObject({
        status: 409,
      });
      expect(generate).not.toHaveBeenCalled();
    },
  );
  it('rejects a late generation after manual correction', async () => {
    generate.mockImplementation(async () => {
      await data.updateProduction('pilot', {
        scriptText: 'Manual correction',
        expectedUpdatedAt: version,
      });
      return JSON.stringify({ script_text: 'Late generated' });
    });
    await expect(service.generateScript(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(row.script_text).toBe('Manual correction');
  });
  it('invalidates derived state and preserves approvals on generated text', async () => {
    await service.generateScript(input);
    expect(row).toMatchObject({
      script_text: 'Generated',
      master_audio_url: null,
      quality_score: null,
      gate_results: null,
      approval_record: { stages: [] },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it('rejects empty generated narration without replacing a good script', async () => {
    generate.mockResolvedValue(JSON.stringify({ script_text: ' ' }));
    await expect(service.generateScript(input)).rejects.toMatchObject({
      status: 400,
    });
    expect(row.script_text).toBe('Original');
  });
  it.each(['read', 'write'])(
    'reports %s failures truthfully',
    async (phase) => {
      failRead = phase === 'read';
      failWrite = phase === 'write';
      await expect(service.generateScript(input)).rejects.toMatchObject({
        status: 503,
      });
      expect(row.script_text).toBe('Original');
    },
  );
  it('protects the alternate edit method and invalidates changed narration', async () => {
    await service.updateScript('pilot', {
      scriptText: 'Alternate correction',
      expectedUpdatedAt: version,
    } as never);
    expect(row.master_audio_url).toBeNull();
    await expect(
      service.updateScript('pilot', {
        scriptText: 'Stale',
        expectedUpdatedAt: version,
      } as never),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('requires the editor revision for a scenario change', async () => {
    await expect(
      data.updateProduction('pilot', { scenario: null }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('preserves voice but invalidates QA on a visual scenario edit', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(version));
    await data.updateProduction('pilot', {
      scenario: {
        schemaVersion: 1,
        compositionId: 'NeChangePasTropVite',
        props: { hook: 'Changed style' },
      },
      expectedUpdatedAt: version,
    });
    expect(row).toMatchObject({
      master_audio_url: 'old.mp3',
      quality_score: null,
      gate_results: null,
      updated_at: '2026-10-14T10:00:00.001Z',
    });
  });
  it('rejects a recreated production during scenario persistence', async () => {
    beforeWrite = () => {
      row.id = 2;
    };
    await expect(
      data.updateProduction('pilot', {
        scenario: null,
        expectedUpdatedAt: version,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('requires a revision for generic artefact/QA changes too', async () => {
    await expect(
      data.updateProduction('pilot', { qualityScore: 99 }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
