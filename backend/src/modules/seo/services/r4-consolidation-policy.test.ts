/**
 * Consolidation R4 → R3 (mandat ER) : garde unique, règle unique des liens,
 * sitemap, snapshot. Pas d'I/O : cache et RPC sont des doublures.
 */
import {
  R4_CONSOLIDATION_OFF,
  R4_CONSOLIDATION_SNAPSHOT_FAILED,
  R4ConsolidationPolicyService,
  applyReferenceLinkRuleToHtml,
  computeR4Redirects,
  r4RedirectTarget,
  referenceLinkPath,
  referenceSlugFromHref,
  withoutR4Redirected,
  type PublishedReferenceRow,
  type R4ConsolidationSnapshot,
} from './r4-consolidation-policy.service';
import { R4_CONSOLIDATION_TARGETS } from './r4-consolidation.config';

const CONSEILS = (a: string) => `/blog-pieces-auto/conseils/${a}`;
const REF = (s: string) => `/reference-auto/${s}`;

const TARGETS = [
  { slug: 'disque-de-frein', pgId: 82 },
  { slug: 'thermostat', pgId: 316 },
];
const row = (
  slug: string,
  pgId: number | null,
  gammeSlug: string | null = slug,
): PublishedReferenceRow => ({ slug, pgId, gammeSlug });

const on = (entries: Array<[string, string]>): R4ConsolidationSnapshot => ({
  enabled: true,
  redirects: new Map(entries),
  degraded: false,
});
const SNAP = on([
  ['disque-de-frein', CONSEILS('disque-de-frein')],
  ['thermostat', CONSEILS('thermostat')],
]);

describe('R4_CONSOLIDATION_TARGETS — liste close', () => {
  it('43 pages, slugs et gammes uniques', () => {
    expect(R4_CONSOLIDATION_TARGETS).toHaveLength(43);
    expect(new Set(R4_CONSOLIDATION_TARGETS.map((t) => t.slug)).size).toBe(43);
    expect(new Set(R4_CONSOLIDATION_TARGETS.map((t) => t.pgId)).size).toBe(43);
    for (const t of R4_CONSOLIDATION_TARGETS) {
      expect(t.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(Number.isInteger(t.pgId) && t.pgId > 0).toBe(true);
    }
  });

  it('figée', () => {
    expect(Object.isFrozen(R4_CONSOLIDATION_TARGETS)).toBe(true);
  });
});

describe('computeR4Redirects — garde', () => {
  const ALL = new Set(['disque-de-frein', 'thermostat']);

  it('chaîne complète : page publiée, même gamme, alias, page conseils servie → cible', () => {
    const r = computeR4Redirects(
      TARGETS,
      [row('disque-de-frein', 82), row('thermostat', 316)],
      ALL,
    );
    expect([...r]).toEqual([
      ['disque-de-frein', CONSEILS('disque-de-frein')],
      ['thermostat', CONSEILS('thermostat')],
    ]);
  });

  it('page non publiée (absente des pages publiées) → pas de redirection', () => {
    const r = computeR4Redirects(TARGETS, [row('thermostat', 316)], ALL);
    expect(r.has('disque-de-frein')).toBe(false);
    expect(r.get('thermostat')).toBe(CONSEILS('thermostat'));
  });

  it('gamme en base différente de la liste → pas de redirection', () => {
    const r = computeR4Redirects(TARGETS, [row('disque-de-frein', 999)], ALL);
    expect(r.size).toBe(0);
  });

  it.each([null, ''])('gamme sans alias (%p) → pas de redirection', (alias) => {
    const r = computeR4Redirects(
      TARGETS,
      [row('disque-de-frein', 82, alias)],
      new Set(['disque-de-frein', '']),
    );
    expect(r.size).toBe(0);
  });

  it('page conseils absente ou non indexable (hors ensemble servi) → pas de redirection', () => {
    const r = computeR4Redirects(
      TARGETS,
      [row('disque-de-frein', 82), row('thermostat', 316)],
      new Set(['thermostat']),
    );
    expect([...r.keys()]).toEqual(['thermostat']);
  });

  it('page publiée hors liste → jamais redirigée', () => {
    const r = computeR4Redirects(
      TARGETS,
      [row('alternateur', 4)],
      new Set(['alternateur']),
    );
    expect(r.size).toBe(0);
  });

  it('cible = alias de la gamme en base, pas le slug R4', () => {
    const r = computeR4Redirects(
      [{ slug: 'thermostat', pgId: 316 }],
      [row('thermostat', 316, 'thermostat-moteur')],
      new Set(['thermostat-moteur']),
    );
    expect(r.get('thermostat')).toBe(CONSEILS('thermostat-moteur'));
  });
});

describe('r4RedirectTarget', () => {
  it('drapeau éteint → null', () => {
    expect(
      r4RedirectTarget('disque-de-frein', R4_CONSOLIDATION_OFF),
    ).toBeNull();
  });
  it('slug hors liste → null', () => {
    expect(r4RedirectTarget('alternateur', SNAP)).toBeNull();
  });
  it('slug redirigé → page conseils', () => {
    expect(r4RedirectTarget('thermostat', SNAP)).toBe(CONSEILS('thermostat'));
  });
  it('drapeau allumé, garde non vérifiable (snapshot vide) → null', () => {
    expect(r4RedirectTarget('thermostat', on([]))).toBeNull();
  });
});

describe('referenceLinkPath — règle unique des liens', () => {
  it('drapeau éteint → page R4', () => {
    expect(referenceLinkPath('thermostat', R4_CONSOLIDATION_OFF, '/x')).toBe(
      REF('thermostat'),
    );
  });
  it('page non redirigée → page R4', () => {
    expect(referenceLinkPath('alternateur', SNAP, '/x')).toBe(
      REF('alternateur'),
    );
  });
  it('page redirigée → sa page conseils', () => {
    expect(referenceLinkPath('thermostat', SNAP, '/reference-auto')).toBe(
      CONSEILS('thermostat'),
    );
  });
  it('page redirigée, lien affiché sur sa page conseils → null (lien retiré)', () => {
    expect(
      referenceLinkPath('thermostat', SNAP, CONSEILS('thermostat')),
    ).toBeNull();
  });
});

describe('referenceSlugFromHref', () => {
  it.each([
    ['/reference-auto/thermostat', 'thermostat'],
    ['/reference-auto/thermostat/', 'thermostat'],
    ['/reference-auto/thermostat#role', 'thermostat'],
    ['/reference-auto/thermostat?x=1', 'thermostat'],
    ['/reference-auto', null],
    ['/reference-auto/', null],
    ['https://www.automecanik.com/reference-auto/thermostat', null],
    ['/reference-auto/a/b', null],
  ])('%s → %p', (href, slug) => {
    expect(referenceSlugFromHref(href)).toBe(slug);
  });
});

describe('applyReferenceLinkRuleToHtml', () => {
  const HTML =
    `<p>Voir <a href="${REF('thermostat')}" class="l">le thermostat</a>, ` +
    `<a href='${REF('disque-de-frein')}'>le disque</a>, ` +
    `<a href="${REF('alternateur')}">l'alternateur</a> et ` +
    `<a href="/reference-auto">le glossaire</a>.</p>`;

  it('drapeau éteint → HTML identique, 0 lien modifié', () => {
    const r = applyReferenceLinkRuleToHtml(HTML, R4_CONSOLIDATION_OFF, '/x');
    expect(r).toEqual({ html: HTML, changed: 0 });
  });

  it('drapeau allumé → href redirigé (attributs et guillemets gardés), autres liens intacts', () => {
    const r = applyReferenceLinkRuleToHtml(HTML, SNAP, '/pieces/x-1.html');
    expect(r.changed).toBe(2);
    expect(r.html).toBe(
      `<p>Voir <a href="${CONSEILS('thermostat')}" class="l">le thermostat</a>, ` +
        `<a href='${CONSEILS('disque-de-frein')}'>le disque</a>, ` +
        `<a href="${REF('alternateur')}">l'alternateur</a> et ` +
        `<a href="/reference-auto">le glossaire</a>.</p>`,
    );
  });

  it('sur la page conseils cible → lien déplié, texte gardé', () => {
    const r = applyReferenceLinkRuleToHtml(HTML, SNAP, CONSEILS('thermostat'));
    expect(r.changed).toBe(2);
    expect(r.html).toContain('<p>Voir le thermostat, ');
    expect(r.html).toContain(
      `<a href='${CONSEILS('disque-de-frein')}'>le disque</a>`,
    );
  });

  it('attribut avant href et fragment', () => {
    const r = applyReferenceLinkRuleToHtml(
      `<a title="t" href="${REF('thermostat')}#role">x</a>`,
      SNAP,
      '/x',
    );
    expect(r.html).toBe(`<a title="t" href="${CONSEILS('thermostat')}">x</a>`);
  });

  it('HTML sans lien R4 → identique', () => {
    const html = '<p><a href="/pieces/x-1.html">x</a></p>';
    expect(applyReferenceLinkRuleToHtml(html, SNAP, '/x')).toEqual({
      html,
      changed: 0,
    });
  });
});

describe('withoutR4Redirected — sitemap', () => {
  const rows = [{ slug: 'thermostat' }, { slug: 'alternateur' }];
  it('drapeau éteint → toutes les lignes', () => {
    expect(withoutR4Redirected(rows, R4_CONSOLIDATION_OFF)).toEqual({
      kept: rows,
      excluded: 0,
    });
  });
  it('drapeau allumé → pages redirigées exclues, comptées', () => {
    expect(withoutR4Redirected(rows, SNAP)).toEqual({
      kept: [{ slug: 'alternateur' }],
      excluded: 1,
    });
  });
});

describe('R4ConsolidationPolicyService.getSnapshot', () => {
  const RPC_ROWS = R4_CONSOLIDATION_TARGETS.map((t) => ({
    id: t.pgId,
    slug: t.slug,
    title: t.slug,
    pg_id: t.pgId,
    gamme_slug: t.slug,
  })).concat([
    {
      id: 9999,
      slug: 'alternateur',
      title: 'x',
      pg_id: 4,
      gamme_slug: 'alternateur',
    },
  ]);

  function makeService(
    opts: {
      flag?: boolean;
      cached?: unknown;
      cacheGet?: Error;
      rpc?: { data: unknown; error: { message: string } | null };
      conseils?: string[] | Error;
    } = {},
  ) {
    const svc = Object.create(
      R4ConsolidationPolicyService.prototype,
    ) as R4ConsolidationPolicyService;
    const cacheService = {
      get:
        opts.cacheGet instanceof Error
          ? jest.fn().mockRejectedValue(opts.cacheGet)
          : jest.fn().mockResolvedValue(opts.cached ?? null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const callRpc = jest
      .fn()
      .mockResolvedValue(opts.rpc ?? { data: RPC_ROWS, error: null });
    const guideLinkPolicy = {
      getSnapshot:
        opts.conseils instanceof Error
          ? jest.fn().mockRejectedValue(opts.conseils)
          : jest.fn().mockResolvedValue({
              consolidationEnabled: false,
              publishedGuideAliases: new Set(),
              conseilsAliases: new Set(
                opts.conseils ?? R4_CONSOLIDATION_TARGETS.map((t) => t.slug),
              ),
            }),
    };
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    Object.assign(svc as unknown as Record<string, unknown>, {
      featureFlags: { seoR4ConsolidationEnabled: opts.flag ?? true },
      cacheService,
      guideLinkPolicy,
      callRpc,
      logger,
    });
    return { svc, cacheService, callRpc, guideLinkPolicy, logger };
  }

  it('drapeau éteint → snapshot éteint, aucune lecture', async () => {
    const { svc, cacheService, callRpc, guideLinkPolicy } = makeService({
      flag: false,
    });
    expect(await svc.getSnapshot()).toBe(R4_CONSOLIDATION_OFF);
    expect(R4_CONSOLIDATION_OFF.degraded).toBe(false);
    expect(cacheService.get).not.toHaveBeenCalled();
    expect(callRpc).not.toHaveBeenCalled();
    expect(guideLinkPolicy.getSnapshot).not.toHaveBeenCalled();
    expect(svc.cacheKeySegment('r6c0')).toBe('r6c0');
  });

  it('drapeau allumé → 43 redirections, pages publiées de la liste mises en cache', async () => {
    const { svc, cacheService, callRpc } = makeService();
    const snap = await svc.getSnapshot();
    expect(snap.enabled).toBe(true);
    expect(snap.degraded).toBe(false);
    expect(snap.redirects.size).toBe(43);
    expect(snap.redirects.get('vanne-egr')).toBe(CONSEILS('vanne-egr'));
    expect(snap.redirects.has('alternateur')).toBe(false);
    expect(callRpc).toHaveBeenCalledWith(
      'get_all_seo_references',
      {},
      {
        source: 'api',
      },
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      'r4-consolidation:v1:published-targets',
      expect.any(Array),
      600,
    );
    expect((cacheService.set.mock.calls[0][1] as unknown[]).length).toBe(43);
    expect(svc.cacheKeySegment('r6c0')).toBe('r6c0.r4c1');
  });

  it('cache présent → aucune lecture RPC', async () => {
    const { svc, callRpc } = makeService({
      cached: [{ slug: 'thermostat', pgId: 316, gammeSlug: 'thermostat' }],
    });
    const snap = await svc.getSnapshot();
    expect(callRpc).not.toHaveBeenCalled();
    expect([...snap.redirects.keys()]).toEqual(['thermostat']);
  });

  it('page conseils non servie → page servie comme aujourd’hui', async () => {
    const { svc } = makeService({ conseils: ['thermostat'] });
    const snap = await svc.getSnapshot();
    expect([...snap.redirects.keys()]).toEqual(['thermostat']);
  });

  it.each([
    ['erreur RPC', { rpc: { data: null, error: { message: 'boom' } } }],
    ['réponse non tableau', { rpc: { data: {}, error: null } }],
    ['ligne sans slug', { rpc: { data: [{ pg_id: 1 }], error: null } }],
  ])(
    '%s → aucune redirection, snapshot dégradé, erreur marquée, rien en cache',
    async (_l, opts) => {
      const { svc, cacheService, logger } = makeService(opts as never);
      const snap = await svc.getSnapshot();
      expect(snap).toEqual({
        enabled: true,
        redirects: new Map(),
        degraded: true,
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(R4_CONSOLIDATION_SNAPSHOT_FAILED),
      );
      expect(cacheService.set).not.toHaveBeenCalled();
    },
  );

  it('règle conseils en échec → aucune redirection, snapshot dégradé, erreur marquée', async () => {
    const { svc, logger } = makeService({ conseils: new Error('R6 down') });
    const snap = await svc.getSnapshot();
    expect(snap).toEqual({
      enabled: true,
      redirects: new Map(),
      degraded: true,
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(R4_CONSOLIDATION_SNAPSHOT_FAILED),
    );
  });

  it('lecture du cache Redis en échec → snapshot dégradé, aucune lecture RPC, erreur marquée', async () => {
    const { svc, cacheService, callRpc, logger } = makeService({
      cacheGet: new Error('redis down'),
    });
    const snap = await svc.getSnapshot();
    expect(snap).toEqual({
      enabled: true,
      redirects: new Map(),
      degraded: true,
    });
    expect(callRpc).not.toHaveBeenCalled();
    expect(cacheService.set).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(R4_CONSOLIDATION_SNAPSHOT_FAILED),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('redis down'),
    );
  });
});
