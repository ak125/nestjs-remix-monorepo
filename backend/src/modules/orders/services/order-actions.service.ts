import { randomUUID } from 'crypto';
import { TABLES } from '@repo/database-types';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { OrdersService } from './orders.service';
import {
  ORDER_EVENTS,
  type OrderStatusChangedEvent,
  type OrderShippedEvent,
  type OrderDeliveredEvent,
  type OrderCancelledEvent,
  type OrderLineStatusChangedEvent,
} from '../events/order.events';
import type { OrderRecord, CustomerRecord } from '../types/order.types';

/**
 * 🚀 Service Actions Commandes - Version Moderne
 *
 * Gère TOUTES les actions sur lignes de commande :
 * - Changements statuts (1-6)
 * - Workflow équivalences (91-94)
 * - Commande fournisseur
 */
@Injectable()
export class OrderActionsService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrderActionsService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly ordersService: OrdersService,
  ) {
    super();
  }

  /**
   * ⚡ Action universelle : Changer statut ligne
   */
  async updateLineStatus(
    orderId: number,
    lineId: number,
    newStatus: number,
    options?: {
      comment?: string;
      userId?: number;
      resetEquiv?: boolean;
      supplierData?: {
        splId: number;
        splName: string;
        priceHT: number;
        qty: number;
      };
    },
  ): Promise<{ success: boolean; lineId: number; newStatus: number }> {
    const { comment, userId, resetEquiv, supplierData } = options || {};

    try {
      this.logger.log(`🔄 Ligne ${lineId} → Statut ${newStatus}`);

      // Récupérer ligne actuelle
      const { data: line, error } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('*')
        .eq('orl_id', lineId)
        .eq('orl_ord_id', orderId)
        .single();

      if (error || !line) {
        throw new BadRequestException('Ligne introuvable');
      }

      // Préparer mise à jour
      const updateData: Record<string, unknown> = {
        orl_orls_id: newStatus,
        orl_updated_at: new Date().toISOString(),
      };

      // Reset équivalence si demandé (statut 1)
      if (resetEquiv || newStatus === 1) {
        updateData.orl_equiv_id = 0;
      }

      // Statut 6 : Commander fournisseur
      if (newStatus === 6 && supplierData) {
        const { splId, splName, priceHT, qty } = supplierData;
        const TVA = 1.2; // TODO: récupérer taux réel

        // 1. Passer en statut 5 d'abord
        await this.supabase
          .from(TABLES.xtr_order_line)
          .update({ orl_orls_id: 5 })
          .eq('orl_id', lineId);

        // 2. Enregistrer fournisseur
        updateData.orl_spl_id = splId;
        updateData.orl_spl_name = splName;
        updateData.orl_spl_date = new Date().toISOString();
        updateData.orl_spl_price_buy_unit_ht = priceHT;
        updateData.orl_spl_price_buy_unit_ttc = priceHT * TVA;
        updateData.orl_spl_price_buy_ht = priceHT * qty;
        updateData.orl_spl_price_buy_ttc = priceHT * qty * TVA;
      }

      // Mettre à jour
      const { error: updateError } = await this.supabase
        .from(TABLES.xtr_order_line)
        .update(updateData)
        .eq('orl_id', lineId);

      if (updateError) {
        throw new BadRequestException(updateError.message);
      }

      // Audit trail
      await this.createAudit(orderId, lineId, 'update_status', {
        oldStatus: line.orl_orls_id,
        newStatus,
        comment,
        userId,
      });

      this.eventEmitter.emit(ORDER_EVENTS.LINE_STATUS_CHANGED, {
        orderId,
        lineId,
        previousStatus: line.orl_orls_id,
        newStatus,
        changedBy: userId,
        comment,
        timestamp: new Date().toISOString(),
      } satisfies OrderLineStatusChangedEvent);

      this.logger.log(`✅ Ligne ${lineId} mise à jour`);
      return { success: true, lineId, newStatus };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur updateLineStatus:`, message);
      throw error;
    }
  }

  /**
   * ✅ Accepter équivalence (statut 92)
   */
  async acceptEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<{ success: boolean }> {
    try {
      // Passer ligne équivalente en statut 92
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({ orl_orls_id: 92 })
        .eq('orl_id', equivalentLineId)
        .eq('orl_ord_id', orderId);

      this.logger.log(`✅ Équivalence ${equivalentLineId} acceptée`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur acceptEquivalent:`, message);
      throw error;
    }
  }

  /**
   * ❌ Refuser équivalence (statut 93)
   */
  async rejectEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<{ success: boolean }> {
    try {
      // Récupérer ligne équivalente pour trouver l'originale
      const { data: equivLine } = await this.supabase
        .from(TABLES.xtr_order_line)
        .select('orl_id')
        .eq('orl_ord_id', orderId)
        .eq('orl_equiv_id', equivalentLineId)
        .single();

      if (!equivLine) {
        throw new BadRequestException('Ligne originale introuvable');
      }

      // 1. Marquer équiv comme refusée (statut 93 + equiv_id vers originale)
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({
          orl_orls_id: 93,
          orl_equiv_id: equivLine.orl_id,
        })
        .eq('orl_id', equivalentLineId);

      // 2. Reset equiv_id de la ligne originale
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({ orl_equiv_id: 0 })
        .eq('orl_id', equivLine.orl_id);

      this.logger.log(`✅ Équivalence ${equivalentLineId} refusée`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur rejectEquivalent:`, message);
      throw error;
    }
  }

  /**
   * 📊 Audit trail
   */
  private async createAudit(
    orderId: number,
    lineId: number,
    action: string,
    data: {
      oldStatus?: number;
      newStatus?: number;
      comment?: string;
      userId?: number;
    },
  ): Promise<void> {
    try {
      await this.supabase.from('___xtr_order_line_audit').insert({
        orl_ord_id: orderId,
        orl_id: lineId,
        action,
        old_status: data.oldStatus,
        new_status: data.newStatus,
        comment: data.comment || '',
        user_id: data.userId,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn('⚠️ Erreur audit:', error);
    }
  }

  // ============================================================
  // ACTIONS GLOBALES SUR COMMANDES (Nouveau)
  // ============================================================

  /**
   * 📦 Récupérer une commande complète
   */
  async getOrder(orderId: string): Promise<OrderRecord> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select('*')
      .eq('ord_id', orderId)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Commande ${orderId} introuvable`);
    }

    return data as OrderRecord;
  }

  /**
   * 👤 Récupérer client d'une commande
   */
  async getCustomer(customerId: string): Promise<CustomerRecord> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('*')
      .eq('cst_id', customerId)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Client ${customerId} introuvable`);
    }

    return data as CustomerRecord;
  }

  /**
   * ✅ Valider commande (statut 2 → 3)
   */
  async validateOrder(
    orderId: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string }> {
    try {
      this.logger.log(`✅ Validation commande ${orderId}`);

      const order = await this.getOrder(orderId);

      // Vérifier que commande est payée
      if (order.ord_is_pay !== '1') {
        throw new BadRequestException(
          'Commande non payée, validation impossible',
        );
      }

      // Vérifier statut actuel = 2 (Confirmée)
      if (order.ord_ords_id !== '2') {
        throw new BadRequestException(
          `Statut invalide: ${order.ord_ords_id}, attendu: 2 (Confirmée)`,
        );
      }

      // Mettre à jour statut → 3 (En cours)
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '3', // En cours
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      // Historique
      await this.createOrderStatusHistory(
        orderId,
        '3',
        'Commande validée par admin',
        userId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.VALIDATED, {
        orderId,
        previousStatus: '2',
        newStatus: '3',
        changedBy: userId ? String(userId) : undefined,
        comment: 'Commande validée par admin',
        timestamp: new Date().toISOString(),
      } satisfies OrderStatusChangedEvent);

      this.logger.log(`✅ Commande ${orderId} validée (statut 3)`);
      return { success: true, newStatus: '3' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur validation commande:`, message);
      throw error;
    }
  }

  /**
   * 📦 Expédier commande (statut 3 → 4)
   */
  async shipOrder(
    orderId: string,
    trackingNumber: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string; trackingNumber: string }> {
    try {
      this.logger.log(
        `📦 Expédition commande ${orderId} - Suivi: ${trackingNumber}`,
      );

      const order = await this.getOrder(orderId);

      // Vérifier statut actuel = 3 (En cours)
      if (order.ord_ords_id !== '3') {
        throw new BadRequestException(
          `Statut invalide: ${order.ord_ords_id}, attendu: 3 (En cours)`,
        );
      }

      // Generer URL tracking automatique
      const trackingUrl = this.buildTrackingUrl(trackingNumber);

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '4',
          ord_date_ship: new Date().toISOString(),
          ord_tracking: trackingNumber,
          ord_tracking_url: trackingUrl,
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      await this.createOrderStatusHistory(
        orderId,
        '4',
        `Commande expédiée - Suivi: ${trackingNumber}`,
        userId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.SHIPPED, {
        orderId,
        customerId: order.ord_cst_id,
        trackingNumber,
        changedBy: userId ? String(userId) : undefined,
        timestamp: new Date().toISOString(),
      } satisfies OrderShippedEvent);

      this.logger.log(`✅ Commande ${orderId} expédiée`);
      return { success: true, newStatus: '4', trackingNumber };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur expédition commande:`, message);
      throw error;
    }
  }

  /**
   * 🚚 Marquer comme livrée (statut 4 → 5)
   */
  async markAsDelivered(
    orderId: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string }> {
    try {
      this.logger.log(`🚚 Livraison commande ${orderId}`);

      const order = await this.getOrder(orderId);

      // Vérifier statut actuel = 4 (Expédiée)
      if (order.ord_ords_id !== '4') {
        throw new BadRequestException(
          `Statut invalide: ${order.ord_ords_id}, attendu: 4 (Expédiée)`,
        );
      }

      // Mettre à jour
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '5', // Livrée
          ord_date_deliv: new Date().toISOString(),
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      // Historique
      await this.createOrderStatusHistory(
        orderId,
        '5',
        'Commande livrée',
        userId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.DELIVERED, {
        orderId,
        customerId: order.ord_cst_id,
        changedBy: userId ? String(userId) : undefined,
        timestamp: new Date().toISOString(),
      } satisfies OrderDeliveredEvent);

      this.logger.log(`✅ Commande ${orderId} livrée`);
      return { success: true, newStatus: '5' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur livraison commande:`, message);
      throw error;
    }
  }

  /**
   * 💰 Confirmer paiement manuellement (admin)
   */
  async confirmPaymentManual(orderId: string): Promise<{ success: boolean }> {
    try {
      this.logger.log(`💰 Confirmation paiement manuel: ${orderId}`);

      const order = await this.getOrder(orderId);

      if (order.ord_is_pay === '1') {
        throw new BadRequestException('Commande deja payee');
      }

      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_is_pay: '1',
          ord_date_pay: new Date().toISOString(),
          ord_ords_id: '5', // Payee — En preparation
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      this.logger.log(`✅ Paiement confirme manuellement: ${orderId}`);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur confirmation paiement:`, message);
      throw error;
    }
  }

  /**
   * ❌ Annuler commande (→ statut 2)
   *
   * Délègue à OrdersService.cancelOrder, seul propriétaire de
   * cancel_order_atomic (authority-graph.yaml, order_lifecycle.cancellation) :
   * la RPC décide sur la ligne verrouillée (refus d'une commande payée, seules
   * les transitions 1|3|4 → 2) et journalise ORDER_CANCELLED dans
   * ___xtr_order_history. L'événement émis ensuite porte la même corrélation ;
   * ses écouteurs envoient l'unique mail d'annulation et l'audit admin.
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    userId?: number,
  ): Promise<{ success: boolean; newStatus: string; reason: string }> {
    try {
      this.logger.log(`❌ Annulation commande ${orderId} - Raison: ${reason}`);

      const order = await this.getOrder(orderId);
      const correlationId = randomUUID();

      await this.ordersService.cancelOrder(
        orderId,
        reason,
        userId,
        correlationId,
      );

      this.eventEmitter.emit(ORDER_EVENTS.CANCELLED, {
        orderId,
        customerId: order.ord_cst_id,
        reason,
        changedBy: userId ? String(userId) : undefined,
        correlationId,
        timestamp: new Date().toISOString(),
      } satisfies OrderCancelledEvent);

      this.logger.log(`✅ Commande ${orderId} annulée`);
      return { success: true, newStatus: '2', reason };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`❌ Erreur annulation commande:`, message);
      throw error;
    }
  }

  private buildTrackingUrl(trackingNumber: string): string {
    const num = trackingNumber.trim();
    if (/^\d{11,15}$/.test(num))
      return `https://www.laposte.fr/outils/suivre-vos-envois?code=${num}`;
    if (num.startsWith('1Z'))
      return `https://www.ups.com/track?tracknum=${num}`;
    if (/^\d{14}$/.test(num)) return `https://trace.dpd.fr/fr/trace/${num}`;
    return `https://www.laposte.fr/outils/suivre-vos-envois?code=${num}`;
  }

  /**
   * 📝 Créer entrée historique statuts
   */
  private async createOrderStatusHistory(
    orderId: string,
    newStatus: string,
    comment: string,
    userId?: number,
  ): Promise<void> {
    try {
      await this.supabase.from('___xtr_order_status_history').insert({
        osh_ord_id: orderId,
        osh_ords_id: newStatus,
        osh_date: new Date().toISOString(),
        osh_admin_id: userId ? `adm_${userId}` : null,
        osh_comment: comment,
      });
    } catch (error) {
      this.logger.warn('⚠️ Erreur historique statuts:', error);
    }
  }
}
