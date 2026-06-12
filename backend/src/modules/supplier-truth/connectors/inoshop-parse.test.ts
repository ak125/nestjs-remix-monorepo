import {
  classifyStockIcon,
  articleToObservation,
  type InoshopArticle,
} from './inoshop-parse';

const base: InoshopArticle = {
  supplierId: '26',
  rawRef: 'ELH4261',
  codeArticle: 'MFIELH4261',
  stock: null,
  dispoType: null,
};

describe('classifyStockIcon', () => {
  it('maps the real inoshop icon filenames', () => {
    expect(classifyStockIcon('.../stock/vert.png')).toBe('vert');
    expect(classifyStockIcon('.../stock/vert+.png')).toBe('vert+');
    expect(classifyStockIcon('.../stock/orange.png')).toBe('orange');
    expect(classifyStockIcon('.../stock/rouge.png')).toBe('rouge');
    expect(classifyStockIcon('.../stock/gris.png')).toBe('gris');
    expect(classifyStockIcon('.../stock/transport.png')).toBe('transport');
    expect(classifyStockIcon('.../stock/partner.png')).toBe('partner');
    expect(classifyStockIcon('weird.png')).toBe('unknown');
  });
});

describe('articleToObservation', () => {
  it('ELH4261: local agency stock=4 ⇒ available (even if centralized icon is rouge)', () => {
    const o = articleToObservation({
      ...base,
      stock: 4,
      dispoType: 'ag',
      bestIcon: '.../stock/rouge.png',
    });
    expect(o.available).toBe(true);
    expect(o.parseError).toBe(false);
    expect(o.delayDays).toBeNull();
  });

  it('no local stock + green centralized icon ⇒ available', () => {
    const o = articleToObservation({
      ...base,
      stock: 0,
      bestIcon: '.../vert.png',
    });
    expect(o.available).toBe(true);
  });

  it('no local stock + rouge icon ⇒ not available', () => {
    const o = articleToObservation({
      ...base,
      stock: 0,
      bestIcon: '.../rouge.png',
    });
    expect(o.available).toBe(false);
  });

  it('nothing extracted ⇒ parseError true and not available (safe)', () => {
    const o = articleToObservation({
      supplierId: '26',
      rawRef: 'ELH4261',
      codeArticle: null,
      stock: null,
      dispoType: null,
      bestIcon: null,
    });
    expect(o.parseError).toBe(true);
    expect(o.available).toBe(false);
  });

  it('captures priceBuyHt when provided (V2)', () => {
    const o = articleToObservation({ ...base, stock: 4, priceBuyHt: 4.56 });
    expect(o.priceBuyHt).toBe(4.56);
  });

  it('output always satisfies the SupplierObservation contract', () => {
    // articleToObservation parses via the Zod schema; a returned value proves it.
    const o = articleToObservation({ ...base, stock: 2 });
    expect(o.supplierId).toBe('26');
    expect(o.freshnessProvenance).toBe('CONNECTOR_FETCHED');
  });
});
