/**
 * 📚 SEO HUB - CONTENT REFERENCES (R4)
 *
 * Gestion des pages R4 Reference (définitions techniques)
 * Re-dirige vers le gestionnaire de contenu R4 existant
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Pour l'instant, rediriger vers la page de contenu principale
  // TODO: Implémenter une vue dédiée R4 quand nécessaire
  return redirect("/admin/seo-hub/content");
}

export default function SeoHubContentReferences() {
  return null;
}
