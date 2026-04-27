import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  ORDER_EVENTS,
  type OrderCreatedEvent,
  type OrderStatusChangedEvent,
  type OrderShippedEvent,
  type OrderDeliveredEvent,
  type OrderCancelledEvent,
  type OrderRefundedEvent,
  type OrderLineStatusChangedEvent,
} from '../events/order.events';

@Injectable()
export class OrderAuditListener extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderAuditListener.name);

  private async log(
    action: string,
    entityType: string,
    entityId: string,
    userId?: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
    correlationId?: string,
  ): Promise<void> {
    try {
      const mergedMetadata = {
        ...metadata,
        ...(correlationId ? { correlationId } : {}),
      };
      await this.supabase.from('__admin_audit_log').insert({
        aal_action: action,
        aal_entity_type: entityType,
        aal_entity_id: entityId,
        aal_user_id: userId || null,
        aal_old_value: oldValue || null,
        aal_new_value: newValue || null,
        aal_metadata:
          Object.keys(mergedMetadata).length > 0 ? mergedMetadata : null,
      });
    } catch (error) {
      this.logger.warn(`Audit log failed (non-blocking): ${error}`);
    }
  }

  @OnEvent(ORDER_EVENTS.CREATED)
  async onOrderCreated(event: OrderCreatedEvent) {
    await this.log(
      'order_created',
      'order',
      event.orderId,
      event.customerId,
      undefined,
      { totalTtc: event.totalTtc, linesCount: event.linesCount },
      undefined,
      event.correlationId,
    );
  }

  @OnEvent(ORDER_EVENTS.VALIDATED)
  async onOrderValidated(event: OrderStatusChangedEvent) {
    await this.log(
      'order_validated',
      'order',
      event.orderId,
      event.changedBy,
      { status: event.previousStatus },
      { status: event.newStatus },
      undefined,
      event.correlationId,
    );
  }

  @OnEvent(ORDER_EVENTS.SHIPPED)
  async onOrderShipped(event: OrderShippedEvent) {
    await this.log(
      'order_shipped',
      'order',
      event.orderId,
      event.changedBy,
      undefined,
      { trackingNumber: event.trackingNumber },
      undefined,
      event.correlationId,
    );
  }

  @OnEvent(ORDER_EVENTS.DELIVERED)
  async onOrderDelivered(event: OrderDeliveredEvent) {
    await this.log(
      'order_delivered',
      'order',
      event.orderId,
      event.changedBy,
      undefined,
      undefined,
      undefined,
      event.correlationId,
    );
  }

  @OnEvent(ORDER_EVENTS.CANCELLED)
  async onOrderCancelled(event: OrderCancelledEvent) {
    await this.log(
      'order_cancelled',
      'order',
      event.orderId,
      event.changedBy,
      undefined,
      { reason: event.reason },
      undefined,
      event.correlationId,
    );
  }

  @OnEvent(ORDER_EVENTS.REFUNDED)
  async onOrderRefunded(event: OrderRefundedEvent) {
    await this.log(
      'order_refunded',
      'order',
      event.orderId,
      event.initiatedBy,
      undefined,
      { refundId: event.refundId, amount: event.amount, reason: event.reason },
      undefined,
      event.correlationId,
    );
  }

  @OnEvent(ORDER_EVENTS.LINE_STATUS_CHANGED)
  async onLineStatusChanged(event: OrderLineStatusChangedEvent) {
    await this.log(
      'line_status_changed',
      'order_line',
      String(event.lineId),
      event.changedBy ? String(event.changedBy) : undefined,
      { status: event.previousStatus },
      { status: event.newStatus },
      { orderId: event.orderId, comment: event.comment },
      event.correlationId,
    );
  }
}
