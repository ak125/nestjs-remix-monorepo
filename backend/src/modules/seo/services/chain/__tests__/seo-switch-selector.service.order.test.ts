import { SeoSwitchSelector } from '../seo-switch-selector.service';
import { SeoVariantFamilyRegistry } from '../../../registries/seo-variant-family.registry';

/**
 * Vérifie que `SeoSwitchSelector.fetchVariants()` honore le champ `orderBy`
 * exposé par `VariantFamilyConfig` quand il est présent (PR-1 seo-v9 R8 meta
 * pool — la famille `ROLE_TEMPLATE_POOL` déclare `orderBy: 'srtp_order'`).
 *
 * Les 4 familles legacy (sans `orderBy`) ne doivent PAS appeler `.order()` —
 * compat préservée.
 */
describe('SeoSwitchSelector.fetchVariants — orderBy', () => {
  /**
   * Builder mock minimal qui capture tous les appels chaînés. Renvoie
   * `{ data: [], error: null }` au final.
   */
  function makeQueryBuilder() {
    const calls: { method: string; args: unknown[] }[] = [];
    const builder: Record<string, unknown> = {};
    const proxy: Record<string, unknown> = new Proxy(builder, {
      get(_target, prop) {
        if (prop === 'then') {
          // Awaitable : résout sur { data: [], error: null }
          return (resolve: (v: { data: unknown[]; error: null }) => void) =>
            resolve({ data: [], error: null });
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return proxy;
        };
      },
    });
    return { proxy, calls };
  }

  /**
   * Override du client supabase via Object.defineProperty (la propriété est
   * `readonly` sur SupabaseBaseService).
   */
  function overrideSupabase(
    selector: SeoSwitchSelector,
    fakeClient: { from: (table: string) => unknown },
  ) {
    Object.defineProperty(selector, 'supabase', {
      value: fakeClient,
      writable: true,
      configurable: true,
    });
  }

  it('appelle .order(srtp_order, asc) quand la famille déclare orderBy', async () => {
    const registry = new SeoVariantFamilyRegistry();
    const selector = new SeoSwitchSelector(registry);

    const { proxy, calls } = makeQueryBuilder();
    overrideSupabase(selector, { from: () => proxy });

    await selector.fetchVariants({
      family: 'ROLE_TEMPLATE_POOL',
      where: { srtp_role: 'R8_VEHICLE', srtp_slot: 'meta_title' },
      seed: { surfaceKey: 'R8_VEHICLE:meta_title', pgId: 0, vehicleId: 12345 },
    });

    const orderCall = calls.find((c) => c.method === 'order');
    expect(orderCall).toBeDefined();
    expect(orderCall?.args[0]).toBe('srtp_order');
    expect(orderCall?.args[1]).toEqual({ ascending: true });
  });

  it('n appelle PAS .order() pour les familles legacy sans orderBy', async () => {
    const registry = new SeoVariantFamilyRegistry();
    const selector = new SeoSwitchSelector(registry);

    const { proxy, calls } = makeQueryBuilder();
    overrideSupabase(selector, { from: () => proxy });

    await selector.fetchVariants({
      family: 'TYPE_SWITCH',
      where: { sts_id: '12345' },
      seed: { surfaceKey: 'R8_VEHICLE', pgId: 0, vehicleId: 12345 },
    });

    const orderCall = calls.find((c) => c.method === 'order');
    expect(orderCall).toBeUndefined();
  });
});
