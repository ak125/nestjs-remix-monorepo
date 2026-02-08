import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { getOptionalUser } from "~/auth/unified.server";
import { Error404 } from "~/components/errors/Error404";
import { logger } from "~/utils/logger";

/**
 * 🔄 REDIRECTEUR INTELLIGENT POUR UTILISATEURS CONNECTÉS
 *
 * Route: /app
 * Cette route redirige automatiquement les utilisateurs connectés
 * vers leur dashboard approprié selon leur niveau d'accès
 */

export async function loader({ context }: LoaderFunctionArgs) {
  // Vérifier si l'utilisateur est authentifié
  const user = await getOptionalUser({ context });

  if (!user) {
    // Utilisateur non connecté → Landing page publique
    return redirect("/");
  }

  // 🎯 REDIRECTION INTELLIGENTE BASÉE SUR LE NIVEAU D'ACCÈS
  let targetRoute = "/account/dashboard"; // Défaut pour utilisateurs standards

  if (user.level) {
    if (user.level >= 7) {
      // Niveau admin → Dashboard administrateur
      targetRoute = "/admin";
    } else if (user.level >= 3) {
      // Niveau commercial → Dashboard commercial
      targetRoute = "/commercial";
    }
    // Sinon → Dashboard utilisateur standard
  }

  logger.log(
    `🔄 [App Router] Utilisateur level ${user.level} → ${targetRoute}`,
  );
  return redirect(targetRoute);
}

// Cette route ne rend rien, elle redirige seulement
export default function App() {
  return null;
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
