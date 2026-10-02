/**
 * Règle unique des liens vers une page détail guide d'achat (ADR-103 D5, vault).
 *
 * Invariants couverts :
 *   - drapeau éteint : un lien vers un guide n'est servi que si le guide est publié ;
 *   - drapeau allumé : jamais de lien vers un guide. Le lien vise l'article conseils
 *     de la gamme s'il existe et n'est pas la page courante, sinon il disparaît ;
 *   - drapeau éteint, aucun doublon n'est retiré : le seul effet est le retrait des
 *     liens vers un guide non publié ;
 *   - le hub, la page autonome du sélecteur et les autres URL ne sont pas touchés ;
 *   - HTML : le lien retiré garde son texte (balise <a> dépliée), rien d'autre ne change ;
 *   - chargement : une seule lecture, la fonction DEFINER `get_r6_guide_link_snapshot`
 *     (le rôle `anon` de PREPROD ne lit pas les tables sous RLS) ; réponse en erreur ou
 *     mal formée → erreur marquée, jamais mise en cache, aucun ensemble de repli.
 *
 * Fonctions pures, sauf le chargement : `callRpc` et le cache y sont des doubles
 * (constructeur SupabaseBaseService contourné par Object.create).
 */

import {
  CACHE_STRATEGIES,
  getCacheKey,
} from '../../../config/cache-ttl.config';
import {
  applyGuideLinkRuleToBlocks,
  applyGuideLinkRuleToHtml,
  guideAliasFromHref,
  R6GuideLinkPolicyService,
  resolveGuideLink,
  type R6GuideLinkSnapshot,
} from './r6-guide-link-policy.service';

const GUIDE = (a: string) => `/blog-pieces-auto/guide-achat/${a}`;
const CONSEILS = (a: string) => `/blog-pieces-auto/conseils/${a}`;

function snapshot(
  consolidationEnabled: boolean,
  published: string[] = ['filtre-a-air', 'cardan', 'batterie'],
  conseils: string[] = ['filtre-a-air', 'batterie'],
): R6GuideLinkSnapshot {
  return {
    consolidationEnabled,
    publishedGuideAliases: new Set(published),
    conseilsAliases: new Set(conseils),
  };
}

describe('guideAliasFromHref', () => {
  it.each([
    [GUIDE('filtre-a-air'), 'filtre-a-air'],
    [`${GUIDE('filtre-a-air')}#comment-choisir`, 'filtre-a-air'],
    [`${GUIDE('filtre-a-air')}?utm=x`, 'filtre-a-air'],
    [`${GUIDE('filtre-a-air')}/`, 'filtre-a-air'],
    [GUIDE('démarreur'), 'démarreur'],
  ])('%s → %s', (href, alias) => {
    expect(guideAliasFromHref(href)).toBe(alias);
  });

  it.each([
    '/blog-pieces-auto/guide-achat',
    '/blog-pieces-auto/guide-achat/',
    '/blog-pieces-auto/guide-achat/comment-utiliser-selecteur-vehicule-pieces-auto',
    CONSEILS('filtre-a-air'),
    '/pieces/filtre-a-air-8.html',
    '/guide-achat/filtre-a-air',
    'https://exemple.fr/blog-pieces-auto/guide-achat/filtre-a-air',
    '/blog-pieces-auto/guide-achats/filtre-a-air',
  ])('%s → pas un lien de guide', (href) => {
    expect(guideAliasFromHref(href)).toBeNull();
  });
});

describe('resolveGuideLink', () => {
  const onConseils = { currentPath: CONSEILS('cardan') };

  describe('drapeau éteint', () => {
    const s = snapshot(false);

    it('guide publié → lien vers le guide, inchangé', () => {
      expect(resolveGuideLink('filtre-a-air', s, onConseils)).toBe(
        GUIDE('filtre-a-air'),
      );
    });

    it('guide non publié → pas de lien', () => {
      expect(resolveGuideLink('demarreur', s, onConseils)).toBeNull();
    });

    it('guide publié déjà lié par la page → lien gardé (pas de retrait de doublon)', () => {
      expect(
        resolveGuideLink('filtre-a-air', s, {
          currentPath: CONSEILS('cardan'),
          linkedPaths: new Set([
            GUIDE('filtre-a-air'),
            CONSEILS('filtre-a-air'),
          ]),
        }),
      ).toBe(GUIDE('filtre-a-air'));
    });
  });

  describe('drapeau allumé', () => {
    const s = snapshot(true);

    it('gamme avec article conseils → lien vers les conseils', () => {
      expect(resolveGuideLink('filtre-a-air', s, onConseils)).toBe(
        CONSEILS('filtre-a-air'),
      );
    });

    it('gamme sans article conseils → pas de lien, même si le guide est publié', () => {
      expect(resolveGuideLink('cardan', s, onConseils)).toBeNull();
    });

    it('article conseils = page courante → pas de lien', () => {
      expect(
        resolveGuideLink('filtre-a-air', s, {
          currentPath: CONSEILS('filtre-a-air'),
        }),
      ).toBeNull();
    });

    it('article conseils déjà lié par la page → pas de doublon', () => {
      expect(
        resolveGuideLink('filtre-a-air', s, {
          currentPath: '/pieces/filtre-a-air-8.html',
          linkedPaths: new Set([CONSEILS('filtre-a-air')]),
        }),
      ).toBeNull();
    });

    it('ne renvoie jamais une URL de guide', () => {
      for (const a of ['filtre-a-air', 'cardan', 'batterie', 'inconnu']) {
        const href = resolveGuideLink(a, s, onConseils);
        expect(href === null || !href.includes('/guide-achat/')).toBe(true);
      }
    });
  });
});

describe('applyGuideLinkRuleToHtml', () => {
  const ctx = () => ({ currentPath: CONSEILS('cardan') });

  it('sans lien de guide → même chaîne, aucun changement compté', () => {
    const html = '<p>Voir <a href="/pieces/cardan-13.html">le cardan</a>.</p>';
    const out = applyGuideLinkRuleToHtml(html, snapshot(true), ctx());
    expect(out.html).toBe(html);
    expect(out.changed).toBe(0);
  });

  it('drapeau éteint, guide publié → HTML inchangé', () => {
    const html = `<p>Lire <a href="${GUIDE('filtre-a-air')}" class="x">le guide</a>.</p>`;
    const out = applyGuideLinkRuleToHtml(html, snapshot(false), ctx());
    expect(out.html).toBe(html);
    expect(out.changed).toBe(0);
  });

  it('drapeau éteint, guide non publié → balise dépliée, texte gardé', () => {
    const html = `<p>Lire <a href="${GUIDE('démarreur')}">le <strong>guide</strong></a>.</p>`;
    const out = applyGuideLinkRuleToHtml(html, snapshot(false), ctx());
    expect(out.html).toBe('<p>Lire le <strong>guide</strong>.</p>');
    expect(out.changed).toBe(1);
  });

  it('drapeau allumé → href remplacé par les conseils, attributs gardés', () => {
    const html = `<a class="link" href="${GUIDE('filtre-a-air')}#faq" title="t">guide</a>`;
    const out = applyGuideLinkRuleToHtml(html, snapshot(true), ctx());
    expect(out.html).toBe(
      `<a class="link" href="${CONSEILS('filtre-a-air')}" title="t">guide</a>`,
    );
    expect(out.changed).toBe(1);
  });

  it('drapeau allumé, lien vers le guide de la page courante → déplié', () => {
    const html = `<p>Voir <a href="${GUIDE('cardan')}">notre guide</a>.</p>`;
    const out = applyGuideLinkRuleToHtml(html, snapshot(true), {
      currentPath: CONSEILS('cardan'),
    });
    expect(out.html).toBe('<p>Voir notre guide.</p>');
  });

  it('drapeau allumé, conseils déjà liés dans le fragment → doublon déplié', () => {
    const html =
      `<a href="${CONSEILS('filtre-a-air')}">conseils</a> ` +
      `<a href="${GUIDE('filtre-a-air')}">guide</a>`;
    const out = applyGuideLinkRuleToHtml(html, snapshot(true), ctx());
    expect(out.html).toBe(
      `<a href="${CONSEILS('filtre-a-air')}">conseils</a> guide`,
    );
  });

  it('deux liens vers le même guide → un seul lien servi drapeau allumé, HTML inchangé drapeau éteint', () => {
    const html = `<a href="${GUIDE('batterie')}">a</a> <a href="${GUIDE('batterie')}">b</a>`;
    expect(applyGuideLinkRuleToHtml(html, snapshot(true), ctx()).html).toBe(
      `<a href="${CONSEILS('batterie')}">a</a> b`,
    );
    const off = applyGuideLinkRuleToHtml(html, snapshot(false), ctx());
    expect(off.html).toBe(html);
    expect(off.changed).toBe(0);
  });

  it('linkedPaths partagé : les fragments traités ensuite voient les liens servis', () => {
    const shared = {
      currentPath: CONSEILS('cardan'),
      linkedPaths: new Set<string>(),
    };
    const s = snapshot(true);
    const a = applyGuideLinkRuleToHtml(
      `<a href="${GUIDE('batterie')}">x</a>`,
      s,
      shared,
    );
    const b = applyGuideLinkRuleToHtml(
      `<a href="${GUIDE('batterie')}">y</a>`,
      s,
      shared,
    );
    expect(a.html).toBe(`<a href="${CONSEILS('batterie')}">x</a>`);
    expect(b.html).toBe('y');
  });

  it('hub et page du sélecteur → jamais touchés', () => {
    const html =
      '<a href="/blog-pieces-auto/guide-achat">hub</a> ' +
      '<a href="/blog-pieces-auto/guide-achat/comment-utiliser-selecteur-vehicule-pieces-auto">s</a>';
    const out = applyGuideLinkRuleToHtml(html, snapshot(true), ctx());
    expect(out.html).toBe(html);
  });

  it('guillemets simples et majuscules de balise', () => {
    const html = `<A HREF='${GUIDE('cardan')}'>g</A>`;
    expect(applyGuideLinkRuleToHtml(html, snapshot(true), ctx()).html).toBe(
      'g',
    );
  });
});

describe('applyGuideLinkRuleToBlocks', () => {
  const blocks = () => ({
    blocks: [
      {
        kind: 'buying-guide' as const,
        heading: 'Bien choisir votre filtre à air',
        items: [
          {
            kind: 'buying-guide' as const,
            title: "Guide d'achat Filtre à air",
            href: GUIDE('filtre-a-air'),
            reason: 'Guide complet pour bien choisir',
            score: 0.95,
          },
        ],
      },
      {
        kind: 'compatible-parts' as const,
        heading: 'Pièces associées',
        items: [
          {
            kind: 'compatible-parts' as const,
            title: 'Cardan',
            href: '/pieces/cardan-13.html',
            reason: 'r',
            score: 0.5,
          },
        ],
      },
    ],
  });
  const onGamme = { currentPath: '/pieces/filtre-a-air-8.html' };

  it('drapeau éteint, guide publié → payload identique', () => {
    expect(
      applyGuideLinkRuleToBlocks(blocks(), snapshot(false), onGamme),
    ).toEqual(blocks());
  });

  it('drapeau éteint, conseils et guide déjà liés par la page → payload identique', () => {
    expect(
      applyGuideLinkRuleToBlocks(blocks(), snapshot(false), {
        ...onGamme,
        linkedPaths: new Set([GUIDE('filtre-a-air'), CONSEILS('filtre-a-air')]),
      }),
    ).toEqual(blocks());
  });

  it('drapeau éteint, guide non publié → item retiré, bloc vide retiré', () => {
    const out = applyGuideLinkRuleToBlocks(
      blocks(),
      snapshot(false, ['cardan']),
      onGamme,
    );
    expect(out.blocks.map((b) => b.kind)).toEqual(['compatible-parts']);
  });

  it('drapeau allumé, conseils déjà liés par la page → bloc guide retiré', () => {
    const out = applyGuideLinkRuleToBlocks(blocks(), snapshot(true), {
      ...onGamme,
      linkedPaths: new Set([CONSEILS('filtre-a-air')]),
    });
    expect(out.blocks.map((b) => b.kind)).toEqual(['compatible-parts']);
  });

  it('drapeau allumé, conseils non liés → href remplacé, le reste gardé', () => {
    const out = applyGuideLinkRuleToBlocks(blocks(), snapshot(true), onGamme);
    expect(out.blocks[0].items[0]).toEqual({
      ...blocks().blocks[0].items[0],
      href: CONSEILS('filtre-a-air'),
    });
    expect(out.blocks[1]).toEqual(blocks().blocks[1]);
  });

  it("n'altère pas le payload reçu", () => {
    const input = blocks();
    applyGuideLinkRuleToBlocks(input, snapshot(true), onGamme);
    expect(input).toEqual(blocks());
  });
});

describe('R6GuideLinkPolicyService.getSnapshot', () => {
  type RpcOut = { data: unknown; error: { message: string } | null };

  function makeService(rpcOut: RpcOut, cached: unknown = null) {
    const calls: Array<{ name: string; params: unknown; ctx: unknown }> = [];
    const cacheService = {
      get: jest.fn().mockResolvedValue(cached),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const svc = Object.create(R6GuideLinkPolicyService.prototype) as Record<
      string,
      unknown
    >;
    svc.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    svc.featureFlags = { seoR6ConsolidationEnabled: true };
    svc.cacheService = cacheService;
    svc.callRpc = (name: string, params: unknown, ctx: unknown) => {
      calls.push({ name, params, ctx });
      return Promise.resolve(rpcOut);
    };
    return {
      service: svc as unknown as R6GuideLinkPolicyService,
      calls,
      cacheService,
    };
  }

  const strategy = CACHE_STRATEGIES.BLOG.R6_GUIDE_LINKS;
  const key = getCacheKey(strategy, 'snapshot');
  const payload = {
    published_guide_aliases: ['batterie', 'cardan', 'filtre-a-air'],
    conseils_aliases: ['batterie', 'filtre-a-air'],
  };

  it('lit la fonction DEFINER via callRpc, source api, et met le résultat en cache', async () => {
    const { service, calls, cacheService } = makeService({
      data: payload,
      error: null,
    });
    const s = await service.getSnapshot();
    expect(calls).toEqual([
      {
        name: 'get_r6_guide_link_snapshot',
        params: {},
        ctx: { source: 'api', role: 'service_role' },
      },
    ]);
    expect(s).toEqual(snapshot(true));
    expect(cacheService.set).toHaveBeenCalledWith(
      key,
      {
        publishedGuideAliases: payload.published_guide_aliases,
        conseilsAliases: payload.conseils_aliases,
      },
      strategy.ttl,
    );
  });

  it('cache présent → aucune lecture', async () => {
    const { service, calls } = makeService(
      { data: null, error: { message: 'inattendu' } },
      {
        publishedGuideAliases: ['cardan'],
        conseilsAliases: [],
      },
    );
    const s = await service.getSnapshot();
    expect(calls).toHaveLength(0);
    expect([...s.publishedGuideAliases]).toEqual(['cardan']);
  });

  it('erreur de la fonction → erreur marquée, rien en cache', async () => {
    const { service, cacheService } = makeService({
      data: null,
      error: { message: 'permission denied' },
    });
    await expect(service.getSnapshot()).rejects.toThrow(
      'R6_GUIDE_LINK_SNAPSHOT_FAILED: get_r6_guide_link_snapshot: permission denied',
    );
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['tableau au lieu d’objet', []],
    ['clé absente', { published_guide_aliases: ['cardan'] }],
    [
      'pas un tableau',
      { published_guide_aliases: 'cardan', conseils_aliases: [] },
    ],
    [
      'élément non chaîne',
      { published_guide_aliases: ['cardan', 7], conseils_aliases: [] },
    ],
    [
      'chaîne vide',
      { published_guide_aliases: ['cardan'], conseils_aliases: [''] },
    ],
  ])(
    'réponse mal formée (%s) → erreur marquée, rien en cache',
    async (_label, data) => {
      const { service, cacheService } = makeService({ data, error: null });
      await expect(service.getSnapshot()).rejects.toThrow(
        /^R6_GUIDE_LINK_SNAPSHOT_FAILED: get_r6_guide_link_snapshot: réponse invalide/,
      );
      expect(cacheService.set).not.toHaveBeenCalled();
    },
  );
});
