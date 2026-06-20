/**
 * 🛒 API CART - Endpoint pour CartSidebarSimple
 *
 * Cette route permet au useFetcher de récupérer le panier
 * avec les bonnes cookies de session (contrairement aux fetch client-side)
 */

import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  data as dataResponse,
} from "@remix-run/node";
import { logger } from "~/utils/logger";

const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:3000";

/**
 * GET - Récupérer le panier
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const cookie = request.headers.get("Cookie") || "";
    logger.log(
      "[API Cart Remix] Cookie reçu:",
      cookie ? cookie.substring(0, 50) + "..." : "AUCUN",
    );

    const response = await fetch(`${API_BASE}/api/cart`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      credentials: "include",
    });

    if (!response.ok) {
      logger.error(
        "[API Cart] Erreur fetch:",
        response.status,
        response.statusText,
      );
      return dataResponse(
        {
          items: [],
          subtotal: 0,
          itemCount: 0,
          consigneTotal: 0,
          error: "Erreur API",
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    logger.log(
      "[API Cart Remix] Réponse backend:",
      data.totals?.total_items,
      "articles",
    );

    // Le backend retourne data.totals.*, on le transforme en format plat
    return {
      items: data.items || [],
      subtotal: data.totals?.subtotal || 0,
      itemCount: data.totals?.total_items || 0,
      consigneTotal: data.totals?.consigne_total || 0,
    };
  } catch (error) {
    logger.error("[API Cart] Erreur:", error);
    return dataResponse(
      {
        items: [],
        subtotal: 0,
        itemCount: 0,
        consigneTotal: 0,
        error: "Erreur serveur",
      },
      { status: 500 },
    );
  }
}

/**
 * POST/DELETE - Actions sur le panier
 */
export async function action({ request }: ActionFunctionArgs) {
  const cookie = request.headers.get("Cookie") || "";
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  logger.log("[API Cart Action] Intent:", intent);

  try {
    if (intent === "update") {
      // Mise à jour quantité - utiliser POST /api/cart/items avec replace=true
      const productId = formData.get("productId") as string;
      const quantity = parseInt(formData.get("quantity") as string, 10);

      logger.log(
        `[API Cart] Update: productId=${productId}, quantity=${quantity}`,
      );

      const response = await fetch(`${API_BASE}/api/cart/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          product_id: parseInt(productId, 10),
          quantity,
          replace: true, // Flag pour remplacer la quantité au lieu d'additionner
        }),
        credentials: "include",
      });

      const data = await response.json();
      logger.log("[API Cart] Update response:", data.success ? "OK" : "FAIL");
      return data;
    }

    if (intent === "remove") {
      // Supprimer un article - DELETE /api/cart/items/:productId
      const productId = formData.get("productId") as string;

      logger.log(`[API Cart] Remove: productId=${productId}`);

      const response = await fetch(`${API_BASE}/api/cart/items/${productId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        credentials: "include",
      });

      const data = await response.json();
      logger.log("[API Cart] Remove response:", data.success ? "OK" : "FAIL");
      return data;
    }

    if (intent === "clear") {
      // Vider le panier - DELETE /api/cart
      logger.log("[API Cart] Clear cart");

      const response = await fetch(`${API_BASE}/api/cart`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        credentials: "include",
      });

      const data = await response.json();
      logger.log("[API Cart] Clear response:", data.success ? "OK" : "FAIL");
      return data;
    }

    logger.error("[API Cart] Intent inconnu:", intent);
    return dataResponse({ error: "Intent inconnu", intent }, { status: 400 });
  } catch (error) {
    logger.error("[API Cart Action] Erreur:", error);
    return dataResponse(
      { error: "Erreur serveur", details: String(error) },
      { status: 500 },
    );
  }
}
