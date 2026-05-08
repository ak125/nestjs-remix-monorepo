import { SeoContentBlockBuilder } from '../seo-content-block-builder.service';

describe('SeoContentBlockBuilder', () => {
  let builder: SeoContentBlockBuilder;

  beforeEach(() => {
    builder = new SeoContentBlockBuilder();
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
      links: new Map(),
    });
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'lead', html: 'Aperçu' });
    expect(blocks[1]).toEqual({ type: 'paragraph', html: '<p>Contenu</p>' });
  });

  it('skippe lead/paragraph si vide ou whitespace', () => {
    const blocks = builder.buildBlocks({
      template: {
        title: 't',
        description: 'd',
        h1: 'h',
        preview: '   ',
        content: '',
        keywords: '',
      },
      variants: {},
      links: new Map(),
    });
    expect(blocks).toHaveLength(0);
  });

  it('extrait HTML des variantes switch (sis_content / sgcs_content / sts_content)', () => {
    const blocks = builder.buildBlocks({
      template: {
        title: '',
        description: '',
        h1: '',
        preview: '',
        content: '',
        keywords: '',
      },
      variants: {
        1: { sis_content: 'Variante alias 1' },
        2: { sgcs_content: 'Variante alias 2' },
        12: { sts_content: 'Variante alias 12' },
      },
      links: new Map(),
    });
    expect(blocks).toHaveLength(3);
    expect(blocks).toEqual([
      { type: 'switch-variant', alias: 1, html: 'Variante alias 1' },
      { type: 'switch-variant', alias: 2, html: 'Variante alias 2' },
      { type: 'switch-variant', alias: 12, html: 'Variante alias 12' },
    ]);
  });

  it('skippe variante si toutes les colonnes content sont vides', () => {
    const blocks = builder.buildBlocks({
      template: {
        title: '',
        description: '',
        h1: '',
        preview: '',
        content: '',
        keywords: '',
      },
      variants: {
        1: { sis_content: '' },
        2: null,
      },
      links: new Map(),
    });
    expect(blocks).toHaveLength(0);
  });

  it('inclut les links résolus (isLink=true) et omet les fallbacks texte', () => {
    const links = new Map([
      [
        '#LinkGamme_42#',
        {
          marker: '#LinkGamme_42#',
          html: '<a href="/gammes/x">X</a>',
          isLink: true,
        },
      ],
      [
        '#LinkGamme_99#',
        {
          marker: '#LinkGamme_99#',
          html: 'nos pièces auto',
          isLink: false,
        },
      ],
    ]);
    const blocks = builder.buildBlocks({
      template: {
        title: '',
        description: '',
        h1: '',
        preview: '',
        content: '',
        keywords: '',
      },
      variants: {},
      links,
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: 'link',
      html: '<a href="/gammes/x">X</a>',
      target: '#LinkGamme_42#',
    });
  });
});
