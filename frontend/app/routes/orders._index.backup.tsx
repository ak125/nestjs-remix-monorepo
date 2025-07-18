/**
 * Route de redirection automatique pour /orders
 * Redirige vers l'interface appropriée selon le rôle utilisateur
 */

import { redirect, type LoaderFunction } from "@remix-run/node";
import { getOptionalUser } from "~/server/auth.server";
import { isAdmin } from "~/lib/auth";

export const loader: LoaderFunction = async ({ request, context }) => {
  const user = await getOptionalUser({ context });
  
  // Si pas d'utilisateur, rediriger vers login
  if (!user) {
    return redirect('/login');
  }
  
  // Si admin, rediriger vers interface admin
  if (isAdmin(user)) {
    return redirect('/admin/orders');
  }
  
  // Si utilisateur normal, rediriger vers interface utilisateur
  return redirect('/my-orders');
};

export default function OrdersRedirect() {
  // Cette page ne devrait jamais être rendue
  return null;
}
