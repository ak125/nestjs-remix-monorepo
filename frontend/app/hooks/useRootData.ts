import { useRouteLoaderData } from "@remix-run/react";
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
 * Hook pour accéder aux données du panier depuis le root loader
 * Utilisé par CartSidebarSimple pour avoir les données SSR
 */
export const useRootCart = () => {
  const data = useRouteLoaderData<typeof loader>("root");
  return data?.cart || null;
};
