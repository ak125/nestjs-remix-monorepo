import { TABLES } from '@repo/database-types';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

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
  ): Promise<any> {
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
      const updateData: any = {
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

      this.logger.log(`✅ Ligne ${lineId} mise à jour`);
      return { success: true, lineId, newStatus };
    } catch (error: any) {
      this.logger.error(`❌ Erreur updateLineStatus:`, error);
      throw error;
    }
  }

  /**
   * 🔄 Proposer équivalence (statut 91)
   */
  async proposeEquivalent(
    orderId: number,
    originalLineId: number,
    equivalentProductId: number,
    quantity: number,
    userId: number,
  ): Promise<any> {
    try {
      this.logger.log(
        `🔄 Proposer équiv ligne ${originalLineId} → produit ${equivalentProductId}`,
      );

      // 🚀 P7.2 PERF: Paralléliser product + order lookups (indépendants)
      const [productResult, orderResult] = await Promise.all([
        this.supabase
          .from(TABLES.pieces)
          .select(
            `
            piece_id,
            piece_ref,
            piece_ref_clean,
            piece_pg_id,
            piece_name,
            piece_pm_id,
            pieces_price!inner(
              pri_vente_ttc,
              pri_consigne_ttc,
              pri_achat_ht,
              pri_marge,
              pri_remise
            ),
            pieces_marque!inner(pm_name)
          `,
          )
          .eq('piece_id', equivalentProductId)
          .eq('piece_display', 1)
          .single(),
        this.supabase
          .from(TABLES.xtr_order)
          .select('ord_cst_id')
          .eq('ord_id', orderId)
          .single(),
      ]);

      const { data: product, error: productError } = productResult;
      const { data: order } = orderResult;

      if (productError || !product) {
        throw new BadRequestException('Produit équivalent introuvable');
      }

      const TVA = 1.2;
      const price = product.pieces_price[0];

      // 2. Créer nouvelle ligne avec statut 91
      const newLine = {
        orl_ord_id: orderId,
        orl_pg_id: product.piece_pg_id,
        orl_pg_name: product.piece_name,
        orl_pm_id: product.piece_pm_id,
        orl_pm_name: product.pieces_marque[0].pm_name,
        orl_art_ref: product.piece_ref,
        orl_art_ref_clean: product.piece_ref_clean,
        orl_art_quantity: quantity,
        orl_art_price_buy_unit_ht: price.pri_achat_ht,
        orl_art_price_buy_unit_ttc: price.pri_achat_ht * TVA,
        orl_art_price_sell_unit_ht: price.pri_vente_ttc / TVA,
        orl_art_price_sell_unit_ttc: price.pri_vente_ttc,
        orl_art_price_sell_ht: (price.pri_vente_ttc / TVA) * quantity,
        orl_art_price_sell_ttc: price.pri_vente_ttc * quantity,
        orl_art_deposit_unit_ht: price.pri_consigne_ttc / TVA,
        orl_art_deposit_unit_ttc: price.pri_consigne_ttc,
        orl_art_deposit_ht: (price.pri_consigne_ttc / TVA) * quantity,
        orl_art_deposit_ttc: price.pri_consigne_ttc * quantity,
        orl_orls_id: 91, // Statut "Proposition équivalence"
        orl_website_url: 'System',
      };

      const { data: createdLine, error: insertError } = await this.supabase
        .from(TABLES.xtr_order_line)
        .insert(newLine)
        .select()
        .single();

      if (insertError || !createdLine) {
        throw new BadRequestException('Erreur création ligne équivalente');
      }

      // 🚀 P7.2 PERF: Paralléliser update ligne + insert message
      const updatePromise = this.supabase
        .from(TABLES.xtr_order_line)
        .update({ orl_equiv_id: createdLine.orl_id })
        .eq('orl_id', originalLineId);

      const messagePromise = order
        ? this.supabase.from(TABLES.xtr_msg).insert({
            msg_cst_id: order.ord_cst_id,
            msg_ord_id: orderId,
            msg_cnfa_id: userId,
            msg_date: new Date().toISOString(),
            msg_subject: 'Support Technique : Proposition équivalence',
            msg_content: "Une proposition d'équivalence a été envoyée",
            msg_open: 0,
          })
        : Promise.resolve();

      await Promise.all([updatePromise, messagePromise]);

      this.logger.log(`✅ Équivalence proposée: ligne ${createdLine.orl_id}`);
      return { success: true, equivalentLineId: createdLine.orl_id };
    } catch (error: any) {
      this.logger.error(`❌ Erreur proposeEquivalent:`, error);
      throw error;
    }
  }

  /**
   * ✅ Accepter équivalence (statut 92)
   */
  async acceptEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<any> {
    try {
      // Passer ligne équivalente en statut 92
      await this.supabase
        .from(TABLES.xtr_order_line)
        .update({ orl_orls_id: 92 })
        .eq('orl_id', equivalentLineId)
        .eq('orl_ord_id', orderId);

      this.logger.log(`✅ Équivalence ${equivalentLineId} acceptée`);
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Erreur acceptEquivalent:`, error);
      throw error;
    }
  }

  /**
   * ❌ Refuser équivalence (statut 93)
   */
  async rejectEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<any> {
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
    } catch (error: any) {
      this.logger.error(`❌ Erreur rejectEquivalent:`, error);
      throw error;
    }
  }

  /**
   * 💰 Valider équivalence (statut 94) + Ticket paiement
   */
  async validateEquivalent(
    orderId: number,
    equivalentLineId: number,
  ): Promise<any> {
    try {
      // 🚀 P7.2 PERF: Paralléliser les lectures
      const [equivResult, origResult] = await Promise.all([
        this.supabase
          .from(TABLES.xtr_order_line)
          .select('orl_id, orl_art_price_sell_ttc, orl_art_deposit_ttc')
          .eq('orl_ord_id', orderId)
          .eq('orl_equiv_id', equivalentLineId)
          .single(),
        this.supabase
          .from(TABLES.xtr_order_line)
          .select('orl_id, orl_art_price_sell_ttc, orl_art_deposit_ttc')
          .eq('orl_id', equivalentLineId)
          .single(),
      ]);

      const equivLine = equivResult.data;
      const origLine = origResult.data;

      if (!equivLine || !origLine) {
        throw new BadRequestException('Lignes introuvables');
      }

      // Calculer différence
      const totalNew =
        equivLine.orl_art_price_sell_ttc + equivLine.orl_art_deposit_ttc;
      const totalOld =
        origLine.orl_art_price_sell_ttc + origLine.orl_art_deposit_ttc;
      const amountDiff = totalNew - totalOld;

      // 🚀 P7.2 PERF: Paralléliser les écritures indépendantes
      await Promise.all([
        // 1. Passer équiv en statut 5 (PD)
        this.supabase
          .from(TABLES.xtr_order_line)
          .update({ orl_orls_id: 5 })
          .eq('orl_id', equivalentLineId),
        // 2. Passer originale en statut 2 (Annulée)
        this.supabase
          .from(TABLES.xtr_order_line)
          .update({ orl_orls_id: 2 })
          .eq('orl_id', equivLine.orl_id),
        // 3. Créer ticket paiement/remboursement
        this.supabase.from('___xtr_order_line_equiv_ticket').insert({
          orlet_ord_id: orderId,
          orlet_orl_id: equivLine.orl_id,
          orlet_equiv_id: equivalentLineId,
          orlet_amount_ttc: amountDiff,
        }),
      ]);

      this.logger.log(`✅ Équivalence validée, ticket généré: ${amountDiff}€`);
      return { success: true, amountDiff };
    } catch (error: any) {
      this.logger.error(`❌ Erreur validateEquivalent:`, error);
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
    data: any,
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
  async getOrder(orderId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_order)
      .select('*')
      .eq('ord_id', orderId)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Commande ${orderId} introuvable`);
    }

    return data;
  }

  /**
   * 👤 Récupérer client d'une commande
   */
  async getCustomer(customerId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from(TABLES.xtr_customer)
      .select('*')
      .eq('cst_id', customerId)
      .single();

    if (error || !data) {
      throw new BadRequestException(`Client ${customerId} introuvable`);
    }

    return data;
  }

  /**
   * ✅ Valider commande (statut 2 → 3)
   */
  async validateOrder(orderId: string, userId?: number): Promise<any> {
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

      this.logger.log(`✅ Commande ${orderId} validée (statut 3)`);
      return { success: true, newStatus: '3' };
    } catch (error: any) {
      this.logger.error(`❌ Erreur validation commande:`, error);
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
  ): Promise<any> {
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

      // Mettre à jour avec numéro de suivi
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '4', // Expédiée
          ord_date_ship: new Date().toISOString(),
          ord_tracking: trackingNumber,
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      // Historique
      await this.createOrderStatusHistory(
        orderId,
        '4',
        `Commande expédiée - Suivi: ${trackingNumber}`,
        userId,
      );

      this.logger.log(`✅ Commande ${orderId} expédiée`);
      return { success: true, newStatus: '4', trackingNumber };
    } catch (error: any) {
      this.logger.error(`❌ Erreur expédition commande:`, error);
      throw error;
    }
  }

  /**
   * 🚚 Marquer comme livrée (statut 4 → 5)
   */
  async markAsDelivered(orderId: string, userId?: number): Promise<any> {
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

      this.logger.log(`✅ Commande ${orderId} livrée`);
      return { success: true, newStatus: '5' };
    } catch (error: any) {
      this.logger.error(`❌ Erreur livraison commande:`, error);
      throw error;
    }
  }

  /**
   * ❌ Annuler commande (→ statut 6)
   */
  async cancelOrder(
    orderId: string,
    reason: string,
    userId?: number,
  ): Promise<any> {
    try {
      this.logger.log(`❌ Annulation commande ${orderId} - Raison: ${reason}`);

      const order = await this.getOrder(orderId);

      // Ne pas annuler si déjà expédiée ou livrée
      if (order.ord_ords_id === '4' || order.ord_ords_id === '5') {
        throw new BadRequestException(
          "Impossible d'annuler une commande expédiée ou livrée",
        );
      }

      // Mettre à jour
      const { error } = await this.supabase
        .from(TABLES.xtr_order)
        .update({
          ord_ords_id: '6', // Annulée
          ord_cancel_date: new Date().toISOString(),
          ord_cancel_reason: reason,
          ord_updated_at: new Date().toISOString(),
        })
        .eq('ord_id', orderId);

      if (error) throw error;

      // Historique
      await this.createOrderStatusHistory(
        orderId,
        '6',
        `Commande annulée: ${reason}`,
        userId,
      );

      // TODO: Remettre stock si produits réservés
      // TODO: Remboursement si payée

      this.logger.log(`✅ Commande ${orderId} annulée`);
      return { success: true, newStatus: '6', reason };
    } catch (error: any) {
      this.logger.error(`❌ Erreur annulation commande:`, error);
      throw error;
    }
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
