import {
  SeoVariantFamilyRegistry,
  type VariantFamilyKey,
} from '../seo-variant-family.registry';

describe('SeoVariantFamilyRegistry', () => {
  let registry: SeoVariantFamilyRegistry;

  beforeEach(() => {
    registry = new SeoVariantFamilyRegistry();
  });

  it('list() returns the 5 canonical variant families (4 legacy switch + ROLE_TEMPLATE_POOL)', () => {
    const families = registry.list();
    expect(families).toHaveLength(5);
    expect(families).toEqual([
      'ITEM_SWITCH',
      'TYPE_SWITCH',
      'GAMME_CAR_SWITCH',
      'FAMILY_GAMME_CAR_SWITCH',
      'ROLE_TEMPLATE_POOL',
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
    expect(registry.resolveTable('ROLE_TEMPLATE_POOL')).toBe(
      '__seo_role_template_pool',
    );
  });

  it('getConfig() exposes purpose + knownAliases', () => {
    const cfg = registry.getConfig('ITEM_SWITCH');
    expect(cfg.knownAliases).toEqual([1, 2, 3]);
    expect(cfg.purpose).toContain('R1');
    expect(cfg.table).toBe('__seo_item_switch');
  });

  it('ROLE_TEMPLATE_POOL exposes orderBy=srtp_order (slot-based, deterministic)', () => {
    const cfg = registry.getConfig('ROLE_TEMPLATE_POOL');
    expect(cfg.orderBy).toBe('srtp_order');
    expect(cfg.knownAliases).toEqual([]);
    expect(cfg.purpose).toContain('slot-based');
  });

  it('legacy switch families do NOT declare orderBy (compat preserved)', () => {
    expect(registry.getConfig('ITEM_SWITCH').orderBy).toBeUndefined();
    expect(registry.getConfig('TYPE_SWITCH').orderBy).toBeUndefined();
    expect(registry.getConfig('GAMME_CAR_SWITCH').orderBy).toBeUndefined();
    expect(registry.getConfig('FAMILY_GAMME_CAR_SWITCH').orderBy).toBeUndefined();
  });
});
