/**
 * Order last-mile routing (Task 15 core, pure).
 *
 * Maps a piece's canonical availability state to what should happen to an order
 * line — closing the loop to the actual "commandes infaisables" problem WITHOUT
 * flooding the human equivalence workflow.
 *
 * Graded routing (per explicit guidance):
 *   - VERIFIED_AVAILABLE                       → NOMINAL (proceed)
 *   - HARD_CONFLICT, BACKORDER (confirmed)     → EQUIVALENCE (existing human workflow)
 *   - connector failure after retry            → EQUIVALENCE
 *   - UNKNOWN / STALE / SUPPLIER_PENDING /
 *     DEGRADED / SOFT_CONFLICT / DEGRADED_CONSENSUS → REVIEW_FLAG only
 *
 * Rationale: "not yet verified" ≠ "confirmed rupture". Routing every unverified
 * line into equivalence would flood the manual flow uselessly. Never auto-disables
 * the piece (piece_display stays manual).
 */

import { AvailabilityState } from './availability-state';

export enum OrderLineAction {
  /** Verified available → normal checkout. */
  NOMINAL = 'NOMINAL',
  /** Not yet verified → flag the line review-needed (no human workflow trigger). */
  REVIEW_FLAG = 'REVIEW_FLAG',
  /** Confirmed rupture/conflict/failure → trigger the existing equivalence/supplier flow. */
  EQUIVALENCE = 'EQUIVALENCE',
}

export interface RoutingContext {
  /** The connector for this piece's source supplier failed even after retry. */
  connectorFailedAfterRetry?: boolean;
}

export function decideOrderLineAction(
  state: AvailabilityState,
  ctx: RoutingContext = {},
): OrderLineAction {
  if (ctx.connectorFailedAfterRetry) return OrderLineAction.EQUIVALENCE;

  switch (state) {
    case AvailabilityState.VERIFIED_AVAILABLE:
      return OrderLineAction.NOMINAL;

    case AvailabilityState.HARD_CONFLICT:
    case AvailabilityState.BACKORDER:
      return OrderLineAction.EQUIVALENCE;

    case AvailabilityState.UNKNOWN:
    case AvailabilityState.STALE:
    case AvailabilityState.SUPPLIER_PENDING:
    case AvailabilityState.DEGRADED:
    case AvailabilityState.SOFT_CONFLICT:
    case AvailabilityState.DEGRADED_CONSENSUS:
      return OrderLineAction.REVIEW_FLAG;

    default:
      // exhaustive guard — unknown states lean to caution
      return OrderLineAction.REVIEW_FLAG;
  }
}
