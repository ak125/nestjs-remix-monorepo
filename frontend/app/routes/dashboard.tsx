/**
 * 🎯 DASHBOARD SMART ROUTER
 *
 * Redirige automatiquement vers la bonne interface selon le niveau utilisateur:
 * - Niveau 3-4 (Commercial) → /admin (dashboard avec permissions limitées)
 * - Niveau 5+ (Admin) → /admin (dashboard complet)
 *
 * Note: Tous les utilisateurs vont maintenant vers /admin qui adapte
 * son contenu et sa sidebar selon les permissions.
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";
import { requireUser } from "../auth/unified.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  // Vérifier l'authentification
  const user = await requireUser({ context });

  // Tous les utilisateurs niveau 3+ (Commercial et Admin) vont vers /admin
  // La sidebar et les permissions filtrent automatiquement le contenu
  if (user.level && user.level >= 3) {
    return redirect("/admin");
  }

  // Utilisateurs de niveau inférieur (1-2) n'ont pas accès au dashboard
  return redirect("/unauthorized");
}

// Pas de composant par défaut car on redirige toujours
export default function Dashboard() {
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
