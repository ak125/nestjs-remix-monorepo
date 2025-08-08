import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseServiceFacade } from '../../../database/supabase-service-facade';
import { RedisCacheService } from '../../../database/services/redis-cache.service';
import { PaymentAuditService } from './payment-audit-simple.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly supabaseService: SupabaseServiceFacade,
    private readonly redisCacheService: RedisCacheService,
    private readonly auditService: PaymentAuditService,
  ) {}

  /**
   * Récupérer la liste des vrais paiements depuis ic_postback avec données client enrichies
   */
  async getPaymentsWithCustomers(params: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<any> {
    try {
      const { page = 1, limit = 10, status } = params;

      this.logger.log(
        `🎯 Récupération des vrais paiements ic_postback - page ${page}, limit ${limit}`,
      );

      // 1. Récupérer les vrais paiements depuis ic_postback
      const headers = {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      };

      const baseUrl =
        process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
      let query = `${baseUrl}/rest/v1/ic_postback?select=*&order=datepayment.desc`;

      if (status) {
        query += `&status=eq.${status}`;
      }

      query += `&limit=${limit}&offset=${(page - 1) * limit}`;

      const response = await fetch(query, { headers });

      if (!response.ok) {
        throw new Error(`Erreur API ic_postback: ${response.status}`);
      }

      const realPayments = await response.json();
      this.logger.log(`✅ ${realPayments.length} vrais paiements récupérés`);

      // 2. Extraire les IDs de commande pour enrichir avec les données clients
      const orderIds = [
        ...new Set(
          realPayments
            .map((payment: any) => payment.id_com?.toString())
            .filter((id: string) => id && id !== 'null' && id !== ''),
        ),
      ] as string[];

      this.logger.log(
        `🔗 ${orderIds.length} commandes uniques à enrichir avec données clients`,
      );

      // 3. Récupérer les commandes correspondantes avec enrichissement client
      const enrichedOrders = await this.getOrdersWithCustomersByIds(orderIds);

      // 4. Mapper les vrais paiements avec les données clients
      const enrichedPayments = realPayments.map((payment: any) => {
        const orderData = enrichedOrders.find(
          (order: any) => order.ord_id === payment.id_com,
        );
        const customer = orderData?.customer || {};

        return {
          id: payment.id_ic_postback,
          paymentId: payment.paymentid,
          transactionId: payment.transactionid,
          orderId: payment.id_com,
          orderReference: payment.orderid,
          customerId: orderData?.ord_cst_id || '',
          customerName:
            customer.cst_name && customer.cst_fname
              ? `${customer.cst_fname} ${customer.cst_name}`
              : customer.cst_name || 'Client introuvable',
          customerEmail: customer.cst_mail || 'Email non disponible',
          customerCity: customer.cst_city || '',
          customerActive: customer.cst_activ === '1',
          montantTotal: parseFloat(payment.amount || '0'),
          devise: payment.currency || 'EUR',
          statutPaiement: payment.status === 'OK' ? '1' : '0',
          methodePaiement: payment.paymentmethod || 'Non définie',
          dateCreation: payment.datepayment,
          datePaiement: payment.datepayment,
          ipAddress: payment.ip,
          ipSource: payment.ips,
        };
      });

      this.logger.log(
        `🔗 Enrichissement terminé pour ${enrichedPayments.length} vrais paiements`,
      );

      return {
        success: true,
        payments: enrichedPayments,
        total: enrichedPayments.length,
        page,
        limit,
        _enriched: true,
        _source: 'ic_postback_real_payments',
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des vrais paiements:',
        error,
      );
      return {
        success: false,
        payments: [],
        total: 0,
        page: params.page || 1,
        limit: params.limit || 10,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Récupérer les commandes avec données clients par IDs
   */
  private async getOrdersWithCustomersByIds(
    orderIds: string[],
  ): Promise<any[]> {
    try {
      if (!orderIds.length) return [];

      // Utiliser le service Redis pour récupérer et enrichir les commandes
      const allEnrichedOrders =
        await this.redisCacheService.getCachedOrdersWithRelations(1, 2000);

      // Filtrer les commandes qui correspondent aux IDs
      return allEnrichedOrders.filter((order: any) =>
        orderIds.includes(order.ord_id),
      );
    } catch (error) {
      this.logger.error('Erreur récupération commandes par IDs:', error);
      return [];
    }
  }

  /**
   * Obtenir les statistiques des paiements
   */
  async getPaymentStats(): Promise<any> {
    try {
      // Récupérer les vraies statistiques depuis ic_postback
      const headers = {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      };

      const baseUrl =
        process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';

      // Tous les paiements
      const allResponse = await fetch(
        `${baseUrl}/rest/v1/ic_postback?select=status,amount,currency`,
        { headers },
      );
      const allPayments = await allResponse.json();

      // Paiements réussis
      const paidPayments = allPayments.filter((p: any) => p.status === 'OK');

      // Paiements en échec
      const failedPayments = allPayments.filter((p: any) => p.status !== 'OK');

      const totalAmount = paidPayments.reduce((sum: number, payment: any) => {
        return sum + parseFloat(payment.amount || '0');
      }, 0);

      return {
        total_orders: allPayments.length,
        paid_orders: paidPayments.length,
        pending_orders: failedPayments.length,
        total_amount: totalAmount,
        currency: 'EUR',
      };
    } catch (error) {
      this.logger.error(
        'Erreur lors de la récupération des statistiques:',
        error,
      );
      throw new BadRequestException(
        'Erreur lors de la récupération des statistiques',
      );
    }
  }

  /**
   * TEST: Vérifier l'accès à la table ic_postback (vraie table de paiements)
   */
  async testRealPaymentsTable(): Promise<any> {
    try {
      this.logger.log("🧪 Test d'accès à la table ic_postback...");

      // Utiliser la clé service_role pour accéder aux vraies tables
      const headers = {
        'Content-Type': 'application/json',
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      };

      const baseUrl =
        process.env.SUPABASE_URL || 'https://cxpojprgwgubzjyqzmoq.supabase.co';
      const response = await fetch(
        `${baseUrl}/rest/v1/ic_postback?limit=5&select=*`,
        {
          headers,
        },
      );

      if (!response.ok) {
        this.logger.warn(
          `❌ Table ic_postback inaccessible: ${response.status}`,
        );
        return { accessible: false, error: `HTTP ${response.status}` };
      }

      const data = await response.json();
      this.logger.log(
        `✅ Table ic_postback accessible: ${Array.isArray(data) ? data.length : 0} enregistrements`,
      );

      return {
        accessible: true,
        count: Array.isArray(data) ? data.length : 0,
        sample: data?.[0] || null,
        data: data || [],
      };
    } catch (error) {
      this.logger.error('❌ Erreur test table ic_postback:', error);
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}
