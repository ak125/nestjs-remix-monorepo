/**
 * Mandat EW — GET /api/seo/reference/:slug porte `robots: noindex, follow`
 * seulement drapeau allumé ET fiche de la liste fermée. Drapeau éteint : réponse
 * identique à aujourd'hui (aucune clé `robots`), aucun appel de plus.
 * Fiche non publiée : le RPC `get_seo_reference_by_slug` filtre
 * `is_published = true` ⇒ getBySlug null ⇒ 404 comme aujourd'hui.
 */
import { NotFoundException } from '@nestjs/common';
import { ReferenceController } from './reference.controller';
import type { FeatureFlagsService } from '../../../config/feature-flags.service';
import type {
  ReferenceService,
  SeoReference,
} from '../services/reference.service';
import type { R6GuideLinkPolicyService } from '../services/r6-guide-link-policy.service';
import type { DiagnosticService } from '../validation/diagnostic.service';

const LISTED = 'capteur-de-pluie';
const UNLISTED = 'soupape-d-admission';

function reference(slug: string): SeoReference {
  return {
    id: 1,
    slug,
    title: 'Titre',
    metaDescription: 'desc',
    definition: 'Définition',
    roleMecanique: null,
    roleNegatif: null,
    composition: null,
    confusionsCourantes: null,
    symptomesAssocies: null,
    reglesMetier: null,
    scopeLimites: null,
    contentHtml: null,
    schemaJson: { '@type': 'DefinedTerm' },
    pgId: null,
    gammeName: null,
    gammeSlug: null,
    pgImg: null,
    relatedReferences: null,
    blogSlugs: null,
    canonicalUrl: null,
    takeaways: null,
    synonyms: null,
    variants: null,
    keySpecs: null,
    commonQuestions: null,
    contaminationFlags: null,
    sectionOverrides: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-11-25T00:00:00Z'),
  };
}

function build(flag: boolean, found = true) {
  const getBySlug = jest.fn(async (slug: string) =>
    found ? reference(slug) : null,
  );
  const flagGetter = jest.fn(() => flag);
  const featureFlags = {} as FeatureFlagsService;
  Object.defineProperty(featureFlags, 'seoR4NoindexEnabled', {
    get: flagGetter,
  });
  const filterPublishedSlugs = jest.fn(async () => [] as string[]);
  const getSnapshot = jest.fn();
  const controller = new ReferenceController(
    { getBySlug } as unknown as ReferenceService,
    featureFlags,
    { getSnapshot } as unknown as R6GuideLinkPolicyService,
    { filterPublishedSlugs } as unknown as DiagnosticService,
  );
  return {
    controller,
    getBySlug,
    flagGetter,
    filterPublishedSlugs,
    getSnapshot,
  };
}

describe('ReferenceController.getReference — R4 noindex (mandat EW)', () => {
  it('drapeau éteint, fiche listée : aucune clé robots, canonique propre', async () => {
    const { controller, getBySlug } = build(false);
    const res = await controller.getReference(LISTED);
    expect(res).not.toHaveProperty('robots');
    expect(res.canonicalUrl).toBe(`/reference-auto/${LISTED}`);
    expect(getBySlug).toHaveBeenCalledTimes(1);
  });

  it('drapeau allumé, fiche listée : noindex, follow et canonique inchangée', async () => {
    const { controller, getBySlug } = build(true);
    const res = await controller.getReference(LISTED);
    expect(res.robots).toBe('noindex, follow');
    expect(res.canonicalUrl).toBe(`/reference-auto/${LISTED}`);
    expect(res.slug).toBe(LISTED);
    expect(getBySlug).toHaveBeenCalledTimes(1);
  });

  it('drapeau allumé, fiche hors liste : aucune clé robots', async () => {
    const { controller } = build(true);
    const res = await controller.getReference(UNLISTED);
    expect(res).not.toHaveProperty('robots');
    expect(res.canonicalUrl).toBe(`/reference-auto/${UNLISTED}`);
  });

  it('fiche non publiée (RPC → null) : 404, drapeau allumé comme éteint', async () => {
    for (const flag of [false, true]) {
      const { controller } = build(flag, false);
      await expect(controller.getReference(LISTED)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
  });

  it('même réponse et mêmes appels hors robots, drapeau éteint ou allumé', async () => {
    const bOff = build(false);
    const bOn = build(true);
    const off = await bOff.controller.getReference(LISTED);
    const on = await bOn.controller.getReference(LISTED);
    for (const k of [
      'getBySlug',
      'filterPublishedSlugs',
      'getSnapshot',
    ] as const) {
      expect(bOn[k].mock.calls).toEqual(bOff[k].mock.calls);
    }
    const { robots, ...rest } = on;
    expect(robots).toBe('noindex, follow');
    expect(rest).toEqual(off);
  });
});
