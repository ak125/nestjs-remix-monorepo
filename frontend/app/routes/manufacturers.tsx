/**
 * 🔀 REDIRECT: /manufacturers → /brands
 * 
 * Layout route redirect - redirige toutes les sous-routes
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace('/manufacturers', '/brands');
  return redirect(path + url.search, 301);
}

export default function ManufacturersLayoutRedirect() {
  return null;
}
