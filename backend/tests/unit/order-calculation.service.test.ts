/**
 * OrderCalculationService — Unit tests (P21).
 *
 * Tests: calculateOrderTotal (subtotal, tax, shipping, consignes, discount, floor),
 *        calculateLineItemTotal, applyDiscount.
 *
 * Pure injectable — no DB dependency.
 *
 * @see backend/src/modules/orders/services/order-calculation.service.ts
 */

import {
  OrderCalculationService,
  type OrderLineItem,
} from '../../src/modules/orders/services/order-calculation.service';

describe('OrderCalculationService', () => {
  let service: OrderCalculationService;

  beforeEach(() => {
    service = new OrderCalculationService();
  });

  // ── calculateOrderTotal ──

  describe('calculateOrderTotal', () => {
    it('basic order: 2 items, default tax, no extras', async () => {
      const items: OrderLineItem[] = [
        { productId: 'p1', quantity: 2, unitPrice: 25 },
        { productId: 'p2', quantity: 1, unitPrice: 50 },
      ];

      const result = await service.calculateOrderTotal(items);

      expect(result.subtotal).toBe(100); // 2*25 + 1*50
      expect(result.taxAmount).toBe(20); // 100 * 0.2
      expect(result.shippingCost).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.consigne_total).toBe(0);
      expect(result.total).toBe(120); // 100 + 20
    });

    it('with shipping cost', async () => {
      const items: OrderLineItem[] = [
        { productId: 'p1', quantity: 1, unitPrice: 80 },
      ];

      const result = await service.calculateOrderTotal(items, 5.99);

      expect(result.shippingCost).toBe(5.99);
      expect(result.total).toBe(80 + 16 + 5.99); // subtotal + tax + shipping
    });

    it('with discount', async () => {
      const items: OrderLineItem[] = [
        { productId: 'p1', quantity: 1, unitPrice: 100 },
      ];

      const result = await service.calculateOrderTotal(items, 0, 15);

      expect(result.discountAmount).toBe(15);
      expect(result.total).toBe(100 + 20 - 15); // 105
    });

    it('with consignes (Phase 5)', async () => {
      const items: OrderLineItem[] = [
        { productId: 'p1', quantity: 2, unitPrice: 30, has_consigne: true, consigne_unit: 1.50 },
        { productId: 'p2', quantity: 1, unitPrice: 20, has_consigne: false },
      ];

      const result = await service.calculateOrderTotal(items);

      expect(result.consigne_total).toBe(3); // 2 * 1.50
      expect(result.subtotal).toBe(80); // 2*30 + 1*20
      expect(result.total).toBe(80 + 16 + 3); // subtotal + tax + consignes = 99
    });

    it('total floors at zero when discount exceeds everything', async () => {
      const items: OrderLineItem[] = [
        { productId: 'p1', quantity: 1, unitPrice: 10 },
      ];

      const result = await service.calculateOrderTotal(items, 0, 500);

      expect(result.total).toBe(0); // Math.max(0, 10 + 2 - 500)
    });
  });

  // ── calculateLineItemTotal ──

  it('calculateLineItemTotal should return quantity * unitPrice', async () => {
    const result = await service.calculateLineItemTotal({
      productId: 'p1',
      quantity: 3,
      unitPrice: 15.5,
    });

    expect(result).toBe(46.5);
  });

  // ── applyDiscount ──

  describe('applyDiscount', () => {
    it('percentage discount', async () => {
      const result = await service.applyDiscount(100, 10);
      expect(result).toBe(10); // 10% of 100
    });

    it('flat amount capped at subtotal', async () => {
      const result = await service.applyDiscount(100, undefined, 200);
      expect(result).toBe(100); // Math.min(200, 100)
    });
  });
});
