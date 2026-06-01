import { parsePriceHt, InoshopConnector } from './inoshop.connector';

// Importing the connector here also proves the module loads WITHOUT playwright
// installed (type-only imports are erased; the dynamic import is deferred to login()).

describe('parsePriceHt', () => {
  it('parses comma and dot decimals', () => {
    expect(parsePriceHt('10,60 €')).toBe(10.6);
    expect(parsePriceHt('Px achat: 10.60€')).toBe(10.6);
    expect(parsePriceHt('6,08 € TTC')).toBe(6.08);
  });
  it('returns null when no price', () => {
    expect(parsePriceHt('')).toBeNull();
    expect(parsePriceHt('non communiqué')).toBeNull();
  });
});

describe('InoshopConnector (construction, no I/O)', () => {
  it('constructs with platform/supplier identity and normalizes baseUrl', () => {
    const c = new InoshopConnector({
      supplierId: '26',
      baseUrl: 'https://districashv2.inoshop.net/',
    });
    expect(c.platform).toBe('inoshop');
    expect(c.supplierId).toBe('26');
  });

  it('fetchAvailability before login throws (guard)', async () => {
    const c = new InoshopConnector({ supplierId: '26', baseUrl: 'https://x' });
    await expect(c.fetchAvailability(['REF'])).rejects.toThrow(/before login/);
  });
});
