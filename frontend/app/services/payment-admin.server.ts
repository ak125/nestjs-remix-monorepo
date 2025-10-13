import { type Payment, type PaymentStats, PaymentStatus } from "../types/payment";

/**
 * Obtenir l'URL du backend à partir des variables d'environnement
 */
function getBackendUrl(): string {
  return process.env.BACKEND_URL || 'http://localhost:3000';
}

/**
 * Service côté serveur pour la gestion admin des paiements
 */

export interface AdminPaymentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
}

export interface AdminPaymentListResult {
  payments: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: PaymentStats;
}

/**
 * Récupérer un paiement spécifique par ID (basé sur les commandes)
 */
export async function getPaymentById(id: string): Promise<Payment | null> {
  try {
    // Extraire l'ID de commande du payment ID
    const orderId = id.replace('payment_', '');
    
    const response = await fetch(`http://localhost:3000/api/legacy-orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch payment: ${response.statusText}`);
    }

    const result = await response.json();
    const order = result.data;

    // Convertir la commande en données de paiement (format BDD)
    return {
      id: `payment_${order.ord_id}`,
      orderId: order.ord_id,
      userId: order.ord_cst_id,
      amount: parseFloat(order.ord_total_ttc || '0'),
      currency: 'EUR',
      status: order.ord_is_pay === '1' ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
      paymentMethod: 'stripe',
      transactionId: order.ord_id,
      createdAt: order.ord_date || new Date().toISOString(),
      updatedAt: order.ord_date || new Date().toISOString(),
      gatewayData: order.ord_info ? (() => {
        try {
          return JSON.parse(order.ord_info);
        } catch {
          return {};
        }
      })() : {},
    };
  } catch (error) {
    console.error(`❌ Failed to fetch payment ${id}:`, error);
    return null;
  }
}

/**
 * Récupérer la liste des paiements pour l'admin (basé sur les commandes)
 */
export async function getAdminPayments(params: AdminPaymentListParams = {}): Promise<AdminPaymentListResult> {
  try {
    const { page = 1, limit = 10, search = '', status = '' } = params;
    
    // Utiliser l'API legacy orders car les paiements sont intégrés aux commandes
    const response = await fetch(
      `http://localhost:3000/api/legacy-orders?page=${page}&limit=${limit}${search ? `&search=${search}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('🔧 DEBUG - Orders data structure:', {
      success: data.success,
      dataLength: data.data?.length,
      firstOrder: data.data?.[0],
      pagination: data.pagination
    });
    
    // ✅ Le filtrage est maintenant géré côté BACKEND (excludePending=true par défaut)
    // Plus besoin de filtrer ici, toutes les commandes reçues sont déjà payées et confirmées
    const orders = data.data || [];
    
    console.log('🔧 DEBUG - Orders received (already filtered by backend):', {
      ordersCount: orders.length,
      paginationTotal: data.pagination?.total,
    });
    
    // Convertir les commandes en données de paiement (format BDD)
    const payments: Payment[] = orders.map((order: any) => {
      // Extraire le nom du client
      const customer = order.customer;
      const customerName = customer 
        ? `${customer.cst_fname || ''} ${customer.cst_name || ''}`.trim() || `Client #${order.ord_cst_id}`
        : `Client #${order.ord_cst_id}`;
      const customerEmail = customer?.cst_mail || '';

      // ✨ Extraire la vraie méthode de paiement depuis ic_postback
      const postback = order.postback;
      const paymentMethod = postback?.paymentmethod || 'card'; // card, paypal, etc.
      const transactionId = postback?.transactionid || order.ord_id;
      const paymentDate = postback?.datepayment || order.ord_date;

      return {
        id: `payment_${order.ord_id}`,
        orderId: order.ord_id,
        userId: order.ord_cst_id,
        customerName,
        customerEmail,
        amount: parseFloat(order.ord_total_ttc || '0'),
        currency: 'EUR',
        status: order.ord_is_pay === '1' ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
        paymentMethod, // ✨ Vraie méthode depuis ic_postback
        transactionId, // ✨ Vrai ID transaction
        createdAt: order.ord_date || new Date().toISOString(),
        updatedAt: paymentDate || new Date().toISOString(),
        gatewayData: postback || {}, // ✨ Données réelles du postback
      };
    });

    // ✅ Utiliser directement la pagination du backend (déjà ajustée aux filtres)
    return {
      payments,
      pagination: {
        page: data.pagination?.page || page,
        limit: data.pagination?.limit || limit,
        total: data.pagination?.total || 0, // Total ajusté aux filtres backend
        totalPages: Math.ceil((data.pagination?.total || 0) / limit),
        hasNext: page < Math.ceil((data.pagination?.total || 0) / limit),
        hasPrev: page > 1,
      },
      stats: await getPaymentStats(), // Sera calculé séparément
    };
  } catch (error) {
    console.error('❌ Failed to fetch admin payments:', error);
    throw error;
  }
}

/**
 * Récupère les statistiques des paiements pour le dashboard admin (basé sur les commandes)
 */
export async function getPaymentStats(): Promise<PaymentStats> {
  try {
    // Utiliser l'API legacy orders stats
    const response = await fetch(
      `http://localhost:3000/api/legacy-orders/stats`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch payment stats: ${response.statusText}`);
    }

    const data = await response.json();
    const stats = data.data;

    return {
      totalRevenue: stats.totalRevenue || 0,
      totalTransactions: stats.totalOrders || 0,
      successRate: stats.totalOrders > 0 ? (stats.paidOrders / stats.totalOrders) * 100 : 0,
      averageAmount: stats.averageOrderValue || 0,
      monthlyGrowth: 0, // Pas disponible dans les stats actuelles
      statusDistribution: {
        completed: stats.paidOrders || 0,
        pending: stats.pendingOrders || 0,
        failed: 0,
        cancelled: 0,
        refunded: 0,
      },
      methodDistribution: {
        cyberplus: 0, // Ces données ne sont pas disponibles dans l'API legacy
        paypal: 0,
        bank_transfer: 0,
      },
      recentPayments: [], // Sera rempli par une autre requête si nécessaire
    };
  } catch (error) {
    console.error('❌ Failed to fetch payment stats:', error);
    // Retourner des stats par défaut en cas d'erreur
    return {
      totalRevenue: 0,
      totalTransactions: 0,
      successRate: 0,
      averageAmount: 0,
      monthlyGrowth: 0,
      statusDistribution: {
        completed: 0,
        pending: 0,
        failed: 0,
        cancelled: 0,
        refunded: 0,
      },
      methodDistribution: {
        cyberplus: 0,
        paypal: 0,
        bank_transfer: 0,
      },
      recentPayments: [],
    };
  }
}

/**
 * Récupère un paiement spécifique pour l'admin
 */
export async function getAdminPayment(paymentId: string): Promise<Payment> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/admin/payments/${paymentId}`,
      {
        headers: {
          'Internal-Call': 'true',
          'X-Admin-Request': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch payment: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('❌ Failed to fetch payment:', error);
    throw error;
  }
}

/**
 * Met à jour le statut d'un paiement (admin seulement)
 */
export async function updatePaymentStatus(
  paymentId: string,
  status: string,
  reason?: string
): Promise<Payment> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/admin/payments/${paymentId}/status`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
          'X-Admin-Request': 'true',
        },
        body: JSON.stringify({
          status,
          reason,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update payment status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('❌ Failed to update payment status:', error);
    throw error;
  }
}

/**
 * Traite un remboursement (admin seulement)
 */
export async function processRefund(
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<{ success: boolean; refundId?: string; message: string }> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/admin/payments/${paymentId}/refund`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Internal-Call': 'true',
          'X-Admin-Request': 'true',
        },
        body: JSON.stringify({
          amount,
          reason,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to process refund: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Failed to process refund:', error);
    throw error;
  }
}

/**
 * Exporte les données de paiement (admin seulement)
 */
export async function exportPayments(
  filters: AdminPaymentListParams = {},
  format: 'csv' | 'xlsx' = 'csv'
): Promise<Blob> {
  try {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams.append(key, value.toString());
    });
    
    queryParams.append('format', format);

    const response = await fetch(
      `${process.env.BACKEND_URL}/api/admin/payments/export?${queryParams}`,
      {
        headers: {
          'Internal-Call': 'true',
          'X-Admin-Request': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to export payments: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error('❌ Failed to export payments:', error);
    throw error;
  }
}

/**
 * Récupère les transactions Cyberplus pour debug/test (admin seulement)
 */
export async function getCyberplusTransactions(
  startDate?: string,
  endDate?: string
): Promise<any[]> {
  try {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    const response = await fetch(
      `${process.env.BACKEND_URL}/api/admin/payments/cyberplus/transactions?${queryParams}`,
      {
        headers: {
          'Internal-Call': 'true',
          'X-Admin-Request': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch Cyberplus transactions: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('❌ Failed to fetch Cyberplus transactions:', error);
    return [];
  }
}

/**
 * Test de connexion Cyberplus (admin seulement)
 */
export async function testCyberplusConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/admin/payments/cyberplus/test`,
      {
        method: 'POST',
        headers: {
          'Internal-Call': 'true',
          'X-Admin-Request': 'true',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Cyberplus test failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Cyberplus test failed:', error);
    return {
      success: false,
      message: `Test échoué: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
    };
  }
}
