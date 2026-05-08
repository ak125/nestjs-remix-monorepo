import type { LinkResolutionResult } from '../seo-internal-linking.service';
import {
  SeoContentBlockBuilder,
  type SeoContentBlock,
} from '../seo-content-block-builder.service';
import type { SwitchVariant } from '../seo-switch-selector.service';

describe('SeoContentBlockBuilder (PR-2c rev 2)', () => {
  let builder: SeoContentBlockBuilder;

  beforeEach(() => {
    builder = new SeoContentBlockBuilder();
  });

  const noLinks: LinkResolutionResult[] = [];

  function emptyTemplate() {
    return {
      title: '',
      description: '',
      h1: '',
      preview: '',
      content: '',
      keywords: '',
    };
  }

  function indexableLink(marker: string, html: string): LinkResolutionResult {
    return {
      marker,
      html,
      isLink: true,
      targetUrl: '/gammes/x',
      targetRole: 'R1_ROUTER' as never,
      indexable: true,
    };
  }

  it('retourne tableau vide si tout est vide', () => {
    const blocks = builder.buildBlocks({
      template: emptyTemplate(),
      variants: {},
      links: noLinks,
    });
    expect(blocks).toEqual([]);
  });

  it('produit lead + paragraph quand template a preview + content', () => {
    const blocks = builder.buildBlocks({
      template: {
        title: 't',
        description: 'd',
        h1: 'h',
        preview: 'Aperçu',
        content: '<p>Contenu</p>',
        keywords: 'k',
      },
      variants: {},
      links: noLinks,
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'lead', html: 'Aperçu' });
    expect(blocks[1]).toEqual({ type: 'paragraph', html: '<p>Contenu</p>' });
  });

  it('skippe lead/paragraph si vide ou whitespace', () => {
    const blocks = builder.buildBlocks({
      template: {
        ...emptyTemplate(),
        preview: '   ',
        content: '',
      },
      variants: {},
      links: noLinks,
    });
    expect(blocks).toHaveLength(0);
  });

  it('extrait HTML des variantes switch (sis/sgcs/sts/sfgcs)', () => {
    const variants: Record<number, SwitchVariant | null> = {
      1: { sis_content: 'Variante alias 1' },
      2: { sgcs_content: 'Variante alias 2' },
      12: { sts_content: 'Variante alias 12' },
    };
    const blocks = builder.buildBlocks({
      template: emptyTemplate(),
      variants,
      links: noLinks,
    });
    expect(blocks).toEqual([
      { type: 'switch-variant', alias: 1, html: 'Variante alias 1' },
      { type: 'switch-variant', alias: 2, html: 'Variante alias 2' },
      { type: 'switch-variant', alias: 12, html: 'Variante alias 12' },
    ]);
  });

  it('skippe variante null ou sans champ HTML reconnu', () => {
    const blocks = builder.buildBlocks({
      template: emptyTemplate(),
      variants: {
        1: { sis_content: '' },
        2: null,
        3: { sis_id: 1 }, // pas de *_content
      },
      links: noLinks,
    });
    expect(blocks).toHaveLength(0);
  });

  it('inclut isLink=true et filtre tous les fallbacks (NOINDEX/NO_TARGET/ORPHAN/SELF_LINK)', () => {
    const links: LinkResolutionResult[] = [
      indexableLink('#LinkGamme_42#', '<a href="/gammes/x">X</a>'),
      {
        marker: '#LinkGamme_99#',
        html: 'nos pièces auto',
        isLink: false,
        targetUrl: '/gammes/y',
        targetRole: 'R1_ROUTER' as never,
        indexable: false,
        reason: 'NOINDEX',
      },
      {
        marker: '#LinkGamme_404#',
        html: 'nos pièces auto',
        isLink: false,
        targetUrl: null,
        targetRole: 'R1_ROUTER' as never,
        indexable: false,
        reason: 'NO_TARGET',
      },
      {
        marker: '#GarbageMarker#',
        html: 'nos pièces auto',
        isLink: false,
        targetUrl: null,
        targetRole: null,
        indexable: false,
        reason: 'ORPHAN',
      },
      {
        marker: '#LinkGamme_self#',
        html: 'nos pièces auto',
        isLink: false,
        targetUrl: '/gammes/self',
        targetRole: 'R1_ROUTER' as never,
        indexable: true,
        reason: 'SELF_LINK',
      },
    ];
    const blocks = builder.buildBlocks({
      template: emptyTemplate(),
      variants: {},
      links,
    });
    const linkBlocks = blocks.filter(
      (b): b is Extract<SeoContentBlock, { type: 'link' }> => b.type === 'link',
    );
    expect(linkBlocks).toHaveLength(1);
    expect(linkBlocks[0]).toEqual({
      type: 'link',
      html: '<a href="/gammes/x">X</a>',
      target: '#LinkGamme_42#',
    });
  });

  it('compose tous types ensemble (lead + paragraph + switch + link)', () => {
    const blocks = builder.buildBlocks({
      template: {
        ...emptyTemplate(),
        preview: 'Lead',
        content: '<p>Body</p>',
      },
      variants: { 1: { sis_id: 1, sis_content: 'Switch 1' } },
      links: [indexableLink('#LinkGamme_1#', '<a>A</a>')],
    });
    expect(blocks.map((b) => b.type)).toEqual([
      'lead',
      'paragraph',
      'switch-variant',
      'link',
    ]);
  });

  it("préserve l'ordre input des links dans output (anti-breaking PR-7)", () => {
    const links: LinkResolutionResult[] = [
      indexableLink('#LinkGamme_99#', '<a>Z</a>'),
      indexableLink('#LinkGamme_1#', '<a>A</a>'),
    ];
    const blocks = builder.buildBlocks({
      template: emptyTemplate(),
      variants: {},
      links,
    });
    const linkBlocks = blocks.filter(
      (b): b is Extract<SeoContentBlock, { type: 'link' }> => b.type === 'link',
    );
    expect(linkBlocks.map((b) => b.target)).toEqual([
      '#LinkGamme_99#',
      '#LinkGamme_1#',
    ]);
  });

  it('discriminated union narrowing : chaque type expose ses champs propres', () => {
    const blocks = builder.buildBlocks({
      template: { ...emptyTemplate(), preview: 'X', content: 'Y' },
      variants: { 1: { sis_id: 1, sis_content: 'Z' } },
      links: [indexableLink('#LinkGamme_1#', '<a>A</a>')],
    });

    for (const block of blocks) {
      // TS narrow correctement chaque branche.
      if (block.type === 'lead' || block.type === 'paragraph') {
        expect(typeof block.html).toBe('string');
      } else if (block.type === 'switch-variant') {
        expect(typeof block.alias).toBe('number');
        expect(typeof block.html).toBe('string');
      } else if (block.type === 'link') {
        expect(typeof block.target).toBe('string');
        expect(typeof block.html).toBe('string');
      }
    }
  });
});
