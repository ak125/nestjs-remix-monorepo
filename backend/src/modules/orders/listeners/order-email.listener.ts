import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { MailService } from '../../../services/mail.service';
import {
  ORDER_EVENTS,
  type OrderShippedEvent,
  type OrderCancelledEvent,
  type OrderRefundedEvent,
} from '../events/order.events';
import { TABLES } from '@repo/database-types';

@Injectable()
export class OrderEmailListener extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderEmailListener.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  @OnEvent(ORDER_EVENTS.SHIPPED)
  async onOrderShipped(event: OrderShippedEvent) {
    try {
      const { order, customer } = await this.loadOrderAndCustomer(
        event.orderId,
      );
      if (!order || !customer) return;

      await this.mailService.sendShippingNotification(
        {
          ord_id: order.ord_id,
          ord_total_ttc: order.ord_total_ttc,
          ord_date: order.ord_date,
        },
        {
          cst_mail: customer.cst_mail,
          cst_fname: customer.cst_prenom || customer.cst_fname || '',
          cst_name: customer.cst_nom || customer.cst_name || '',
        },
        event.trackingNumber,
      );
      this.logger.log(`Shipping email sent for order ${event.orderId}`);
    } catch (error) {
      this.logger.warn(`Shipping email failed (non-blocking): ${error}`);
    }
  }

  @OnEvent(ORDER_EVENTS.CANCELLED)
  async onOrderCancelled(event: OrderCancelledEvent) {
    try {
      const { order, customer } = await this.loadOrderAndCustomer(
        event.orderId,
      );
      if (!order || !customer) return;

      await this.mailService.sendCancellationEmail(
        {
          ord_id: order.ord_id,
          ord_total_ttc: order.ord_total_ttc,
          ord_date: order.ord_date,
        },
        {
          cst_mail: customer.cst_mail,
          cst_fname: customer.cst_prenom || customer.cst_fname || '',
          cst_name: customer.cst_nom || customer.cst_name || '',
        },
        event.reason,
      );
      this.logger.log(`Cancellation email sent for order ${event.orderId}`);
    } catch (error) {
      this.logger.warn(`Cancellation email failed (non-blocking): ${error}`);
    }
  }

  @OnEvent(ORDER_EVENTS.REFUNDED)
  async onOrderRefunded(event: OrderRefundedEvent) {
    try {
      const { order, customer } = await this.loadOrderAndCustomer(
        event.orderId,
      );
      if (!order || !customer) return;

      await this.mailService.sendRefundConfirmation(
        {
          ord_id: order.ord_id,
          ord_total_ttc: order.ord_total_ttc,
          ord_date: order.ord_date,
        },
        {
          cst_mail: customer.cst_mail,
          cst_fname: customer.cst_prenom || customer.cst_fname || '',
          cst_name: customer.cst_nom || customer.cst_name || '',
        },
        event.amount,
        event.reason,
      );
      this.logger.log(`Refund email sent for order ${event.orderId}`);
    } catch (error) {
      this.logger.warn(`Refund email failed (non-blocking): ${error}`);
    }
  }

  private async loadOrderAndCustomer(orderId: string) {
    const { data: order } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id, ord_cst_id, ord_total_ttc, ord_date')
      .eq('ord_id', orderId)
      .single();

    if (!order) return { order: null, customer: null };

    const { data: customer } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('cst_mail, cst_prenom, cst_nom, cst_fname, cst_name')
      .eq('cst_id', order.ord_cst_id)
      .single();

    return { order, customer: customer || null };
  }
}
