import { type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const action = async ({
  request,
  context: _context,
}: ActionFunctionArgs) => {
  logger.log("--- Remix Logout Action ---");

  try {
    // Faire un POST vers le backend pour déconnecter
    const backendUrl = getInternalApiUrl("");
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("Cookie") || "",
        "Content-Type": "application/json",
      },
    });

    logger.log("Réponse backend logout:", response.status, response.statusText);

    // Récupérer les headers de réponse pour les cookies
    const setCookieHeader = response.headers.get("Set-Cookie");

    // Rediriger vers la page d'accueil avec les nouveaux cookies
    return redirect("/", {
      headers: setCookieHeader
        ? {
            "Set-Cookie": setCookieHeader,
          }
        : undefined,
    });
  } catch (error) {
    logger.error("Erreur lors du logout:", error);
    // En cas d'erreur, rediriger quand même
    return redirect("/");
  }
};

// Loader pour rediriger les accès GET
export const loader = async () => {
  return redirect("/");
};

export default function Logout() {
  return null;
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <ErrorGeneric status={error.status} message={error.data?.message} />;
  }

  return <ErrorGeneric />;
}
