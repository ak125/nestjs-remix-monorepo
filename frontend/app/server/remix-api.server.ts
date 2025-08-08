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
  if (ctx.remixIntegration) return ctx.remixIntegration;
  if (ctx.remixService?.integration) return ctx.remixService.integration;

  // Fallback minimal basé sur appels HTTP (utile pour tests locaux sans contexte complet)
  const baseUrl = process.env.INTERNAL_API_BASE_URL || "http://localhost:3000";

  const makeApiCall = async (endpoint: string) => {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      headers: { "Internal-Call": "true" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
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
      return makeApiCall(`/api/orders/admin/all-relations?${q}`);
    },
    getUsersForRemix: (params: any) => {
      const { page = 1, limit = 10, search, level } = params || {};
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search ? { search } : {}),
        ...(level ? { level: String(level) } : {}),
      });
      return makeApiCall(`/api/users?${q}`);
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
        const orders: any = await makeApiCall(`/api/orders?page=1&limit=1`);
        const users: any = await makeApiCall(`/api/users?page=1&limit=1`);
        return {
          success: true,
          stats: {
            totalOrders: orders.totalOrders || orders.total || 0,
            totalUsers: users.totalUsers || users.total || 0,
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
  };

  return api;
}
