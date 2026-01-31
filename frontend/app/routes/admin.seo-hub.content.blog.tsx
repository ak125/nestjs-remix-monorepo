/**
 * 📝 SEO HUB - CONTENT BLOG
 *
 * Gestion des articles blog (guides, conseils)
 * Re-dirige vers le gestionnaire de blog existant
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  // Rediriger vers la page d'admin blog existante
  return redirect("/admin/blog");
}

export default function SeoHubContentBlog() {
  return null;
}
