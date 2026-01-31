/**
 * 🔧 SEO HUB - CONTENT DIAGNOSTICS (R5)
 *
 * Gestion des pages R5 Diagnostic (symptômes et pannes)
 * Re-dirige vers le gestionnaire de contenu R5 existant
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Pour l'instant, rediriger vers la page de contenu principale
  // TODO: Implémenter une vue dédiée R5 quand nécessaire
  return redirect("/admin/seo-hub/content");
}

export default function SeoHubContentDiagnostics() {
  return null;
}
