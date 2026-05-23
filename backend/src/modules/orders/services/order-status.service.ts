import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  OrderEventType,
  type OrderEventTypeCode,
  type OrderStatusCode,
  getOrderStatusLabel,
  isOrderStatusCode,
} from '@repo/domain-commerce';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

/**
 * Order status / event history service.
 *
 * F3 (Vault #301 audit, 2026-05-22) : ce service portait un DOUBLON cassé de
 * la machine d'état statut — enum modèle-colis faux + INSERT sur table lookup
 * `___xtr_order_status` (jamais une table history). PR #696 a retiré la
 * state-machine cassée + l'enum faux ; cette PR-C (Vault #301 follow-up)
 * rebranche `createStatusHistory` sur la RPC canonique `append_order_event`
 * qui écrit dans la table `___xtr_order_history` (créée par migration
 * 20260523_001_create_order_history).
 *
 * Canon : `.spec/00-canon/commerce-runtime/authority-graph.yaml#rpc_authority.rpcs.append_order_event`.
 */

export interface AppendOrderEventInput {
  ordId: string;
  eventType: OrderEventTypeCode;
  fromStatus: OrderStatusCode | null;
  toStatus: OrderStatusCode | null;
  payload?: Record<string, unknown>;
  source?: string;
  correlationId?: string;
  userId?: number;
}

@Injectable()
export class OrderStatusService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderStatusService.name);

  constructor() {
    super();
  }

  /**
   * Append a typed event to `___xtr_order_history` via canonical RPC.
   *
   * Single entry point for event-stream writes (alongside RPCs
   * create_order_atomic / cancel_order_atomic which call it atomically
   * inside their own transaction).
   */
  async appendOrderEvent(input: AppendOrderEventInput): Promise<void> {
    const { error } = await this.callRpc(
      'append_order_event',
      {
        p_ord_id: input.ordId,
        p_event_type: input.eventType,
        p_from_status: input.fromStatus ?? null,
        p_to_status: input.toStatus ?? null,
        p_payload: input.payload ?? {},
        p_source: input.source ?? 'orders_service',
        p_correlation_id: input.correlationId ?? randomUUID(),
        p_user_id: input.userId ?? null,
      },
      { isServiceRole: true, source: 'internal' },
    );

    if (error) {
      this.logger.error(
        `append_order_event failed for ord_id=${input.ordId} event=${input.eventType}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Backward-compatible status-history helper.
   *
   * Pre-PR-C signature kept for any remaining callers that did not migrate
   * to typed `appendOrderEvent`. Converts the legacy `(orderId: number, status: number)`
   * into the canonical RPC call. The numeric status is validated against the
   * 5-value canon (1..5); non-canonical inputs are rejected loudly so silent
   * data drift cannot recur.
   */
  async createStatusHistory(
    orderId: number,
    status: number,
    comment?: string,
    userId?: number,
  ): Promise<void> {
    const ordId = String(orderId);
    const statusCode = String(status);
    if (!isOrderStatusCode(statusCode)) {
      throw new Error(
        `createStatusHistory: status '${status}' hors-canon (___xtr_order_status n'a que '1'..'5'). Vault #301 sentinel.`,
      );
    }

    await this.appendOrderEvent({
      ordId,
      eventType: OrderEventType.STATUS_CHANGED,
      fromStatus: null,
      toStatus: statusCode,
      payload: {
        comment:
          comment ?? `Statut changé vers ${getOrderStatusLabel(statusCode)}`,
      },
      userId,
    });
  }
}
