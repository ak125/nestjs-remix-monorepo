import {
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { requireAdmin } from "../auth/unified.server";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Paiements - Admin");

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
