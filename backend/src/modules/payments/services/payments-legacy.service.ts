import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseServiceFacade } from '../../../database/supabase-service-facade';
import { RedisCacheService } from '../../../database/services/redis-cache.service';
import { PaymentAuditService } from './payment-audit-simple.service';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  // Petit cache mémoire pour les index de lookup (TTL court)
  private txToCustomerCache?: Map<string, any>;
  private ordIdToCustomerCache?: Map<string, any>;
  private indexCacheTs?: number;
  private readonly indexCacheTtlMs = parseInt(
    process.env.PAYMENTS_INDEX_CACHE_TTL_MS || '60000',
    10,
  ); // 60s par défaut

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
    from?: string; // ISO date string
    to?: string; // ISO date string
  }): Promise<any> {
    try {
      const { page = 1, limit = 10, status, from, to } = params;

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
        query += `&status=eq.${encodeURIComponent(status)}`;
      }
      if (from) {
        query += `&datepayment=gte.${encodeURIComponent(from)}`;
      }
      if (to) {
        query += `&datepayment=lte.${encodeURIComponent(to)}`;
      }
      query += `&limit=${limit}&offset=${(page - 1) * limit}`;

      const response = await fetch(query, { headers });

      if (!response.ok) {
        throw new Error(`Erreur API ic_postback: ${response.status}`);
      }

      const realPayments = await response.json();
      this.logger.log(`✅ ${realPayments.length} vrais paiements récupérés`);

      // DEBUG: Voir les vraies données récupérées
      if (realPayments.length > 0) {
        this.logger.log(
          `🔍 Premier paiement DEBUG:`,
          JSON.stringify(realPayments[0], null, 2),
        );
      }

      // 2. Extraire les IDs de commande pour enrichir avec les données clients
      // Essayer d'abord id_com, puis extraire depuis orderid si nécessaire
      const orderIds = [
        ...new Set(
          realPayments
            .map((payment: any) => {
              // Essayer id_com d'abord
              if (
                payment.id_com &&
                payment.id_com !== 'null' &&
                payment.id_com !== ''
              ) {
                return payment.id_com.toString();
              }

              // Fallback: extraire depuis orderid (ex: "278383-A" -> "278383")
              if (
                payment.orderid &&
                payment.orderid !== 'null' &&
                payment.orderid !== ''
              ) {
                const match = payment.orderid.toString().match(/^(\d+)/);
                return match ? match[1] : null;
              }

              return null;
            })
            .filter(
              (id: string | null) =>
                id && id !== 'null' && id !== '' && id !== 'undefined',
            ),
        ),
      ] as string[];

      this.logger.log(
        `🔗 ${orderIds.length} commandes uniques à enrichir avec données clients: [${orderIds.slice(0, 5).join(', ')}...]`,
      );

      // 3. Enrichir les vrais paiements avec les données clients directement
      const enrichedPayments = await this.enrichPaymentsWithCustomers(
        realPayments.map((payment: any) => ({
          id: payment.id_ic_postback,
          paymentId: payment.paymentid,
          transactionId: payment.transactionid,
          orderId: payment.id_com,
          orderReference: payment.orderid,
          id_com: payment.id_com,
          montantTotal: parseFloat(payment.amount || '0') / 100, // Diviser par 100 car stocké en centimes
          devise: payment.currency || 'EUR',
          statutPaiement: payment.status === 'OK' ? '1' : '0',
          methodePaiement: payment.paymentmethod || 'Non définie',
          dateCreation: payment.datepayment,
          datePaiement: payment.datepayment,
          ipAddress: payment.ip,
          ipSource: payment.ips,
        })),
      );

      this.logger.log(
        `🔗 Enrichissement terminé pour ${enrichedPayments.length} vrais paiements`,
      );

      return {
        success: true,
        payments: enrichedPayments,
        total: enrichedPayments.length,
        page,
        limit,
        filters: { status: status || null, from: from || null, to: to || null },
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
        filters: {
          status: params.status || null,
          from: params['from'] || null,
          to: params['to'] || null,
        },
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

      const totalAmountCents = paidPayments.reduce(
        (sum: number, payment: any) => {
          return sum + parseFloat(payment.amount || '0');
        },
        0,
      );
      // Harmoniser: renvoyer le total en euros
      const totalAmount = parseFloat(
        ((totalAmountCents || 0) / 100).toFixed(2),
      );

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

  /**
   * Enrichir les paiements avec les données clients en utilisant les tables de liaison
   */
  private async enrichPaymentsWithCustomers(payments: any[]): Promise<any[]> {
    if (!payments || payments.length === 0) {
      return payments;
    }

    try {
      this.logger.log(
        '🔗 Enrichissement optimisé des données clients pour les paiements...',
      );

      // Essayer de réutiliser les index mis en cache si non expirés
      let txToCustomer = this.txToCustomerCache;
      let ordIdToCustomer = this.ordIdToCustomerCache;
      const now = Date.now();
      const cacheValid =
        !!this.indexCacheTs &&
        now - (this.indexCacheTs as number) < this.indexCacheTtlMs;

      if (!txToCustomer || !ordIdToCustomer || !cacheValid) {
        // Charger un lot d'ordres déjà enrichis (inclut customer)
        const enrichedOrders: any[] =
          await this.redisCacheService.getCachedOrdersWithRelations(1, 2000);
        this.logger.log(
          `📦 Commandes enrichies chargées: ${Array.isArray(enrichedOrders) ? enrichedOrders.length : 0}`,
        );

        // Construire des index de lookup rapides
        txToCustomer = new Map<string, any>();
        ordIdToCustomer = new Map<string, any>();

        for (const order of enrichedOrders) {
          const customer = order?.customer || null;
          if (!customer) continue;

          let txId: string | undefined;
          // ord_info est souvent une string JSON, on la parse en sécurité
          try {
            if (order?.ord_info) {
              if (typeof order.ord_info === 'string') {
                const info = JSON.parse(order.ord_info);
                txId =
                  info?.transaction_id ||
                  info?.pay_transaction_id ||
                  info?.transactionId;
              } else if (typeof order.ord_info === 'object') {
                txId =
                  order.ord_info?.transaction_id ||
                  order.ord_info?.pay_transaction_id ||
                  order.ord_info?.transactionId;
              }
            }
          } catch (e) {
            // ignore parse error
          }

          const oid = order?.ord_id?.toString?.();

          if (txId && typeof txId === 'string') {
            txToCustomer.set(txId, customer);
          }
          if (oid) {
            ordIdToCustomer.set(oid, customer);
          }
        }

        // Stocker en cache mémoire avec TTL
        this.txToCustomerCache = txToCustomer;
        this.ordIdToCustomerCache = ordIdToCustomer;
        this.indexCacheTs = now;
      }

      // Helper pour formater un customer en nom/email
      const formatCustomer = (cust: any) => {
        if (!cust)
          return {
            id: null,
            name: 'Client introuvable',
            email: 'Email non disponible',
          };
        const id = cust.cst_id || cust.id || null;
        const first = cust.cst_fname || cust.cst_prenom || '';
        const last = cust.cst_name || cust.cst_nom || '';
        const name = `${first} ${last}`.trim() || 'Client anonyme';
        const email = cust.cst_mail || cust.cst_email || 'Email non disponible';
        return { id, name, email };
      };

      // Enrichir chaque paiement en priorisant la correspondance par transactionId puis par id_com/ord_id
      const enrichedPayments = (payments || []).map((payment: any) => {
        const txId = payment?.transactionId?.toString?.();
        const idComRaw = payment?.id_com?.toString?.();
        const orderRefRaw = payment?.orderReference?.toString?.();

        // Extraire la partie numérique quand présente (ex: "278383-A" -> "278383")
        const idFromIdCom = idComRaw?.match(/^(\d+)/)?.[1];
        const idFromOrderRef = orderRefRaw?.match(/^(\d+)/)?.[1];
        const idFromTxIfNumeric = txId?.match(/^(\d+)/)?.[1];

        // Correspondance prioritaire: transactionId exacte (issue d'ord_info)
        let customer = (txId && txToCustomer.get(txId)) || null;

        // Fallbacks: tenter via ord_id avec les différentes sources numériques
        if (!customer) {
          const candidates = [
            idFromIdCom,
            idFromOrderRef,
            idFromTxIfNumeric,
          ].filter(Boolean) as string[];
          for (const cid of candidates) {
            const found = ordIdToCustomer.get(cid);
            if (found) {
              customer = found;
              break;
            }
          }
        }

        const { id, name, email } = formatCustomer(customer);

        return {
          ...payment,
          customerId: id,
          customerName: name,
          customerEmail: email,
        };
      });

      this.logger.log(
        `✅ Enrichissement terminé pour ${enrichedPayments.length} paiements`,
      );
      return enrichedPayments;
    } catch (error) {
      this.logger.error('❌ Erreur globale enrichissement clients:', error);
      return payments.map((payment) => ({
        ...payment,
        customerId: null,
        customerName: 'Client introuvable',
        customerEmail: 'Email non disponible',
      }));
    }
  }

  /**
   * Invalidation des caches (mémoire + Redis)
   */
  async invalidateCaches(): Promise<{ memory: boolean; redis: boolean }> {
    try {
      // Mémoire
      this.txToCustomerCache = undefined;
      this.ordIdToCustomerCache = undefined;
      this.indexCacheTs = undefined;

      // Redis (commande enrichies)
      await this.redisCacheService.invalidateOrderCache();
      this.logger.log('🧹 Caches invalidés (mémoire + Redis)');
      return { memory: true, redis: true };
    } catch (e) {
      this.logger.error("❌ Erreur lors de l'invalidation des caches", e);
      return { memory: false, redis: false };
    }
  }
}
