/**
 * Consolidation R4 → R3 (mandat ER) — routes R4 et R5 : redirection, liens.
 * Pas d'I/O : services en doublure.
 */
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { ReferenceController } from './reference.controller';
import { DiagnosticController } from './diagnostic.controller';
import {
  R4_CONSOLIDATION_OFF,
  type R4ConsolidationSnapshot,
} from '../services/r4-consolidation-policy.service';

const CONSEILS = (a: string) => `/blog-pieces-auto/conseils/${a}`;
const REF = (s: string) => `/reference-auto/${s}`;
const ON: R4ConsolidationSnapshot = {
  enabled: true,
  redirects: new Map([['thermostat', CONSEILS('thermostat')]]),
  degraded: false,
};

function referenceController(
  snap: R4ConsolidationSnapshot,
  referenceService: Record<string, unknown> = {},
) {
  const ctl = Object.create(
    ReferenceController.prototype,
  ) as ReferenceController;
  Object.assign(ctl as unknown as Record<string, unknown>, {
    logger: { log: jest.fn(), debug: jest.fn(), warn: jest.fn() },
    referenceService,
    r4Consolidation: { getSnapshot: jest.fn().mockResolvedValue(snap) },
    guideLinkPolicy: {
      getSnapshot: jest.fn().mockResolvedValue({
        consolidationEnabled: false,
        publishedGuideAliases: new Set(),
        conseilsAliases: new Set(),
      }),
    },
    diagnosticService: {
      filterPublishedSlugs: jest.fn().mockResolvedValue([]),
    },
  });
  return ctl;
}

describe('GET /api/seo/reference/redirect/:slug', () => {
  it('drapeau éteint → null', async () => {
    const ctl = referenceController(R4_CONSOLIDATION_OFF);
    expect(await ctl.getRedirect('thermostat')).toEqual({
      redirect_to: null,
      pg_alias: null,
    });
  });
  it('slug hors liste ou garde non satisfaite → null', async () => {
    const ctl = referenceController(ON);
    expect(await ctl.getRedirect('alternateur')).toEqual({
      redirect_to: null,
      pg_alias: null,
    });
  });
  it('en-tête Cache-Control : no-store, plus « public, max-age=300 »', () => {
    expect(
      Reflect.getMetadata(
        HEADERS_METADATA,
        ReferenceController.prototype.getRedirect,
      ),
    ).toEqual([{ name: 'Cache-Control', value: 'no-store' }]);
  });
  it('page redirigée → page conseils et alias', async () => {
    const ctl = referenceController(ON);
    expect(await ctl.getRedirect('thermostat')).toEqual({
      redirect_to: CONSEILS('thermostat'),
      pg_alias: 'thermostat',
    });
  });
});

describe('GET /api/seo/reference/by-gamme/:pgId — url du lien', () => {
  const svc = {
    getReferenceSlugByGammeId: jest.fn().mockResolvedValue('thermostat'),
  };
  it('drapeau éteint → page R4 (réponse inchangée)', async () => {
    const ctl = referenceController(R4_CONSOLIDATION_OFF, svc);
    expect(await ctl.getReferenceByGamme('316')).toEqual({
      slug: 'thermostat',
      url: REF('thermostat'),
    });
  });
  it('drapeau allumé → page conseils', async () => {
    const ctl = referenceController(ON, svc);
    expect(
      await ctl.getReferenceByGamme(
        '316',
        '/blog-pieces-auto/guide-achat/thermostat',
      ),
    ).toEqual({ slug: 'thermostat', url: CONSEILS('thermostat') });
  });
  it('drapeau allumé, lien affiché sur la page conseils cible → url null', async () => {
    const ctl = referenceController(ON, svc);
    expect(
      await ctl.getReferenceByGamme('316', CONSEILS('thermostat')),
    ).toEqual({
      slug: 'thermostat',
      url: null,
    });
  });
});

describe('GET /api/seo/reference — hub', () => {
  const item = (slug: string) => ({
    id: 1,
    slug,
    title: slug,
    metaDescription: null,
    definition: '',
    pgId: 1,
    gammeName: slug,
    gammeSlug: slug,
  });
  const svc = {
    getAll: jest
      .fn()
      .mockResolvedValue([item('thermostat'), item('alternateur')]),
  };
  it('drapeau éteint → aucun champ href', async () => {
    const out = await referenceController(
      R4_CONSOLIDATION_OFF,
      svc,
    ).listReferences();
    expect(out.references.every((r) => !('href' in r))).toBe(true);
  });
  it('drapeau allumé → href : page conseils si redirigée, sinon page R4', async () => {
    const out = await referenceController(ON, svc).listReferences();
    expect(out.references.map((r) => r.href)).toEqual([
      CONSEILS('thermostat'),
      REF('alternateur'),
    ]);
    expect(out.total).toBe(2);
  });
});

describe('GET /api/seo/reference/:slug/related', () => {
  const svc = {
    getBySlug: jest.fn().mockResolvedValue({ id: 7, slug: 'alternateur' }),
    getRelatedReferences: jest
      .fn()
      .mockResolvedValue([{ slug: 'thermostat' }, { slug: 'demarreur' }]),
  };
  it('drapeau éteint → réponse inchangée', async () => {
    const out = await referenceController(
      R4_CONSOLIDATION_OFF,
      svc,
    ).getRelatedReferences('alternateur');
    expect(out).toEqual({
      related: [{ slug: 'thermostat' }, { slug: 'demarreur' }],
    });
  });
  it('drapeau allumé → href par page', async () => {
    const out = await referenceController(ON, svc).getRelatedReferences(
      'alternateur',
    );
    expect(out.related.map((r) => r.href)).toEqual([
      CONSEILS('thermostat'),
      REF('demarreur'),
    ]);
  });
});

describe('DiagnosticController :slug — liens « Comprendre »', () => {
  function diagnosticController(snap: R4ConsolidationSnapshot) {
    const ctl = Object.create(
      DiagnosticController.prototype,
    ) as DiagnosticController;
    Object.assign(ctl as unknown as Record<string, unknown>, {
      logger: { debug: jest.fn() },
      diagnosticService: {
        getBySlug: jest.fn().mockResolvedValue({
          slug: 'surchauffe-moteur',
          schema_org: {},
          related_references: ['thermostat', 'pompe-a-eau-x'],
        }),
      },
      r4Consolidation: { getSnapshot: jest.fn().mockResolvedValue(snap) },
    });
    return ctl;
  }
  it('drapeau éteint → pas de champ related_reference_hrefs', async () => {
    const out =
      await diagnosticController(R4_CONSOLIDATION_OFF).getBySlug(
        'surchauffe-moteur',
      );
    expect('related_reference_hrefs' in out.data).toBe(false);
  });
  it('drapeau allumé → liens parallèles à related_references', async () => {
    const out = await diagnosticController(ON).getBySlug('surchauffe-moteur');
    expect(out.data.related_reference_hrefs).toEqual([
      CONSEILS('thermostat'),
      REF('pompe-a-eau-x'),
    ]);
    expect(out.data.related_references).toEqual([
      'thermostat',
      'pompe-a-eau-x',
    ]);
  });
});
