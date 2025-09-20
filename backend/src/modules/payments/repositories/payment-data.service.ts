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
  protected readonly tableName = 'payments';

  /**
   * Créer un nouveau paiement
   */
  async createPayment(paymentData: Partial<Payment>): Promise<Payment> {
    try {
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
    } catch (error) {
      this.logger.error('Error in createPayment:', error);
      throw error;
    }
  }

  /**
   * Trouver un paiement par ID
   */
  async findPaymentById(id: string): Promise<Payment | null> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to find payment: ${error.message}`);
      }

      return data as Payment;
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
   */
  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    additionalData?: Partial<Payment>,
  ): Promise<Payment> {
    try {
      const updateData = {
        status,
        updatedAt: new Date().toISOString(),
        ...(status === PaymentStatus.COMPLETED && {
          processedAt: new Date().toISOString(),
        }),
        ...additionalData,
      };

      const { data, error } = await this.supabase
        .from('payments')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update payment status: ${error.message}`);
      }

      this.logger.log(`Payment ${id} status updated to ${status}`);
      return data as Payment;
    } catch (error) {
      this.logger.error('Error in updatePaymentStatus:', error);
      throw error;
    }
  }

  /**
   * Trouver les paiements d'un utilisateur
   */
  async findPaymentsByUserId(userId: string, limit = 50): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to find payments by user: ${error.message}`);
      }

      return data as Payment[];
    } catch (error) {
      this.logger.error('Error in findPaymentsByUserId:', error);
      throw error;
    }
  }

  /**
   * Trouver les paiements d'une commande
   */
  async findPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('orderId', orderId)
        .order('createdAt', { ascending: false });

      if (error) {
        throw new Error(`Failed to find payments by order: ${error.message}`);
      }

      return data as Payment[];
    } catch (error) {
      this.logger.error('Error in findPaymentsByOrderId:', error);
      throw error;
    }
  }

  /**
   * Créer une transaction
   */
  async createTransaction(
    transactionData: Partial<Transaction>,
  ): Promise<Transaction> {
    try {
      const { data, error } = await this.supabase
        .from('payment_transactions')
        .insert([transactionData])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create transaction: ${error.message}`);
      }

      return data as Transaction;
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
