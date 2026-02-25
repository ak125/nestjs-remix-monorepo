/**
 * OrderStatusService — Unit tests (P21).
 *
 * Tests: OrderLineStatusCode enum, state machine (isFinal, isActive),
 *        getStatusInfo, getStatusColor, getAllStatuses,
 *        updateLineStatus (valid/invalid transitions), getOrderStatusHistory.
 *
 * @see backend/src/modules/orders/services/order-status.service.ts
 */

import { BadRequestException } from '@nestjs/common';
import {
  OrderStatusService,
  OrderLineStatusCode,
} from '../../src/modules/orders/services/order-status.service';

// ─── Chain mock builder ──────────────────────────────────────

type ChainResult = { data: unknown; error: unknown };

function chainMock(result: ChainResult) {
  const chain: Record<string, jest.Mock> = {};
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockResolvedValue(result);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.order = jest.fn().mockReturnValue(chain);
  return chain;
}

// ─── Tests ───────────────────────────────────────────────────

describe('OrderStatusService', () => {
  let service: OrderStatusService;

  beforeEach(() => {
    service = new OrderStatusService();
  });

  // ── OrderLineStatusCode enum ──

  it('should expose all 10 status codes', () => {
    const numericValues = Object.values(OrderLineStatusCode).filter(
      (v) => typeof v === 'number',
    );
    expect(numericValues).toHaveLength(10);
    expect(OrderLineStatusCode.PENDING).toBe(1);
    expect(OrderLineStatusCode.CONFIRMED).toBe(2);
    expect(OrderLineStatusCode.PREPARING).toBe(3);
    expect(OrderLineStatusCode.READY).toBe(4);
    expect(OrderLineStatusCode.SHIPPED).toBe(5);
    expect(OrderLineStatusCode.DELIVERED).toBe(6);
    expect(OrderLineStatusCode.CANCELLED_CLIENT).toBe(91);
    expect(OrderLineStatusCode.CANCELLED_STOCK).toBe(92);
    expect(OrderLineStatusCode.RETURNED).toBe(93);
    expect(OrderLineStatusCode.REFUNDED).toBe(94);
  });

  // ── State machine: isFinalStatus / isActiveStatus ──

  it('isFinalStatus returns true for terminal statuses (6, 91, 92, 94)', () => {
    expect(service.isFinalStatus(6)).toBe(true);
    expect(service.isFinalStatus(91)).toBe(true);
    expect(service.isFinalStatus(92)).toBe(true);
    expect(service.isFinalStatus(94)).toBe(true);
  });

  it('isFinalStatus returns false for non-terminal statuses', () => {
    for (const s of [1, 2, 3, 4, 5, 93]) {
      expect(service.isFinalStatus(s)).toBe(false);
    }
  });

  it('isActiveStatus returns true for processing statuses (1-5)', () => {
    for (const s of [1, 2, 3, 4, 5]) {
      expect(service.isActiveStatus(s)).toBe(true);
    }
  });

  it('isActiveStatus returns false for non-active statuses', () => {
    for (const s of [6, 91, 92, 93, 94]) {
      expect(service.isActiveStatus(s)).toBe(false);
    }
  });

  // ── getStatusInfo ──

  it('getStatusInfo for PENDING (1)', () => {
    const info = service.getStatusInfo(1);
    expect(info.label).toBe('En attente');
    expect(info.color).toBe('#fbbf24');
    expect(info.isFinal).toBe(false);
    expect(info.isActive).toBe(true);
  });

  it('getStatusInfo for REFUNDED (94)', () => {
    const info = service.getStatusInfo(94);
    expect(info.label).toBe('Remboursée');
    expect(info.color).toBe('#6b7280');
    expect(info.isFinal).toBe(true);
    expect(info.isActive).toBe(false);
  });

  // ── getStatusColor ──

  it('unknown status returns default gray', () => {
    expect(service.getStatusColor(999)).toBe('#6b7280');
  });

  // ── getAllStatuses ──

  it('getAllStatuses returns all 10 numeric status codes', () => {
    const statuses = service.getAllStatuses();
    expect(statuses).toHaveLength(10);
    expect(statuses).toEqual(
      expect.arrayContaining([1, 2, 3, 4, 5, 6, 91, 92, 93, 94]),
    );
  });

  // ── updateLineStatus ──

  describe('updateLineStatus', () => {
    it('valid transition 1→2 should update line and create history', async () => {
      const updatedLine = { id: 10, status: 2, order_id: 100 };

      // Universal chain: every method returns `chain` so all paths work
      let singleCallCount = 0;
      const chain: Record<string, jest.Mock> = {};
      chain.from = jest.fn().mockReturnValue(chain);
      chain.select = jest.fn().mockReturnValue(chain);
      chain.update = jest.fn().mockReturnValue(chain);
      chain.eq = jest.fn().mockReturnValue(chain);
      chain.order = jest.fn().mockReturnValue(chain);
      chain.insert = jest.fn().mockResolvedValue({ error: null });

      // .single() called twice: 1st=fetch current line, 2nd=update result
      chain.single = jest.fn().mockImplementation(() => {
        singleCallCount++;
        if (singleCallCount === 1) {
          return Promise.resolve({ data: { id: 10, status: 1, order_id: 100 }, error: null });
        }
        return Promise.resolve({ data: updatedLine, error: null });
      });

      // When chain is used as a thenable (await chain without .single()),
      // mock the implicit resolve for checkAndUpdateOrderStatus select().eq()
      // which returns all lines for order rollup
      const origEq = chain.eq;
      let eqCallCount = 0;
      chain.eq = jest.fn().mockImplementation(() => {
        eqCallCount++;
        // After the first 3 .eq() calls (fetch line + update + rollup),
        // subsequent .eq() calls may resolve as promise (for rollup select)
        return chain;
      });

      // Make chain itself thenable for `await this.supabase.from().select().eq()`
      // which resolves without .single()
      (chain as any).then = (resolve: (v: any) => void) => {
        resolve({ data: [{ status: 2 }, { status: 2 }], error: null });
        return chain;
      };

      Object.defineProperty(service, 'supabase', { get: () => chain, configurable: true });

      const result = await service.updateLineStatus(10, 2, 'test comment', 1);

      expect(result).toEqual(updatedLine);
      expect(chain.insert).toHaveBeenCalled();
    });

    it('invalid transition 1→6 should throw BadRequestException', async () => {
      const chain = chainMock({ data: { id: 10, status: 1, order_id: 100 }, error: null });

      Object.defineProperty(service, 'supabase', { get: () => chain, configurable: true });

      await expect(service.updateLineStatus(10, 6)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.updateLineStatus(10, 6)).rejects.toThrow(
        /Transition impossible/,
      );
    });
  });

  // ── getOrderStatusHistory ──

  it('getOrderStatusHistory returns empty array (disabled feature)', async () => {
    const result = await service.getOrderStatusHistory(100);
    expect(result).toEqual([]);
  });
});
