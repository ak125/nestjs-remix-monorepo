// 🚗 Composant Header Véhicule - Architecture Modulaire
import React, { memo } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";

interface VehicleData {
  marque: string;
  modele: string;
  type: string;
  typeId: number;
  marqueId: number;
  modeleId: number;
}

interface GammeData {
  id: number;
  name: string;
  alias: string;
  description: string;
  image?: string;
}

interface VehicleHeaderProps {
  vehicle: VehicleData;
  gamme: GammeData;
  piecesCount: number;
  breadcrumbs?: {
    label: string;
    href: string;
  }[];
}

export const VehicleHeader = memo(function VehicleHeader({
  vehicle,
  gamme,
  piecesCount,
  breadcrumbs = [],
}: VehicleHeaderProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border mb-8">
      {/* Breadcrumbs */}
      {breadcrumbs.length > 0 && (
        <div className="px-6 pt-4">
          <nav className="flex" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              {breadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="mx-2 text-gray-400">/</span>}
                  <a
                    href={crumb.href}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {crumb.label}
                  </a>
                </li>
              ))}
              <li className="flex items-center">
                <span className="mx-2 text-gray-400">/</span>
                <span className="text-sm text-gray-900 font-medium">
                  {gamme.name}
                </span>
              </li>
            </ol>
          </nav>
        </div>
      )}

      <div className="p-6">
        <div className="flex items-start justify-between">
          {/* Informations véhicule */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              {/* Image gamme si disponible */}
              {gamme.image && (
                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={gamme.image}
                    alt={gamme.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}

              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {gamme.name}
                </h1>
                <div className="flex items-center gap-4 text-lg text-gray-600">
                  <span className="font-semibold">{vehicle.marque}</span>
                  <span>•</span>
                  <span className="font-semibold">{vehicle.modele}</span>
                  <span>•</span>
                  <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">
                    {vehicle.type}
                  </span>
                </div>
              </div>
            </div>

            {/* Description gamme */}
            {gamme.description && (
              <p className="text-gray-600 mb-4 max-w-3xl">
                {gamme.description}
              </p>
            )}

            {/* Statistiques rapides */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 text-sm">🔧</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {piecesCount}
                  </div>
                  <div className="text-xs text-gray-500">
                    Pièce{piecesCount > 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 text-sm">✅</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Compatible</div>
                  <div className="text-xs text-gray-500">Vérifié</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                  <span className="text-purple-600 text-sm">🚚</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">24-48h</div>
                  <div className="text-xs text-gray-500">Livraison</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 ml-6">
            <div className="flex flex-col gap-3">
              <Button
                className="px-6 py-3 rounded-lg   flex items-center gap-2"
                variant="blue"
              >
                <span>📋</span>
                Devis rapide
              </Button>
              <button className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
                <span>❤️</span>
                Favoris
              </button>
            </div>
          </div>
        </div>

        {/* Tags additionnels */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Catégories :</span>
            <Badge variant="info">{gamme.alias}</Badge>
            <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
              Type {vehicle.typeId}
            </span>
            <Badge variant="success">Pièces d'origine</Badge>
          </div>
        </div>
      </div>
    </div>
  );
});

export default VehicleHeader;
