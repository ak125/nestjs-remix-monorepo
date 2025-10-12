import { json, type LoaderFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUser } from "../auth/unified.server";

/**
 * Layout parent minimal pour toutes les pages compte utilisateur
 * Les routes enfants (account.dashboard, account.orders, etc.) 
 * gèrent leur propre layout avec AccountLayout component
 */

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
