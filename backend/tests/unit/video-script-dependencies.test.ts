import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { AudioCacheService } from '../../src/modules/media-factory/services/audio-cache.service';
import { TtsService } from '../../src/modules/media-factory/services/tts.service';
import { VideoDataService } from '../../src/modules/media-factory/services/video-data.service';

const version = '2026-10-14T10:00:00.000Z';
const original = {
  id: 42,
  brief_id: 'local-pilot',
  status: 'draft',
  updated_at: version,
  script_text: 'Narration originale.',
  master_audio_url: 'https://media.invalid/original.mp3',
  tts_voice: 'fr-FR-HenriNeural',
  tts_speed: 0.9,
  quality_score: 95,
  quality_flags: ['GATE_WARN:G3'],
  gate_results: [{ gate: 'G1', verdict: 'PASS' }],
  approval_record: { stages: [{ stage: 'script', status: 'approved' }] },
  scenario: { schemaVersion: 1, props: { hook: 'Original' } },
};

describe('manual script dependencies (offline PostgREST contract)', () => {
  let service: VideoDataService;
  let row: typeof original;
  let beforeWrite: () => void;
  let failWrite: boolean;
  let patches: Record<string, unknown>[];
  let tts: TtsService;
  let cache: { get: jest.Mock; set: jest.Mock };

  beforeEach(() => {
    row = structuredClone(original);
    beforeWrite = () => undefined;
    failWrite = false;
    patches = [];
    service = new VideoDataService({
      get: (key: string) =>
        key === 'SUPABASE_URL' ? 'https://unit.invalid' : 'unit-key',
    } as ConfigService);
    // Installed supabase-js serializes the real query. No network transport.
    const client = createClient('https://unit.invalid', 'unit-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url, init) => {
          const writing = init?.method === 'PATCH';
          const query = new URL(String(url)).searchParams;
          if (writing) {
            patches.push(JSON.parse(String(init!.body)));
            beforeWrite();
          }
          if (writing && failWrite)
            return new Response(JSON.stringify({ code: '42703' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            });
          const matches = [...query].every(
            ([key, value]) =>
              key === 'select' ||
              value === `eq.${row[key as keyof typeof row]}`,
          );
          if (writing && matches) Object.assign(row, patches.at(-1));
          const single = new Headers(init?.headers)
            .get('Accept')
            ?.includes('application/vnd.pgrst.object+json');
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
            {
              status: single && !matches ? 406 : 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        },
      },
    });
    Object.defineProperty(service, 'client', { get: () => client });
    cache = { get: jest.fn(), set: jest.fn() };
    tts = new TtsService(
      {
        get: (key: string) =>
          ({
            SUPABASE_URL: 'https://unit.invalid',
            SUPABASE_SERVICE_ROLE_KEY: 'unit-key',
            AZURE_SPEECH_KEY: 'unit-key',
          })[key],
      } as ConfigService,
      cache as unknown as AudioCacheService,
    );
    Object.defineProperty(tts, 'client', { get: () => client });
    // A cache miss must fail locally instead of reaching any real provider.
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network forbidden'));
  });

  afterEach(() => jest.restoreAllMocks());

  it('detaches obsolete narration and clears current QA in the same script write', async () => {
    const result = await service.updateProduction('local-pilot', {
      scriptText: 'Narration corrigée.',
      expectedUpdatedAt: version,
    });
    expect(result).toMatchObject({
      scriptText: 'Narration corrigée.',
      masterAudioUrl: null,
      qualityScore: null,
      qualityFlags: [],
      gateResults: null,
    });
    expect(patches).toHaveLength(1);
    expect(row.approval_record).toEqual(original.approval_record);
    expect(row.scenario).toEqual(original.scenario);
    expect(row.tts_voice).toBe(original.tts_voice);
    expect(row.tts_speed).toBe(original.tts_speed);
  });

  it.each(['Narration originale.', ' \nNarration originale.  '])(
    'preserves matching narration and QA for an unchanged normalized script: %p',
    async (scriptText) => {
      const result = await service.updateProduction('local-pilot', {
        scriptText,
        expectedUpdatedAt: version,
      });
      expect(result.masterAudioUrl).toBe(original.master_audio_url);
      expect(result.qualityScore).toBe(95);
      expect(result.gateResults).toEqual(original.gate_results);
    },
  );

  it('treats internal punctuation and whitespace as a narration change', async () => {
    await service.updateProduction('local-pilot', {
      scriptText: 'Narration  originale !',
      expectedUpdatedAt: version,
    });
    expect(row.master_audio_url).toBeNull();
  });

  it.each(['audio', 'approval', 'recreated'])(
    'preserves concurrent %s data instead of partially clearing dependencies',
    async (change) => {
      beforeWrite = () => {
        if (change === 'audio') {
          row.master_audio_url = 'https://media.invalid/newer.mp3';
          row.updated_at = '2026-10-14T10:01:00.000Z';
        } else if (change === 'approval') row.status = 'pending_review';
        else row.id = 43;
      };
      await expect(
        service.updateProduction('local-pilot', {
          scriptText: 'Narration corrigée.',
          expectedUpdatedAt: version,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(row.script_text).toBe(original.script_text);
      expect(row.quality_score).toBe(original.quality_score);
      expect(row.master_audio_url).toBe(
        change === 'audio'
          ? 'https://media.invalid/newer.mp3'
          : original.master_audio_url,
      );
    },
  );

  it('keeps narration and QA when persistence fails', async () => {
    failWrite = true;
    await expect(
      service.updateProduction('local-pilot', {
        scriptText: 'Narration corrigée.',
        expectedUpdatedAt: version,
      }),
    ).rejects.toMatchObject({ status: 503 });
    expect(row).toEqual(original);
  });

  it('advances the revision even when the clock has not moved', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(version));
    await service.updateProduction('local-pilot', {
      scriptText: 'Narration corrigée.',
      expectedUpdatedAt: version,
    });
    expect(row.updated_at).toBe('2026-10-14T10:00:00.001Z');
  });

  it('prevents audio already being prepared from reattaching after the script edit', async () => {
    let reachedCache!: () => void;
    const started = new Promise<void>((resolve) => {
      reachedCache = resolve;
    });
    let release!: (audio: { url: string; durationSecs: number }) => void;
    cache.get.mockImplementation(() => {
      reachedCache();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const audio = tts.generateAudio({
      briefId: 'local-pilot',
      text: original.script_text,
    });
    await Promise.race([started, audio]);
    await service.updateProduction('local-pilot', {
      scriptText: 'Narration corrigée.',
      expectedUpdatedAt: version,
    });
    release({ url: 'https://media.invalid/late.mp3', durationSecs: 3 });
    await expect(audio).rejects.toMatchObject({ status: 409 });
    expect(row.master_audio_url).toBeNull();
    expect(row.script_text).toBe('Narration corrigée.');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('preserves a newly attached audio when the older editor submits next', async () => {
    cache.get.mockResolvedValue({
      url: 'https://media.invalid/fresh.mp3',
      durationSecs: 3,
    });
    await tts.generateAudio({
      briefId: 'local-pilot',
      text: original.script_text,
    });
    await expect(
      service.updateProduction('local-pilot', {
        scriptText: 'Narration corrigée.',
        expectedUpdatedAt: version,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(row.master_audio_url).toBe('https://media.invalid/fresh.mp3');
    expect(row.script_text).toBe(original.script_text);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
