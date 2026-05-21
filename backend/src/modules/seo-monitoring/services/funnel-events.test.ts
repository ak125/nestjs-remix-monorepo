/**
 * Tests — contrat d'entrée funnel `FunnelEventInputSchema` (étape 4-A).
 *
 * On teste le CONTRAT (validation Zod) qui protège l'insert : c'est la pièce
 * critique de correction. Pas de test d'internes Supabase (éviter les casts).
 */
import { FunnelEventInputSchema } from '@repo/seo-types';

describe('FunnelEventInputSchema', () => {
  it('accepts a valid diag_hub_view event', () => {
    const r = FunnelEventInputSchema.safeParse({
      event_type: 'diag_hub_view',
      entity_url: 'https://www.automecanik.com/diagnostic-auto',
      payload: { session_id: 's1', device: 'mobile' },
    });
    expect(r.success).toBe(true);
  });

  it('accepts a valid r2_add_to_cart event', () => {
    const r = FunnelEventInputSchema.safeParse({
      event_type: 'r2_add_to_cart',
      payload: {
        session_id: 's1',
        product_id: 'p123',
        quantity: 2,
        unit_price_cents: 4990,
      },
    });
    expect(r.success).toBe(true);
  });

  it('accepts r2_order_placed with nullable session/referrer', () => {
    const r = FunnelEventInputSchema.safeParse({
      event_type: 'r2_order_placed',
      payload: {
        session_id: null,
        order_id: 'o-42',
        item_count: 3,
        revenue_cents: 12990,
        referrer: 'diagnostic',
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects an unknown event_type', () => {
    const r = FunnelEventInputSchema.safeParse({
      event_type: 'totally_unknown',
      payload: { session_id: 's1' },
    });
    expect(r.success).toBe(false);
  });

  it('rejects a payload that does not match its event_type', () => {
    const r = FunnelEventInputSchema.safeParse({
      event_type: 'r2_add_to_cart',
      payload: { session_id: 's1' }, // missing product_id/quantity
    });
    expect(r.success).toBe(false);
  });
});
