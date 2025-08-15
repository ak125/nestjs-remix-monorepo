/**
 * Service Admin Orders pour Remix - Compatible avec NestJS Backend
 * Service dédié aux administrateurs pour la gestion des commandes
 */

import { type Order } from "../utils/orders";

export interface GetAdminOrdersParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  year?: string;
  request?: Request; // Ajout pour passer les cookies
}

export interface AdminOrdersResponse {
  orders: Order[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
}

/**
 * Récupère toutes les commandes pour l'administration
 */
export async function getAdminOrders(
  params: GetAdminOrdersParams,
): Promise<AdminOrdersResponse> {
  const {
    page = 1,
    limit = 20,
    status = "all",
    search,
    year,
    request,
  } = params;

  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

    // Construction des paramètres de requête
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (status !== "all") {
      searchParams.append("status", status);
    }

    if (search) {
      searchParams.append("search", search);
    }

    if (year) {
      searchParams.append("year", year);
    }

    // Récupération des headers avec cookies pour l'authentification admin
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Transmission des cookies d'authentification si disponibles
    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers["Cookie"] = cookie;
      }
    }

    // Appel à l'API backend admin
    const response = await fetch(
      `${baseUrl}/api/admin/orders?${searchParams}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch admin orders: ${response.status}`);
    }

    const data = await response.json();

    // Mapping des données depuis la réponse du backend admin
    const orders: Order[] = (data.orders || []).map((order: any) => ({
      id: order.id?.toString() || order.order_id?.toString(),
      orderNumber: order.orderNumber || `CMD-${order.id}`,
      status: order.status || 1,
      totalTTC: parseFloat(order.totalTTC || order.total_ttc || 0),
      createdAt: order.createdAt || order.created_at,
      customerName:
        order.customerName || order.customer_name || "Client inconnu",
      customerEmail: order.customerEmail || order.customer_email,
      lines: (order.lines || order.orderLines || []).map((line: any) => ({
        id: line.id?.toString(),
        productId: line.productId || line.product_id,
        productName: line.productName || line.product_name || "Produit",
        productImage:
          line.productImage || line.product_image || "/images/placeholder.jpg",
        quantity: parseInt(line.quantity || 1),
        unitPrice: parseFloat(line.unitPrice || line.unit_price || 0),
      })),
    }));

    // Pagination du backend ou par défaut
    const pagination = data.pagination || {
      currentPage: 1,
      totalPages: 1,
      totalCount: orders.length,
    };

    return { orders, pagination };
  } catch (error) {
    console.error("Error fetching admin orders:", error);

    // Retour de données vides en cas d'erreur
    return {
      orders: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
      },
    };
  }
}

export interface GetAdminOrderDetailParams {
  orderId: string;
  request?: Request;
}

/**
 * Récupère le détail d'une commande pour l'administration
 */
export async function getAdminOrderDetail(
  params: GetAdminOrderDetailParams,
): Promise<any> {
  const { orderId, request } = params;

  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

    // Récupération des headers avec cookies pour l'authentification admin
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Transmission des cookies d'authentification si disponibles
    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers["Cookie"] = cookie;
      }
    }

    // Appel à l'API backend admin pour le détail de la commande
    const response = await fetch(`${baseUrl}/api/admin/orders/${orderId}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Commande non trouvée
      }
      throw new Error(`Failed to fetch admin order detail: ${response.status}`);
    }

    const response_data = await response.json();

    // Le backend admin renvoie { success: true, data: {...} }
    if (!response_data.success || !response_data.data) {
      return null;
    }

    const order = response_data.data;

    // Mapping des données depuis la réponse du backend admin
    return {
      id: order.id?.toString() || order.order_id?.toString(),
      orderNumber: order.orderNumber || `CMD-${order.id}`,
      status: order.status || 1,
      totalTTC: parseFloat(order.totalTTC || order.total_ttc || 0),
      totalPrice: parseFloat(
        order.totalPrice ||
          order.total_price ||
          order.totalTTC ||
          order.total_ttc ||
          0,
      ),
      subtotalHT: parseFloat(order.subtotalHT || order.subtotal_ht || 0),
      subtotalPrice: parseFloat(
        order.subtotalPrice || order.subtotal_price || order.subtotalHT || 0,
      ),
      tva: parseFloat(order.tva || order.tax_amount || 0),
      shippingFee: parseFloat(
        order.shippingFee || order.shipping_fee || order.deliveryPrice || 0,
      ),
      deliveryPrice: parseFloat(
        order.deliveryPrice || order.delivery_price || order.shippingFee || 0,
      ),
      discountAmount: parseFloat(
        order.discountAmount || order.discount_amount || 0,
      ),
      createdAt: order.createdAt || order.created_at,
      updatedAt: order.updatedAt || order.updated_at,
      paymentMethod:
        order.paymentMethod || order.payment_method || "Carte bancaire",
      paymentStatus: order.paymentStatus || order.payment_status || "Payé",
      transactionId: order.transactionId || order.transaction_id,
      trackingNumber: order.trackingNumber || order.tracking_number,
      deliveryMethod: order.deliveryMethod || order.delivery_method,
      deliveryDate: order.deliveryDate || order.delivery_date,

      // Informations client (visible pour admin)
      customerName:
        order.customerName || order.customer_name || "Client inconnu",
      customerEmail: order.customerEmail || order.customer_email,
      customerPhone: order.customerPhone || order.customer_phone,
      customerId: order.customerId || order.customer_id,

      // Lignes de commande
      lines: (order.lines || order.orderLines || []).map((line: any) => ({
        id: line.id?.toString(),
        productId: line.productId || line.product_id,
        productName: line.productName || line.product_name || "Produit",
        productRef: line.productRef || line.product_ref || line.sku,
        productImage:
          line.productImage || line.product_image || "/images/placeholder.jpg",
        quantity: parseInt(line.quantity || 1),
        unitPrice: parseFloat(line.unitPrice || line.unit_price || 0),
        totalPrice: parseFloat(
          line.totalPrice ||
            line.total_price ||
            line.unitPrice * line.quantity ||
            0,
        ),
        status: line.status || order.status || 1,
      })),

      // Adresses
      shippingAddress: order.shippingAddress ||
        order.shipping_address || {
          firstName: order.shipping_first_name || order.first_name,
          lastName: order.shipping_last_name || order.last_name,
          company: order.shipping_company || order.company,
          address1: order.shipping_address1 || order.address,
          address2: order.shipping_address2,
          postalCode: order.shipping_postal_code || order.postal_code,
          city: order.shipping_city || order.city,
          country: order.shipping_country || order.country || "France",
        },

      billingAddress: order.billingAddress ||
        order.billing_address ||
        order.shippingAddress || {
          firstName:
            order.billing_first_name ||
            order.shipping_first_name ||
            order.first_name,
          lastName:
            order.billing_last_name ||
            order.shipping_last_name ||
            order.last_name,
          company:
            order.billing_company || order.shipping_company || order.company,
          address1:
            order.billing_address1 || order.shipping_address1 || order.address,
          address2: order.billing_address2 || order.shipping_address2,
          postalCode:
            order.billing_postal_code ||
            order.shipping_postal_code ||
            order.postal_code,
          city: order.billing_city || order.shipping_city || order.city,
          country:
            order.billing_country ||
            order.shipping_country ||
            order.country ||
            "France",
        },

      // Historique des statuts
      statusHistory: order.statusHistory || order.status_history || [],

      // Notes et commentaires admin
      adminNotes: order.adminNotes || order.admin_notes,
      internalNotes: order.internalNotes || order.internal_notes,
    };
  } catch (error) {
    console.error("Error fetching admin order detail:", error);
    throw error;
  }
}

/**
 * Met à jour le statut d'une commande (admin seulement)
 */
export async function updateOrderStatus(params: {
  orderId: string;
  newStatus: number;
  notes?: string;
  request?: Request;
}): Promise<boolean> {
  const { orderId, newStatus, notes, request } = params;

  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

    // Récupération des headers avec cookies pour l'authentification admin
    const headers: HeadersInit = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // Transmission des cookies d'authentification si disponibles
    if (request) {
      const cookie = request.headers.get("Cookie");
      if (cookie) {
        headers["Cookie"] = cookie;
      }
    }

    // Appel à l'API backend admin pour mettre à jour le statut
    const response = await fetch(
      `${baseUrl}/api/admin/orders/${orderId}/status`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: newStatus,
          notes: notes || "",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to update order status: ${response.status}`);
    }

    const data = await response.json();
    return data.success || false;
  } catch (error) {
    console.error("Error updating order status:", error);
    return false;
  }
}

// Utilitaires pour les admins
export function getOrderStatusLabel(status: number): string {
  const labels: Record<number, string> = {
    1: "En attente",
    2: "Confirmée",
    3: "En préparation",
    4: "Prête à expédier",
    5: "Expédiée",
    6: "Livrée",
    91: "Annulée",
    92: "En rupture",
    93: "Retournée",
    94: "Remboursée",
  };
  return labels[status] || "Statut inconnu";
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}
