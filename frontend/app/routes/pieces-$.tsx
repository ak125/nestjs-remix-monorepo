/**
 * 🛑 ROUTE 410 - ANCIENNES URLs FOURNISSEURS
 *
 * Intercepte les URLs legacy au format: /pieces-{supplier}.html
 * Exemples: /pieces-al-ko.html, /pieces-bosch.html, etc.
 *
 * Ces pages n'existent plus et ne reviendront pas.
 * Retourne 410 Gone pour que Google les désindexe.
 *
 * @since 2026-01-15
 * @author SEO Migration Team
 */

import { type LoaderFunctionArgs } from "@remix-run/node";
import { Error410 } from "~/components/errors/Error410";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Log pour monitoring
  console.log(`🛑 [410] URL fournisseur obsolète: ${pathname}`);

  // Retourner 410 Gone - la ressource n'existe plus et ne reviendra pas
  throw new Response("Page fournisseur supprimée", { status: 410 });
}

export default function SupplierPagesGone() {
  // Ce composant ne sera jamais rendu car le loader throw 410
  return null;
}

export function ErrorBoundary() {
  return <Error410 />;
}
