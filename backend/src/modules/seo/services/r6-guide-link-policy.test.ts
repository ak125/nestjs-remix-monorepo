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
 *   - HTML : le lien retiré garde son texte (balise <a> dépliée), rien d'autre ne change.
 *
 * Fonctions pures : aucune I/O.
 */

import {
  applyGuideLinkRuleToBlocks,
  applyGuideLinkRuleToHtml,
  guideAliasFromHref,
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
