import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import {
  Payment,
  PaymentStatus,
  Transaction,
  PaymentPostback,
} from '../entities/payment.entity';

@Injectable()
export class PaymentDataService extends SupabaseBaseService {
  // Utilise ic_postback comme table temporaire pour les paiements
  // TODO: Migrer vers table 'payments' dédiée en production
  protected readonly tableName = 'ic_postback';

  /**
   * Créer un nouveau paiement
   * Utilise ic_postback + ___xtr_order pour stocker les informations
   */
  async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
    try {
      const paymentReference = paymentData.paymentReference || `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      this.logger.log(`Creating payment with reference: ${paymentReference}`);

      // 1. Enregistrer dans ic_postback pour tracking paiement
      const { data: postback, error: postbackError } = await this.supabase
        .from('ic_postback')
        .insert({
          id_ic_postback: paymentReference,
          id_com: paymentData.orderId || '',
          orderid: paymentData.orderId || '',
          paymentid: paymentReference,
          transactionid: paymentData.providerTransactionId || '',
          amount: paymentData.amount?.toString() || '0',
          currency: paymentData.currency || 'EUR',
          paymentmethod: paymentData.method || 'card',
          status: 'pending',
          statuscode: '00',
          datepayment: new Date().toISOString(),
        })
        .select()
        .single();

      if (postbackError) {
        this.logger.error('Error creating postback:', postbackError);
        throw new Error(`Failed to create payment: ${postbackError.message}`);
      }

      this.logger.log(`✅ Payment postback created: ${postback.id_ic_postback}`);

      // 2. Si orderId fourni, mettre à jour le statut de paiement de la commande
      if (paymentData.orderId) {
        const { error: orderError } = await this.supabase
          .from('___xtr_order')
          .update({
            ord_is_pay: '0', // 0 = en attente, 1 = payé
            ord_date_pay: null, // Sera mis à jour lors du callback de succès
          })
          .eq('ord_id', paymentData.orderId);

        if (orderError) {
          this.logger.warn(`Could not update order payment status: ${orderError.message}`);
        } else {
          this.logger.log(`✅ Order ${paymentData.orderId} marked as payment pending`);
        }
      }

      // 3. Convertir les données postback vers format Payment
      const payment: Payment = {
        id: postback.id_ic_postback,
        paymentReference: postback.paymentid,
        amount: parseFloat(postback.amount || '0'),
        currency: postback.currency || 'EUR',
        status: PaymentStatus.PENDING,
        method: paymentData.method!,
        providerTransactionId: postback.transactionid || undefined,
        description: paymentData.description,
        metadata: paymentData.metadata,
        userId: paymentData.userId!,
        orderId: postback.orderid || undefined,
        createdAt: new Date(postback.datepayment),
        updatedAt: new Date(postback.datepayment),
        refundedAmount: 0,
      };

      this.logger.log(`✅ Payment object created successfully: ${payment.id}`);
      return payment;

      /* CODE ORIGINAL - À restaurer après création table 'payments'
      const { data, error } = await this.supabase
        .from('payments')
        .insert([paymentData])
        .select('*')
        .single();

      if (error) {
        this.logger.error('Error creating payment:', error);
        throw new Error(`Failed to create payment: ${error.message}`);
      }

      this.logger.log(`Payment created successfully: ${data.id}`);
      return data as Payment;
      */
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
   */
  async findPaymentByReference(reference: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('paymentReference', reference)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(
          `Failed to find payment by reference: ${error.message}`,
        );
      }

      return data as Payment;
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
      const { data, error } = await this.supabase
        .from('ic_postback')
        .update({
          status,
          statuscode: status === 'completed' ? '00' : status === 'failed' ? '05' : '01',
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
          .from('___xtr_order')
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
   * Utilise ic_postback avec JOIN sur ___xtr_order
   */
  async findPaymentsByUserId(userId: string): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('ic_postback')
        .select('*')
        .eq('id_com', userId)
        .order('datepayment', { ascending: false });

      if (error) {
        throw new Error(`Failed to find payments: ${error.message}`);
      }

      return data.map(postback => this.mapPostbackToPayment(postback));
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

      return data.map(postback => this.mapPostbackToPayment(postback));
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
    transactionData: Partial<PaymentTransaction>,
  ): Promise<PaymentTransaction> {
    try {
      // Les transactions sont déjà enregistrées dans ic_postback
      // On retourne juste un objet formaté
      const transaction: PaymentTransaction = {
        id: transactionData.id || `TXN_${Date.now()}`,
        paymentId: transactionData.paymentId,
        amount: transactionData.amount,
        currency: transactionData.currency || 'EUR',
        status: transactionData.status || 'pending',
        type: transactionData.type || 'payment',
        metadata: transactionData.metadata || {},
        createdAt: new Date(),
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
   */
  async findTransactionsByPaymentId(paymentId: string): Promise<Transaction[]> {
    try {
      const { data, error } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .eq('paymentId', paymentId)
        .order('createdAt', { ascending: false });

      if (error) {
        throw new Error(`Failed to find transactions: ${error.message}`);
      }

      return data as Transaction[];
    } catch (error) {
      this.logger.error('Error in findTransactionsByPaymentId:', error);
      throw error;
    }
  }

  /**
   * Enregistrer un postback
   */
  async createPostback(
    postbackData: Partial<PaymentPostback>,
  ): Promise<PaymentPostback> {
    try {
      const { data, error } = await this.supabase
        .from('payment_postbacks')
        .insert([postbackData])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create postback: ${error.message}`);
      }

      return data as PaymentPostback;
    } catch (error) {
      this.logger.error('Error in createPostback:', error);
      throw error;
    }
  }

  /**
   * Statistiques des paiements
   */
  async getPaymentStats(userId?: string): Promise<{
    totalAmount: number;
    totalCount: number;
    successfulCount: number;
    failedCount: number;
  }> {
    try {
      let query = this.supabase.from('payments').select('amount, status');

      if (userId) {
        query = query.eq('userId', userId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get payment stats: ${error.message}`);
      }

      const stats = data.reduce(
        (acc, payment) => {
          acc.totalCount++;
          acc.totalAmount += parseFloat(payment.amount.toString());

          if (payment.status === PaymentStatus.COMPLETED) {
            acc.successfulCount++;
          } else if (payment.status === PaymentStatus.FAILED) {
            acc.failedCount++;
          }

          return acc;
        },
        { totalAmount: 0, totalCount: 0, successfulCount: 0, failedCount: 0 },
      );

      return stats;
    } catch (error) {
      this.logger.error('Error in getPaymentStats:', error);
      throw error;
    }
  }
}
