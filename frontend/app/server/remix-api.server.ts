/**
 * Point d'entrée côté serveur pour l'intégration Remix <-> NestJS (Ultra-simplifié)
 * Ce fichier ne doit être importé que dans les loaders et actions de Remix.
 * Remplacement ultra-allégé de remix-integration.server.ts
 */
import "reflect-metadata";
import { type AppLoadContext } from "@remix-run/node";

/**
 * Récupère une instance du service API Remix ultra-simplifié.
 * Gère le bootstrap de l'application NestJS si nécessaire.
 */
export async function getRemixApiService(
  context: AppLoadContext
): Promise<any> {
  // Si le backend Nest a déjà injecté le service dans le contexte, on l'utilise directement
  const ctx: any = context as any;
  
  console.log('[getRemixApiService] Context keys:', Object.keys(ctx));
  console.log('[getRemixApiService] remixIntegration available:', !!ctx.remixIntegration);
  console.log('[getRemixApiService] remixService available:', !!ctx.remixService);
  
  if (ctx.remixIntegration) {
    console.log('[getRemixApiService] Using remixIntegration:', Object.keys(ctx.remixIntegration));
    return ctx.remixIntegration;
  }
  if (ctx.remixService?.integration) {
    console.log('[getRemixApiService] Using remixService.integration:', Object.keys(ctx.remixService.integration));
    return ctx.remixService.integration;
  }
  if (ctx.remixService) {
    console.log('[getRemixApiService] Using remixService directly:', Object.keys(ctx.remixService));
    return ctx.remixService;
  }

  console.log('[getRemixApiService] Creating fallback API service');

  // Fallback minimal basé sur appels HTTP (utile pour tests locaux sans contexte complet)
  const baseUrl = process.env.INTERNAL_API_BASE_URL || "http://localhost:3000";
  
  console.log('[RemixApiService] Base URL utilisée:', baseUrl);

  const makeApiCall = async (endpoint: string) => {
    const fullUrl = `${baseUrl}${endpoint}`;
    console.log('[makeApiCall] Appel vers:', fullUrl);
    
    // Préparer les headers avec authentification si disponible
    const headers: Record<string, string> = { 
      "Internal-Call": "true",
      "Content-Type": "application/json"
    };
    
    // Transmettre les informations d'authentification du contexte
    if (ctx.user) {
      headers["X-User-Id"] = String(ctx.user.id || ctx.user.usr_id);
      headers["X-User-Email"] = String(ctx.user.email || ctx.user.usr_email);
      headers["X-User-Level"] = String(ctx.user.level || ctx.user.usr_level || 1);
      console.log('[makeApiCall] Auth headers ajoutés pour utilisateur:', ctx.user.email);
    }
    
    try {
      const res = await fetch(fullUrl, {
        headers,
      });
      
      console.log('[makeApiCall] Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[makeApiCall] Erreur HTTP:', res.status, errorText);
        throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
      }
      
      const data = await res.json();
      console.log('[makeApiCall] Success data keys:', Object.keys(data));
      return data;
    } catch (error) {
      console.error('[makeApiCall] Erreur fetch:', error);
      throw error;
    }
  };

  const api = {
    makeApiCall,
    getOrdersForRemix: (params: any) => {
      const { page = 1, limit = 20, status, search } = params || {};
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(status ? { status } : {}),
        ...(search ? { search } : {}),
      });
      return makeApiCall(`/api/admin/orders?${q}`);
    },
    getUsersForRemix: (params: any) => {
      const { page = 1, limit = 10, search, level } = params || {};
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(level ? { level: String(level) } : {}),
      });
      return makeApiCall(`/api/legacy-users?${q}`);
    },
    getSuppliersForRemix: (params: any) => {
      const { page = 1, limit = 20, search } = params || {};
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
      });
      
      console.log('[getSuppliersForRemix] Params:', params);
      console.log('[getSuppliersForRemix] Query:', q.toString());
      console.log('[getSuppliersForRemix] URL:', `/api/suppliers?${q}`);
      
      return makeApiCall(`/api/suppliers?${q}`)
        .then((data) => {
          console.log('[getSuppliersForRemix] Success data:', data);
          return {
            success: true,
            suppliers: data.suppliers || [],
            pagination: data.pagination || { page: 1, totalPages: 1, total: 0 },
            total: data.pagination?.total || 0,
          };
        })
        .catch((error) => {
          console.error('[getSuppliersForRemix] Error:', error);
          return {
            success: false,
            error: error.message,
            suppliers: [],
            pagination: { page: 1, totalPages: 1, total: 0 },
            total: 0,
          };
        });
    },
    getPayments: async (params: any) => {
      // Proxy simple via orders
      const orders: any = await api.getOrdersForRemix(params);
      const payments = (orders?.orders || []).map((o: any) => ({
        id: o.ord_id,
        orderId: o.ord_id,
        customerId: o.ord_cst_id,
        amount: parseFloat(o.ord_total_ttc?.toString() || "0"),
        currency: "EUR",
        status: o.ord_is_pay?.toString() || "0",
        gateway: "unknown",
        createdAt: o.ord_date || new Date().toISOString(),
      }));
      return {
        success: true,
        payments,
        total: orders?.total || 0,
        page: params?.page || 1,
        totalPages: Math.ceil((orders?.total || 0) / (params?.limit || 20)),
      };
  },
  getDashboardStats: async () => {
      try {
        const orders: any = await makeApiCall(`/api/legacy-orders?page=1&limit=1`);
        const users: any = await makeApiCall(`/api/legacy-users?page=1&limit=1`);
        return {
          success: true,
          stats: {
            totalOrders: orders.pagination?.total || orders.total || orders.totalOrders || 0,
            totalUsers: users.pagination?.total || users.total || users.totalUsers || 0,
            activeUsers: 0,
            pendingOrders: 0,
            totalRevenue: 0,
            weeklyRevenue: 0,
            averageOrderValue: 0,
            conversionRate: 0,
            lowStockItems: 0,
          },
        };
      } catch (e) {
        return {
          success: false,
          stats: {
            totalOrders: 0,
            totalUsers: 0,
            activeUsers: 0,
            pendingOrders: 0,
            totalRevenue: 0,
            weeklyRevenue: 0,
            averageOrderValue: 0,
            conversionRate: 0,
            lowStockItems: 0,
          },
        };
      }
    },

    // 🛒 Méthodes Cart ajoutées pour corriger l'intégration Remix
    getCartForRemix: async (userId: string) => {
      try {
        console.log('[getCartForRemix] Getting cart for user:', userId);
        const cartData = await makeApiCall(`/api/cart?userId=${userId}`);
        
        return {
          success: true,
          cart: {
            items: cartData.data?.items || [],
            summary: cartData.data || {
              total_items: 0,
              total_quantity: 0,
              subtotal: 0,
              total: 0,
              currency: 'EUR'
            }
          }
        };
      } catch (error) {
        console.error('[getCartForRemix] Erreur:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          cart: {
            items: [],
            summary: {
              total_items: 0,
              total_quantity: 0,
              subtotal: 0,
              total: 0,
              currency: 'EUR'
            }
          }
        };
      }
    },

    addToCartForRemix: async (params: { productId: number; quantity: number; userId: string; notes?: string }) => {
      try {
        console.log('[addToCartForRemix] Adding item:', params);
        const response = await fetch(`${baseUrl}/api/cart/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Internal-Call': 'true'
          },
          body: JSON.stringify({
            product_id: params.productId,
            quantity: params.quantity,
            notes: params.notes || ''
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          success: true,
          message: 'Article ajouté au panier avec succès',
          data
        };
      } catch (error) {
        console.error('[addToCartForRemix] Erreur:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          message: 'Erreur lors de l\'ajout au panier'
        };
      }
    },

    updateCartItemForRemix: async (params: { itemId: number; quantity: number; userId: string }) => {
      try {
        console.log('[updateCartItemForRemix] Updating item:', params);
        const response = await fetch(`${baseUrl}/api/cart/${params.itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Internal-Call': 'true'
          },
          body: JSON.stringify({
            quantity: params.quantity
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          success: true,
          message: 'Article mis à jour avec succès',
          data
        };
      } catch (error) {
        console.error('[updateCartItemForRemix] Erreur:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          message: 'Erreur lors de la mise à jour'
        };
      }
    },

    removeCartItemForRemix: async (params: { itemId: number; userId: string }) => {
      try {
        console.log('[removeCartItemForRemix] Removing item:', params);
        const response = await fetch(`${baseUrl}/api/cart/${params.itemId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Internal-Call': 'true'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          success: true,
          message: 'Article supprimé avec succès',
          data
        };
      } catch (error) {
        console.error('[removeCartItemForRemix] Erreur:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          message: 'Erreur lors de la suppression'
        };
      }
    },

    clearCartForRemix: async (userId: string) => {
      try {
        console.log('[clearCartForRemix] Clearing cart for user:', userId);
        const response = await fetch(`${baseUrl}/api/cart/clear`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Internal-Call': 'true'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return {
          success: true,
          message: 'Panier vidé avec succès',
          data
        };
      } catch (error) {
        console.error('[clearCartForRemix] Erreur:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          message: 'Erreur lors du vidage du panier'
        };
      }
    },
    getOrderDetail: async (orderId: string, customerId: string) => {
      console.log('[getOrderDetail] Récupération commande:', orderId, 'pour client:', customerId);
      
      try {
        const endpoint = `/api/legacy-orders/${orderId}`;
        const data = await makeApiCall(endpoint);
        
        if (!data.success) {
          throw new Error(data.error || 'Commande non trouvée');
        }

        // Transformer les données pour correspondre au format attendu par le frontend
        const order = data.data;
        const orderInfo = order.ord_info ? JSON.parse(order.ord_info) : {};

        return {
          id: order.ord_id,
          orderNumber: `ORD-${order.ord_id}`,
          status: orderInfo.status || (order.ord_is_pay === '1' ? 6 : 2),
          paymentStatus: order.ord_is_pay === '1' ? 'paid' : 'pending',
          createdAt: order.ord_date,
          totalTTC: parseFloat(order.ord_total_ttc),
          
          // Adresses (données de test)
          shippingAddress: orderInfo.shipping_address || {
            firstName: order.customer?.cst_fname || 'Client',
            lastName: order.customer?.cst_name || 'Test',
            address1: '123 Rue de la Paix',
            city: 'Paris',
            postalCode: '75001',
            country: 'France'
          },
          
          billingAddress: orderInfo.billing_address || {
            firstName: order.customer?.cst_fname || 'Client', 
            lastName: order.customer?.cst_name || 'Test',
            address1: '123 Rue de la Paix',
            city: 'Paris',
            postalCode: '75001',
            country: 'France'
          },

          // Articles (données de test)
          lines: orderInfo.items || [
            {
              id: `line_${order.ord_id}_1`,
              productName: 'Produit Test',
              quantity: 1,
              unitPrice: parseFloat(order.ord_total_ttc),
              totalPrice: parseFloat(order.ord_total_ttc),
              status: orderInfo.status || 2
            }
          ],

          // Historique de statut
          statusHistory: orderInfo.statusHistory || [
            {
              status: 1,
              label: 'Commande reçue',
              date: order.ord_date,
              isActive: true
            }
          ],

          // Méthodes de paiement et livraison
          paymentMethod: orderInfo.payment_gateway || 'Carte bancaire',
          transactionId: orderInfo.transaction_id,
          
          // Totaux
          subtotalHT: parseFloat(order.ord_total_ttc) * 0.833, // approximation TTC -> HT
          tva: parseFloat(order.ord_total_ttc) * 0.167,
          shippingFee: 0,
          
          // Flags
          hasReview: false,
          canReturn: orderInfo.status === 6
        };
      } catch (error) {
        console.error('[getOrderDetail] Erreur:', error);
        throw error;
      }
    },

    // 👥 Méthodes Staff ajoutées pour corriger l'intégration Remix
    getStaff: async (params: any) => {
      try {
        const { page = 1, limit = 20, status, department, search } = params || {};
        const q = new URLSearchParams({
          page: String(page),
          limit: String(limit),
          ...(status ? { status } : {}),
          ...(department ? { department } : {}),
          ...(search ? { search } : {}),
        });

        console.log('[getStaff] Params:', params);
        console.log('[getStaff] Query:', q.toString());
        console.log('[getStaff] URL:', `/api/admin/staff?${q}`);

        const data = await makeApiCall(`/api/admin/staff?${q}`);
        
        return {
          success: true,
          staff: data.data?.staff || [],
          pagination: data.data?.pagination || { page: 1, totalPages: 1, total: 0 },
          total: data.data?.total || 0,
        };
      } catch (error) {
        console.error('[getStaff] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          staff: [],
          pagination: { page: 1, totalPages: 1, total: 0 },
          total: 0,
        };
      }
    },

    getStaffStatistics: async () => {
      try {
        console.log('[getStaffStatistics] Récupération des statistiques staff');
        
        const data = await makeApiCall('/api/admin/staff/stats');
        
        return {
          success: true,
          statistics: data.data || {
            total: 0,
            active: 0,
            inactive: 0,
            departments: 0,
            byLevel: {},
            byDepartment: {}
          },
        };
      } catch (error) {
        console.error('[getStaffStatistics] Error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          statistics: {
            total: 0,
            active: 0,
            inactive: 0,
            departments: 0,
            byLevel: {},
            byDepartment: {}
          },
        };
      }
    },
  };

  return api;
}
