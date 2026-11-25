/**
 * Sources d'achat ordonnées par marque (mandat DQ). Les trois cas reprennent
 * les décisions de Marwane du 19/11 ; les ids de fiches sont ceux relevés en
 * base (lecture seule), les liens créés sont fictifs. Aucune donnée réelle
 * n'est écrite ni importée.
 */
import {
  orderBrandSources,
  type BrandSourceCardInput,
  type BrandSourceLinkInput,
} from './supplier-brand-source';

const card = (
  splId: string,
  name: string,
  over: Partial<BrandSourceCardInput> = {},
): BrandSourceCardInput => ({
  splId,
  name,
  type: 'plateforme',
  status: 'actif',
  supplyMode: 'flux_tendu',
  fallbackMode: 'transporteur',
  ...over,
});

const CARDS: BrandSourceCardInput[] = [
  card('15', 'BG'),
  card('20', 'CEVAM', {
    type: 'marque_directe',
    supplyMode: 'livraison_france',
    fallbackMode: null,
  }),
  card('21', 'CS'),
  card('45', 'MEAT & DORIA', {
    type: 'marque_directe',
    supplyMode: null,
    fallbackMode: null,
  }),
  card('52', 'OTTOGO'),
  card('59', 'SASIC', {
    type: 'marque_directe',
    supplyMode: null,
    fallbackMode: null,
  }),
  card('71', 'DCA'),
  card('72', 'EXADIS'),
  card('26', 'DISTRICASH', { status: 'archive' }),
];

const link = (
  linkId: string,
  splId: string,
  over: Partial<BrandSourceLinkInput> = {},
): BrandSourceLinkInput => ({
  linkId,
  splId,
  displayed: true,
  rank: null,
  deliverySplId: null,
  stockKind: null,
  surchargeCents: null,
  ...over,
});

const ranked = (
  linkId: string,
  splId: string,
  rank: number,
  stockKind: string,
  over: Partial<BrandSourceLinkInput> = {},
) => link(linkId, splId, { rank, stockKind, surchargeCents: 0, ...over });

describe('orderBrandSources — cas décidés par Marwane (19/11)', () => {
  it('CEVAM : EXADIS rang 1 en stock, CEVAM rang 2 sur commande livrée en France', () => {
    const { sources, issues } = orderBrandSources(
      [
        ranked('40', '20', 2, 'commande'),
        link('41', '19'), // CAL : lié à la marque, non classé
        ranked('900', '72', 1, 'stock'),
      ],
      CARDS,
    );
    expect(issues).toEqual([]);
    expect(
      sources.map((s) => [s.rank, s.source.name, s.stockKind, s.supplyMode]),
    ).toEqual([
      [1, 'EXADIS', 'stock', 'flux_tendu'],
      [2, 'CEVAM', 'commande', 'livraison_france'],
    ]);
    expect(sources[1].delivery).toEqual({
      splId: '20',
      name: 'CEVAM',
      isSource: true,
    });
    expect(sources[1].surchargeCents).toBe(0);
  });

  it('MEAT & DORIA : OTTOGO rang 1, M&D rang 2 livré chez CS + 300 c', () => {
    const { sources, issues } = orderBrandSources(
      [
        ranked('97', '45', 2, 'commande', {
          deliverySplId: '21',
          surchargeCents: 300,
        }),
        ranked('901', '52', 1, 'stock'),
      ],
      CARDS,
    );
    expect(issues).toEqual([]);
    expect(sources.map((s) => s.source.name)).toEqual([
      'OTTOGO',
      'MEAT & DORIA',
    ]);
    expect(sources[0].delivery.isSource).toBe(true);
    expect(sources[1]).toMatchObject({
      rank: 2,
      source: { splId: '45', type: 'marque_directe' },
      delivery: { splId: '21', name: 'CS', isSource: false },
      stockKind: 'commande',
      surchargeCents: 300,
      // Arrivée chez CS : mode de la fiche CS, pas de la fiche M&D.
      supplyMode: 'flux_tendu',
    });
  });

  it('SASIC : en direct, stock chez BG et chez DCA', () => {
    const { sources, issues } = orderBrandSources(
      [
        link('73', '71'), // DCA × SASIC : lien historique non classé
        link('74', '15'), // BG × SASIC : idem
        ranked('75', '59', 1, 'stock', { deliverySplId: '15' }),
        ranked('902', '59', 2, 'stock', { deliverySplId: '71' }),
      ],
      CARDS,
    );
    expect(issues).toEqual([]);
    expect(
      sources.map((s) => [
        s.rank,
        s.source.name,
        s.delivery.name,
        s.stockKind,
        s.surchargeCents,
      ]),
    ).toEqual([
      [1, 'SASIC', 'BG', 'stock', 0],
      [2, 'SASIC', 'DCA', 'stock', 0],
    ]);
    expect(sources.every((s) => s.source.type === 'marque_directe')).toBe(true);
  });
});

describe('orderBrandSources — repli et contrôles', () => {
  it('le repli vient de la fiche source (MGA : flux tendu, sinon transporteur)', () => {
    const { sources } = orderBrandSources(
      [ranked('82', '46', 1, 'stock')],
      [card('46', 'MGA', { fallbackMode: 'transporteur' })],
    );
    expect(sources[0]).toMatchObject({
      supplyMode: 'flux_tendu',
      fallbackMode: 'transporteur',
    });
  });

  it('une marque sans lien classé n’a aucune source', () => {
    expect(orderBrandSources([link('1', '15')], CARDS)).toEqual({
      sources: [],
      issues: [],
    });
  });

  it('signale sans corriger : rang en double, source archivée, surcoût négatif', () => {
    const { sources, issues } = orderBrandSources(
      [
        ranked('1', '15', 1, 'stock'),
        ranked('2', '26', 1, 'stock', { surchargeCents: -1 }),
      ],
      CARDS,
    );
    expect(sources).toHaveLength(2);
    expect(issues.map((i) => [i.linkId, i.code])).toEqual([
      ['2', 'duplicate_rank'],
      ['2', 'inactive_source'],
      ['2', 'negative_surcharge'],
    ]);
  });

  it('signale un point de livraison inconnu ou inactif, un lien masqué, une nature absente', () => {
    const { issues } = orderBrandSources(
      [
        ranked('1', '15', 1, 'stock', { deliverySplId: '999' }),
        ranked('2', '52', 2, 'stock', { deliverySplId: '26' }),
        ranked('3', '72', 3, 'stock', { displayed: false }),
        ranked('4', '21', 4, 'autre'),
      ],
      CARDS,
    );
    expect(issues.map((i) => [i.rank, i.code])).toEqual([
      [1, 'unknown_supplier'],
      [2, 'inactive_delivery'],
      [3, 'hidden_link'],
      [4, 'missing_stock_kind'],
    ]);
  });
});
