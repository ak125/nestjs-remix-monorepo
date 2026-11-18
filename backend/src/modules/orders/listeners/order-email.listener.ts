import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { MailService } from '../../../services/mail.service';
import { ORDER_EVENTS, type OrderShippedEvent } from '../events/order.events';
import { TABLES } from '@repo/database-types';

/**
 * Mails automatiques des événements de commande : l'expédition seule.
 *
 * Mandat CG : l'annulation (ORDER_EVENTS.CANCELLED) et le remboursement
 * (ORDER_EVENTS.REFUNDED) n'envoient plus de mail automatique — aucun texte
 * ne part sans relecture. La boutique écrit au client depuis la fiche
 * commande (« Écrire au client », OrderCustomerMailService). Les événements
 * restent émis et journalisés par OrderAuditListener.
 */
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
      if (!order || !customer?.cst_mail) {
        this.logger.warn(
          `Shipping email NOT sent for order ${event.orderId}: commande ou mail client introuvable`,
        );
        return;
      }

      await this.mailService.sendShippingNotification(
        {
          ord_id: order.ord_id,
          ord_total_ttc: order.ord_total_ttc,
          ord_date: order.ord_date,
        },
        {
          cst_mail: customer.cst_mail,
          cst_fname: customer.cst_fname || '',
          cst_name: customer.cst_name || '',
        },
        event.trackingNumber,
        event.trackingUrl || order.ord_tracking_url || undefined,
      );
      this.logger.log(`Shipping email sent for order ${event.orderId}`);
    } catch (error) {
      this.logger.warn(`Shipping email failed (non-blocking): ${error}`);
    }
  }

  private async loadOrderAndCustomer(orderId: string) {
    const { data: order } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id, ord_cst_id, ord_total_ttc, ord_date, ord_tracking_url')
      .eq('ord_id', orderId)
      .single();

    if (!order) return { order: null, customer: null };

    // Mandat BM : `cst_prenom` / `cst_nom` n'existent pas dans
    // ___xtr_customer (mesuré 2026-11-17) ; les demander faisait échouer la
    // requête, le client restait null et AUCUN mail n'était envoyé.
    const { data: customer, error } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('cst_mail, cst_fname, cst_name')
      .eq('cst_id', order.ord_cst_id)
      .single();
    if (error) {
      this.logger.warn(
        `Client de la commande ${orderId} illisible : ${error.message}`,
      );
    }

    return { order, customer: customer || null };
  }
}
