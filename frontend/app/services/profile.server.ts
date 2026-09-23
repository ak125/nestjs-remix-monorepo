/**
 * Profile server service — encapsule /api/users/profile (profil du client connecté) :
 * GET pour pré-remplir le checkout et l'édition du profil, PUT pour l'enregistrer.
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

export type UpdateOwnProfileInput = {
  firstName: string;
  lastName: string;
  phone?: string;
};

export type UpdateOwnProfileResult =
  | { ok: true }
  | { ok: false; status: number };

/**
 * Enregistre le profil du client connecté (PUT /api/users/profile).
 * Le backend n'accepte que prénom, nom et téléphone : toute autre clé est
 * refusée (400). Un échec HTTP est journalisé et renvoyé avec son statut —
 * c'est à l'appelant de décider du message affiché.
 */
export async function updateOwnProfile(
  request: Request,
  input: UpdateOwnProfileInput,
): Promise<UpdateOwnProfileResult> {
  const res = await fetch(
    getInternalApiUrlFromRequest("/api/users/profile", request),
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Cookie: request.headers.get("Cookie") || "",
      },
      body: JSON.stringify(input),
    },
  );

  if (res.ok) return { ok: true };

  logger.error(`[Profile] PUT /api/users/profile a échoué: ${res.status}`);
  return { ok: false, status: res.status };
}
