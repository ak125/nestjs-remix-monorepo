import { OrderAvailabilityService } from './order-availability.service';
import type { SupplierTruthService } from './supplier-truth.service';
import { AvailabilityState } from './domain/availability-state';
import { OrderLineAction } from './domain/order-line-routing';

function svc(state: AvailabilityState, delayDays: number | null = null) {
  const truth = {
    getProjection: jest.fn(async () => ({
      state,
      confidence: 0,
      delayDays,
      sourceSupplier: null,
    })),
  } as unknown as SupplierTruthService;
  return new OrderAvailabilityService(truth);
}

describe('OrderAvailabilityService.evaluate', () => {
  it('VERIFIED_AVAILABLE → NOMINAL', async () => {
    const d = await svc(AvailabilityState.VERIFIED_AVAILABLE).evaluate(123);
    expect(d.action).toBe(OrderLineAction.NOMINAL);
    expect(d.state).toBe(AvailabilityState.VERIFIED_AVAILABLE);
  });

  it('BACKORDER (with delay) → EQUIVALENCE, carries delayDays', async () => {
    const d = await svc(AvailabilityState.BACKORDER, 7).evaluate(123);
    expect(d.action).toBe(OrderLineAction.EQUIVALENCE);
    expect(d.delayDays).toBe(7);
  });

  it('UNKNOWN (missing projection) → REVIEW_FLAG only', async () => {
    const d = await svc(AvailabilityState.UNKNOWN).evaluate(999);
    expect(d.action).toBe(OrderLineAction.REVIEW_FLAG);
  });
});
