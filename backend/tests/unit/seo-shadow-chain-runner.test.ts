/**
 * SeoShadowChainRunner — adaptateur unique vers SeoChainOrchestratorService
 * + timeout 2s + Zod validation du output.
 *
 * @see backend/src/modules/seo-shadow-observatory/seo-shadow-chain-runner.service.ts
 */
import {
  SeoShadowChainRunner,
  SeoShadowChainTimeoutError,
  SeoShadowSurfaceNotWiredError,
} from '../../src/modules/seo-shadow-observatory/seo-shadow-chain-runner.service';
import type { SeoChainOrchestratorService } from '../../src/modules/seo/services/chain/seo-chain-orchestrator.service';
import type { ShadowObservationInput } from '../../src/modules/seo-shadow-observatory/types';

function fakeOrchestratorOk() {
  return {
    run: jest.fn().mockResolvedValue({
      surfaceKey: 'R7_BRAND_HUB',
      template: {
        title: 'A',
        description: 'B',
        h1: 'C',
        preview: 'P',
        content: 'D',
        keywords: 'E',
      },
      contentBlocks: [],
      policies: { canonical: 'https://www.automecanik.com/x', robots: 'index,follow', blockingReasons: [] },
      ariane: { jsonLd: null, textTrail: null },
      metadata: {},
    }),
  } as unknown as SeoChainOrchestratorService;
}

function r7Input(overrides: Partial<ShadowObservationInput> = {}): ShadowObservationInput {
  return {
    surface: 'R7_BRAND_HUB',
    legacy: { title: 'A' },
    requestUrl: 'https://www.automecanik.com/constructeurs/bmw.html',
    ids: { brandId: 1, brandAlias: 'bmw' },
    vars: { VMarque: 'BMW' },
    entityId: '1',
    ...overrides,
  };
}

describe('SeoShadowChainRunner', () => {
  it('compute success → ChainSeoSnapshot bien formé', async () => {
    const runner = new SeoShadowChainRunner(fakeOrchestratorOk());
    const out = await runner.compute(r7Input());
    expect(out.title).toBe('A');
    expect(out.canonical).toBe('https://www.automecanik.com/x');
    expect(out.robots).toBe('index,follow');
  });

  it('R8 input → adapté avec ids brandAlias/modeleAlias/typeAlias', async () => {
    const orchestrator = fakeOrchestratorOk();
    const runner = new SeoShadowChainRunner(orchestrator);
    await runner.compute(
      r7Input({
        surface: 'R8_VEHICLE',
        ids: {
          brandId: 1,
          brandAlias: 'bmw',
          modeleAlias: 'serie-3',
          typeAlias: '320i',
          typeId: 9876,
        },
      }),
    );
    const callInput = (orchestrator.run as jest.Mock).mock.calls[0][0];
    expect(callInput.surfaceKey).toBe('R8_VEHICLE');
    expect(callInput.typeId).toBe(9876);
    expect(callInput.ids.brandAlias).toBe('bmw');
    expect(callInput.ids.modeleAlias).toBe('serie-3');
    expect(callInput.ids.typeAlias).toBe('320i');
  });

  it('orchestrator throw → propagé', async () => {
    const orchestrator = {
      run: jest.fn().mockRejectedValue(new Error('boom')),
    } as unknown as SeoChainOrchestratorService;
    const runner = new SeoShadowChainRunner(orchestrator);
    await expect(runner.compute(r7Input())).rejects.toThrow(/boom/);
  });

  it('timeout 2s → throw SeoShadowChainTimeoutError', async () => {
    jest.useFakeTimers();
    const orchestrator = {
      run: jest.fn().mockImplementation(() => new Promise(() => {})),
    } as unknown as SeoChainOrchestratorService;
    const runner = new SeoShadowChainRunner(orchestrator);
    const promise = runner.compute(r7Input());
    jest.advanceTimersByTime(2_001);
    await expect(promise).rejects.toThrow(SeoShadowChainTimeoutError);
    jest.useRealTimers();
  });

  it('output corrompu (type invalide) → Zod throw', async () => {
    const orchestrator = {
      run: jest.fn().mockResolvedValue({
        surfaceKey: 'R7_BRAND_HUB',
        template: { title: 42, description: 'B', h1: 'C', preview: '', content: '', keywords: '' },
        contentBlocks: [],
        policies: { canonical: '', robots: 'index,follow' },
        ariane: {},
        metadata: {},
      }),
    } as unknown as SeoChainOrchestratorService;
    const runner = new SeoShadowChainRunner(orchestrator);
    await expect(runner.compute(r7Input())).rejects.toBeDefined();
  });

  it('surface non câblée → throw SeoShadowSurfaceNotWiredError', async () => {
    const runner = new SeoShadowChainRunner(fakeOrchestratorOk());
    await expect(
      runner.compute(r7Input({ surface: 'R0_HOME' })),
    ).rejects.toThrow(SeoShadowSurfaceNotWiredError);
  });
});
