/**
 * Profile server service — encapsule GET /api/users/profile pour le checkout
 */

import { type CheckoutUserProfile } from "~/schemas/checkout.schemas";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

/**
 * Recupere le profil utilisateur pour pre-remplir le formulaire checkout.
 * Retourne null en cas d'erreur (silencieux, comme le comportement actuel).
 */
export async function getUserProfile(
  request: Request,
): Promise<CheckoutUserProfile | null> {
  try {
    const res = await fetch(
      getInternalApiUrlFromRequest("/api/users/profile", request),
      {
        headers: { Cookie: request.headers.get("Cookie") || "" },
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    const profile = data.data || data;

    return {
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      address: profile.address || "",
      zipCode: profile.zipCode || "",
      city: profile.city || "",
      country: profile.country || "France",
      phone: profile.phone || "",
      email: profile.email || undefined,
    };
  } catch (err) {
    logger.warn("[Profile] Impossible de charger le profil:", err);
    return null;
  }
}
