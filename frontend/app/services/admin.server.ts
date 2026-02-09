/**
 * 🔧 Service Admin Dashboard - Intégration Backend
 *
 * Service optimisé pour récupérer les données du dashboard admin
 * Compatible avec l'architecture NestJS existante
 */

import { logger } from "~/utils/logger";

// Types pour l'API Response standardisée
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

// Types pour les statistiques dashboard
export interface StockStats {
  totalProducts: number;
  outOfStock: number;
  lowStock: number;
  overstock: number;
  avgStockLevel: number;
  totalValue?: number;
  turnoverRate?: number;
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  todayCount: number;
  monthlyRevenue: number;
}

export interface StockAlert {
  id: string;
  product_id: string;
  alert_type: "OUT_OF_STOCK" | "LOW_STOCK" | "OVERSTOCK";
  alert_level: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  resolved: boolean;
  created_at: string;
  stock?: {
    available: number;
    min_stock: number;
    pieces?: {
      id: string;
      reference: string;
      name: string;
    };
  };
}

export interface DashboardData {
  stock: StockStats;
  orders: OrderStats;
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
  stockAlerts: StockAlert[];
  recentOrders: Record<string, unknown>[];
  recentActivities: Record<string, unknown>[];
}

interface StockItem {
  pieces?: { price?: number };
  price?: number;
  available?: number;
  quantity?: number;
  min_stock?: number;
}

/**
 * Récupère les données du dashboard admin
 * Utilise les endpoints NestJS avec gestion d'erreurs robuste
 */
export async function getAdminDashboard(
  request?: Request,
): Promise<DashboardData> {
  const baseUrl = process.env.BACKEND_URL || "http://localhost:3000";
  const headers = {
    "Content-Type": "application/json",
    ...(request?.headers.get("Cookie") && {
      Cookie: request.headers.get("Cookie")!,
    }),
  };

  try {
    logger.log("🔄 Récupération des données dashboard admin...");

    // Paralléliser les appels API pour optimiser les performances
    const [stockResult, ordersResult, alertsResult] = await Promise.allSettled([
      fetchStockData(baseUrl, headers),
      fetchOrdersData(baseUrl, headers),
      fetchAlertsData(baseUrl, headers),
    ]);

    // Traitement des résultats avec fallbacks
    const stockData =
      stockResult.status === "fulfilled"
        ? stockResult.value
        : getDefaultStockData();
    const ordersData =
      ordersResult.status === "fulfilled"
        ? ordersResult.value
        : getDefaultOrdersData();
    const alertsData =
      alertsResult.status === "fulfilled"
        ? alertsResult.value
        : { alerts: [], counts: { critical: 0, warning: 0, info: 0 } };

    logger.log("✅ Données dashboard récupérées avec succès");

    return {
      stock: stockData,
      orders: ordersData,
      alerts: alertsData.counts,
      stockAlerts: alertsData.alerts,
      recentOrders: [], // À implémenter selon besoins
      recentActivities: [], // À implémenter selon besoins
    };
  } catch (error) {
    logger.error(
      "❌ Erreur lors de la récupération des données dashboard:",
      error,
    );
    return getDefaultDashboardData();
  }
}

/**
 * Récupère les données de stock via l'API NestJS
 */
async function fetchStockData(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<StockStats> {
  try {
    const response = await fetch(`${baseUrl}/admin/stock/dashboard`, {
      headers,
      // Timeout de 5 secondes
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ApiResponse<{ items: StockItem[]; stats: StockStats }> =
      await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    // Calculer la valeur totale du stock si pas fournie
    const stockValue =
      result.data.stats.totalValue || calculateStockValue(result.data.items);

    return {
      ...result.data.stats,
      totalValue: stockValue,
      turnoverRate:
        result.data.stats.turnoverRate ||
        calculateTurnoverRate(result.data.items),
    };
  } catch (error) {
    logger.warn("⚠️ Échec récupération données stock:", error);
    return getDefaultStockData();
  }
}

/**
 * Récupère les données de commandes
 */
async function fetchOrdersData(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<OrderStats> {
  try {
    const response = await fetch(`${baseUrl}/api/legacy-orders/stats`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      totalOrders: result.totalOrders || 0,
      pendingOrders: result.pendingOrders || 0,
      todayCount: result.todayCount || 0,
      monthlyRevenue: result.monthlyRevenue || 0,
    };
  } catch (error) {
    logger.warn("⚠️ Échec récupération données commandes:", error);
    return getDefaultOrdersData();
  }
}

/**
 * Récupère les alertes de stock
 */
async function fetchAlertsData(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<{
  alerts: StockAlert[];
  counts: { critical: number; warning: number; info: number };
}> {
  try {
    const response = await fetch(`${baseUrl}/admin/stock/alerts`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: ApiResponse<StockAlert[]> = await response.json();

    if (!result.success) {
      throw new Error(result.message);
    }

    const alerts = result.data || [];

    // Compter les alertes par niveau
    const counts = alerts.reduce(
      (acc, alert) => {
        if (alert.alert_level === "CRITICAL") acc.critical++;
        else if (alert.alert_level === "WARNING") acc.warning++;
        else acc.info++;
        return acc;
      },
      { critical: 0, warning: 0, info: 0 },
    );

    return { alerts, counts };
  } catch (error) {
    logger.warn("⚠️ Échec récupération alertes:", error);
    return {
      alerts: [],
      counts: { critical: 0, warning: 0, info: 0 },
    };
  }
}

/**
 * Calcule la valeur totale du stock
 */
function calculateStockValue(items: StockItem[]): number {
  if (!Array.isArray(items)) return 0;

  return items.reduce((total, item) => {
    const price = item.pieces?.price || item.price || 0;
    const quantity = item.available || item.quantity || 0;
    return total + price * quantity;
  }, 0);
}

/**
 * Calcule le taux de rotation du stock
 */
function calculateTurnoverRate(items: StockItem[]): number {
  if (!Array.isArray(items) || items.length === 0) return 0;

  // Calcul simplifié basé sur le ratio stock minimum/stock actuel
  const totalRatio = items.reduce((sum, item) => {
    if (item.min_stock && item.available) {
      return sum + item.available / item.min_stock;
    }
    return sum;
  }, 0);

  return Math.round((totalRatio / items.length) * 100) || 0;
}

/**
 * Données par défaut en cas d'erreur
 */
function getDefaultStockData(): StockStats {
  return {
    totalProducts: 0,
    outOfStock: 0,
    lowStock: 0,
    overstock: 0,
    avgStockLevel: 0,
    totalValue: 0,
    turnoverRate: 0,
  };
}

function getDefaultOrdersData(): OrderStats {
  return {
    totalOrders: 0,
    pendingOrders: 0,
    todayCount: 0,
    monthlyRevenue: 0,
  };
}

function getDefaultDashboardData(): DashboardData {
  return {
    stock: getDefaultStockData(),
    orders: getDefaultOrdersData(),
    alerts: { critical: 0, warning: 0, info: 0 },
    stockAlerts: [],
    recentOrders: [],
    recentActivities: [],
  };
}
