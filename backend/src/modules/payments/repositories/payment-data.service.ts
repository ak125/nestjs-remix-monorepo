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
import { normalizeOrderId } from '../utils/normalize-order-id';

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
   * Créer un nouveau paiement
   * Utilise ic_postback + ___xtr_order pour stocker les informations
   */
  async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
    try {
      // Defense-in-depth: normaliser orderId même si l'appelant l'a déjà fait
      // Cela garantit que l'ID dans la DB sera toujours le format numérique attendu
      const safeOrderId = normalizeOrderId(paymentData.orderId || '');

      const paymentReference =
        paymentData.paymentReference ||
        `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      this.logger.log(
        `Creating payment with reference: ${paymentReference}, orderId: ${safeOrderId}`,
      );

      // 1. Enregistrer dans ic_postback pour tracking paiement
      // Note: Les consignes sont stockées dans ___xtr_order.ord_deposit_ttc, pas ici
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
              ord_is_pay: '1', // 1 = payé
              ord_date_pay: new Date().toISOString(),
              ord_ords_id: '3', // Statut "Validée"
            }
          : {
              ord_is_pay: '0', // 0 = en attente de paiement
              ord_date_pay: null,
            };

        const { error: orderError } = await this.supabase
          .from(TABLES.xtr_order)
          .update(orderUpdate)
          .eq('ord_id', safeOrderId);

        if (orderError) {
          this.logger.warn(
            `Failed to update order ${safeOrderId}: ${orderError.message}`,
          );
        } else if (isCompleted) {
          this.logger.log(
            `✅ Order ${safeOrderId} marked as PAID (ord_is_pay=1, ord_ords_id=3)`,
          );
        } else {
          this.logger.log(`✅ Order ${safeOrderId} marked as unpaid`);
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
        await this.supabase
          .from(TABLES.xtr_order)
          .update({
            ord_is_pay: '1',
            ord_date_pay: new Date().toISOString(),
          })
          .eq('ord_id', data.orderid);
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
}
