import { json, type LoaderFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

/**
 * Layout principal pour toutes les pages compte utilisateur
 * Route parent pour account.*
 */

export const loader: LoaderFunction = async ({ request }) => {
  // TODO: Vérifier l'authentification utilisateur
  // Pour l'instant, on laisse passer
  return json({ user: null });
};

export default function AccountLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </div>
    </div>
  );
}
