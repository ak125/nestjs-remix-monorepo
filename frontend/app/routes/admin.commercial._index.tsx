/**
 * 📊 TABLEAU DE BORD COMMERCIAL - ROUTE ADMIN
 * 
 * Route: /admin/commercial
 * Redirige vers /commercial pour éviter la duplication
 */

import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getOptionalUser } from "../auth/unified.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (!user) throw redirect('/login');
  
  // Vérifier le niveau d'accès commercial (niveau 3+)
  if (!user.level || user.level < 3) {
    throw redirect('/unauthorized');
  }

  // Rediriger vers la vraie route commercial
  throw redirect('/commercial');
}

// Cette route ne rend rien car elle redirige toujours
export default function AdminCommercial() {
  return null;
}
