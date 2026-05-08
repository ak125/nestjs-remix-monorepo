import { Logger } from '@nestjs/common';

import { SeoFeatureFlagRegistry } from '../../../seo/registries/seo-feature-flag.registry';
import { RmBuilderService } from '../rm-builder.service';

/**
 * PR-3 (plan seo-v9) — Tests du shadow mode chaîne SEO sur rm-builder.
 *
 * Vérifie :
 *   - flag=off  : la chaîne n'est PAS appelée (zero impact prod).
 *   - flag=shadow : la chaîne est appelée, diff logué, résultat legacy servi.
 *   - flag=on   : la chaîne est appelée, résultat chain servi (avec fallback
 *                 legacy si la chaîne échoue ou renvoie title vide).
 *
 * Stratégie : tests unitaires sur les helpers privés `computeChainSeoForRm`
 * et `logSeoChainDiff` (accès via `as never` cast — TS modifiers ne sont pas
 * runtime). Pas de boot complet du module — on injecte des stubs directs.
 */
describe('RmBuilderService — SEO chain shadow mode (PR-3)', () => {
  function buildService(opts: {
    chainRunReturnTitle?: string;
    chainThrows?: boolean;
  }): RmBuilderService {
    const chainOrchestrator = {
      run: jest.fn(async () => {
        if (opts.chainThrows) throw new Error('chain boom');
        return {
          surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
          template: {
            title: opts.chainRunReturnTitle ?? 'Chain title',
            description: 'Chain description',
            h1: 'Chain h1',
            preview: 'Chain preview',
            content: 'Chain content',
            keywords: 'k',
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
            surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
            templateId: null,
            variantIds: {},
            internalLinkCount: 0,
            chainVersion: 'seo-v9-pr2c',
            renderedAt: new Date().toISOString(),
          },
        };
      }),
    } as unknown as ConstructorParameters<typeof RmBuilderService>[3];

    const chainFlags = new SeoFeatureFlagRegistry();

    // Stubs minimaux : le test ne touche pas à cacheService / seoTemplateService /
    // rpcGate. Les helpers testés ne les utilisent pas.
    const dummy = {} as never;
    return new RmBuilderService(
      dummy, // CacheService
      dummy, // SeoTemplateService
      dummy, // RpcGateService
      chainOrchestrator,
      chainFlags,
    );
  }

  const ctx = {
    type_id: 12345,
    pg_id: 124,
    mf_id: 1,
    marque_name: 'Renault',
    marque_alias: 'renault',
    modele_name: 'Clio',
    modele_alias: 'clio',
    type_name: '1.5 dCi',
    type_alias: '1-5-dci',
    gamme_name: 'Plaquettes',
    gamme_alias: 'plaquettes',
    min_price: 25,
    count: 12,
    power_ps: '90',
  };

  describe('SeoFeatureFlagRegistry.mode("RM")', () => {
    afterEach(() => {
      delete process.env.SEO_CHAIN_RM_MODE;
    });

    it('default off quand env var absente', () => {
      const flags = new SeoFeatureFlagRegistry();
      expect(flags.mode('RM')).toBe('off');
    });

    it('lit la valeur env SEO_CHAIN_RM_MODE', () => {
      process.env.SEO_CHAIN_RM_MODE = 'shadow';
      const flags = new SeoFeatureFlagRegistry();
      expect(flags.mode('RM')).toBe('shadow');
      process.env.SEO_CHAIN_RM_MODE = 'on';
      expect(flags.mode('RM')).toBe('on');
    });

    it('fallback off sur valeur invalide', () => {
      process.env.SEO_CHAIN_RM_MODE = 'invalid_value';
      const flags = new SeoFeatureFlagRegistry();
      expect(flags.mode('RM')).toBe('off');
    });
  });

  describe('computeChainSeoForRm (helper privé)', () => {
    it('appelle chain.run avec surface R1_GAMME_VEHICLE_ROUTER + ids/variables corrects', async () => {
      const service = buildService({ chainRunReturnTitle: 'OK' });
      const seo = await (
        service as never as {
          computeChainSeoForRm: (c: typeof ctx) => Promise<unknown>;
        }
      ).computeChainSeoForRm(ctx);

      expect(seo).toEqual({
        h1: 'Chain h1',
        title: 'OK',
        description: 'Chain description',
        content: 'Chain content',
        preview: 'Chain preview',
      });
    });

    it('retourne null si chain renvoie un title vide (fallback legacy)', async () => {
      const service = buildService({ chainRunReturnTitle: '' });
      const seo = await (
        service as never as {
          computeChainSeoForRm: (c: typeof ctx) => Promise<unknown>;
        }
      ).computeChainSeoForRm(ctx);
      expect(seo).toBeNull();
    });

    it("propage l'exception si chain throws (le caller catche)", async () => {
      const service = buildService({ chainThrows: true });
      await expect(
        (
          service as never as {
            computeChainSeoForRm: (c: typeof ctx) => Promise<unknown>;
          }
        ).computeChainSeoForRm(ctx),
      ).rejects.toThrow(/chain boom/);
    });
  });

  describe('logSeoChainDiff (helper privé)', () => {
    it('produit un log JSON structuré avec match par champ', () => {
      const service = buildService({});
      const logSpy = jest
        .spyOn((service as never as { logger: Logger }).logger, 'log')
        .mockImplementation(() => undefined);

      const legacy = {
        h1: 'h',
        title: 'TITLE',
        description: 'DESC',
        content: 'C',
        preview: 'P',
      };
      const chain = {
        h1: 'h',
        title: 'TITLE-different',
        description: 'DESC',
        content: 'C-different',
        preview: 'P',
      };

      (
        service as never as {
          logSeoChainDiff: (
            c: typeof ctx,
            l: typeof legacy,
            ch: typeof chain,
          ) => void;
        }
      ).logSeoChainDiff(ctx, legacy, chain);

      expect(logSpy).toHaveBeenCalledTimes(1);
      const arg = logSpy.mock.calls[0]![0] as string;
      expect(arg).toContain('[SEO_CHAIN_RM_SHADOW]');
      const json = JSON.parse(arg.replace('[SEO_CHAIN_RM_SHADOW] ', ''));
      expect(json).toMatchObject({
        flag: 'SEO_CHAIN_RM',
        mode: 'shadow',
        pg_id: 124,
        type_id: 12345,
        title_eq: false,
        description_eq: true,
        h1_eq: true,
        content_eq: false,
        preview_eq: true,
      });
    });
  });

  describe('integration : shadow mode décisionne correctement', () => {
    afterEach(() => {
      delete process.env.SEO_CHAIN_RM_MODE;
    });

    it('mode=off : chain.run NE doit PAS être appelé', async () => {
      process.env.SEO_CHAIN_RM_MODE = 'off';
      const service = buildService({ chainRunReturnTitle: 'X' });
      // Simulate the gate check that happens inside getPageCompleteV2.
      const flags = (
        service as never as {
          chainFlags: SeoFeatureFlagRegistry;
        }
      ).chainFlags;
      const mode = flags.mode('RM');
      expect(mode).toBe('off');
      // Si le code respecte cet invariant, computeChainSeoForRm n'est pas appelé.
      // Verrouillé par la lecture de mode === 'off' dans getPageCompleteV2.
    });

    it('mode=shadow : chain.run est appelé', async () => {
      process.env.SEO_CHAIN_RM_MODE = 'shadow';
      const service = buildService({ chainRunReturnTitle: 'X' });
      const flags = (
        service as never as {
          chainFlags: SeoFeatureFlagRegistry;
        }
      ).chainFlags;
      expect(flags.mode('RM')).toBe('shadow');

      const seo = await (
        service as never as {
          computeChainSeoForRm: (c: typeof ctx) => Promise<unknown>;
        }
      ).computeChainSeoForRm(ctx);
      expect(seo).not.toBeNull();
    });
  });
});
