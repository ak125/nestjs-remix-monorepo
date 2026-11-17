import { useEffect, useState } from "react";
import { useRouteLoaderData } from "react-router";
import { logger } from "~/utils/logger";
import { type loader } from "../root";

export const useOptionalUser = () => {
  const data = useRouteLoaderData<typeof loader>("root");

  if (!data) {
    // Retourner null au lieu de lancer une erreur
    logger.warn("Root loader was not run - returning null user");
    return null;
  }
  return data.user;
};

/**
 * Règle de port de la France métropolitaine (forfait, seuil de gratuité), servie
 * par le backend dans le root loader. `null` si elle n'a pas pu être lue : le
 * composant n'affiche alors aucune promesse de seuil.
 */
export const useShippingPolicy = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.shippingPolicy ?? null;
};

/**
 * Hook pour accéder aux données du panier depuis le root loader.
 *
 * Le cart est chargé via defer() (P0 perf) : côté client c'est une Promise
 * qui se résout après le premier rendu. Le hook la résout automatiquement
 * et retourne null pendant le chargement.
 */
export const useRootCart = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  const [resolvedCart, setResolvedCart] = useState<any>(null);

  useEffect(() => {
    const raw = data?.cart;
    if (!raw) {
      setResolvedCart(null);
      return;
    }

    // defer() renvoie une Promise côté client
    if (raw instanceof Promise || typeof (raw as any)?.then === "function") {
      (raw as Promise<any>)
        .then((v) => setResolvedCart(v ?? null))
        .catch(() => setResolvedCart(null));
    } else {
      // Valeur déjà résolue (navigation SPA après revalidation)
      setResolvedCart(raw);
    }
  }, [data?.cart]);

  return resolvedCart;
};
