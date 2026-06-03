import { decideOrderLineAction, OrderLineAction } from './order-line-routing';
import { AvailabilityState } from './availability-state';

describe('decideOrderLineAction', () => {
  it('VERIFIED_AVAILABLE → NOMINAL', () => {
    expect(decideOrderLineAction(AvailabilityState.VERIFIED_AVAILABLE)).toBe(
      OrderLineAction.NOMINAL,
    );
  });

  it('HARD_CONFLICT and confirmed BACKORDER → EQUIVALENCE (human workflow)', () => {
    expect(decideOrderLineAction(AvailabilityState.HARD_CONFLICT)).toBe(
      OrderLineAction.EQUIVALENCE,
    );
    expect(decideOrderLineAction(AvailabilityState.BACKORDER)).toBe(
      OrderLineAction.EQUIVALENCE,
    );
  });

  it('connector failure after retry → EQUIVALENCE regardless of state', () => {
    expect(
      decideOrderLineAction(AvailabilityState.SUPPLIER_PENDING, {
        connectorFailedAfterRetry: true,
      }),
    ).toBe(OrderLineAction.EQUIVALENCE);
  });

  it('not-yet-verified states → REVIEW_FLAG only (no equivalence flood)', () => {
    for (const s of [
      AvailabilityState.UNKNOWN,
      AvailabilityState.STALE,
      AvailabilityState.SUPPLIER_PENDING,
      AvailabilityState.DEGRADED,
      AvailabilityState.SOFT_CONFLICT,
      AvailabilityState.DEGRADED_CONSENSUS,
    ]) {
      expect(decideOrderLineAction(s)).toBe(OrderLineAction.REVIEW_FLAG);
    }
  });
});
