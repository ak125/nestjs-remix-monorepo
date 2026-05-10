import { SeoSurfaceRegistry } from '../../../registries/seo-surface.registry';
import { SeoVariantFamilyRegistry } from '../../../registries/seo-variant-family.registry';
import { R2IndexabilityGate } from '../../policies/r2-indexability-gate.service';
import { SeoCanonicalService } from '../../policies/seo-canonical.service';
import { SeoIndexabilityPolicyService } from '../../policies/seo-indexability-policy.service';
import { SeoArianeBreadcrumbService } from '../seo-ariane-breadcrumb.service';
import { SeoChainOrchestratorService } from '../seo-chain-orchestrator.service';
import { SeoContentBlockBuilder } from '../seo-content-block-builder.service';
import { SeoInternalLinkingService } from '../seo-internal-linking.service';
import { SeoSwitchSelector } from '../seo-switch-selector.service';
import { SeoTemplateRenderer } from '../seo-template-renderer.service';
import { PRIX_PAS_CHER, VOUS_PROPOSE } from '../../../seo-v4.types';

/**
 * PR-2d — Marketing seed parity : title / description / content reçoivent
 * 3 seeds distincts pour `#PrixPasCher#` (cf. legacy PHP `processTitle` /
 * `processDescription` / `processContent`). Sans cela, toutes les sections
 * d'une page sortent le MÊME prix → régression duplicate content.
 *
 * Ce test verrouille la parité orchestrator → legacy V4.
 */
describe('SeoChainOrchestrator — marketing seed parity (PR-2d)', () => {
  function build(opts: {
    template: Record<string, unknown>;
  }): SeoChainOrchestratorService {
    const renderer = new SeoTemplateRenderer();
    const switchSelector = new SeoSwitchSelector(
      new SeoVariantFamilyRegistry(),
    );
    const linking = new SeoInternalLinkingService();

    Object.defineProperty(renderer, 'supabase', {
      value: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: opts.template, error: null }),
            }),
          }),
        }),
      },
      configurable: true,
    });

    Object.defineProperty(switchSelector, 'supabase', {
      value: {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                async then(resolve: (v: unknown) => void) {
                  resolve({ data: [], error: null });
                },
              }),
              async then(resolve: (v: unknown) => void) {
                resolve({ data: [], error: null });
              },
            }),
          }),
        }),
      },
      configurable: true,
    });

    Object.defineProperty(linking, 'supabase', {
      value: {
        from: () => ({
          select: () => ({
            in: async () => ({ data: [], error: null }),
          }),
        }),
      },
      configurable: true,
    });

    const surfaces = new SeoSurfaceRegistry();
    return new SeoChainOrchestratorService(
      surfaces,
      renderer,
      switchSelector,
      linking,
      new SeoArianeBreadcrumbService(),
      new SeoCanonicalService(),
      new SeoIndexabilityPolicyService(surfaces, new R2IndexabilityGate()),
      new SeoContentBlockBuilder(),
    );
  }

  const baseVars = {
    gamme: 'Plaquettes',
    gammeMeta: 'Plaquettes',
    marque: 'Renault',
    marqueMeta: 'Renault',
    marqueMetaTitle: 'Renault',
    modele: 'Clio',
    modeleMeta: 'Clio IV',
    type: '1.5 dCi',
    typeMeta: '1.5 dCi',
    annee: '2015',
    nbCh: 90,
    carosserie: 'berline',
    fuel: 'diesel',
    codeMoteur: 'K9K',
    articlesCount: 10,
    gammeLevel: 1,
    isTopGamme: false,
  };

  it('title et description ont des seeds #PrixPasCher# distincts (parité legacy V4)', async () => {
    const orch = build({
      template: {
        sgc_id: 999,
        sgc_title: 'Achetez nos pièces #PrixPasCher#',
        sgc_descrip: 'Découvrez nos pièces #PrixPasCher#',
        sgc_h1: '<h1>H1</h1>',
        sgc_content: 'Contenu #PrixPasCher#',
      },
    });

    const out = await orch.run({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      pgId: 124,
      typeId: 12345,
      vehicleId: 12345,
      variables: baseVars,
      ids: {
        gammeAlias: 'g',
        marqueAlias: 'm',
        modeleAlias: 'mod',
        typeAlias: 't',
      },
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [{ name: 'a', url: 'https://www.automecanik.com/' }],
    });

    const extract = (s: string) => {
      // Trouve laquelle des 16 variantes a été interpolée.
      for (const v of PRIX_PAS_CHER) if (s.includes(v)) return v;
      return null;
    };

    const titlePrix = extract(out.template.title);
    const descPrix = extract(out.template.description);
    const contentPrix = extract(out.template.content);

    // 3 valeurs trouvées (les marqueurs ont bien été remplacés).
    expect(titlePrix).not.toBeNull();
    expect(descPrix).not.toBeNull();
    expect(contentPrix).not.toBeNull();

    // Au moins 2 valeurs distinctes parmi les 3 (parité legacy : pgId+typeId+1
    // vs pgId+typeId vs typeId — 3 seeds différents → variantes différentes
    // sauf collision modulo accidentelle).
    const distinct = new Set([titlePrix, descPrix, contentPrix]);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
  });

  it('reproduit exactement les seeds legacy : title=(pgId%100)+1+typeId, descrip=(pgId%100)+typeId, content=typeId', async () => {
    const orch = build({
      template: {
        sgc_id: 1,
        sgc_title: '#PrixPasCher#',
        sgc_descrip: '#PrixPasCher#',
        sgc_content: '#PrixPasCher#',
      },
    });

    const pgId = 10;
    const typeId = 5;

    const out = await orch.run({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      pgId,
      typeId,
      vehicleId: typeId,
      variables: baseVars,
      ids: {
        gammeAlias: 'g',
        marqueAlias: 'm',
        modeleAlias: 'mod',
        typeAlias: 't',
      },
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [{ name: 'a', url: 'https://www.automecanik.com/' }],
    });

    // Legacy V4 formulas (cleanContent strippe les balises mais préserve le
    // texte du PrixPasCher, donc on peut comparer directement).
    const expectedTitle =
      PRIX_PAS_CHER[((pgId % 100) + 1 + typeId) % PRIX_PAS_CHER.length]!;
    const expectedDesc =
      PRIX_PAS_CHER[((pgId % 100) + typeId) % PRIX_PAS_CHER.length]!;
    const expectedContent = PRIX_PAS_CHER[typeId % PRIX_PAS_CHER.length]!;

    expect(out.template.title).toBe(expectedTitle);
    expect(out.template.description).toBe(expectedDesc);
    expect(out.template.content).toBe(expectedContent);
  });

  it('content reçoit la même seed VousPropose que content legacy (typeId%len)', async () => {
    const orch = build({
      template: {
        sgc_id: 1,
        sgc_content: '#VousPropose#',
      },
    });

    const typeId = 7;
    const out = await orch.run({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      pgId: 1,
      typeId,
      vehicleId: typeId,
      variables: baseVars,
      ids: {
        gammeAlias: 'g',
        marqueAlias: 'm',
        modeleAlias: 'mod',
        typeAlias: 't',
      },
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [{ name: 'a', url: 'https://www.automecanik.com/' }],
    });

    expect(out.template.content).toBe(
      VOUS_PROPOSE[typeId % VOUS_PROPOSE.length]!,
    );
  });

  it("h1 et preview reçoivent seed neutre (legacy n'utilisait pas de #PrixPasCher# sur ces champs)", async () => {
    const orch = build({
      template: {
        sgc_id: 1,
        sgc_h1: '#PrixPasCher#',
        sgc_preview: '#PrixPasCher#',
      },
    });

    const out = await orch.run({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      pgId: 50,
      typeId: 100,
      vehicleId: 100,
      variables: baseVars,
      ids: {
        gammeAlias: 'g',
        marqueAlias: 'm',
        modeleAlias: 'mod',
        typeAlias: 't',
      },
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [{ name: 'a', url: 'https://www.automecanik.com/' }],
    });

    // seed=0 → première variante de la liste.
    expect(out.template.h1).toBe(PRIX_PAS_CHER[0]);
    expect(out.template.preview).toBe(PRIX_PAS_CHER[0]);
  });
});
