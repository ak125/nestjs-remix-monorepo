/**
 * 🔧 Utilitaires pour Gestion des Commandes
 * Extrait de routes/orders._index.tsx
 */

import { type Order, type OrdersStats } from "../types/orders.types";
import { formatDate, formatDateTime } from "./date";
import { formatPrice, formatPriceNumber } from "./format";
import { getOrderStatusLabel } from "./orders";

// ========================================
// 💰 FORMATAGE MONTANTS
// ========================================

export { formatPrice, formatPriceNumber };

// ========================================
// 📅 FORMATAGE DATES
// ========================================

export { formatDate, formatDateTime };

// ========================================
// 🆔 FORMATAGE IDS
// ========================================

/**
 * Formate un ID commande (ex: "ORD-12345")
 */
export function formatOrderId(id: string | number): string {
  if (!id) return "";

  const numId = typeof id === "string" ? id : id.toString();
  return `#${numId.padStart(6, "0")}`;
}

/**
 * Extrait l'ID numérique d'un ID formaté
 */
export function parseOrderId(formattedId: string): string {
  if (!formattedId) return "";
  return formattedId.replace(/^#/, "").replace(/^0+/, "");
}

// ========================================
// 🎨 BADGES & COULEURS
// ========================================

/**
 * Retourne la couleur de badge selon le statut de commande
 */
export function getStatusBadgeColor(statusId: string): string {
  switch (statusId) {
    case "1": // En attente
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "2": // Validée
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "3": // En préparation
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "4": // Prête
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "5": // Expédiée
      return "bg-green-100 text-green-800 border-green-200";
    case "6": // Livrée
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "7": // Annulée
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

/**
 * Retourne le label du statut de commande (wrapper string → number)
 */
export function getStatusLabel(statusId: string): string {
  return getOrderStatusLabel(Number(statusId));
}

/**
 * Retourne la couleur de badge pour le statut de paiement
 */
export function getPaymentBadgeColor(isPaid: string): string {
  return isPaid === "1"
    ? "bg-green-100 text-green-800 border-green-200"
    : "bg-red-100 text-red-800 border-red-200";
}

/**
 * Retourne le label du statut de paiement
 */
export function getPaymentLabel(isPaid: string): string {
  return isPaid === "1" ? "Payée" : "Impayée";
}

// ========================================
// 📊 CALCULS STATISTIQUES
// ========================================

/**
 * Calcule les statistiques à partir d'une liste de commandes
 */
export function calculateOrderStats(orders: Order[]): OrdersStats {
  const totalOrders = orders.length;

  const totalRevenue = orders.reduce((sum, order) => {
    const amount = parseFloat(order.ord_total_ttc || "0");
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthRevenue = orders
    .filter((order) => {
      const orderDate = new Date(order.ord_date);
      return (
        orderDate.getMonth() === currentMonth &&
        orderDate.getFullYear() === currentYear
      );
    })
    .reduce((sum, order) => {
      const amount = parseFloat(order.ord_total_ttc || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

  const averageBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const unpaidAmount = orders
    .filter((order) => order.ord_is_pay === "0")
    .reduce((sum, order) => {
      const amount = parseFloat(order.ord_total_ttc || "0");
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

  const pendingOrders = orders.filter(
    (order) => order.ord_ords_id === "1",
  ).length;

  return {
    totalOrders,
    totalRevenue,
    monthRevenue,
    averageBasket,
    unpaidAmount,
    pendingOrders,
  };
}

// ========================================
// 🔍 FILTRAGE & RECHERCHE
// ========================================

/**
 * Filtre les commandes selon critères de recherche
 */
export function filterOrders(
  orders: Order[],
  search: string,
  orderStatus: string,
  paymentStatus: string,
  dateRange: string,
): Order[] {
  let filtered = [...orders];

  // Recherche par ID, nom client, email
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(
      (order) =>
        order.ord_id.toLowerCase().includes(searchLower) ||
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.customerEmail?.toLowerCase().includes(searchLower) ||
        order.customer?.cst_mail?.toLowerCase().includes(searchLower),
    );
  }

  // Filtre statut commande
  if (orderStatus && orderStatus !== "all") {
    filtered = filtered.filter((order) => order.ord_ords_id === orderStatus);
  }

  // Filtre paiement
  if (paymentStatus && paymentStatus !== "all") {
    filtered = filtered.filter((order) => order.ord_is_pay === paymentStatus);
  }

  // Filtre date (aujourd'hui, semaine, mois, année)
  if (dateRange && dateRange !== "all") {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    filtered = filtered.filter((order) => {
      const orderDate = new Date(order.ord_date);

      switch (dateRange) {
        case "today":
          return orderDate >= today;
        case "week":
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return orderDate >= weekAgo;
        case "month":
          return (
            orderDate.getMonth() === now.getMonth() &&
            orderDate.getFullYear() === now.getFullYear()
          );
        case "year":
          return orderDate.getFullYear() === now.getFullYear();
        default:
          return true;
      }
    });
  }

  return filtered;
}

/**
 * Trie les commandes
 */
export function sortOrders(orders: Order[], sortBy: string): Order[] {
  const sorted = [...orders];

  switch (sortBy) {
    case "date-desc":
      return sorted.sort(
        (a, b) =>
          new Date(b.ord_date).getTime() - new Date(a.ord_date).getTime(),
      );
    case "date-asc":
      return sorted.sort(
        (a, b) =>
          new Date(a.ord_date).getTime() - new Date(b.ord_date).getTime(),
      );
    case "amount-desc":
      return sorted.sort(
        (a, b) =>
          parseFloat(b.ord_total_ttc || "0") -
          parseFloat(a.ord_total_ttc || "0"),
      );
    case "amount-asc":
      return sorted.sort(
        (a, b) =>
          parseFloat(a.ord_total_ttc || "0") -
          parseFloat(b.ord_total_ttc || "0"),
      );
    case "customer":
      return sorted.sort((a, b) =>
        (a.customerName || "").localeCompare(b.customerName || ""),
      );
    case "status":
      return sorted.sort((a, b) => a.ord_ords_id.localeCompare(b.ord_ords_id));
    default:
      return sorted;
  }
}

// ========================================
// 📄 EXPORT
// ========================================

/**
 * Génère un CSV à partir des commandes
 */
export function generateOrdersCSV(orders: Order[]): string {
  const headers = [
    "ID",
    "Date",
    "Client",
    "Email",
    "Montant TTC",
    "Statut",
    "Paiement",
  ];
  const rows = orders.map((order) => [
    formatOrderId(order.ord_id),
    formatDate(order.ord_date),
    order.customerName || "",
    order.customerEmail || order.customer?.cst_mail || "",
    formatPrice(order.ord_total_ttc),
    order.statusDetails?.ords_named || "",
    getPaymentLabel(order.ord_is_pay),
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map((row) => row.join(";")),
  ].join("\n");

  return csvContent;
}

/**
 * Télécharge un CSV
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
