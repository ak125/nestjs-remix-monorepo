/**
 * Order server service — encapsule creation de commande + details pour paiement
 * Utilise pour le checkout uniquement (pas pour la liste des commandes compte client)
 */

import { type CartItem } from "~/schemas/cart.schemas";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

// -- Types --

interface AddressData {
  civility: string;
  firstName: string;
  lastName: string;
  address: string;
  phone?: string;
  zipCode: string;
  city: string;
  country: string;
}

export interface CreateCheckoutOrderPayload {
  customerId?: string;
  guestEmail?: string;
  orderLines: Array<{
    productId: string;
    productName: string;
    productReference: string;
    quantity: number;
    unitPrice: number;
    vatRate: number;
    discount: number;
    consigne_unit: number;
    has_consigne: boolean;
  }>;
  billingAddress: AddressData;
  shippingAddress: AddressData;
  customerNote: string;
  shippingMethod: string;
  paymentMethod?: string;
}

export type CreateOrderResult =
  | { success: true; orderId: string }
  | {
      success: false;
      error: string;
      status: number;
      emailConflict?: boolean;
      conflictEmail?: string;
      redirect?: string;
    };

export interface OrderPaymentDetails {
  orderId: string;
  totalTTC: number;
  isPaid: boolean;
  customerEmail: string;
}

// -- Service functions --

/**
 * Transforme les items du panier en lignes de commande
 */
export function buildOrderLines(items: CartItem[]) {
  return items.map((item) => ({
    productId: String(item.product_id),
    productName: item.product_name || "Produit",
    productReference: item.product_sku || String(item.product_id),
    quantity: item.quantity,
    unitPrice: item.price,
    vatRate: 20,
    discount: 0,
    consigne_unit: item.consigne_unit || 0,
    has_consigne: item.has_consigne || false,
  }));
}

/**
 * Cree une commande checkout (authentifie ou guest).
 * Gere les cas 409 (email conflict), 401/403 (auth required).
 */
export async function createCheckoutOrder(
  request: Request,
  payload: CreateCheckoutOrderPayload,
): Promise<CreateOrderResult> {
  const isGuest = !!payload.guestEmail;
  const cookieHeader = request.headers.get("Cookie") || "";

  const orderUrl = isGuest
    ? getInternalApiUrlFromRequest("/api/orders/guest", request)
    : getInternalApiUrlFromRequest("/api/orders", request);

  const body = isGuest
    ? { ...payload, guestEmail: payload.guestEmail }
    : payload;

  logger.log("[Checkout] Creating order...", {
    itemCount: payload.orderLines.length,
    isGuest,
  });

  try {
    const response = await fetch(orderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Guest: email conflict
      if (response.status === 409 && isGuest) {
        return {
          success: false,
          error: `Un compte existe deja avec l'email ${payload.guestEmail}. Connectez-vous ou utilisez une autre adresse email.`,
          status: 409,
          emailConflict: true,
          conflictEmail: payload.guestEmail,
        };
      }

      // Auth required
      if (response.status === 403 || response.status === 401) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set(
          "message",
          "Vous devez etre connecte pour passer commande",
        );
        loginUrl.searchParams.set("redirectTo", "/checkout");
        return {
          success: false,
          error: "Authentification requise",
          status: response.status,
          redirect: loginUrl.toString(),
        };
      }

      const errorData = await response
        .json()
        .catch(() => ({ message: "Erreur serveur" }));
      return {
        success: false,
        error:
          errorData.message || "Erreur lors de la creation de la commande",
        status: response.status,
      };
    }

    const order = await response.json();
    const orderId = order.ord_id || order.order_id || order.id;

    if (!orderId || orderId === "cree") {
      // Fallback: order created but no ID returned
      return {
        success: false,
        error: "Commande creee mais ID manquant",
        status: 200,
        redirect: "/account/orders?created=true",
      };
    }

    return { success: true, orderId };
  } catch (error) {
    logger.error("[Checkout] Order creation error:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Erreur lors de la commande",
      status: 500,
    };
  }
}

/**
 * Recupere les details d'une commande necessaires pour construire le redirect Paybox.
 */
export async function getOrderForPayment(
  request: Request,
  orderId: string,
): Promise<OrderPaymentDetails | null> {
  const cookieHeader = request.headers.get("Cookie") || "";

  try {
    const response = await fetch(
      getInternalApiUrlFromRequest(`/api/orders/${orderId}`, request),
      {
        headers: {
          Cookie: cookieHeader,
          "Internal-Call": "true",
        },
      },
    );

    if (!response.ok) {
      logger.error(
        `[Checkout] Failed to fetch order ${orderId}: ${response.status}`,
      );
      return null;
    }

    const orderData = await response.json();
    const details = orderData.data;

    return {
      orderId,
      totalTTC: parseFloat(details.ord_total_ttc || "0"),
      isPaid: parseInt(details.ord_is_pay || "0") !== 0,
      customerEmail: details.customer?.cst_mail || "",
    };
  } catch (error) {
    logger.error("[Checkout] Error fetching order for payment:", error);
    return null;
  }
}

/**
 * Construit l'URL de redirect Paybox a partir des details commande.
 */
export function buildPayboxRedirectUrl(
  orderId: string,
  totalTTC: number,
  customerEmail: string,
): string {
  return `/api/paybox/redirect?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(totalTTC)}&email=${encodeURIComponent(customerEmail)}`;
}
