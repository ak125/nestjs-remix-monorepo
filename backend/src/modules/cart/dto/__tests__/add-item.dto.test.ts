/**
 * F1 attribution — AddItemDto : la source d'ajout par-ligne (website_url) doit être
 * acceptée, threadée, optionnelle, et bornée. Ref vault audit 2026-05-22 (F1).
 */

import { validateAddItem } from '../add-item.dto';

describe('AddItemDto — website_url (F1 attribution source d’ajout)', () => {
  const base = { product_id: 12345, quantity: 1 };

  it('accepte et conserve website_url', () => {
    const dto = validateAddItem({
      ...base,
      website_url: '/pieces/filtre-a-huile-7/bmw-serie-3.html',
    });
    expect(dto.website_url).toBe('/pieces/filtre-a-huile-7/bmw-serie-3.html');
  });

  it('trim les espaces autour de website_url', () => {
    const dto = validateAddItem({ ...base, website_url: '  /pieces/x  ' });
    expect(dto.website_url).toBe('/pieces/x');
  });

  it('reste valide sans website_url (optionnel, rétro-compat)', () => {
    const dto = validateAddItem({ ...base });
    expect(dto.website_url).toBeUndefined();
    expect(dto.product_id).toBe(12345);
  });

  it('rejette une website_url au-delà de 2048 caractères', () => {
    expect(() =>
      validateAddItem({ ...base, website_url: 'x'.repeat(2049) }),
    ).toThrow();
  });
});

describe('AddItemDto — autorité de prix (F5, anti price-tampering)', () => {
  it('ignore (strip) un custom_price fourni par le client', () => {
    const dto = validateAddItem({
      product_id: 12345,
      quantity: 1,
      custom_price: 0.01,
    }) as Record<string, unknown>;
    expect(dto.custom_price).toBeUndefined();
  });

  it('reste valide malgré un custom_price client (non rejeté, juste ignoré)', () => {
    const dto = validateAddItem({
      product_id: 12345,
      quantity: 2,
      custom_price: 999,
    });
    expect(dto.product_id).toBe(12345);
    expect(dto.quantity).toBe(2);
  });
});
