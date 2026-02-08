import { json, type LoaderFunction, type MetaFunction } from "@remix-run/node";
import { Outlet, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { requireUser } from "../auth/unified.server";
import { Error404 } from "~/components/errors/Error404";
import { createNoIndexMeta } from "~/utils/meta-helpers";

/**
 * Layout parent minimal pour toutes les pages compte utilisateur
 * Les routes enfants (account.dashboard, account.orders, etc.)
 * gèrent leur propre layout avec AccountLayout component
 */

export const meta: MetaFunction = () => createNoIndexMeta("Mon Compte");

export const loader: LoaderFunction = async ({ context }) => {
  const user = await requireUser({ context });
  return json({ user });
};

export default function AccountLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Layout minimal - la sidebar complète est gérée par AccountLayout dans chaque route */}
      <Outlet />
    </div>
  );
}

// ============================================================
// ERROR BOUNDARY - Gestion des erreurs HTTP
// ============================================================
export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return <Error404 url={error.data?.url} />;
  }

  return <Error404 />;
}
