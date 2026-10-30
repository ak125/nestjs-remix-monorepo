import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PostprocessService } from '../../src/modules/media-factory/services/postprocess.service';

const inspection = {
  checksumSha256: 'a'.repeat(64),
  fileSizeBytes: 1024,
  durationSecs: 2,
  video: {
    codec: 'h264',
    width: 1080,
    height: 1920,
    fps: 30,
    frames: 60,
    durationSecs: 2,
  },
  audio: [{ codec: 'aac', channels: 2, sampleRate: 48000, durationSecs: 2 }],
};
const variant = {
  name: '1080p_vertical',
  s3Path: 's3://media/v.mp4',
  codec: 'h264',
  resolution: '1080x1920',
  fileSizeBytes: 1024,
  durationSecs: 2,
  inspection,
  audioMergeMode: 'replace' as const,
  audioNormalization: {
    status: 'normalized',
    targetLufs: -14,
    measuredInputLufs: -22,
    measuredOutputLufs: -14.1,
  },
};
const input = {
  briefId: 'brief-1',
  executionLogId: 17,
  renderOutputPath: 's3://media/master.mp4',
  videoType: 'short',
};

function setup(
  options: {
    variantError?: string;
    logError?: string;
    missingLog?: boolean;
    disabled?: boolean;
  } = {},
) {
  const config = new ConfigService({
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-placeholder',
    POSTPROCESS_ENABLED: options.disabled ? 'false' : 'true',
  });
  const service = new PostprocessService(config);
  const logResult = {
    data: options.missingLog ? null : { id: 17 },
    error: options.logError ? { message: options.logError } : null,
  };
  const chain = {
    upsert: jest.fn().mockResolvedValue({
      error: options.variantError ? { message: options.variantError } : null,
    }),
    update: jest.fn(),
    eq: jest.fn(),
    select: jest.fn(),
    single: jest.fn().mockResolvedValue(logResult),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  Object.assign(chain, {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(logResult).then(resolve),
  });
  const from = jest.fn().mockReturnValue(chain);
  Object.defineProperty(service, 'client', {
    get: () => ({ from }),
    configurable: true,
  });
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      status: 'success',
      variants: [variant],
      srtS3Path: null,
      totalDurationMs: 50,
    }),
  } as Response);
  return { service, chain, from, fetchMock };
}

afterEach(() => jest.restoreAllMocks());

describe('Postprocess inspection persistence', () => {
  it('sends the inspection JSON with an execution-bound update through the real Supabase client', async () => {
    const { service } = setup();
    const databaseFetch = jest
      .fn()
      .mockImplementation(async (url: string, init: RequestInit) => {
        if (init.method === 'PATCH')
          return new Response(JSON.stringify({ id: 17 }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        return new Response(null, { status: 201 });
      });
    const client = createClient('https://db.invalid', 'test-placeholder', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: databaseFetch },
    });
    Object.defineProperty(service, 'client', { get: () => client });
    await expect(service.postprocess(input)).resolves.toMatchObject({
      variants: [variant],
    });
    expect(databaseFetch).toHaveBeenCalledTimes(2);
    const [url, init] = databaseFetch.mock.calls[1] as [string, RequestInit];
    const query = new URL(url);
    expect(query.pathname).toBe('/rest/v1/__video_execution_log');
    expect(query.searchParams.get('id')).toBe('eq.17');
    expect(query.searchParams.get('select')).toBe('id');
    expect(new Headers(init.headers).get('prefer')).toContain(
      'return=representation',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      postprocess_variants: [variant],
      postprocess_duration_ms: 50,
      srt_s3_path: null,
    });
  });

  it('keeps the complete inspection in the existing execution JSON and result', async () => {
    const { service, chain } = setup();
    const result = await service.postprocess(input);
    expect(result?.variants).toEqual([variant]);
    expect(chain.update).toHaveBeenCalledWith({
      postprocess_variants: [variant],
      postprocess_duration_ms: 50,
      srt_s3_path: null,
    });
    expect(chain.eq).toHaveBeenCalledWith('id', 17);
    expect(chain.update.mock.calls[0][0]).not.toHaveProperty('can_publish');
  });
  it('does not report success after a variant write fails', async () => {
    const { service, chain } = setup({ variantError: 'write rejected' });
    await expect(service.postprocess(input)).rejects.toThrow('write rejected');
    expect(chain.update).not.toHaveBeenCalled();
  });
  it('does not report success after inspection persistence fails', async () => {
    const { service } = setup({ logError: 'log rejected' });
    await expect(service.postprocess(input)).rejects.toThrow('log rejected');
  });
  it('requires an execution row to actually be updated', async () => {
    const { service } = setup({ missingLog: true });
    await expect(service.postprocess(input)).rejects.toThrow('execution');
  });
  it('keeps the disabled path free of renderer and database calls', async () => {
    const { service, from, fetchMock } = setup({ disabled: true });
    await expect(service.postprocess(input)).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

it('forwards an explicit audio mode without choosing one for the caller', async () => {
  const { service, fetchMock } = setup();
  await service.postprocess({
    ...input,
    audioS3Key: 's3://media/voice.mp3',
    audioMergeMode: 'mix',
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
    audioS3Key: 's3://media/voice.mp3',
    audioMergeMode: 'mix',
  });
});

it('distinguishes an unavailable variants query from a true empty result', async () => {
  const { service, chain } = setup();
  const order = jest
    .fn()
    .mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } })
    .mockResolvedValueOnce({ data: [], error: null });
  Object.assign(chain, { order });
  await expect(service.listVariants(17)).rejects.toMatchObject({ status: 503 });
  await expect(service.listVariants(17)).resolves.toEqual([]);
});
