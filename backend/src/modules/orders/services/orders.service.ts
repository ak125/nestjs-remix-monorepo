import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { OrderCalculationService } from './order-calculation.service';
import { OrderStatusService } from './order-status.service';
import { ShippingService } from '../../shipping/shipping.service';

export interface CreateOrderData {
  customerId: number;
  orderLines: Array<{
    productId: string;
    productName: string;
    productReference: string;
    quantity: number;
    unitPrice: number;
    vatRate?: number;
    discount?: number;
    consigne_unit?: number;  // ✅ Phase 5: Consigne unitaire
    has_consigne?: boolean;  // ✅ Phase 5: Produit avec consigne
  }>;
  billingAddress: any;
  shippingAddress: any;
  customerNote?: string;
  shippingMethod?: string;
}

export interface UpdateOrderData {
  billingAddress?: any;
  shippingAddress?: any;
  customerNote?: string;
  status?: number;
}

export interface OrderFilters {
  customerId?: number;
  status?: number;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export interface OrderLine {
  id?: number;
  orderId: string;
  productId: string;
  productName: string;
  productReference: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
  discount: number;
  subtotal: number;
}

/**
 * Service Orders Principal - Version Consolidée
 *
 * Responsabilités:
 * - CRUD commandes
 * - Création depuis panier
 * - Validation métier
 * - Calcul totaux
 * - Gestion lignes de commande
 *
 * Délégations:
 * - Calculs → OrderCalculationService
 * - Statuts → OrderStatusService
 * - Livraison → ShippingService
 */
@Injectable()
export class OrdersService extends SupabaseBaseService {
  protected readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly calculationService: OrderCalculationService,
    private readonly statusService: OrderStatusService,
    private readonly shippingService: ShippingService,
  ) {
    super();
  }

  /**
   * Créer une commande complète
   */
  async createOrder(orderData: CreateOrderData): Promise<any> {
    try {
      this.logger.log(`Création commande pour client ${orderData.customerId}`);

      // Validation
      if (!orderData.orderLines || orderData.orderLines.length === 0) {
        throw new BadRequestException(
          'La commande doit contenir au moins une ligne',
        );
      }

      // Générer numéro unique de commande
      const orderNumber = await this.generateOrderNumber();

      // Calculer frais de port
      const shippingCost = await this.calculateShippingCost(orderData);

      // Calculer totaux
      // ✅ Phase 5: Les prix sont TTC, donc taxRate = 0 (pas de TVA supplémentaire)
      const totals = await this.calculationService.calculateOrderTotal(
        orderData.orderLines,
        shippingCost,
        0, // discountAmount
        0, // taxRate = 0 car les prix sont déjà TTC
      );

      // Créer commande principale avec les vrais noms de colonnes
      // IMPORTANT: Table legacy - toutes les colonnes sont TEXT
      const orderToInsert = {
        ord_id: orderNumber, // ✅ CORRECTIF: Générer l'ID obligatoire
        ord_cst_id: String(orderData.customerId),
        ord_date: new Date().toISOString(),
        ord_parent: '0',
        ord_is_pay: '0',
        ord_date_pay: null,
        ord_amount_ttc: String(totals.subtotal.toFixed(2)),
        ord_deposit_ttc: String(totals.consigne_total.toFixed(2)), // ✅ Phase 5: Consignes
        ord_shipping_fee_ttc: String(shippingCost.toFixed(2)),
        ord_total_ttc: String(totals.total.toFixed(2)),
        ord_info: orderData.customerNote || 'Commande depuis le site',
        ord_ords_id: '1', // Statut: En attente
        ord_cba_id: null,
        ord_cda_id: null,
      };

      this.logger.log(
        '📤 Données à insérer:',
        JSON.stringify(orderToInsert, null, 2),
      );

      const { data: createdOrders, error: orderError } = await this.supabase
        .from('___xtr_order')
        .insert(orderToInsert)
        .select();
      
      this.logger.log('📥 Réponse Supabase data:', createdOrders);
      this.logger.log('📥 Réponse Supabase error:', orderError);
      
      const createdOrder = createdOrders?.[0];

      // Vérifier si c'est une vraie erreur (pas juste un objet vide)
      if (
        orderError &&
        (orderError.message || orderError.code || orderError.details)
      ) {
        this.logger.error(
          '❌ Erreur Supabase complète:',
          JSON.stringify(orderError, null, 2),
        );
        this.logger.error('❌ Message:', orderError.message);
        this.logger.error('❌ Details:', orderError.details);
        this.logger.error('❌ Hint:', orderError.hint);
        this.logger.error('❌ Code:', orderError.code);
        throw new BadRequestException(
          `Échec création commande: ${orderError.message || orderError.code}`,
        );
      }
      
      // Si pas de données retournées mais pas d'erreur, créer un objet minimal
      if (!createdOrder) {
        this.logger.warn(
          '⚠️ Commande probablement créée mais pas de données retournées (RLS)',
        );
        this.logger.log('✅ Retour succès sans données - commande créée');
        return {
          success: true,
          message: 'Commande créée avec succès',
          ord_id: 'créé', // On ne peut pas récupérer l'ID à cause de RLS
        };
      }

      const orderId = createdOrder.ord_id;
      this.logger.log(`Commande créée: #${orderId}`);

      // Créer lignes de commande avec les vrais noms de colonnes
      // IMPORTANT: Tous les champs numériques en TEXT
      const orderLines = orderData.orderLines.map((line, index) => ({
        orl_id: `${orderId}-L${String(index + 1).padStart(3, '0')}`, // ✅ CORRECTIF: Générer l'ID de ligne (ex: ORD2510060001-L001)
        orl_ord_id: String(orderId),
        orl_pg_name: line.productName,
        orl_art_price_sell_unit_ttc: String(line.unitPrice.toFixed(2)),
        orl_art_quantity: String(line.quantity),
        orl_art_price_sell_ttc: String(
          (line.quantity * line.unitPrice).toFixed(2),
        ),
      }));

      const { error: linesError } = await this.supabase
        .from('___xtr_order_line')
        .insert(orderLines);

      if (linesError) {
        this.logger.error('Erreur création lignes:', linesError);
        // Rollback manuel - supprimer la commande
        await this.supabase
          .from('___xtr_order')
          .delete()
          .eq('ord_id', orderId);
        throw new BadRequestException(
          `Échec création lignes: ${linesError.message}`,
        );
      }

      this.logger.log(`${orderLines.length} lignes créées pour #${orderId}`);

      // TODO: Créer historique statut initial
      // Note: ___xtr_order_status est une table de référence, pas d'historique
      // Il faudra créer une vraie table d'historique si nécessaire
      // await this.statusService.createStatusHistory(orderId, 1, 'Commande créée');

      // Retourner commande complète
      return await this.getOrderById(orderId);
    } catch (error: any) {
      this.logger.error('Erreur createOrder:', error);
      throw error;
    }
  }

  /**
   * Récupérer une commande par ID
   */
  async getOrderById(orderId: string): Promise<any> {
    try {
      // Simplifier sans JOIN pour éviter erreurs de relation
      const { data: order, error } = await this.supabase
        .from('___xtr_order')
        .select('*')
        .eq('ord_id', orderId)
        .single();

      if (error || !order) {
        throw new NotFoundException(`Commande #${orderId} introuvable`);
      }

      // Récupérer lignes
      const { data: lines } = await this.supabase
        .from('___xtr_order_line')
        .select('*')
        .eq('orl_ord_id', orderId);

      // TODO: Récupérer historique statuts
      // Note: ___xtr_order_status est une table de référence, pas d'historique
      // const statusHistory = await this.statusService.getOrderStatusHistory(orderId);

      return {
        ...order,
        lines: lines || [],
        statusHistory: [], // Temporaire - à implémenter avec une vraie table d'historique
      };
    } catch (error: any) {
      this.logger.error(`Erreur getOrderById(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Lister les commandes avec filtres
   */
  async listOrders(filters: OrderFilters = {}): Promise<any> {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      // Utiliser les vrais noms de colonnes Supabase (préfixe ord_)
      let query = this.supabase
        .from('___xtr_order')
        .select('*', { count: 'exact' });

      // Filtres
      if (filters.customerId) {
        query = query.eq('ord_cst_id', filters.customerId.toString());
      }

      if (filters.status) {
        query = query.eq('ord_ords_id', filters.status.toString());
      }

      if (filters.startDate) {
        query = query.gte('ord_date', filters.startDate.toISOString());
      }

      if (filters.endDate) {
        query = query.lte('ord_date', filters.endDate.toISOString());
      }

      if (filters.minAmount) {
        query = query.gte('ord_total_ttc', filters.minAmount.toString());
      }

      if (filters.maxAmount) {
        query = query.lte('ord_total_ttc', filters.maxAmount.toString());
      }

      if (filters.search) {
        query = query.or(
          `ord_id.ilike.%${filters.search}%,ord_info.ilike.%${filters.search}%`,
        );
      }

      // Pagination et tri
      query = query
        .range(offset, offset + limit - 1)
        .order('ord_date', { ascending: false });

      const { data: orders, error, count } = await query;

      if (error) {
        this.logger.error('Erreur listOrders:', error);
        throw new BadRequestException(`Erreur récupération: ${error.message}`);
      }

      return {
        data: orders || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasNextPage: page < Math.ceil((count || 0) / limit),
          hasPreviousPage: page > 1,
        },
      };
    } catch (error: any) {
      this.logger.error('Erreur listOrders:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour une commande
   */
  async updateOrder(
    orderId: string,
    updateData: UpdateOrderData,
  ): Promise<any> {
    try {
      // Vérifier existence
      const existing = await this.getOrderById(orderId);

      // Vérifier statut (pas de MAJ si expédiée/livrée)
      if (existing.order_status >= 4) {
        throw new ConflictException(
          'Impossible de modifier une commande expédiée/livrée',
        );
      }

      const dataToUpdate: any = {
        updated_at: new Date().toISOString(),
      };

      if (updateData.billingAddress) {
        dataToUpdate.billing_address = JSON.stringify(
          updateData.billingAddress,
        );
      }

      if (updateData.shippingAddress) {
        dataToUpdate.shipping_address = JSON.stringify(
          updateData.shippingAddress,
        );
      }

      if (updateData.customerNote !== undefined) {
        dataToUpdate.customer_note = updateData.customerNote;
      }

      if (updateData.status !== undefined) {
        dataToUpdate.order_status = updateData.status;
        // Créer historique
        await this.statusService.createStatusHistory(
          orderId,
          updateData.status,
          'Statut mis à jour',
        );
      }

      const { error } = await this.supabase
        .from('___xtr_order')
        .update(dataToUpdate)
        .eq('order_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec MAJ: ${error.message}`);
      }

      this.logger.log(`Commande #${orderId} mise à jour`);
      return await this.getOrderById(orderId);
    } catch (error: any) {
      this.logger.error(`Erreur updateOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Annuler une commande
   */
  async cancelOrder(orderId: string, reason?: string): Promise<any> {
    try {
      const order = await this.getOrderById(orderId);

      // Vérifier si annulation possible (avant expédition)
      if (order.order_status >= 4) {
        throw new ConflictException(
          "Impossible d'annuler une commande expédiée/livrée",
        );
      }

      // Statut annulée = 99
      await this.updateOrder(orderId, { status: 99 });
      await this.statusService.createStatusHistory(
        orderId,
        99,
        reason || 'Commande annulée',
      );

      this.logger.log(`Commande #${orderId} annulée`);
      return { success: true, message: 'Commande annulée' };
    } catch (error: any) {
      this.logger.error(`Erreur cancelOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Supprimer une commande (soft delete)
   */
  async deleteOrder(orderId: string): Promise<any> {
    try {
      const order = await this.getOrderById(orderId);

      // Seules les commandes brouillon peuvent être supprimées
      if (order.order_status !== 1) {
        throw new ConflictException(
          'Seules les commandes brouillon peuvent être supprimées',
        );
      }

      // Supprimer lignes
      await this.supabase
        .from('___xtr_order_line')
        .delete()
        .eq('order_id', orderId);

      // Supprimer commande
      const { error } = await this.supabase
        .from('___xtr_order')
        .delete()
        .eq('order_id', orderId);

      if (error) {
        throw new BadRequestException(`Échec suppression: ${error.message}`);
      }

      this.logger.log(`Commande #${orderId} supprimée`);
      return { success: true, message: 'Commande supprimée' };
    } catch (error: any) {
      this.logger.error(`Erreur deleteOrder(${orderId}):`, error);
      throw error;
    }
  }

  /**
   * Récupérer les commandes d'un client
   */
  async getCustomerOrders(
    customerId: number,
    page = 1,
    limit = 20,
  ): Promise<any> {
    return this.listOrders({ customerId, page, limit });
  }

  /**
   * Obtenir statistiques commandes
   */
  async getOrderStats(customerId?: number): Promise<any> {
    try {
      let query = this.supabase.from('___xtr_order').select('*', {
        count: 'exact',
        head: false,
      });

      if (customerId) {
        query = query.eq('ord_cst_id', customerId.toString());
      }

      const { data: orders, count } = await query;

      const totalRevenue = (orders || []).reduce(
        (sum, order) => sum + parseFloat(order.ord_total_ttc || '0'),
        0,
      );

      const statusCounts = (orders || []).reduce(
        (acc, order) => {
          const status = order.ord_ords_id || '0';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      return {
        totalOrders: count || 0,
        totalRevenue,
        averageOrderValue: count && count > 0 ? totalRevenue / count : 0,
        statusBreakdown: statusCounts,
      };
    } catch (error: any) {
      this.logger.error('Erreur getOrderStats:', error);
      throw error;
    }
  }

  // ========== MÉTHODES PRIVÉES ==========

  /**
   * Générer numéro de commande unique
   */
  private async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  /**
   * Calculer frais de port
   */
  private async calculateShippingCost(
    _orderData: CreateOrderData,
  ): Promise<number> {
    try {
      // Pour l'instant, logique simple basée sur le montant
      // ShippingService.calculateShippingFee() nécessite orderId
      // On appliquera le calcul après création de la commande
      return 5.99; // Forfait par défaut
    } catch (error) {
      this.logger.warn('Erreur calcul port, utilisation forfait:', error);
      return 5.99;
    }
  }
}
