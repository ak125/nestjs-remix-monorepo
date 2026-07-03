/**
 * 🔀 REDIRECTION VEHICLES
 *
 * Route de redirection de /vehicles vers /commercial/vehicles
 * Améliore l'UX en cas d'URL raccourcie
 */

import { redirect, useRouteError, isRouteErrorResponse } from "react-router";
import { ErrorGeneric } from "~/components/errors/ErrorGeneric";

export async function loader() {
  return redirect("/commercial/vehicles");
}

export default function VehiclesRedirect() {
  // Cette page ne sera jamais rendue car on fait toujours une redirection
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
