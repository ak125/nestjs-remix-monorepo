import { Injectable } from '@nestjs/common';
import { SupplierTruthService } from './supplier-truth.service';
import {
  decideOrderLineAction,
  OrderLineAction,
} from './domain/order-line-routing';
import { AvailabilityState } from './domain/availability-state';

/**
 * Order last-mile decision (Task 15) — read-only composition.
 *
 * Given a piece, returns the canonical availability + the order-line action
 * (NOMINAL / REVIEW_FLAG / EQUIVALENCE). This is the bridge the cart/order flow
 * calls; it performs NO order writes itself (the caller persists the companion
 * columns + triggers the existing equivalence workflow on EQUIVALENCE).
 *
 * Lives in the read slice (consumes only `SupplierTruthService` + the pure
 * routing rule), so cart/orders import `SupplierTruthReadModule` to use it
 * without pulling the Bull sync runtime.
 */

export interface OrderLineAvailabilityDecision {
  state: AvailabilityState;
  delayDays: number | null;
  action: OrderLineAction;
}

@Injectable()
export class OrderAvailabilityService {
  constructor(private readonly truth: SupplierTruthService) {}

  /** Decide what to do with an order line for `pieceId` based on canonical truth. */
  async evaluate(pieceId: number): Promise<OrderLineAvailabilityDecision> {
    const view = await this.truth.getProjection(pieceId);
    return {
      state: view.state,
      delayDays: view.delayDays,
      action: decideOrderLineAction(view.state),
    };
  }
}
