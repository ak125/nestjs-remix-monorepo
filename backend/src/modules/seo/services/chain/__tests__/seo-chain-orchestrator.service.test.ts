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

/**
 * Tests d'intégration de la chaîne SEO seo-v9 PR-2c.
 *
 * Stubs Supabase via `Object.defineProperty` (cf. pattern PR-2b).
 * Vérifie : assemblage end-to-end + propagation des verdicts policies.
 */
describe('SeoChainOrchestratorService', () => {
  function buildOrchestrator(opts: {
    templateRow?: Record<string, unknown> | null;
    variantsByAlias?: Record<number, Record<string, unknown>>;
    gammeRows?: Array<Record<string, unknown>>;
  }) {
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
              maybeSingle: async () => ({
                data: opts.templateRow ?? null,
                error: null,
              }),
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
              eq: (col2: string, val2: unknown) => ({
                async then(resolve: (v: unknown) => void) {
                  // Pour les tests : on sélectionne l'alias passé en 2e eq().
                  const alias = col2 === 'sis_alias' ? Number(val2) : null;
                  const row = alias
                    ? (opts.variantsByAlias ?? {})[alias]
                    : null;
                  resolve({ data: row ? [row] : [], error: null });
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
            in: async () => ({
              data: opts.gammeRows ?? [],
              error: null,
            }),
          }),
        }),
      },
      configurable: true,
    });

    const surfaces = new SeoSurfaceRegistry();
    const canonical = new SeoCanonicalService();
    const r2Gate = new R2IndexabilityGate();
    const indexability = new SeoIndexabilityPolicyService(surfaces, r2Gate);
    const ariane = new SeoArianeBreadcrumbService();
    const blocks = new SeoContentBlockBuilder();

    return new SeoChainOrchestratorService(
      surfaces,
      renderer,
      switchSelector,
      linking,
      ariane,
      canonical,
      indexability,
      blocks,
    );
  }

  const baseVars = {
    gamme: 'Plaquettes',
    gammeMeta: 'Plaquettes de frein',
    marque: 'Renault',
    marqueMeta: 'Renault',
    marqueMetaTitle: 'Renault',
    modele: 'Clio',
    modeleMeta: 'Clio IV',
    type: '1.5 dCi 90',
    typeMeta: '1.5 dCi 90',
    annee: '2015',
    nbCh: 90,
    carosserie: 'berline',
    fuel: 'diesel',
    codeMoteur: 'K9K',
    minPrice: 25,
    articlesCount: 12,
    familyName: 'Freinage',
    isTopGamme: false,
    gammeLevel: 1,
  };

  it('R1_GAMME_VEHICLE_ROUTER : applique les variables, rend canonical et JSON-LD', async () => {
    const orchestrator = buildOrchestrator({
      templateRow: {
        sgc_id: 124,
        sgc_title: '#Gamme# pour #VMarque# #VModele# #VType#',
        sgc_descrip: 'Description #PrixPasCher# #MinPrice#',
        sgc_h1: '<h1>#Gamme#</h1>',
        sgc_preview: 'Aperçu #Gamme#',
        sgc_content: '<p>Découvrez nos pièces #FamilyContext#</p>',
      },
      variantsByAlias: {
        1: { sis_id: 100, sis_alias: 1, sis_content: 'Variante alias 1' },
        2: { sis_id: 200, sis_alias: 2, sis_content: 'Variante alias 2' },
        3: { sis_id: 300, sis_alias: 3, sis_content: 'Variante alias 3' },
      },
    });

    const out = await orchestrator.run({
      surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
      pgId: 124,
      typeId: 12345,
      vehicleId: 12345,
      variables: baseVars,
      ids: {
        gammeAlias: 'plaquettes-de-frein',
        marqueAlias: 'renault',
        modeleAlias: 'clio',
        typeAlias: '1-5-dci-90',
      },
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [
        { name: 'Accueil', url: 'https://www.automecanik.com/' },
        {
          name: 'Plaquettes',
          url: 'https://www.automecanik.com/pieces/plaquettes-de-frein/renault/clio/1-5-dci-90.html',
        },
      ],
    });

    expect(out.surfaceKey).toBe('R1_GAMME_VEHICLE_ROUTER');
    expect(out.template.title).toContain(
      'Plaquettes de frein pour Renault Clio IV',
    );
    expect(out.template.description).toContain('à partir de 25€');
    expect(out.template.h1).toContain('<b>Plaquettes</b>');
    expect(out.template.preview).toContain('Plaquettes de frein');
    expect(out.template.content).toContain('dans la catégorie <b>Freinage</b>');
    expect(out.policies.canonical).toBe(
      'https://www.automecanik.com/pieces/plaquettes-de-frein/renault/clio/1-5-dci-90.html',
    );
    expect(out.policies.robots).toBe('index,follow');
    expect(out.ariane.jsonLd['@type']).toBe('BreadcrumbList');
    expect(out.ariane.jsonLd.itemListElement).toHaveLength(2);
    expect(out.metadata.templateId).toBe('R1_GAMME_VEHICLE_ROUTER:124');
    expect(out.metadata.chainVersion).toBe('seo-v9-pr2c');
  });

  it('R0_HOME : pas de template DB → champs vides, canonical /, robots index', async () => {
    const orchestrator = buildOrchestrator({ templateRow: null });

    const out = await orchestrator.run({
      surfaceKey: 'R0_HOME',
      pgId: 0,
      typeId: 0,
      variables: baseVars,
      ids: {},
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [{ name: 'Accueil', url: 'https://www.automecanik.com/' }],
    });

    expect(out.template.title).toBe('');
    expect(out.policies.canonical).toBe('https://www.automecanik.com/');
    expect(out.policies.robots).toBe('index,follow');
    expect(out.metadata.templateId).toBeNull();
  });

  it('R3_ADVICE : canonical non supportée → robots noindex,follow + reason', async () => {
    const orchestrator = buildOrchestrator({ templateRow: null });

    const out = await orchestrator.run({
      surfaceKey: 'R3_ADVICE',
      pgId: 7,
      typeId: 0,
      variables: baseVars,
      ids: {},
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [],
    });

    expect(out.policies.canonical).toBe('');
    expect(out.policies.robots).toBe('noindex,follow');
    expect(out.policies.blockingReasons).toContain(
      'canonical_not_supported_in_pr2c',
    );
  });

  it('throw si surface inconnue', async () => {
    const orchestrator = buildOrchestrator({ templateRow: null });
    await expect(
      orchestrator.run({
        // @ts-expect-error - surface volontairement invalide
        surfaceKey: 'BOGUS_SURFACE',
        pgId: 0,
        typeId: 0,
        variables: baseVars,
        ids: {},
        baseUrl: 'https://www.automecanik.com',
        breadcrumbs: [],
      }),
    ).rejects.toThrow(/inconnue/);
  });

  it('seuils noindex appliqués (availableFamilies < threshold)', async () => {
    const orchestrator = buildOrchestrator({ templateRow: null });
    const out = await orchestrator.run({
      surfaceKey: 'R7_BRAND_HUB',
      pgId: 0,
      typeId: 0,
      variables: baseVars,
      ids: { brandAlias: 'bosch' },
      baseUrl: 'https://www.automecanik.com',
      breadcrumbs: [{ name: 'Accueil', url: 'https://www.automecanik.com/' }],
      indexability: { availableFamilies: 1 }, // < threshold legacy 3
    });

    expect(out.policies.robots).toBe('noindex,follow');
    expect(out.policies.blockingReasons?.[0]).toMatch(
      /families_below_threshold/,
    );
  });

  // ─────────── Étape 6 plan rev 2 : freeze contrat orchestrator ───────────
  // Snapshot tests sur 3 surfaces canon. Tout changement de format (clé,
  // structure, casse, types) cassera le snapshot et obligera une mise à jour
  // explicite via `--updateSnapshot`. Empêche les dérives invisibles dans
  // les PRs futures.
  describe('Snapshot freeze contrat output (Étape 6 plan v9 rev 2)', () => {
    function strip(out: Record<string, unknown>) {
      // renderedAt change à chaque run → on le neutralise pour stabiliser
      // les snapshots. Le format ISO reste vérifié implicitement par les
      // tests d'intégration ci-dessus.
      const { metadata, ...rest } = out as {
        metadata: Record<string, unknown>;
      };
      const { renderedAt: _renderedAt, ...metaRest } = metadata;
      return { ...rest, metadata: metaRest };
    }

    it('freeze R1_GAMME_VEHICLE_ROUTER output shape', async () => {
      const orchestrator = buildOrchestrator({
        templateRow: {
          sgc_id: 124,
          sgc_title: '#Gamme# pour #VMarque# #VModele#',
          sgc_descrip: 'Description #PrixPasCher#',
          sgc_h1: '<h1>#Gamme#</h1>',
          sgc_preview: 'Aperçu #Gamme#',
          sgc_content: '<p>#FamilyContext#</p>',
        },
      });
      const out = await orchestrator.run({
        surfaceKey: 'R1_GAMME_VEHICLE_ROUTER',
        pgId: 124,
        typeId: 12345,
        vehicleId: 12345,
        variables: baseVars,
        ids: {
          gammeAlias: 'plaquettes-de-frein',
          marqueAlias: 'renault',
          modeleAlias: 'clio',
          typeAlias: '1-5-dci-90',
        },
        baseUrl: 'https://www.automecanik.com',
        breadcrumbs: [{ name: 'Accueil', url: 'https://www.automecanik.com/' }],
      });
      expect(strip(out as never)).toMatchSnapshot();
    });

    it('freeze R0_HOME output shape', async () => {
      const orchestrator = buildOrchestrator({ templateRow: null });
      const out = await orchestrator.run({
        surfaceKey: 'R0_HOME',
        pgId: 0,
        typeId: 0,
        variables: baseVars,
        ids: {},
        baseUrl: 'https://www.automecanik.com',
        breadcrumbs: [{ name: 'Accueil', url: 'https://www.automecanik.com/' }],
      });
      expect(strip(out as never)).toMatchSnapshot();
    });

    it('freeze R7_BRAND_HUB output shape (noindex via threshold)', async () => {
      const orchestrator = buildOrchestrator({ templateRow: null });
      const out = await orchestrator.run({
        surfaceKey: 'R7_BRAND_HUB',
        pgId: 0,
        typeId: 0,
        variables: baseVars,
        ids: { brandAlias: 'bosch' },
        baseUrl: 'https://www.automecanik.com',
        breadcrumbs: [{ name: 'Accueil', url: 'https://www.automecanik.com/' }],
        indexability: { availableFamilies: 1 },
      });
      expect(strip(out as never)).toMatchSnapshot();
    });
  });
});
