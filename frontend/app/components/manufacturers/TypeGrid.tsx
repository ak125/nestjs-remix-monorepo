/**
 * 🚗 TYPE GRID COMPONENT
 * 
 * Composant réutilisable pour afficher une grille de types/motorisations
 * Basé sur l'architecture optimisée existante avec améliorations
 */

import { Link } from "@remix-run/react";
import { Zap, Calendar, Fuel, Settings } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

interface VehicleType {
  id: number;
  name: string;
  fuel_type?: string;
  power_hp?: number;
  power_kw?: number;
  engine_displacement?: number;
  engine_code?: string;
  year_from?: number;
  year_to?: number | null;
  transmission_type?: string;
  body_type?: string;
  category?: string;
  segment?: string;
  production_start?: string;
  production_end?: string;
  models_count?: number;
}

interface TypeGridProps {
  types: VehicleType[];
  layout?: 'grid' | 'list';
  showActions?: boolean;
  linkPrefix?: string; // Pour customiser les liens
  emptyMessage?: string;
}

export function TypeGrid({ 
  types, 
  layout = 'grid', 
  showActions = true,
  linkPrefix = "/manufacturers/types",
  emptyMessage = "Aucun type disponible"
}: TypeGridProps) {
  // Fonction pour obtenir l'icône de carburant
  const getFuelIcon = (fuelType?: string) => {
    if (!fuelType) return <Fuel className="h-4 w-4 text-gray-500" />;
    const fuel = fuelType.toLowerCase();
    if (fuel.includes('diesel')) return <Fuel className="h-4 w-4 text-black" />;
    if (fuel.includes('electr') || fuel.includes('hybrid')) return <Zap className="h-4 w-4 text-green-500" />;
    return <Fuel className="h-4 w-4 text-blue-500" />;
  };

  // Fonction pour obtenir la couleur du badge carburant
  const getFuelBadgeVariant = (fuelType?: string) => {
    if (!fuelType) return 'outline';
    const fuel = fuelType.toLowerCase();
    if (fuel.includes('diesel')) return 'secondary';
    if (fuel.includes('electr') || fuel.includes('hybrid')) return 'default';
    return 'outline';
  };

  // Empty state
  if (types.length === 0) {
    return (
      <div className="text-center py-12">
        <Settings className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-gray-900 mb-2">
          Aucun type trouvé
        </h3>
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  // Layout Liste (détaillé, pour pages spécifiques)
  if (layout === 'list') {
    return (
      <div className="space-y-4">
        {types.map((type) => (
          <Link
            key={type.id}
            to={`${linkPrefix}/${type.id}`}
            className="block"
          >
            <Card className="hover:border-blue-300 hover:shadow-sm transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Infos principales */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="font-semibold text-lg text-gray-900">
                        {type.name}
                      </h3>
                      
                      {type.fuel_type && (
                        <Badge variant={getFuelBadgeVariant(type.fuel_type)}>
                          {getFuelIcon(type.fuel_type)}
                          <span className="ml-1">{type.fuel_type}</span>
                        </Badge>
                      )}
                      
                      {(type.year_from || type.year_to) && (
                        <Badge variant="outline">
                          <Calendar className="h-3 w-3 mr-1" />
                          {type.year_from || '?'}
                          {type.year_to ? ` - ${type.year_to}` : ' - Actuel'}
                        </Badge>
                      )}
                      
                      {type.category && (
                        <Badge variant="outline">
                          {type.category}
                        </Badge>
                      )}
                    </div>

                    {/* Grille des spécifications */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {type.engine_code && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">Code moteur</p>
                          <p className="text-sm font-mono bg-gray-50 px-2 py-1 rounded">
                            {type.engine_code}
                          </p>
                        </div>
                      )}
                      
                      {(type.power_hp || type.power_kw) && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">Puissance</p>
                          <p className="text-sm">
                            {type.power_hp && <span className="font-semibold">{type.power_hp} cv</span>}
                            {type.power_kw && <span className="text-gray-500"> ({type.power_kw} kW)</span>}
                          </p>
                        </div>
                      )}
                      
                      {type.engine_displacement && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">Cylindrée</p>
                          <p className="text-sm font-semibold">
                            {(type.engine_displacement / 1000).toFixed(1)}L
                          </p>
                        </div>
                      )}
                      
                      {type.transmission_type && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-gray-600">Transmission</p>
                          <p className="text-sm">{type.transmission_type}</p>
                        </div>
                      )}
                    </div>

                    {/* Infos additionnelles */}
                    {(type.body_type || type.segment) && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex gap-4 text-sm text-gray-600">
                          {type.body_type && <span>Style: {type.body_type}</span>}
                          {type.segment && <span>Segment: {type.segment}</span>}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {showActions && (
                    <div className="ml-4">
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4 mr-1" />
                        Détails
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    );
  }

  // Layout Grille (compact, pour listes/catalogues)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {types.map((type) => (
        <Link
          key={type.id}
          to={`${linkPrefix}/${type.id}`}
          className="block"
        >
          <Card className="hover:shadow-lg hover:border-blue-300 transition-all duration-200 group">
            <CardContent className="p-6">
              {/* Header avec icône et ID */}
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-info/20 transition-colors">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500">#{type.id}</span>
              </div>
              
              {/* Titre */}
              <h3 className="font-semibold text-gray-900 text-lg mb-3 group-hover:text-blue-600 transition-colors">
                {type.name}
              </h3>
              
              {/* Catégorie */}
              {type.category && (
                <div className="mb-3">
                  <Badge variant="outline" className="text-xs">
                    {type.category}
                  </Badge>
                </div>
              )}
              
              {/* Spécifications clés */}
              <div className="space-y-2 mb-4">
                {type.fuel_type && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Carburant:</span>
                    <span className="font-medium">{type.fuel_type}</span>
                  </div>
                )}
                
                {(type.power_hp || type.power_kw) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Puissance:</span>
                    <span className="font-medium">
                      {type.power_hp && `${type.power_hp} CV`}
                      {type.power_kw && ` / ${type.power_kw} kW`}
                    </span>
                  </div>
                )}
                
                {type.engine_displacement && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cylindrée:</span>
                    <span className="font-medium">{(type.engine_displacement / 1000).toFixed(1)}L</span>
                  </div>
                )}
                
                {(type.year_from || type.year_to) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Période:</span>
                    <span className="font-medium">
                      {type.year_from || '?'}{type.year_to ? ` - ${type.year_to}` : ' - Actuel'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* Badges de statut */}
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  type.year_to 
                    ? 'bg-gray-100 text-gray-700' 
                    : 'bg-success/15 text-green-700'
                }`}>
                  {type.year_to ? 'Ancien' : 'Actuel'}
                </span>
                
                {type.fuel_type && (
                  <div className="flex items-center">
                    {getFuelIcon(type.fuel_type)}
                    <Badge variant="info">{type.fuel_type}</Badge>
                  </div>
                )}
              </div>
              
              {/* Compteur modèles */}
              {type.models_count && type.models_count > 0 && (
                <div className="mt-4 pt-4 border-t text-center">
                  <span className="text-sm text-blue-600 font-medium">
                    {type.models_count} modèle{type.models_count > 1 ? 's' : ''} disponible{type.models_count > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
