import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { requireAdmin } from "../server/auth.server";

/**
 * Route par défaut pour /admin/payments
 * Redirige automatiquement vers le dashboard des paiements
 */
export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin({ context });
  
  // Rediriger vers le dashboard des paiements
  return redirect("/admin/payments/dashboard");
}

// Cette route ne fait que rediriger, pas besoin de composant
export default function AdminPaymentsIndex() {
  return null;
}
