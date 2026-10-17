import { VideoPipelineController } from '../../src/modules/media-factory/controllers/video-pipeline.controller';
import { VideoExecutionController } from '../../src/modules/media-factory/controllers/video-execution.controller';
import { TtsService } from '../../src/modules/media-factory/services/tts.service';

const version = '2026-10-14T10:00:00.000Z';

describe('versioned pipeline and review entrypoints (offline)', () => {
  const data = { getProduction: jest.fn() };
  const scripts = { generateScript: jest.fn() };
  const audio = { generateAudio: jest.fn() };
  const derivatives = { deriveFromMaster: jest.fn() };
  let controller: VideoPipelineController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network forbidden'));
    data.getProduction.mockResolvedValue({
      videoType: 'short',
      vertical: 'freinage',
      scriptText: 'Exact narration',
    });
    scripts.generateScript.mockResolvedValue({ claimCount: 1 });
    audio.generateAudio.mockResolvedValue({ costChars: 15, cached: true });
    derivatives.deriveFromMaster.mockResolvedValue({ derivativesCreated: 1 });
    controller = new VideoPipelineController(
      data as never,
      scripts as never,
      audio as never,
      derivatives as never,
    );
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['generateScript', 'generateAudio', 'deriveFromMaster'] as const)(
    '%s rejects missing versions before service work',
    async (method) => {
      await expect(
        controller[method]('pilot', {} as never),
      ).rejects.toMatchObject({ status: 400 });
      expect(data.getProduction).not.toHaveBeenCalled();
      expect(scripts.generateScript).not.toHaveBeenCalled();
      expect(audio.generateAudio).not.toHaveBeenCalled();
      expect(derivatives.deriveFromMaster).not.toHaveBeenCalled();
    },
  );

  it('forwards the client version unchanged across script, audio and derivatives', async () => {
    await controller.generateScript('pilot', { expectedUpdatedAt: version });
    await controller.generateAudio('pilot', { expectedUpdatedAt: version });
    await controller.deriveFromMaster('pilot', { expectedUpdatedAt: version });
    expect(scripts.generateScript).toHaveBeenCalledWith(
      expect.objectContaining({ expectedUpdatedAt: version }),
    );
    expect(audio.generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: version,
        text: 'Exact narration',
        voice: undefined,
      }),
    );
    expect(derivatives.deriveFromMaster).toHaveBeenCalledWith(
      'pilot',
      undefined,
      version,
    );
  });

  it.each([
    [{ user: { cst_id: 42, id: 'other' } }, '42'],
    [{ user: { id: 'session-id' } }, 'session-id'],
    [{}, ''],
  ])(
    'takes review author exclusively from request session %p',
    async (request, identity) => {
      const jobs = {
        mutateRenderReview: jest.fn().mockResolvedValue({ revision: 1 }),
      };
      const execution = new VideoExecutionController(
        jobs as never,
        {} as never,
      );
      const body = { action: 'add', authorId: 'forged' };
      await execution.mutateReview(1, body, request);
      // Strict service parsing rejects the forged body; controller never promotes it to identity.
      expect(jobs.mutateRenderReview).toHaveBeenCalledWith(1, body, identity);
    },
  );

  it('rejects an outdated TTS version before cache or provider work', async () => {
    const cache = { get: jest.fn() };
    const config = {
      get: (key: string) =>
        ({
          SUPABASE_URL: 'https://unit.invalid',
          SUPABASE_SERVICE_ROLE_KEY: 'unit-key',
          AZURE_SPEECH_KEY: 'unit-key',
        })[key],
    };
    const tts = new TtsService(config as never, cache as never);
    jest
      .spyOn(
        tts as unknown as { readAudioProduction: () => Promise<unknown> },
        'readAudioProduction',
      )
      .mockResolvedValue({ updated_at: '2026-10-14T11:00:00.000Z' });
    await expect(
      tts.generateAudio({
        briefId: 'pilot',
        text: 'Exact narration',
        expectedUpdatedAt: version,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(cache.get).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
