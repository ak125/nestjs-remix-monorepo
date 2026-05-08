import {
  SeoVariantFamilyRegistry,
  type VariantFamilyKey,
} from '../seo-variant-family.registry';

describe('SeoVariantFamilyRegistry', () => {
  let registry: SeoVariantFamilyRegistry;

  beforeEach(() => {
    registry = new SeoVariantFamilyRegistry();
  });

  it('list() returns the 4 canonical variant families', () => {
    const families = registry.list();
    expect(families).toHaveLength(4);
    expect(families).toEqual([
      'ITEM_SWITCH',
      'TYPE_SWITCH',
      'GAMME_CAR_SWITCH',
      'FAMILY_GAMME_CAR_SWITCH',
    ] as VariantFamilyKey[]);
  });

  it('resolveTable() returns the correct __seo_*_switch table name', () => {
    expect(registry.resolveTable('ITEM_SWITCH')).toBe('__seo_item_switch');
    expect(registry.resolveTable('TYPE_SWITCH')).toBe('__seo_type_switch');
    expect(registry.resolveTable('GAMME_CAR_SWITCH')).toBe(
      '__seo_gamme_car_switch',
    );
    expect(registry.resolveTable('FAMILY_GAMME_CAR_SWITCH')).toBe(
      '__seo_family_gamme_car_switch',
    );
  });

  it('getConfig() exposes purpose + knownAliases', () => {
    const cfg = registry.getConfig('ITEM_SWITCH');
    expect(cfg.knownAliases).toEqual([1, 2, 3]);
    expect(cfg.purpose).toContain('R1');
    expect(cfg.table).toBe('__seo_item_switch');
  });
});
