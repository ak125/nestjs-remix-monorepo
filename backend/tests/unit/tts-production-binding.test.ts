import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { AudioCacheService } from '../../src/modules/media-factory/services/audio-cache.service';
import { TtsService } from '../../src/modules/media-factory/services/tts.service';

describe('TTS production binding (offline PostgREST contract)', () => {
  let service: TtsService;
  let row: Record<string, unknown> | null;
  let cache: { get: jest.Mock; set: jest.Mock };
  let synthesize: jest.SpyInstance;
  let upload: jest.SpyInstance;
  let requests: { method: string; url: URL; body: Record<string, unknown> }[];
  let failRead: boolean;
  let failWrite: boolean;
  const input = { briefId: 'pilot', text: 'Une narration exacte.' };

  beforeEach(() => {
    row = {
      id: 42,
      brief_id: 'pilot',
      script_text: input.text,
      updated_at: '2026-10-13T00:00:00.000Z',
      status: 'draft',
      master_audio_url: 'https://media.invalid/previous.mp3',
      approval_record: { stages: [] },
    };
    requests = [];
    failRead = false;
    failWrite = false;
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    service = new TtsService(
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
    // Real supabase-js query serialization, entirely in-memory HTTP transport.
    const client = createClient('https://unit.invalid', 'unit-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (url, init) => {
          const request = {
            method: init?.method ?? 'GET',
            url: new URL(String(url)),
            body: init?.body ? JSON.parse(String(init.body)) : {},
          };
          requests.push(request);
          const writing = request.method === 'PATCH';
          if (writing ? failWrite : failRead) {
            return new Response(
              JSON.stringify({
                code: '42703',
                message: 'fixture schema error',
              }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
          }
          const matches =
            row &&
            [...request.url.searchParams].every(
              ([key, value]) => key === 'select' || value === `eq.${row![key]}`,
            );
          if (writing && matches) Object.assign(row!, request.body);
          return new Response(JSON.stringify(matches ? [row] : []), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      },
    });
    Object.defineProperty(service, 'client', { get: () => client });
    const provider = service as unknown as {
      synthesizeAzure: (
        text: string,
        voice: string,
        rate: string,
      ) => Promise<Buffer>;
      uploadToStorage: (path: string, buffer: Buffer) => Promise<string>;
    };
    synthesize = jest
      .spyOn(provider, 'synthesizeAzure')
      .mockResolvedValue(Buffer.from('fixture-audio'));
    upload = jest
      .spyOn(provider, 'uploadToStorage')
      .mockResolvedValue('https://media.invalid/new.mp3');
  });

  afterEach(() => jest.restoreAllMocks());

  it('persists fresh audio using the exact production identity, status and version', async () => {
    await expect(service.generateAudio(input)).resolves.toMatchObject({
      cached: false,
    });
    const patch = requests.find((request) => request.method === 'PATCH')!;
    expect(Object.fromEntries(patch.url.searchParams)).toMatchObject({
      id: 'eq.42',
      brief_id: 'eq.pilot',
      status: 'eq.draft',
      updated_at: 'eq.2026-10-13T00:00:00.000Z',
    });
    // Do not put potentially long narration in a URL; script writers advance updated_at.
    expect(patch.url.searchParams.has('script_text')).toBe(false);
    expect(row!.master_audio_url).toBe('https://media.invalid/new.mp3');
    expect(row!.approval_record).toEqual({ stages: [] });
  });

  it.each(['text', 'scenario', 'approval', 'deleted', 'recreated'])(
    'rejects a stale generation after a concurrent %s change',
    async (change) => {
      upload.mockImplementation(async () => {
        if (change === 'text') {
          row!.script_text = 'Nouvelle narration.';
          row!.updated_at = '2026-10-13T00:00:01.000Z';
        }
        if (change === 'scenario') row!.updated_at = '2026-10-13T00:00:01.000Z';
        if (change === 'approval') row!.status = 'ready_for_publish';
        if (change === 'deleted') row = null;
        if (change === 'recreated') row!.id = 43;
        return 'https://media.invalid/stale.mp3';
      });
      await expect(service.generateAudio(input)).rejects.toMatchObject({
        status: 409,
      });
      if (row)
        expect(row.master_audio_url).toBe('https://media.invalid/previous.mp3');
    },
  );

  it('applies the same concurrency guard on cache hits without calling Azure', async () => {
    cache.get.mockImplementation(async () => {
      row!.updated_at = '2026-10-13T00:00:01.000Z';
      return { url: 'https://media.invalid/cached.mp3', durationSecs: 3 };
    });
    await expect(service.generateAudio(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(synthesize).not.toHaveBeenCalled();
    expect(row!.master_audio_url).toBe('https://media.invalid/previous.mp3');
  });

  it('successfully attaches an unchanged cached narration', async () => {
    cache.get.mockResolvedValue({
      url: 'https://media.invalid/cached.mp3',
      durationSecs: 3,
    });
    await expect(service.generateAudio(input)).resolves.toMatchObject({
      cached: true,
      durationSecs: 3,
    });
    expect(row!.master_audio_url).toBe('https://media.invalid/cached.mp3');
    expect(synthesize).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it.each(['read', 'write'])(
    'reports %s failure instead of success',
    async (phase) => {
      failRead = phase === 'read';
      failWrite = phase === 'write';
      await expect(service.generateAudio(input)).rejects.toMatchObject({
        status: 503,
      });
      expect(row!.master_audio_url).toBe('https://media.invalid/previous.mp3');
      if (phase === 'read') expect(synthesize).not.toHaveBeenCalled();
    },
  );

  it('rejects a missing production before provider or cache work', async () => {
    row = null;
    await expect(service.generateAudio(input)).rejects.toMatchObject({
      status: 404,
    });
    expect(cache.get).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
  });

  it.each([
    'rendering',
    'qa',
    'qa_failed',
    'ready_for_publish',
    'published',
    'archived',
  ])('refuses to replace audio of a %s production', async (status) => {
    row!.status = status;
    await expect(service.generateAudio(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(synthesize).not.toHaveBeenCalled();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it.each(['draft', 'pending_review', 'script_approved', 'storyboard'])(
    'allows audio preparation in %s',
    async (status) => {
      row!.status = status;
      await expect(service.generateAudio(input)).resolves.toMatchObject({
        cached: false,
      });
    },
  );

  it('rejects text changed between the controller read and service preflight', async () => {
    row!.script_text = 'Texte plus récent.';
    await expect(service.generateAudio(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('rejects an unversioned legacy row before generation', async () => {
    row!.updated_at = null;
    await expect(service.generateAudio(input)).rejects.toMatchObject({
      status: 409,
    });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it('allows only one of two concurrent generations to attach, even in the same millisecond', async () => {
    const version = '2026-10-13T00:00:00.000Z';
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(version));
    let arrive!: () => void;
    const bothArrived = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    let waiting = 0;
    upload.mockImplementation(async () => {
      const number = ++waiting;
      if (waiting === 2) arrive();
      await bothArrived;
      return `https://media.invalid/voice-${number}.mp3`;
    });
    const results = await Promise.allSettled([
      service.generateAudio(input),
      service.generateAudio(input),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ status: 409 }),
      }),
    ]);
    expect(row!.updated_at).toBe('2026-10-13T00:00:00.001Z');
  });

  it('normalizes surrounding whitespace without putting long narration in the update URL', async () => {
    const longText = 'Narration française. '.repeat(1200).trim();
    row!.script_text = ` ${longText} `;
    await expect(
      service.generateAudio({ ...input, text: row!.script_text as string }),
    ).resolves.toMatchObject({ cached: false });
    expect(synthesize).toHaveBeenCalledWith(
      longText,
      'fr-FR-HenriNeural',
      '-10%',
    );
    expect(
      requests.find((request) => request.method === 'PATCH')!.url.href.length,
    ).toBeLessThan(500);
  });

  it('preserves the previous audio when synthesis fails', async () => {
    synthesize.mockRejectedValue(new Error('fixture provider failure'));
    await expect(service.generateAudio(input)).rejects.toThrow(
      'fixture provider failure',
    );
    expect(upload).not.toHaveBeenCalled();
    expect(requests.some((request) => request.method === 'PATCH')).toBe(false);
    expect(row!.master_audio_url).toBe('https://media.invalid/previous.mp3');
  });

  it.each([
    { voice: 'unknown' },
    { voice: 'toString' },
    { speed: 0 },
    { speed: 2.1 },
    { speed: Number.NaN },
    { speed: '0.9' },
    { text: '' },
    { text: null },
  ])(
    'rejects invalid synthesis parameters %p before side effects',
    async (invalid) => {
      await expect(
        service.generateAudio({ ...input, ...invalid } as never),
      ).rejects.toMatchObject({ status: 400 });
      expect(synthesize).not.toHaveBeenCalled();
      expect(cache.get).not.toHaveBeenCalled();
      expect(requests).toHaveLength(0);
    },
  );
});
