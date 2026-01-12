/**
 * 🔀 REDIRECTION VEHICLES
 *
 * Route de redirection de /vehicles vers /commercial/vehicles
 * Améliore l'UX en cas d'URL raccourcie
 */

import { redirect } from "@remix-run/node";
import { useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";

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
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
