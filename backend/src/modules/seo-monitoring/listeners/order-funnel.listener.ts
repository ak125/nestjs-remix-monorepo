/**
 * OrderFunnelListener — Commerce-Loop V1 (PR-A), server-side funnel emission.
 *
 * Records the conversion funnel event `r2_order_placed` into `__seo_event_log`
 * from a GUARANTEED server-side signal (`ORDER_EVENTS.PAID`) instead of the lossy
 * client beacon on the payment-return page (which captured 0 of every paid order:
 * post-Paybox-redirect the tab is usually gone before `sendBeacon` fires).
 *
 * Why a listener (no payments/ touch): the paid transition itself lives in
 * payments/ (NEVER-MODIFY without explicit nominative owner request). The single
 * `emit(ORDER_EVENTS.PAID)` line in payments is a SEPARATE, owner-nominative
 * change (PR-A′). This listener — and everything in PR-A — is built OUTSIDE
 * payments and is fully inert until BOTH the flag is on AND that emit lands.
 *
 * Guarantees:
 *  - Flag-gated (`FUNNEL_SERVER_EMIT_ENABLED`, default OFF) → inert by default.
 *  - PROD-only: skipped under READ_ONLY (PREPROD anon cannot INSERT into
 *    `__seo_event_log` — grants are service_role-only, ADR-028 Option D). Skipping
 *    keeps PREPROD E2E green and keeps real PROD insert failures observable.
 *  - Idempotent: `mark_order_paid_atomic.wasPaid` makes ORDER_EVENTS.PAID fire
 *    once per order; `FunnelEventsService.recordOnce` + the partial unique index
 *    `uq_seo_event_log_r2_order_placed_order_id` are defense-in-depth.
 *  - Non-blocking & no silent fallback: never throws; a true insert failure is
 *    logged at `error` (observable); a benign dedup is logged at `debug`.
 *
 * Authoritative facts (item_count, revenue) are read from the order SoT by
 * orderId so the payments emit stays a literal one-liner carrying only the event.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { FeatureFlagsService } from '@config/feature-flags.service';
import type { FunnelEventInput } from '@repo/seo-types';
import {
  ORDER_EVENTS,
  type OrderPaidEvent,
} from '../../orders/events/order.events';
import { FunnelEventsService } from '../services/funnel-events.service';

@Injectable()
export class OrderFunnelListener extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderFunnelListener.name);

  constructor(
    configService: ConfigService,
    private readonly funnelEvents: FunnelEventsService,
    private readonly flags: FeatureFlagsService,
  ) {
    super(configService);
  }

  @OnEvent(ORDER_EVENTS.PAID)
  async onOrderPaid(event: OrderPaidEvent): Promise<void> {
    // Inert by default — the whole PR-A scaffolding is a no-op until flipped on.
    if (!this.flags.funnelServerEmitEnabled) return;
    // PROD-only: PREPROD runs anon (ADR-028) and cannot INSERT here. Skip cleanly
    // rather than fail-soft, so real PROD insert failures remain the only errors.
    if (this.isReadOnlyMode) return;

    try {
      const facts = await this.fetchOrderFacts(event.orderId);
      if (!facts || facts.itemCount < 1) {
        // A paid order with no readable line is anomalous — surface it, never
        // write a bogus event (item_count must be a positive int per contract).
        this.logger.warn(
          `r2_order_placed skipped for order ${event.orderId}: no readable order lines (itemCount=${facts?.itemCount ?? 'n/a'})`,
        );
        return;
      }

      const input: FunnelEventInput = {
        event_type: 'r2_order_placed',
        entity_url: null,
        payload: {
          // session_id/referrer are not persisted server-side today → null.
          // Funnel stitching by session_id is a separate additive change (PR-A2):
          // capture+persist the funnel session_id at order creation.
          session_id: null,
          order_id: event.orderId,
          item_count: facts.itemCount,
          revenue_cents: facts.revenueCents,
          referrer: null,
        },
      };

      const res = await this.funnelEvents.recordOnce(input);
      if (!res.ok) {
        this.logger.error(
          `r2_order_placed emission failed for order ${event.orderId} (insert error)`,
        );
      } else if (res.deduped) {
        this.logger.debug(
          `r2_order_placed already recorded for order ${event.orderId} (idempotent skip)`,
        );
      }
    } catch (error) {
      // Never break the event pipeline — emission is measurement, not a sale path.
      this.logger.warn(
        `r2_order_placed listener failed for order ${event.orderId} (non-blocking): ${error}`,
      );
    }
  }

  /**
   * Authoritative order facts read from the legacy order tables by orderId.
   * Returns null when the line count cannot be read (caller skips emission).
   * revenue_cents is best-effort: null when the total is absent/unparseable
   * (the contract allows a null revenue, but never a null/invalid item_count).
   */
  private async fetchOrderFacts(
    orderId: string,
  ): Promise<{ itemCount: number; revenueCents: number | null } | null> {
    const { count, error: countError } = await this.supabase
      .from('___xtr_order_line')
      .select('*', { count: 'exact', head: true })
      .eq('ordl_ord_id', orderId);
    if (countError) {
      this.logger.error(
        `r2_order_placed: order line count read failed for ${orderId}: ${countError.message}`,
      );
      return null;
    }

    const { data: order, error: orderError } = await this.supabase
      .from('___xtr_order')
      .select('ord_total_ttc')
      .eq('ord_id', orderId)
      .maybeSingle();
    if (orderError) {
      this.logger.warn(
        `r2_order_placed: order total read failed for ${orderId} (revenue→null): ${orderError.message}`,
      );
    }

    return {
      itemCount: count ?? 0,
      revenueCents: this.toCents(order?.ord_total_ttc),
    };
  }

  /** ord_total_ttc is TEXT euros (e.g. "49.90") → integer cents, or null. */
  private toCents(rawTotal: unknown): number | null {
    if (rawTotal === null || rawTotal === undefined) return null;
    const value = Number.parseFloat(String(rawTotal));
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.round(value * 100);
  }
}
