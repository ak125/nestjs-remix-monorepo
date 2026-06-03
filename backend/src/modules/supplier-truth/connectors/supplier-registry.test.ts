import {
  getSupplierConnectorConfig,
  listConnectableSuppliers,
  isConnectable,
} from './supplier-registry';
import { SupplierObservationSchema } from './supplier-connector.interface';

describe('supplier-registry', () => {
  it('resolves DistriCash (operational spl_id 71 "DCA") to the inoshop connector', () => {
    const c = getSupplierConnectorConfig('71');
    expect(c).toBeDefined();
    expect(c?.platform).toBe('inoshop');
    expect(c?.baseUrl).toContain('inoshop.net');
    expect(c?.credEnv.userKey).toBe('SUPPLIER_INOSHOP_DISTRICASH_USER');
  });

  it('returns undefined for the phantom id 26 and for a brand (no portal), e.g. spl_id 41 MAHLE', () => {
    // 26 "DISTRICASH (DCA)" is a phantom row (0 brand-links / 0 orders) — only 71 is operational.
    expect(getSupplierConnectorConfig('26')).toBeUndefined();
    expect(getSupplierConnectorConfig('41')).toBeUndefined();
    expect(isConnectable('41')).toBe(false);
  });

  it('never hardcodes secret values — only env var NAMES', () => {
    for (const c of listConnectableSuppliers()) {
      expect(c.credEnv.userKey).toMatch(/^[A-Z0-9_]+$/);
      expect(c.credEnv.passKey).toMatch(/^[A-Z0-9_]+$/);
      // ensure no obvious secret-looking value leaked into the config
      expect(JSON.stringify(c)).not.toMatch(/password\s*[:=]\s*["'][^"']/i);
    }
  });
});

describe('SupplierObservationSchema', () => {
  it('accepts a valid observation and applies defaults', () => {
    const o = SupplierObservationSchema.parse({
      supplierId: '71',
      rawRef: 'SCL4123',
      available: true,
      delayDays: null,
      freshnessProvenance: 'CONNECTOR_FETCHED',
      parseError: false,
    });
    expect(o.sourceVerifiedAt).toBeNull();
    expect(o.priceBuyHt).toBeNull();
  });

  it('rejects a malformed observation (bad provenance / negative delay)', () => {
    expect(() =>
      SupplierObservationSchema.parse({
        supplierId: '71',
        rawRef: 'X',
        available: false,
        delayDays: -3,
        freshnessProvenance: 'WHATEVER',
        parseError: false,
      }),
    ).toThrow();
  });
});
