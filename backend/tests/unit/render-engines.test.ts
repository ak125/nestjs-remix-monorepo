/**
 * Render Engines — Unit tests (P17).
 *
 * RemotionRenderEngine (~12 tests): circuit breaker, URL normalization,
 * success/Rule 3, error code mapping, timeout, abort handling.
 *
 * StubRenderEngine (~3 tests): success, properties, duration.
 */

import { RemotionRenderEngine } from '../../src/modules/media-factory/render/engines/remotion-render.engine';
import { StubRenderEngine } from '../../src/modules/media-factory/render/engines/stub-render.engine';
import { RenderEngineUnavailableError } from '../../src/modules/media-factory/render/types/canary.types';
import { RenderErrorCode, RenderRequest } from '../../src/modules/media-factory/render/types/render.types';

// ─── Helpers ─────────────────────────────────────────────────

function fakeRequest(overrides: Partial<RenderRequest> = {}): RenderRequest {
  return {
    briefId: 'brief-001',
    executionLogId: 100,
    videoType: 'short',
    vertical: 'freinage',
    templateId: 'test-card',
    gateResults: [],
    qualityScore: 100,
    canPublish: true,
    governanceSnapshot: {
      pipelineEnabled: true,
      gatesBlocking: true,
      renderEngine: 'remotion',
    },
    resolvedCompositionId: 'TestCard',
    compositionProps: null,
    ...overrides,
  };
}

function withEnv(vars: Record<string, string>): () => void {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    originals[k] = process.env[k];
    process.env[k] = v;
  }
  return () => {
    for (const [k] of Object.entries(vars)) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  };
}

function mockFetchResponse(body: Record<string, unknown>, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });
}

// ─── RemotionRenderEngine ────────────────────────────────────

describe('RemotionRenderEngine', () => {
  let engine: RemotionRenderEngine;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    engine = new RemotionRenderEngine();
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ status: 'success', outputPath: '/out.mp4' }),
    } as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  // ── Properties ──

  it('should have name=remotion and version=1.0.0', () => {
    expect(engine.name).toBe('remotion');
    expect(engine.version).toBe('1.0.0');
  });

  // ── Circuit breaker ──

  describe('circuit breaker', () => {
    it('should throw RenderEngineUnavailableError when VIDEO_RENDER_ENABLED is not true', async () => {
      const cleanup = withEnv({ VIDEO_RENDER_ENABLED: 'false' });

      await expect(engine.render(fakeRequest())).rejects.toThrow(
        RenderEngineUnavailableError,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      cleanup();
    });

    it('should throw when no base URL is configured', async () => {
      const cleanup = withEnv({ VIDEO_RENDER_ENABLED: 'true' });
      // Ensure both URL env vars are cleared
      delete process.env.VIDEO_RENDER_BASE_URL;
      delete process.env.VIDEO_REMOTION_ENDPOINT;

      await expect(engine.render(fakeRequest())).rejects.toThrow(
        RenderEngineUnavailableError,
      );
      cleanup();
    });
  });

  // ── URL normalization ──

  describe('URL normalization', () => {
    it('should append /render when base URL does not end with it', async () => {
      const cleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render-svc:3001',
      });

      await engine.render(fakeRequest());

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://render-svc:3001/render',
        expect.any(Object),
      );
      cleanup();
    });

    it('should use URL as-is when already ends with /render', async () => {
      const cleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render-svc:3001/render',
      });

      await engine.render(fakeRequest());

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://render-svc:3001/render',
        expect.any(Object),
      );
      cleanup();
    });
  });

  // ── Success path ──

  describe('success path', () => {
    it('should return success with outputPath on HTTP 200', async () => {
      const cleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render:3001',
      });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          status: 'success',
          outputPath: '/s3/video-001.mp4',
          durationMs: 5000,
          metadata: { resolution: '1080p' },
        }),
      });

      const result = await engine.render(fakeRequest());

      expect(result.status).toBe('success');
      expect(result.outputPath).toBe('/s3/video-001.mp4');
      expect(result.engineName).toBe('remotion');
      expect(result.retryable).toBe(false);
      cleanup();
    });

    it('should fail with RENDER_OUTPUT_INVALID when success but no outputPath (Rule 3)', async () => {
      const cleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render:3001',
      });
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          status: 'success',
          outputPath: null,
          durationMs: 3000,
        }),
      });

      const result = await engine.render(fakeRequest());

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_OUTPUT_INVALID);
      expect(result.retryable).toBe(true);
      expect(result.errorMessage).toContain('no output file');
      cleanup();
    });
  });

  // ── Error code mapping ──

  describe('error code mapping', () => {
    function setupFailedResponse(errorCode: string, cleanup?: () => void) {
      const envCleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render:3001',
      });
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({
          status: 'failed',
          errorCode,
          errorMessage: `Service error: ${errorCode}`,
        }),
      });
      return envCleanup;
    }

    it('should map RENDER_TIMEOUT to RENDER_ENGINE_TIMEOUT', async () => {
      const cleanup = setupFailedResponse('RENDER_TIMEOUT');
      const result = await engine.render(fakeRequest());

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_ENGINE_TIMEOUT);
      expect(result.retryable).toBe(true);
      cleanup();
    });

    it('should map INVALID_REQUEST to RENDER_PROCESS_FAILED with retryable=false', async () => {
      const cleanup = setupFailedResponse('INVALID_REQUEST');
      const result = await engine.render(fakeRequest());

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_PROCESS_FAILED);
      expect(result.retryable).toBe(false);
      cleanup();
    });

    it('should map unknown error code to RENDER_UNKNOWN_ERROR with retryable=true', async () => {
      const cleanup = setupFailedResponse('SOME_WEIRD_ERROR');
      const result = await engine.render(fakeRequest());

      expect(result.status).toBe('failed');
      expect(result.errorCode).toBe(RenderErrorCode.RENDER_UNKNOWN_ERROR);
      expect(result.retryable).toBe(true);
      cleanup();
    });
  });

  // ── Timeout and fetch errors ──

  describe('timeout and fetch errors', () => {
    it('should throw RENDER_TIMEOUT on AbortError', async () => {
      const cleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render:3001',
        VIDEO_REMOTION_TIMEOUT_MS: '100',
      });
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      fetchSpy.mockRejectedValue(abortError);

      await expect(engine.render(fakeRequest())).rejects.toThrow(
        'RENDER_TIMEOUT:',
      );
      cleanup();
    });

    it('should re-throw non-abort fetch errors', async () => {
      const cleanup = withEnv({
        VIDEO_RENDER_ENABLED: 'true',
        VIDEO_RENDER_BASE_URL: 'http://render:3001',
      });
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(engine.render(fakeRequest())).rejects.toThrow(
        'ECONNREFUSED',
      );
      cleanup();
    });
  });
});

// ─── StubRenderEngine ────────────────────────────────────────

describe('StubRenderEngine', () => {
  let engine: StubRenderEngine;

  beforeEach(() => {
    engine = new StubRenderEngine();
  });

  it('should return success with stub metadata', async () => {
    const result = await engine.render(fakeRequest());

    expect(result.status).toBe('success');
    expect(result.outputPath).toBeNull();
    expect(result.engineName).toBe('stub');
    expect(result.metadata).toMatchObject({ stub: true, briefId: 'brief-001' });
    expect(result.retryable).toBe(false);
  });

  it('should have name=stub and version=1.0.0', () => {
    expect(engine.name).toBe('stub');
    expect(engine.version).toBe('1.0.0');
  });

  it('should have durationMs > 0 from simulation delay', async () => {
    const result = await engine.render(fakeRequest());

    expect(result.durationMs).toBeGreaterThan(0);
  });
});
