import { TABLES } from '@repo/database-types';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
  Transaction,
  PaymentPostback,
} from '../entities/payment.entity';
import {
  normalizeOrderId,
  extractNumericPart,
} from '../utils/normalize-order-id';

@Injectable()
export class PaymentDataService extends SupabaseBaseService {
  // Utilise ic_postback comme table pour les paiements
  protected readonly tableName = 'ic_postback';

  constructor(configService?: ConfigService) {
    super(configService);
  }

  /**
   * Mapper un enregistrement ic_postback vers l'entité Payment
   */
  private mapPostbackToPayment(postback: any): Payment {
    return {
      id: postback.id_ic_postback,
      paymentReference: postback.paymentid,
      amount: parseFloat(postback.amount || '0'),
      currency: postback.currency || 'EUR',
      status: this.mapPaymentStatus(postback.status),
      method: this.mapPaymentMethod(postback.paymentmethod),
      userId: postback.id_com,
      orderId: postback.orderid,
      providerTransactionId: postback.transactionid,
      refundedAmount: 0,
      metadata: {
        statuscode: postback.statuscode,
        ip: postback.ip,
        ips: postback.ips,
        datepayment: postback.datepayment,
      },
      createdAt: postback.datepayment
        ? new Date(postback.datepayment)
        : new Date(),
      updatedAt: postback.datepayment
        ? new Date(postback.datepayment)
        : new Date(),
    };
  }

  /**
   * Mapper le status ic_postback vers PaymentStatus
   */
  private mapPaymentStatus(status: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      paid: PaymentStatus.COMPLETED,
      success: PaymentStatus.COMPLETED,
      pending: PaymentStatus.PENDING,
      failed: PaymentStatus.FAILED,
      error: PaymentStatus.FAILED,
      canceled: PaymentStatus.CANCELLED,
      cancelled: PaymentStatus.CANCELLED,
      refunded: PaymentStatus.REFUNDED,
    };
    return statusMap[status?.toLowerCase()] || PaymentStatus.PENDING;
  }

  /**
   * Mapper la méthode de paiement vers PaymentMethod
   */
  private mapPaymentMethod(method: string): PaymentMethod {
    const methodMap: Record<string, PaymentMethod> = {
      card: PaymentMethod.CREDIT_CARD,
      credit_card: PaymentMethod.CREDIT_CARD,
      debit_card: PaymentMethod.DEBIT_CARD,
      paypal: PaymentMethod.PAYPAL,
      bank_transfer: PaymentMethod.BANK_TRANSFER,
      cyberplus: PaymentMethod.CYBERPLUS,
    };
    return methodMap[method?.toLowerCase()] || PaymentMethod.CYBERPLUS;
  }

  /**
   * Résout un orderId vers le vrai ord_id en BDD.
   * Stratégie multi-format : exact match → LIKE sur partie numérique → null.
   *
   * Gère les deux formats historiques :
   * - Ancien (2020-2024) : "278383" (numérique)
   * - Nouveau (2025+) : "ORD-1770396202649-628" (ORD-timestamp-random)
   */
  async resolveOrderId(inputId: string): Promise<string | null> {
    if (!inputId) return null;

    const safeId = normalizeOrderId(inputId);

    // Étape 1 : Match exact
    const { data: exactMatch } = await this.supabase
      .from(TABLES.xtr_order)
      .select('ord_id')
      .eq('ord_id', safeId)
      .maybeSingle();

    if (exactMatch?.ord_id) return exactMatch.ord_id;

    // Étape 2 : Fallback LIKE sur la partie numérique (timestamp)
    // Ex: inputId="1770396202649" → cherche ord_id LIKE 'ORD-1770396202649%'
    const numericPart = extractNumericPart(inputId);
    if (numericPart && numericPart !== safeId) {
      // Essayer le numérique seul (ancien format)
      const { data: numericMatch } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id')
        .eq('ord_id', numericPart)
        .maybeSingle();

      if (numericMatch?.ord_id) return numericMatch.ord_id;
    }

    // Étape 3 : Si l'input est numérique, chercher le format ORD-{numeric}-%
    if (numericPart) {
      const { data: likeMatch } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id')
        .like('ord_id', `ORD-${numericPart}%`)
        .limit(1)
        .maybeSingle();

      if (likeMatch?.ord_id) {
        this.logger.warn(
          `resolveOrderId: fallback LIKE match "${inputId}" → "${likeMatch.ord_id}"`,
        );
        return likeMatch.ord_id;
      }
    }

    this.logger.error(
      `resolveOrderId: aucune commande trouvée pour "${inputId}"`,
    );
    return null;
  }

  /**
   * Créer un nouveau paiement
   * Utilise ic_postback + ___xtr_order pour stocker les informations
   */
  async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
    try {
      const safeOrderId = normalizeOrderId(paymentData.orderId || '');

      const paymentReference =
        paymentData.paymentReference ||
        `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      this.logger.log(
        `Creating payment with reference: ${paymentReference}, orderId: ${safeOrderId}`,
      );

      // 1. Enregistrer dans ic_postback pour tracking paiement
      const { data: postback, error: postbackError } = await this.supabase
        .from('ic_postback')
        .insert({
          id_ic_postback: paymentReference,
          id_com: safeOrderId,
          orderid: safeOrderId,
          paymentid: paymentReference,
          transactionid: paymentData.providerTransactionId || '',
          amount: paymentData.amount?.toString() || '0',
          currency: paymentData.currency || 'EUR',
          paymentmethod: paymentData.method || 'card',
          status: paymentData.status || 'pending',
          statuscode: '00',
          datepayment: new Date().toISOString(),
        })
        .select()
        .single();

      if (postbackError) {
        this.logger.error('Error creating postback:', postbackError);
        throw new Error(`Failed to create payment: ${postbackError.message}`);
      }

      this.logger.log(
        `✅ Payment postback created: ${postback.id_ic_postback}`,
      );

      // 2. Si orderId fourni, mettre à jour ___xtr_order selon le statut
      if (safeOrderId) {
        const isCompleted = paymentData.status === 'completed';
        const orderUpdate: Record<string, any> = isCompleted
          ? {
              ord_is_pay: '1',
              ord_date_pay: new Date().toISOString(),
              ord_ords_id: '3', // Statut "Validée"
            }
          : {
              ord_is_pay: '0',
              ord_date_pay: null,
            };

        // Résolution robuste : cherche le vrai ord_id en BDD
        const resolvedId = await this.resolveOrderId(safeOrderId);

        if (!resolvedId) {
          const msg = `CRITICAL: Order not found in DB for id="${safeOrderId}" (payment=${paymentReference})`;
          this.logger.error(msg);
          if (isCompleted) {
            throw new Error(msg);
          }
        } else {
          const { error: orderError } = await this.supabase
            .from(TABLES.xtr_order)
            .update(orderUpdate)
            .eq('ord_id', resolvedId);

          if (orderError) {
            const msg = `CRITICAL: Failed to update order ${resolvedId}: ${orderError.message}`;
            this.logger.error(msg);
            if (isCompleted) {
              throw new Error(msg);
            }
          } else if (isCompleted) {
            this.logger.log(
              `✅ Order ${resolvedId} marked as PAID (ord_is_pay=1, ord_ords_id=3)`,
            );
          }
        }
      }

      // 3. Mapper et retourner Payment
      return this.mapPostbackToPayment(postback);
    } catch (error) {
      this.logger.error('Error in createPayment:', error);
      throw error;
    }
  }

  /**
   * Trouver un paiement par ID
   * Utilise ic_postback
   */
  async findPaymentById(id: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('ic_postback')
        .select('*')
        .eq('id_ic_postback', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to find payment: ${error.message}`);
      }

      return this.mapPostbackToPayment(data);
    } catch (error) {
      this.logger.error('Error in findPaymentById:', error);
      throw error;
    }
  }

  /**
   * Trouver un paiement par référence
   * Utilise ic_postback
   */
  async findPaymentByReference(reference: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('ic_postback')
        .select('*')
        .eq('paymentid', reference)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to find payment: ${error.message}`);
      }

      return this.mapPostbackToPayment(data);
    } catch (error) {
      this.logger.error('Error in findPaymentByReference:', error);
      throw error;
    }
  }

  /**
   * Mettre à jour le statut d'un paiement
   * Met à jour ic_postback ET ___xtr_order.ord_is_pay si applicable
   */
  async updatePaymentStatus(
    paymentId: string,
    status: string,
  ): Promise<Payment> {
    try {
      // Mettre à jour ic_postback
      const statuscode =
        status === 'completed' ? '00' : status === 'failed' ? '05' : '01';
      const { data, error } = await this.supabase
        .from('ic_postback')
        .update({
          status,
          statuscode,
        })
        .eq('id_ic_postback', paymentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update payment status: ${error.message}`);
      }

      // Si paiement completé et orderId existe, mettre à jour ___xtr_order
      if (status === 'completed' && data.orderid) {
        const resolvedId = await this.resolveOrderId(data.orderid);
        if (resolvedId) {
          const { error: orderError } = await this.supabase
            .from(TABLES.xtr_order)
            .update({
              ord_is_pay: '1',
              ord_date_pay: new Date().toISOString(),
            })
            .eq('ord_id', resolvedId);

          if (orderError) {
            this.logger.error(
              `CRITICAL: Failed to update order ${resolvedId} on status change: ${orderError.message}`,
            );
          }
        } else {
          this.logger.error(
            `CRITICAL: Order not found for orderid="${data.orderid}" during status update`,
          );
        }
      }

      return this.mapPostbackToPayment(data);
    } catch (error) {
      this.logger.error('Error in updatePaymentStatus:', error);
      throw error;
    }
  }

  /**
   * Trouver les paiements d'un utilisateur
   * Utilise ic_postback
   */
  async findPaymentsByUserId(
    userId: string,
    limit?: number,
  ): Promise<Payment[]> {
    try {
      let query = this.supabase
        .from('ic_postback')
        .select('*')
        .eq('id_com', userId)
        .order('datepayment', { ascending: false });

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to find payments: ${error.message}`);
      }

      return data.map((postback) => this.mapPostbackToPayment(postback));
    } catch (error) {
      this.logger.error('Error in findPaymentsByUserId:', error);
      throw error;
    }
  }

  /**
   * Trouver les paiements d'une commande
   * Utilise ic_postback
   */
  async findPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('ic_postback')
        .select('*')
        .eq('orderid', orderId)
        .order('datepayment', { ascending: false });

      if (error) {
        throw new Error(`Failed to find payments: ${error.message}`);
      }

      return data.map((postback) => this.mapPostbackToPayment(postback));
    } catch (error) {
      this.logger.error('Error in findPaymentsByOrderId:', error);
      throw error;
    }
  }

  /**
   * Créer une transaction
   * Note: Les transactions sont stockées dans ic_postback via transactionid
   * Cette méthode retourne les données formatées mais ne fait pas d'insert séparé
   */
  async createTransaction(
    transactionData: Partial<Transaction>,
  ): Promise<Transaction> {
    try {
      // Les transactions sont déjà enregistrées dans ic_postback
      // On retourne juste un objet formaté
      const transaction: Transaction = {
        id: transactionData.id || `TXN_${Date.now()}`,
        paymentId: transactionData.paymentId || '',
        amount: transactionData.amount || 0,
        status: transactionData.status || PaymentStatus.PENDING,
        type: transactionData.type || 'payment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.logger.log(`Transaction created (in-memory): ${transaction.id}`);
      return transaction;
    } catch (error) {
      this.logger.error('Error in createTransaction:', error);
      throw error;
    }
  }

  /**
   * Trouver les transactions d'un paiement
   * Note: ic_postback contient le transactionid principal
   */
  async findTransactionsByPaymentId(paymentId: string): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('ic_postback')
        .select('*')
        .eq('id_ic_postback', paymentId)
        .single();

      if (error) {
        this.logger.warn(`No postback found for payment ${paymentId}`);
        return [];
      }

      // Retourner une transaction basée sur ic_postback
      const transaction: Transaction = {
        id: data.transactionid || data.id_ic_postback,
        paymentId: data.id_ic_postback,
        amount: parseFloat(data.amount || '0'),
        status: this.mapPaymentStatus(data.status),
        type: 'payment',
        providerTransactionId: data.transactionid,
        providerResponse: {
          statuscode: data.statuscode,
          paymentmethod: data.paymentmethod,
          ip: data.ip,
        },
        createdAt: data.datepayment ? new Date(data.datepayment) : new Date(),
        updatedAt: data.datepayment ? new Date(data.datepayment) : new Date(),
      };

      return [transaction];
    } catch (error) {
      this.logger.error('Error in findTransactionsByPaymentId:', error);
      throw error;
    }
  }

  /**
   * Créer un postback
   * Note: Les postbacks sont stockés dans ic_postback directement
   * Cette méthode fait un upsert sur ic_postback
   */
  async createPostback(
    postbackData: Partial<PaymentPostback>,
  ): Promise<PaymentPostback> {
    try {
      // Les postbacks vont dans ic_postback
      const postback: PaymentPostback = {
        id: postbackData.id || `PB_${Date.now()}`,
        paymentId: postbackData.paymentId || '',
        providerName: postbackData.providerName || 'cyberplus',
        rawData: postbackData.rawData || {},
        signature: postbackData.signature,
        verified: postbackData.verified || false,
        processedAt: postbackData.processedAt,
        createdAt: new Date(),
      };

      this.logger.log(
        `Postback recorded: ${postback.id} for payment ${postback.paymentId}`,
      );
      return postback;
    } catch (error) {
      this.logger.error('Error in createPostback:', error);
      throw error;
    }
  }

  /**
   * Récupérer les paiements récents
   * Utilise ic_postback trié par date décroissante
   */
  async getRecentPayments(limit: number = 20): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('ic_postback')
        .select('*')
        .order('datepayment', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get recent payments: ${error.message}`);
      }

      return data.map((postback: any) => this.mapPostbackToPayment(postback));
    } catch (error) {
      this.logger.error('Error in getRecentPayments:', error);
      return [];
    }
  }

  /**
   * Obtenir les statistiques de paiement
   * Utilise ic_postback avec agrégation
   */
  async getPaymentStats(filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<{
    total: number;
    count: number;
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
  }> {
    try {
      let query = this.supabase.from('ic_postback').select('*');

      if (filters?.startDate) {
        query = query.gte('datepayment', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('datepayment', filters.endDate.toISOString());
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get payment stats: ${error.message}`);
      }

      const stats = {
        total: 0,
        count: data.length,
        byStatus: {} as Record<string, number>,
        byMethod: {} as Record<string, number>,
      };

      data.forEach((postback: any) => {
        const amount = parseFloat(postback.amount || '0');
        stats.total += amount;

        const status = this.mapPaymentStatus(postback.status);
        stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

        const method = postback.paymentmethod || 'unknown';
        stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error('Error in getPaymentStats:', error);
      throw error;
    }
  }

  /**
   * 👤 Récupérer le client associé à une commande (pour envoi email)
   */
  async getCustomerForOrder(orderId: string): Promise<{
    cst_id: string;
    cst_mail: string;
    cst_fname: string;
    cst_name: string;
  } | null> {
    try {
      const resolvedId = await this.resolveOrderId(orderId);
      if (!resolvedId) {
        this.logger.warn(`getCustomerForOrder: order "${orderId}" not found`);
        return null;
      }

      // 1. Récupérer l'ordre pour avoir le cst_id
      const { data: order, error: orderError } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_cst_id')
        .eq('ord_id', resolvedId)
        .single();

      if (orderError || !order?.ord_cst_id) {
        this.logger.warn(`Order ${resolvedId} not found for customer lookup`);
        return null;
      }

      // 2. Récupérer le client
      const { data: customer, error: customerError } = await this.supabase
        .from(TABLES.xtr_customer)
        .select('cst_id, cst_mail, cst_fname, cst_name')
        .eq('cst_id', order.ord_cst_id)
        .single();

      if (customerError || !customer) {
        this.logger.warn(`Customer ${order.ord_cst_id} not found`);
        return null;
      }

      return customer;
    } catch (error) {
      this.logger.error('Error in getCustomerForOrder:', error);
      return null;
    }
  }

  /**
   * 🔐 Récupérer une commande pour vérification avant paiement
   * Utilisé pour valider que le montant demandé correspond au montant stocké
   *
   * @param orderId - ID de la commande (sera normalisé automatiquement)
   * @returns Les données essentielles de la commande ou null si non trouvée
   */
  async getOrderForPayment(orderId: string): Promise<{
    ord_id: string;
    ord_total_ttc: string;
    ord_is_pay: string;
    ord_cst_id: string;
  } | null> {
    try {
      const resolvedId = await this.resolveOrderId(orderId);
      if (!resolvedId) {
        this.logger.warn(
          `Order not found for payment verification: "${orderId}"`,
        );
        return null;
      }

      const { data: order, error } = await this.supabase
        .from(TABLES.xtr_order)
        .select('ord_id, ord_total_ttc, ord_is_pay, ord_cst_id')
        .eq('ord_id', resolvedId)
        .single();

      if (error || !order) {
        this.logger.warn(
          `Order not found for payment verification: ${resolvedId}`,
        );
        return null;
      }

      return order;
    } catch (error) {
      this.logger.error('Error in getOrderForPayment:', error);
      return null;
    }
  }
}
