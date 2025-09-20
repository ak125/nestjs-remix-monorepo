import { Injectable } from '@nestjs/common';
import { SupabaseBaseService } from './supabase-base.service';

export interface Order {
  ord_id: string;
  ord_cst_id: string;
  ord_ords_id: string;
  ord_cba_id?: string;
  ord_cda_id?: string;
  ord_date: string;
  ord_amount_ttc: string;
  ord_total_ttc: string;
  ord_is_pay: string;
  ord_date_pay?: string;
  ord_info?: string;
}

@Injectable()
export class OrderService extends SupabaseBaseService {
  constructor() {
    super();
  }

  /**
   * Récupérer les commandes avec toutes leurs relations - VERSION OPTIMISÉE
   */
  async getOrdersWithAllRelations(
    page: number = 1,
    limit: number = 10,
    filters?: {
      status?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<{ orders: any[]; total: number }> {
    try {
      console.log(`🔍 getOrdersWithAllRelations: page=${page}, limit=${limit}`);

      const offset = (page - 1) * limit;

      // Construire la requête avec tous les filtres
      let query = `${this.baseUrl}/___xtr_order?select=*`;

      if (filters?.status) {
        query += `&ord_ords_id=eq.${filters.status}`;
      }
      if (filters?.customerId) {
        query += `&ord_cst_id=eq.${filters.customerId}`;
      }
      if (filters?.dateFrom) {
        query += `&ord_date=gte.${filters.dateFrom}`;
      }
      if (filters?.dateTo) {
        query += `&ord_date=lte.${filters.dateTo}`;
      }

      query += `&order=ord_date.desc&offset=${offset}&limit=${limit}`;

      console.log(`📡 Query: ${query}`);

      const response = await fetch(query, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur Supabase:', response.status, response.statusText);
        return { orders: [], total: 0 };
      }

      const orders = await response.json();

      // 🚀 ENRICHISSEMENT : Ajouter les données de relation customer
      try {
        console.log(
          `🔗 Enrichissement des ${orders.length} commandes avec données client...`,
        );

        // Récupérer tous les IDs clients uniques
        const customerIds = [
          ...new Set(
            orders.map((order: any) => order.ord_cst_id).filter(Boolean),
          ),
        ];
        console.log(`👥 ${customerIds.length} clients uniques à récupérer`);

        // Récupérer les données clients en une seule requête
        const customersMap = new Map();
        if (customerIds.length > 0) {
          const customerQuery = `${this.baseUrl}/___xtr_customer?select=*&cst_id=in.(${customerIds.join(',')})`;
          const customerResponse = await fetch(customerQuery, {
            method: 'GET',
            headers: this.headers,
          });

          if (customerResponse.ok) {
            const customers = await customerResponse.json();
            customers.forEach((customer: any) => {
              customersMap.set(customer.cst_id, customer);
            });
            console.log(`✅ ${customers.length} clients récupérés`);
          }
        }

        // Enrichir chaque commande avec ses données client
        const enrichedOrders = orders.map((order: any) => {
          const customer = customersMap.get(order.ord_cst_id);
          return {
            ...order,
            customer: customer
              ? {
                  cst_id: customer.cst_id,
                  cst_name: customer.cst_name,
                  cst_fname: customer.cst_fname,
                  cst_mail: customer.cst_mail,
                  cst_phone: customer.cst_phone,
                  cst_activ: customer.cst_activ,
                }
              : null,
          };
        });

        // Compter le total
        const total = await this._getTotalOrdersCount(filters);

        console.log(
          `✅ ENRICHISSEMENT RÉUSSI: ${enrichedOrders.length}/${total} commandes enrichies avec données clients`,
        );

        return {
          orders: enrichedOrders,
          total: total,
        };
      } catch (batchError) {
        console.error(
          '❌ Erreur batch optimization, fallback vers données simples:',
          batchError,
        );

        // Fallback: retourner les commandes sans enrichissement
        const fallbackOrders = orders.map((order: any) => ({
          ...order,
          statusDetails: null,
          customer: null,
          billingAddress: null,
          deliveryAddress: null,
          orderLines: [],
          totalLines: 0,
          totalQuantity: 0,
          _fallback_mode: true,
        }));

        const total = await this._getTotalOrdersCount(filters);
        return {
          orders: fallbackOrders,
          total: total,
        };
      }
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des commandes enrichies:',
        error,
      );
      return { orders: [], total: 0 };
    }
  }

  /**
   * Compter le nombre total de commandes
   */
  private async _getTotalOrdersCount(filters?: any): Promise<number> {
    try {
      let countQuery = `${this.baseUrl}/___xtr_order?select=count`;

      if (filters?.status) {
        countQuery += `&ord_ords_id=eq.${filters.status}`;
      }
      if (filters?.customerId) {
        countQuery += `&ord_cst_id=eq.${filters.customerId}`;
      }
      if (filters?.dateFrom) {
        countQuery += `&ord_date=gte.${filters.dateFrom}`;
      }
      if (filters?.dateTo) {
        countQuery += `&ord_date=lte.${filters.dateTo}`;
      }

      const countResponse = await fetch(countQuery, {
        method: 'GET',
        headers: this.headers,
      });

      if (countResponse.ok) {
        const countResult = await countResponse.json();
        return countResult[0]?.count || 0;
      }
    } catch (error) {
      console.error('Erreur comptage commandes:', error);
    }
    return 0;
  }

  /**
   * Récupérer les commandes d'un client
   */
  async getOrdersByCustomerId(customerId: string): Promise<Order[]> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_cst_id=eq.${customerId}&select=*&order=ord_date.desc`;
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
      });

      if (!response.ok) {
        console.error('Erreur récupération commandes client:', response.status);
        return [];
      }

      const orders = await response.json();
      return orders;
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des commandes client:',
        error,
      );
      return [];
    }
  }

  /**
   * Mettre à jour une commande
   */
  async updateOrder(
    orderId: string,
    updates: Partial<Order>,
  ): Promise<Order | null> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        console.error('Erreur mise à jour commande:', response.status);
        return null;
      }

      const updatedOrders = await response.json();
      return updatedOrders[0] || null;
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la commande:', error);
      return null;
    }
  }

  /**
   * Créer une nouvelle commande
   */
  async createOrder(orderData: Partial<Order>): Promise<Order | null> {
    try {
      const url = `${this.baseUrl}/___xtr_order`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        console.error('Erreur création commande:', response.status);
        return null;
      }

      const createdOrders = await response.json();
      return createdOrders[0] || null;
    } catch (error) {
      console.error('Erreur lors de la création de la commande:', error);
      return null;
    }
  }

  /**
   * Supprimer une commande
   */
  async deleteOrder(orderId: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/___xtr_order?ord_id=eq.${orderId}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.headers,
      });

      return response.ok;
    } catch (error) {
      console.error('Erreur lors de la suppression de la commande:', error);
      return false;
    }
  }

  /**
   * Statistiques des commandes
   */
  async getOrderStats(): Promise<{ totalOrders: number }> {
    try {
      const totalOrdersResponse = await fetch(
        `${this.baseUrl}/___xtr_order?select=count`,
        {
          method: 'GET',
          headers: this.headers,
        },
      );

      const totalOrders = await totalOrdersResponse.json();

      return {
        totalOrders: totalOrders[0]?.count || 0,
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      return { totalOrders: 0 };
    }
  }

  /**
   * Alias pour getOrdersWithAllRelations (utilisé par le contrôleur)
   */
  async getOrdersWithDetails(
    page: number = 1,
    limit: number = 10,
    status?: string,
    search?: string,
  ): Promise<{ orders: any[]; total: number; stats?: any }> {
    const filters = {
      status,
      search,
      customerId: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    };

    const result = await this.getOrdersWithAllRelations(page, limit, filters);

    return {
      orders: result.orders,
      total: result.total,
      stats: {
        total: result.total,
        paid: result.orders.filter((o: any) => o.ord_is_pay === '1').length,
        pending: result.orders.filter((o: any) => o.ord_is_pay !== '1').length,
        revenue: result.orders.reduce(
          (sum: number, o: any) => sum + (parseFloat(o.ord_total_ttc) || 0),
          0,
        ),
      },
    };
  }
}
