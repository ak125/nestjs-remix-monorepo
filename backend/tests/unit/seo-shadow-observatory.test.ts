/**
 * SeoShadowObservatory — service public, sync API + circuit breaker.
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-observatory.service.ts
 */
import { ConfigService } from '@nestjs/config';

import { SeoFeatureFlagRegistry } from '../../src/modules/seo/registries/seo-feature-flag.registry';
import { SeoShadowObservatory } from '../../src/modules/seo-shadow-observatory/seo-shadow-observatory.service';
import { SeoShadowSampler } from '../../src/modules/seo-shadow-observatory/seo-shadow-sampler.service';
import {
  SeoShadowChainRunner,
  SeoShadowChainTimeoutError,
} from '../../src/modules/seo-shadow-observatory/seo-shadow-chain-runner.service';
import { SeoShadowDiffEngine } from '../../src/modules/seo-shadow-observatory/seo-shadow-diff-engine.service';
import { SeoShadowEventSink } from '../../src/modules/seo-shadow-observatory/seo-shadow-event-sink.service';
import { SeoShadowUrlNormalizer } from '../../src/modules/seo-shadow-observatory/seo-shadow-url-normalizer.service';

function flushImmediates(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeCfg(rate = '1', mode: 'off' | 'shadow' | 'on' = 'shadow'): ConfigService {
  process.env.SEO_CHAIN_R7_MODE = mode;
  process.env.SEO_CHAIN_SHADOW_SAMPLE_RATE = rate;
  return {
    get: (k: string) => process.env[k],
  } as unknown as ConfigService;
}

function buildInput(overrides: Record<string, unknown> = {}) {
  return {
    surface: 'R7_BRAND_HUB' as const,
    legacy: {
      title: 'A',
      description: 'B',
      h1: 'C',
      content: 'D',
      keywords: 'E',
      canonical: 'https://www.automecanik.com/x',
      robots: 'index,follow',
    },
    requestUrl: 'https://www.automecanik.com/x',
    ids: { brandId: 1, brandAlias: 'bmw' },
    vars: { VMarque: 'BMW' },
    entityId: '1',
    ...overrides,
  };
}

describe('SeoShadowObservatory', () => {
  let cfg: ConfigService;
  let flags: SeoFeatureFlagRegistry;
  let sampler: SeoShadowSampler;
  let chainRunner: SeoShadowChainRunner;
  let diffEngine: SeoShadowDiffEngine;
  let sink: SeoShadowEventSink;
  let observatory: SeoShadowObservatory;

  beforeEach(() => {
    cfg = makeCfg('1', 'shadow');
    flags = new SeoFeatureFlagRegistry();
    sampler = new SeoShadowSampler(cfg);
    chainRunner = {
      compute: jest.fn().mockResolvedValue({
        title: 'A',
        description: 'B',
        h1: 'C',
        content: 'D',
        keywords: 'E',
        canonical: 'https://www.automecanik.com/x',
        robots: 'index,follow',
      }),
    } as unknown as SeoShadowChainRunner;
    diffEngine = new SeoShadowDiffEngine(new SeoShadowUrlNormalizer());
    sink = { write: jest.fn().mockResolvedValue(undefined) } as unknown as SeoShadowEventSink;
    observatory = new SeoShadowObservatory(
      flags,
      sampler,
      chainRunner,
      diffEngine,
      sink,
    );
  });

  afterEach(() => {
    delete process.env.SEO_CHAIN_R7_MODE;
    delete process.env.SEO_CHAIN_SHADOW_SAMPLE_RATE;
    jest.restoreAllMocks();
  });

  it('mode=off → chainRunner non appelé, sink non appelé', async () => {
    process.env.SEO_CHAIN_R7_MODE = 'off';
    observatory.observe(buildInput());
    await flushImmediates();
    expect(chainRunner.compute).not.toHaveBeenCalled();
    expect(sink.write).not.toHaveBeenCalled();
  });

  it('mode=on → chainRunner non appelé (PR-6 ne contient pas la branche on)', async () => {
    process.env.SEO_CHAIN_R7_MODE = 'on';
    observatory.observe(buildInput());
    await flushImmediates();
    expect(chainRunner.compute).not.toHaveBeenCalled();
    expect(sink.write).not.toHaveBeenCalled();
  });

  it('mode=shadow + sample → chainRunner + sink appelés', async () => {
    observatory.observe(buildInput());
    await flushImmediates();
    expect(chainRunner.compute).toHaveBeenCalledTimes(1);
    expect(sink.write).toHaveBeenCalledTimes(1);
  });

  it('mode=shadow + sample rate 0 → chainRunner non appelé', async () => {
    process.env.SEO_CHAIN_SHADOW_SAMPLE_RATE = '0';
    sampler = new SeoShadowSampler(cfg);
    observatory = new SeoShadowObservatory(
      flags,
      sampler,
      chainRunner,
      diffEngine,
      sink,
    );
    observatory.observe(buildInput());
    await flushImmediates();
    expect(chainRunner.compute).not.toHaveBeenCalled();
  });

  it('observe() retourne SYNCHRONEMENT — chainRunner.compute pas encore lancé après return', () => {
    let computeStarted = false;
    (chainRunner.compute as jest.Mock).mockImplementation(async () => {
      computeStarted = true;
      return {
        title: 'A',
        description: 'B',
        h1: 'C',
        content: 'D',
        keywords: 'E',
        canonical: 'https://www.automecanik.com/x',
        robots: 'index,follow',
      };
    });
    observatory.observe(buildInput());
    // Au retour synchrone, setImmediate n'a pas encore tiré.
    expect(computeStarted).toBe(false);
  });

  it('input invalide Zod → log + no-op (pas de crash propagé)', async () => {
    const errSpy = jest.spyOn((observatory as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => {});
    observatory.observe({ not: 'valid' });
    await flushImmediates();
    expect(errSpy).toHaveBeenCalled();
    expect(chainRunner.compute).not.toHaveBeenCalled();
  });

  it('chainRunner throw non-timeout → sink non appelé, error loggée', async () => {
    (chainRunner.compute as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    const errSpy = jest.spyOn((observatory as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => {});
    observatory.observe(buildInput());
    await flushImmediates();
    await flushImmediates();
    expect(sink.write).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalled();
  });

  it('circuit breaker s’ouvre après 50 timeouts/min', async () => {
    (chainRunner.compute as jest.Mock).mockRejectedValue(
      new SeoShadowChainTimeoutError(),
    );
    jest.spyOn((observatory as unknown as { logger: { error: () => void } }).logger, 'error').mockImplementation(() => {});

    // Empile 50 observations qui timeout
    for (let i = 0; i < 50; i++) {
      observatory.observe(buildInput({ entityId: `t-${i}` }));
    }
    // Laisse les setImmediate tirer
    for (let i = 0; i < 60; i++) {
      await flushImmediates();
    }

    // 51e tentative → breaker ouvert, chainRunner non appelé
    const callsBefore = (chainRunner.compute as jest.Mock).mock.calls.length;
    observatory.observe(buildInput({ entityId: 'after' }));
    await flushImmediates();
    const callsAfter = (chainRunner.compute as jest.Mock).mock.calls.length;
    expect(callsAfter).toBe(callsBefore);
  });

  it('surface non câblée pour shadow (ex: R0_HOME) → no-op', async () => {
    observatory.observe(buildInput({ surface: 'R0_HOME' }));
    await flushImmediates();
    expect(chainRunner.compute).not.toHaveBeenCalled();
  });
});
