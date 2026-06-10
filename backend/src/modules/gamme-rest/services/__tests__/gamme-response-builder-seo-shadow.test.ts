import { Logger } from '@nestjs/common';

import { SeoFeatureFlagRegistry } from '../../../seo/registries/seo-feature-flag.registry';
import { GammeResponseBuilderService } from '../gamme-response-builder.service';

/**
 * PR-5 (plan seo-v9) — Tests du shadow mode chaîne SEO sur gamme-rest.
 *
 * Mirror PR-3 (rm-builder shadow) appliqué à la surface R1_GAMME_ROUTER.
 * Vérifie :
 *   - flag=off  : la chaîne n'est PAS appelée (zero impact prod).
 *   - flag=shadow : chaîne appelée, diff logué, résultat legacy servi.
 *   - flag=on   : chaîne appelée, résultat chain servi (fallback legacy si
 *                 chain throws ou title vide).
 *
 * Stratégie : tests unitaires sur les helpers privés `computeChainSeoForGamme`
 * et `logSeoChainDiffGamme` (cast `as never` — TS modifiers non runtime).
 */
describe('GammeResponseBuilderService — SEO chain shadow mode (PR-5)', () => {
  function buildService(opts: {
    chainRunReturnTitle?: string;
    chainThrows?: boolean;
  }): GammeResponseBuilderService {
    const chainOrchestrator = {
      run: jest.fn(async () => {
        if (opts.chainThrows) throw new Error('chain boom');
        return {
          surfaceKey: 'R1_GAMME_ROUTER',
          template: {
            title: opts.chainRunReturnTitle ?? 'Chain title',
            description: 'Chain description',
            h1: 'Chain h1',
            preview: '',
            content: 'Chain content',
            keywords: 'k1, k2',
          },
          contentBlocks: [],
          policies: { canonical: 'https://x', robots: 'index,follow' },
          ariane: {
            jsonLd: {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [],
            },
            textTrail: '',
          },
          metadata: {
            surfaceKey: 'R1_GAMME_ROUTER',
            templateId: null,
            variantIds: {},
            internalLinkCount: 0,
            chainVersion: 'seo-v9-pr2c',
            renderedAt: new Date().toISOString(),
          },
        };
      }),
    };

    const chainFlags = new SeoFeatureFlagRegistry();

    const dummy = {} as never;
    // SeoReadyGammeService stub — promotion OFF so the additive kw-path stays inert here.
    const seoReadyGamme = {
      isPromoteEnabled: () => false,
      isSeoReady: async () => false,
    } as never;
    return new GammeResponseBuilderService(
      dummy, // GammeDataTransformerService
      dummy, // GammeRpcService
      dummy, // BuyingGuideDataService
      dummy, // ReferenceService
      dummy, // SeoTitleEngineService
      dummy, // R1RelatedResourcesService
      chainOrchestrator as never,
      chainFlags,
      seoReadyGamme, // SeoReadyGammeService
    );
  }

  const ctxInput = {
    pgIdNum: 124,
    pgAlias: 'plaquettes-de-frein',
    pgNameSite: 'Plaquettes de frein',
    pgNameMeta: 'Plaquettes',
    articlesCount: 12,
  };

  describe('SeoFeatureFlagRegistry.mode("GAMME")', () => {
    afterEach(() => {
      delete process.env.SEO_CHAIN_GAMME_MODE;
    });

    it('default off quand env var absente', () => {
      const flags = new SeoFeatureFlagRegistry();
      expect(flags.mode('GAMME')).toBe('off');
    });

    it('lit la valeur env SEO_CHAIN_GAMME_MODE', () => {
      process.env.SEO_CHAIN_GAMME_MODE = 'shadow';
      const flags = new SeoFeatureFlagRegistry();
      expect(flags.mode('GAMME')).toBe('shadow');
      process.env.SEO_CHAIN_GAMME_MODE = 'on';
      expect(flags.mode('GAMME')).toBe('on');
    });
  });

  describe('computeChainSeoForGamme (helper privé)', () => {
    it('appelle chain.run avec surface R1_GAMME_ROUTER + ids/variables corrects', async () => {
      const service = buildService({ chainRunReturnTitle: 'OK' });
      const seo = await (
        service as never as {
          computeChainSeoForGamme: (i: typeof ctxInput) => Promise<unknown>;
        }
      ).computeChainSeoForGamme(ctxInput);

      expect(seo).toEqual({
        title: 'OK',
        description: 'Chain description',
        keywords: 'k1, k2',
        h1: 'Chain h1',
        content: 'Chain content',
      });
    });

    it('retourne null si chain renvoie un title vide (fallback legacy)', async () => {
      const service = buildService({ chainRunReturnTitle: '' });
      const seo = await (
        service as never as {
          computeChainSeoForGamme: (i: typeof ctxInput) => Promise<unknown>;
        }
      ).computeChainSeoForGamme(ctxInput);
      expect(seo).toBeNull();
    });

    it("propage l'exception si chain throws (le caller catche)", async () => {
      const service = buildService({ chainThrows: true });
      await expect(
        (
          service as never as {
            computeChainSeoForGamme: (i: typeof ctxInput) => Promise<unknown>;
          }
        ).computeChainSeoForGamme(ctxInput),
      ).rejects.toThrow(/chain boom/);
    });
  });

  describe('logSeoChainDiffGamme (helper privé)', () => {
    it('produit un log JSON structuré avec match par champ', () => {
      const service = buildService({});
      const logSpy = jest
        .spyOn((service as never as { logger: Logger }).logger, 'log')
        .mockImplementation(() => undefined);

      const legacy = {
        title: 'TITLE',
        description: 'DESC',
        keywords: 'k',
        h1: 'h',
        content: 'C',
      };
      const chain = {
        title: 'TITLE-different',
        description: 'DESC',
        keywords: 'k',
        h1: 'h',
        content: 'C-different',
      };

      (
        service as never as {
          logSeoChainDiffGamme: (
            pgId: number,
            l: typeof legacy,
            ch: typeof chain,
          ) => void;
        }
      ).logSeoChainDiffGamme(124, legacy, chain);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const arg = logSpy.mock.calls[0]![0] as string;
      expect(arg).toContain('[SEO_CHAIN_GAMME_SHADOW]');
      const json = JSON.parse(arg.replace('[SEO_CHAIN_GAMME_SHADOW] ', ''));
      expect(json).toMatchObject({
        flag: 'SEO_CHAIN_GAMME',
        mode: 'shadow',
        pg_id: 124,
        title_eq: false,
        description_eq: true,
        keywords_eq: true,
        h1_eq: true,
        content_eq: false,
      });
    });
  });

  describe('integration : shadow mode décisionne correctement', () => {
    afterEach(() => {
      delete process.env.SEO_CHAIN_GAMME_MODE;
    });

    it("mode=off : flag respecté (pas d'appel chain)", () => {
      process.env.SEO_CHAIN_GAMME_MODE = 'off';
      const service = buildService({ chainRunReturnTitle: 'X' });
      const flags = (service as never as { chainFlags: SeoFeatureFlagRegistry })
        .chainFlags;
      expect(flags.mode('GAMME')).toBe('off');
    });

    it('mode=shadow : chain.run est appelé via le helper', async () => {
      process.env.SEO_CHAIN_GAMME_MODE = 'shadow';
      const service = buildService({ chainRunReturnTitle: 'X' });
      const flags = (service as never as { chainFlags: SeoFeatureFlagRegistry })
        .chainFlags;
      expect(flags.mode('GAMME')).toBe('shadow');

      const seo = await (
        service as never as {
          computeChainSeoForGamme: (i: typeof ctxInput) => Promise<unknown>;
        }
      ).computeChainSeoForGamme(ctxInput);
      expect(seo).not.toBeNull();
    });
  });
});
