import { BadRequestException } from '@nestjs/common';

import { DynamicSeoV4UltimateService } from '../dynamic-seo-v4-ultimate.service';
import { SeoPlaceholderEventsService } from '../services/seo-placeholder-events.service';
import { SeoSurfaceRegistry } from '../registries/seo-surface.registry';
import { SeoVariantFamilyRegistry } from '../registries/seo-variant-family.registry';
import { R2IndexabilityGate } from '../services/policies/r2-indexability-gate.service';
import { SeoCanonicalService } from '../services/policies/seo-canonical.service';
import { SeoIndexabilityPolicyService } from '../services/policies/seo-indexability-policy.service';
import { SeoArianeBreadcrumbService } from '../services/chain/seo-ariane-breadcrumb.service';
import { SeoChainOrchestratorService } from '../services/chain/seo-chain-orchestrator.service';
import { SeoContentBlockBuilder } from '../services/chain/seo-content-block-builder.service';
import { SeoInternalLinkingService } from '../services/chain/seo-internal-linking.service';
import { SeoSwitchSelector } from '../services/chain/seo-switch-selector.service';
import { SeoTemplateRenderer } from '../services/chain/seo-template-renderer.service';
import { SeoV4MonitoringService } from '../services/seo-v4-monitoring.service';

/**
 * PR-2d — Test E2E V4 → chain delegation.
 *
 * Verrouille le contrat de l'adaptateur `DynamicSeoV4UltimateService` après
 * le refactor PR-2c rev 2 :
 *   - generateCompleteSeo(pgId, typeId, vars) appelle bien la chaîne
 *   - le retour est un `CompleteSeoResult` valide (shape inchangée vs legacy)
 *   - le fallback `generateDefaultSeo` se déclenche si template absent
 *   - le cache résultat se comporte correctement (HIT après MISS)
 */
describe('DynamicSeoV4UltimateService → chain delegation (PR-2d E2E)', () => {
  function buildV4(opts: {
    templateRow: Record<string, unknown> | null;
    placeholderEvents?: { record: jest.Mock };
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
                data: opts.templateRow,
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
    const orchestrator = new SeoChainOrchestratorService(
      surfaces,
      renderer,
      switchSelector,
      linking,
      new SeoArianeBreadcrumbService(),
      new SeoCanonicalService(),
      new SeoIndexabilityPolicyService(surfaces, new R2IndexabilityGate()),
      new SeoContentBlockBuilder(),
    );

    // SeoV4MonitoringService nécessite Supabase pour ses méthodes audit/metrics,
    // mais aucun test ici ne les invoque → on crée un stub minimal.
    const monitoring = Object.create(
      SeoV4MonitoringService.prototype,
    ) as SeoV4MonitoringService;

    const placeholderEvents = opts.placeholderEvents ?? {
      record: jest.fn().mockResolvedValue({ ok: true }),
    };

    return new DynamicSeoV4UltimateService(
      orchestrator,
      monitoring,
      placeholderEvents as unknown as SeoPlaceholderEventsService,
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
    gammeLevel: 1,
    isTopGamme: false,
  };

  it('renvoie un CompleteSeoResult valide quand la chaîne hydrate un template', async () => {
    const v4 = buildV4({
      templateRow: {
        sgc_id: 124,
        sgc_title: '#Gamme# pour #VMarque# #VModele# #VType#',
        sgc_descrip: 'Description #PrixPasCher# #MinPrice#',
        sgc_h1: '<h1>#Gamme#</h1>',
        sgc_preview: 'Aperçu #Gamme#',
        sgc_content: '<p>Découvrez nos pièces</p>',
      },
    });

    const result = await v4.generateCompleteSeo(124, 12345, baseVars);

    // Shape legacy CompleteSeoResult préservée (compat 4 endpoints debug).
    expect(result).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
      h1: expect.any(String),
      preview: expect.any(String),
      content: expect.any(String),
      keywords: expect.any(String),
      metadata: {
        templatesUsed: expect.arrayContaining([expect.any(String)]),
        switchesProcessed: expect.any(Number),
        variablesReplaced: expect.any(Number),
        processingTime: expect.any(Number),
        cacheHit: false,
        version: 'seo-v9-pr2c',
      },
    });

    expect(result.title).toContain('Plaquettes de frein');
    expect(result.description).toContain('à partir de 25€');
    expect(result.metadata.templatesUsed[0]).toBe(
      'R1_GAMME_VEHICLE_ROUTER:124',
    );
  });

  it('utilise le fallback `generateDefaultSeo` si template DB absent', async () => {
    const v4 = buildV4({ templateRow: null });

    const result = await v4.generateCompleteSeo(0, 0, baseVars);

    expect(result.metadata.templatesUsed).toContain('default_fallback');
    expect(result.metadata.version).toMatch(/4\.1\.0-/);
    // Le fallback produit un title programmatique avec marque + modèle.
    expect(result.title).toContain('Renault');
    expect(result.title).toContain('Clio');
  });

  it('cache résultat : 2e appel identique → cacheHit=true', async () => {
    const v4 = buildV4({
      templateRow: {
        sgc_id: 1,
        sgc_title: '#Gamme#',
      },
    });

    const r1 = await v4.generateCompleteSeo(1, 1, baseVars);
    const r2 = await v4.generateCompleteSeo(1, 1, baseVars);

    expect(r1.metadata.cacheHit).toBe(false);
    expect(r2.metadata.cacheHit).toBe(true);
    expect(r2.title).toBe(r1.title);
  });

  it('invalidateCache vide le cache', async () => {
    const v4 = buildV4({
      templateRow: { sgc_id: 1, sgc_title: '#Gamme#' },
    });

    await v4.generateCompleteSeo(1, 1, baseVars);
    v4.invalidateCache();
    const r2 = await v4.generateCompleteSeo(1, 1, baseVars);

    expect(r2.metadata.cacheHit).toBe(false);
  });

  // ── A1b : SeoVariables additif + safeParse fail-CLOSED ──────────────────────

  it('contrat additif : powerKw + gammeId optionnels acceptés (zéro breakage)', async () => {
    const v4 = buildV4({
      templateRow: { sgc_id: 5, sgc_title: '#Gamme#' },
    });

    // Les champs A1b sont optionnels : présents → validés, absents → OK.
    const result = await v4.generateCompleteSeo(5, 5, {
      ...baseVars,
      powerKw: 66,
      gammeId: 124,
    });

    expect(result.title).toContain('Plaquettes');
  });

  it('fail-CLOSED : variables invalides → BadRequestException et generateDefaultSeo JAMAIS appelé', async () => {
    const v4 = buildV4({
      templateRow: { sgc_id: 1, sgc_title: '#Gamme#' },
    });
    // Le fallback ne doit JAMAIS produire de page depuis des variables invalides
    // (le throw safeParse est levé AVANT le try/catch fail-open).
    const defaultSpy = jest.spyOn(
      v4 as unknown as { generateDefaultSeo: (...a: unknown[]) => unknown },
      'generateDefaultSeo',
    );

    // nbCh est requis (number positif) ; on passe une valeur non-numérique.
    const invalidVars = { ...baseVars, nbCh: 'quatre-vingt-dix' } as never;

    await expect(
      v4.generateCompleteSeo(1, 1, invalidVars),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(defaultSpy).not.toHaveBeenCalled();
  });

  // ── A1a-observe : rendre observables les replis silencieux (detection-only) ──

  it('A1a-observe : émet runtime_default_fallback quand le fallback est pris', async () => {
    const record = jest.fn().mockResolvedValue({ ok: true });
    const v4 = buildV4({ templateRow: null, placeholderEvents: { record } });

    await v4.generateCompleteSeo(5, 50, baseVars);

    const fb = record.mock.calls
      .map((c) => c[0])
      .find((e) => e.trigger === 'runtime_default_fallback');
    expect(fb).toBeDefined();
    expect(fb.pg_id).toBe(5);
    expect(fb.type_id).toBe(50);
    // baseVars porte un contexte véhicule complet → version fallback.
    expect(fb.fallback_version).toBe('4.1.0-fallback');
  });

  it('A1a-observe : émet residual_marker_detected sur marqueurs orphelins — marker_count vs stripped_count', async () => {
    const record = jest.fn().mockResolvedValue({ ok: true });
    const v4 = buildV4({
      templateRow: {
        sgc_id: 7,
        // #Gamme# est résolu ; #ZzUnknown# (lettres → strippé) et #ZzDigit_9#
        // (chiffre → SURVIT au strip /#[A-Za-z_]+#/g) restent orphelins.
        sgc_title: '#Gamme# #ZzUnknown# #ZzDigit_9#',
        sgc_descrip: 'Description simple sans marqueur',
      },
      placeholderEvents: { record },
    });

    await v4.generateCompleteSeo(7, 70, baseVars);

    const titleEvents = record.mock.calls
      .map((c) => c[0])
      .filter(
        (e) =>
          e.trigger === 'residual_marker_detected' && e.field === 'title',
      );
    expect(titleEvents.length).toBeGreaterThan(0);
    const ev = titleEvents[0];
    expect(ev.marker_count).toBeGreaterThanOrEqual(2); // les 2 orphelins
    expect(ev.stripped_count).toBeGreaterThanOrEqual(1); // seul #ZzUnknown# est retiré
    expect(ev.markers).toEqual(
      expect.arrayContaining(['#ZzUnknown#', '#ZzDigit_9#']),
    );
  });

  it('A1a-observe : sortie propre (aucun #marqueur#) → aucun residual_marker_detected', async () => {
    const record = jest.fn().mockResolvedValue({ ok: true });
    // Fallback : title/description sont construits par littéraux, sans #...#.
    const v4 = buildV4({ templateRow: null, placeholderEvents: { record } });

    await v4.generateCompleteSeo(1, 1, baseVars);

    const residual = record.mock.calls
      .map((c) => c[0])
      .filter((e) => e.trigger === 'residual_marker_detected');
    expect(residual.length).toBe(0);
  });

  it('A1a-observe : un emit qui rejette ne casse pas le rendu (fire-and-forget)', async () => {
    const record = jest.fn().mockRejectedValue(new Error('db down'));
    const v4 = buildV4({ templateRow: null, placeholderEvents: { record } });

    const result = await v4.generateCompleteSeo(1, 1, baseVars);

    // La page se rend normalement malgré l'échec de l'emit.
    expect(result.title).toContain('Renault');
    expect(record).toHaveBeenCalled();
  });
});
