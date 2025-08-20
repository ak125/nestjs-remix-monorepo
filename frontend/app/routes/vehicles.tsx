/**
 * 🔀 REDIRECTION VEHICLES
 * 
 * Route de redirection de /vehicles vers /commercial/vehicles
 * Améliore l'UX en cas d'URL raccourcie
 */

import { redirect } from "@remix-run/node";

export async function loader() {
  return redirect("/commercial/vehicles");
}

export default function VehiclesRedirect() {
  // Cette page ne sera jamais rendue car on fait toujours une redirection
  return null;
}
