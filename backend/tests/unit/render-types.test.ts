/**
 * Render types — Runtime constant & error class tests (P20).
 *
 * Tests: RenderErrorCode enum, NON_RETRYABLE_CODES, RenderEngineUnavailableError.
 *
 * @see backend/src/modules/media-factory/render/types/render.types.ts
 * @see backend/src/modules/media-factory/render/types/canary.types.ts
 */

import {
  RenderErrorCode,
  NON_RETRYABLE_CODES,
} from '../../src/modules/media-factory/render/types/render.types';
import { RenderEngineUnavailableError } from '../../src/modules/media-factory/render/types/canary.types';

describe('RenderErrorCode enum', () => {
  it('should expose exactly 8 error codes', () => {
    const values = Object.values(RenderErrorCode);
    expect(values).toHaveLength(8);
  });

  it('each value should be an uppercase string matching its key', () => {
    for (const [key, value] of Object.entries(RenderErrorCode)) {
      expect(value).toBe(key);
      expect(value).toMatch(/^RENDER_[A-Z_]+$/);
    }
  });
});

describe('NON_RETRYABLE_CODES', () => {
  it('should contain exactly 5 codes', () => {
    expect(NON_RETRYABLE_CODES).toHaveLength(5);
  });

  it('should include permanent failures and exclude retryable codes', () => {
    // These are non-retryable (permanent failures)
    expect(NON_RETRYABLE_CODES).toContain(RenderErrorCode.RENDER_ENGINE_NOT_SUPPORTED);
    expect(NON_RETRYABLE_CODES).toContain(RenderErrorCode.RENDER_ARTEFACTS_INCOMPLETE);
    expect(NON_RETRYABLE_CODES).toContain(RenderErrorCode.RENDER_GATES_FAILED);
    expect(NON_RETRYABLE_CODES).toContain(RenderErrorCode.RENDER_OUTPUT_INVALID);
    expect(NON_RETRYABLE_CODES).toContain(RenderErrorCode.RENDER_CIRCUIT_BREAKER_OPEN);

    // These are retryable — must NOT be in the list
    expect(NON_RETRYABLE_CODES).not.toContain(RenderErrorCode.RENDER_ENGINE_TIMEOUT);
    expect(NON_RETRYABLE_CODES).not.toContain(RenderErrorCode.RENDER_PROCESS_FAILED);
    expect(NON_RETRYABLE_CODES).not.toContain(RenderErrorCode.RENDER_UNKNOWN_ERROR);
  });
});

describe('RenderEngineUnavailableError', () => {
  it('should set name, message, and engineName correctly', () => {
    const error = new RenderEngineUnavailableError('remotion');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RenderEngineUnavailableError');
    expect(error.engineName).toBe('remotion');
    expect(error.message).toBe("Render engine 'remotion' is not available");
  });
});
