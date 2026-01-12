/**
 * 🏷️ LAYOUT BRANDS
 *
 * Layout pour toutes les pages marques automobiles
 * Route: /brands/*
 */

import { Outlet, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { Error404 } from "~/components/errors/Error404";

export default function BrandsLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header global brands */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Catalogue Marques Automobiles
              </h1>
              <p className="text-gray-600 text-sm">
                Explorez nos marques, modèles et motorisations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu des pages */}
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
