/**
 * Service Orders pour Remix - Compatible avec NestJS Backend
 * Connexion avec OrdersSimpleService existant
 */

import { type Order, type OrdersResponse } from "../utils/orders";

export interface GetUserOrdersParams {
  userId: string;
  page?: number;
  status?: string;
  year?: string;
  request?: Request; // Ajout pour passer les cookies
}

/**
 * Récupère les commandes d'un utilisateur depuis l'API NestJS
 */
export async function getUserOrders(
  params: GetUserOrdersParams,
): Promise<OrdersResponse> {
  const { userId, page = 1, status = "all", year, request } = params;

  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

    // Construction des paramètres de requête
    const searchParams = new URLSearchParams({
      page: page.toString(),
      limit: "10",
    });

    if (status !== "all") {
      searchParams.append("status", status);
    }

    if (year) {
      searchParams.append("year", year);
    }

    // Récupération des headers avec cookies pour l'authentification
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

    // Appel à l'API backend
    const response = await fetch(
      `${baseUrl}/api/customer/orders/${userId}?${searchParams}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.status}`);
    }

    const data = await response.json();

    // Mapping des données depuis la réponse du backend
    const orders: Order[] = (data.orders || []).map((order: any) => ({
      id: order.id?.toString() || order.order_id?.toString(),
      orderNumber: order.orderNumber || `CMD-${order.id}`,
      status: order.status || 1,
      totalTTC: parseFloat(order.totalTTC || order.total_ttc || 0),
      createdAt: order.createdAt || order.created_at,
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
    console.error("Error fetching user orders:", error);

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

export interface GetOrderDetailParams {
  orderId: string;
  userId: string;
  request?: Request;
}

/**
 * Récupère le détail d'une commande spécifique
 */
export async function getOrderDetail(
  params: GetOrderDetailParams,
): Promise<any> {
  const { orderId, userId, request } = params;

  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";

    // Récupération des headers avec cookies pour l'authentification
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

    // Appel à l'API backend pour le détail de la commande
    const response = await fetch(
      `${baseUrl}/api/customer/orders/${userId}/${orderId}`,
      {
        method: "GET",
        headers,
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Commande non trouvée
      }
      throw new Error(`Failed to fetch order detail: ${response.status}`);
    }

    const response_data = await response.json();

    // Le backend renvoie { success: true, data: {...} }
    if (!response_data.success || !response_data.data) {
      return null;
    }

    const order = response_data.data;

    // Mapping des données depuis la réponse du backend
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
      hasReview: order.hasReview || false,
      canReturn: order.canReturn || order.status === 6,

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

      deliveryAddress: order.deliveryAddress ||
        order.delivery_address || {
          firstName:
            order.delivery_first_name ||
            order.shipping_first_name ||
            order.first_name,
          lastName:
            order.delivery_last_name ||
            order.shipping_last_name ||
            order.last_name,
          company:
            order.delivery_company || order.shipping_company || order.company,
          street:
            order.delivery_street || order.shipping_address1 || order.address,
          additionalInfo:
            order.delivery_additional_info || order.shipping_address2,
          postalCode:
            order.delivery_postal_code ||
            order.shipping_postal_code ||
            order.postal_code,
          city: order.delivery_city || order.shipping_city || order.city,
          country:
            order.delivery_country ||
            order.shipping_country ||
            order.country ||
            "France",
        },

      billingAddress: order.billingAddress ||
        order.billing_address || {
          firstName: order.billing_first_name || order.first_name,
          lastName: order.billing_last_name || order.last_name,
          company: order.billing_company || order.company,
          address1: order.billing_address1 || order.address,
          address2: order.billing_address2,
          postalCode: order.billing_postal_code || order.postal_code,
          city: order.billing_city || order.city,
          country: order.billing_country || order.country || "France",
        },

      // Historique de statut (si disponible)
      statusHistory: order.statusHistory ||
        order.status_history || [
          {
            label: getOrderStatusLabel(order.status || 1),
            date:
              order.updatedAt ||
              order.updated_at ||
              order.createdAt ||
              order.created_at,
            isActive: true,
          },
        ],
    };
  } catch (error) {
    console.error("Error fetching order detail:", error);
    throw error;
  }
}

// Fonction utilitaire pour les labels de statut (importée depuis utils/orders ou définie ici)
function getOrderStatusLabel(status: number): string {
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
