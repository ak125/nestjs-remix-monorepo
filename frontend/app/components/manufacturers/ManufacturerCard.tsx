/**
 * 🏭 MANUFACTURER CARD COMPONENT
 *
 * Composant réutilisable pour afficher une carte manufacturer
 * Compatible avec le design system existant (shadcn/ui)
 */

import { Link } from "@remix-run/react";
import { Car, ArrowRight } from "lucide-react";
import { memo } from "react";
import { BrandLogoClient } from "../BrandLogoClient";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface ManufacturerCardProps {
  manufacturer: {
    id: number;
    name: string;
    display_name?: string;
    logo_path?: string | null;
    slug?: string;
    models_count?: number;
    types_count?: number;
    country?: string;
  };
  viewMode?: "grid" | "list";
  linkTo?: string; // Override du lien si nécessaire
}

export const ManufacturerCard = memo(function ManufacturerCard({
  manufacturer,
  viewMode = "grid",
  linkTo,
}: ManufacturerCardProps) {
  const defaultLink =
    linkTo || `/brands/${manufacturer.slug || manufacturer.id}`;
  const displayName = manufacturer.display_name || manufacturer.name;
  const modelsCount = manufacturer.models_count || 0;
  const typesCount = manufacturer.types_count || 0;

  // Mode liste - compact et horizontal
  if (viewMode === "list") {
    return (
      <Link to={defaultLink} className="block">
        <Card className="hover:shadow-md transition-all duration-200 hover:border-blue-300">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex-shrink-0">
                <div className="w-12 h-12">
                  <BrandLogoClient
                    logoPath={manufacturer.logo_path ?? null}
                    brandName={manufacturer.name}
                  />
                </div>
              </div>

              {/* Informations principales */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                  {displayName}
                </h3>
                {manufacturer.country && (
                  <p className="text-sm text-gray-600 truncate">
                    {manufacturer.country}
                  </p>
                )}
              </div>

              {/* Métadonnées */}
              <div className="flex-shrink-0 text-right">
                <div className="flex items-center text-sm text-gray-500 mb-1">
                  <Car className="h-4 w-4 mr-1" />
                  <span>{modelsCount} modèles</span>
                </div>
                {typesCount > 0 && (
                  <div className="text-xs text-gray-400">
                    {typesCount} types
                  </div>
                )}
              </div>

              {/* Indicateur de lien */}
              <div className="flex-shrink-0">
                <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Mode grille - vertical et visuel (basé sur l'existant optimisé)
  return (
    <Link to={defaultLink} className="block">
      <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group">
        <CardContent className="p-6 text-center">
          {/* Logo de la marque */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 relative">
              <BrandLogoClient
                logoPath={manufacturer.logo_path ?? null}
                brandName={manufacturer.name}
              />
            </div>
          </div>

          {/* Nom de la marque */}
          <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
            {displayName}
          </h3>

          {/* Pays (si disponible) */}
          {manufacturer.country && (
            <p className="text-sm text-gray-600 mb-4">{manufacturer.country}</p>
          )}

          {/* Métadonnées */}
          <div className="flex items-center justify-center text-sm text-gray-500 mb-4">
            <Car className="h-4 w-4 mr-1" />
            <span>{modelsCount} modèles</span>
            {typesCount > 0 && (
              <>
                <span className="mx-2">•</span>
                <span>{typesCount} types</span>
              </>
            )}
          </div>

          {/* Bouton d'action (apparaît au hover) */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="sm" className="w-full" variant="outline">
              <span>Explorer</span>
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});
