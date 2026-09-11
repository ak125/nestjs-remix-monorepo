import { Injectable } from '@nestjs/common';
import { SupplierTruthService } from './supplier-truth.service';
import {
  decideOrderLineAction,
  OrderLineAction,
} from './domain/order-line-routing';
import { AvailabilityState } from './domain/availability-state';

/**
 * Order last-mile decision (Task 15) — read-only composition. NOT WIRED.
 *
 * Given a piece, returns the canonical availability + the order-line action
 * (NOMINAL / REVIEW_FLAG / EQUIVALENCE). Designed as the bridge the cart/order flow
 * would call; it performs NO order writes itself (the caller would persist the
 * companion columns + trigger the existing equivalence workflow on EQUIVALENCE).
 *
 * Lives in the read slice (consumes only `SupplierTruthService` + the pure
 * routing rule) so cart/orders could import `SupplierTruthReadModule` without
 * pulling the Bull sync runtime. As of 2026-09-10 no cart or order module does:
 * the projection it depends on is deferred to H3 and its table does not exist.
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
