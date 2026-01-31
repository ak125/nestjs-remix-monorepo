/**
 * 📡 Services API - Gestion des Commandes
 * Extrait de routes/orders._index.tsx
 */

import {
  type Order,
  type OrdersStats,
  type OrderFilters,
} from "../../types/orders.types";

// Client-side: use relative URL (browser resolves automatically)
// Server-side: use environment variable or localhost fallback
const API_BASE_URL =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_BASE_URL || "http://localhost:3000") + "/api"
    : "/api";

// ========================================
// 📥 RÉCUPÉRATION DONNÉES
// ========================================

/**
 * Récupère les commandes avec filtres et pagination
 */
export async function fetchOrders(
  filters: Partial<OrderFilters> = {},
  page: number = 1,
  limit: number = 50,
): Promise<{ orders: Order[]; total: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(filters.search && { search: filters.search }),
    ...(filters.orderStatus && { orderStatus: filters.orderStatus }),
    ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
    ...(filters.dateRange && { dateRange: filters.dateRange }),
  });

  const response = await fetch(`${API_BASE_URL}/orders?${params}`);

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la récupération des commandes: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Récupère une commande par ID
 */
export async function fetchOrderById(orderId: string): Promise<Order> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la récupération de la commande: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Récupère les statistiques des commandes
 */
export async function fetchOrdersStats(): Promise<OrdersStats> {
  const response = await fetch(`${API_BASE_URL}/orders/stats`);

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la récupération des statistiques: ${response.statusText}`,
    );
  }

  return response.json();
}

// ========================================
// ✏️ MISE À JOUR
// ========================================

/**
 * Met à jour le statut d'une commande
 */
export async function updateOrderStatus(
  orderId: string,
  statusId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ statusId }),
  });

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la mise à jour du statut: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Marque une commande comme payée
 */
export async function markOrderPaid(
  orderId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `Erreur lors du marquage comme payée: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Met à jour les informations d'une commande
 */
export async function updateOrder(
  orderId: string,
  updates: Partial<Order>,
): Promise<{ success: boolean; message: string; order: Order }> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la mise à jour de la commande: ${response.statusText}`,
    );
  }

  return response.json();
}

// ========================================
// 🗑️ SUPPRESSION
// ========================================

/**
 * Annule une commande
 */
export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    throw new Error(
      `Erreur lors de l'annulation de la commande: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Supprime une commande (Admin only)
 */
export async function deleteOrder(
  orderId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la suppression de la commande: ${response.statusText}`,
    );
  }

  return response.json();
}

// ========================================
// 📤 EXPORT
// ========================================

/**
 * Exporte les commandes en CSV
 */
export async function exportOrdersCSV(
  filters: Partial<OrderFilters> = {},
): Promise<Blob> {
  const params = new URLSearchParams({
    ...(filters.search && { search: filters.search }),
    ...(filters.orderStatus && { orderStatus: filters.orderStatus }),
    ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus }),
    ...(filters.dateRange && { dateRange: filters.dateRange }),
  });

  const response = await fetch(`${API_BASE_URL}/orders/export/csv?${params}`);

  if (!response.ok) {
    throw new Error(`Erreur lors de l'export CSV: ${response.statusText}`);
  }

  return response.blob();
}

/**
 * Génère une facture PDF pour une commande
 */
export async function generateInvoicePDF(orderId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/invoice`);

  if (!response.ok) {
    throw new Error(
      `Erreur lors de la génération de la facture: ${response.statusText}`,
    );
  }

  return response.blob();
}

// ========================================
// 📧 EMAIL
// ========================================

/**
 * Envoie un email de confirmation de commande au client
 */
export async function sendOrderConfirmationEmail(
  orderId: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/send-confirmation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Erreur lors de l'envoi de l'email: ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Envoie un email personnalisé au client
 */
export async function sendCustomEmail(
  orderId: string,
  subject: string,
  message: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, message }),
  });

  if (!response.ok) {
    throw new Error(
      `Erreur lors de l'envoi de l'email: ${response.statusText}`,
    );
  }

  return response.json();
}
