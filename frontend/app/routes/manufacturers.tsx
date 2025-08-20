/**
 * 🏭 LAYOUT MANUFACTURERS
 * 
 * Layout pour toutes les pages manufacturers
 * Route: /manufacturers/*
 */

import { Outlet } from "@remix-run/react";

export default function ManufacturersLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header global manufacturers */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-4">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                🚗 Catalogue Manufacturiers
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
