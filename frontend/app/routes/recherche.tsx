import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

/**
 * Route de compatibilité /recherche → /search
 *
 * Pourquoi cette route existe :
 * - Le JSON-LD SearchAction de la homepage pointe vers /recherche?q={query}
 * - Sans cette route, les requêtes tombent sur NestJS (potentiel XSS)
 * - Remix intercepte et redirige proprement vers /search
 *
 * @see frontend/app/routes/_index.tsx - SearchAction urlTemplate
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  // Construire l'URL de redirection vers /search
  const searchUrl = new URL("/search", url.origin);
  if (query) {
    searchUrl.searchParams.set("q", query);
  }

  // Redirection 301 permanente (SEO-friendly)
  return redirect(searchUrl.toString(), 301);
}
