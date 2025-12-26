/**
 * 🚗 Composant VehicleCard
 * 
 * Affichage d'une carte véhicule avec toutes les informations essentielles
 */

import { Car, Fuel, Zap, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface VehicleCardProps {
  vehicle: {
    // Données de la table auto_type_number_code + jointures
    tnc_code?: string;
    tnc_cnit?: string;
    auto_type?: {
      type_id: string;
      type_name: string;
      type_fuel: string;
      type_power_ps: string;
      type_power_kw: string;
      type_year_from: string;
      type_year_to?: string;
      type_engine?: string;
      type_liter?: string;
      type_body?: string;
      auto_modele?: {
        modele_id: number;
        modele_name: string;
        modele_alias: string;
        auto_marque?: {
          marque_id: number;
          marque_name: string;
          marque_logo?: string;
        };
      };
    };
  };
  className?: string;
  showDetails?: boolean;
}

export function VehicleCard({ vehicle, className = "", showDetails = true }: VehicleCardProps) {
  const type = vehicle.auto_type;
  const model = type?.auto_modele;
  const brand = model?.auto_marque;

  if (!type || !model || !brand) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardContent className="p-4">
          <p className="text-red-600">Informations véhicule incomplètes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`hover:shadow-lg transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          {brand.marque_logo && (
            <img
              src={brand.marque_logo}
              alt={brand.marque_name}
              width={32}
              height={32}
              className="w-8 h-8 object-contain"
            />
          )}
          <div>
            <div className="text-lg font-semibold">
              {brand.marque_name} {model.modele_name}
            </div>
            <div className="text-sm text-gray-600 font-normal">
              {type.type_name}
            </div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Codes d'identification */}
        <div className="grid grid-cols-2 gap-3">
          {vehicle.tnc_code && (
            <div className="bg-muted p-3 rounded-lg">
              <div className="text-xs font-medium text-blue-600 uppercase">Code Mine</div>
              <div className="text-sm font-mono text-blue-800">{vehicle.tnc_code}</div>
            </div>
          )}
          {vehicle.tnc_cnit && (
            <div className="bg-success/10 p-3 rounded-lg">
              <div className="text-xs font-medium text-green-600 uppercase">CNIT</div>
              <div className="text-sm font-mono text-green-800">{vehicle.tnc_cnit}</div>
            </div>
          )}
        </div>

        {showDetails && (
          <>
            {/* Caractéristiques principales */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Carburant</div>
                  <div className="text-sm font-medium capitalize">{type.type_fuel}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Puissance</div>
                  <div className="text-sm font-medium">
                    {type.type_power_ps}cv / {type.type_power_kw}kW
                  </div>
                </div>
              </div>
            </div>

            {/* Informations techniques */}
            <div className="grid grid-cols-2 gap-3">
              {type.type_engine && (
                <div>
                  <div className="text-xs text-gray-500">Code moteur</div>
                  <div className="text-sm font-mono">{type.type_engine}</div>
                </div>
              )}
              {type.type_liter && (
                <div>
                  <div className="text-xs text-gray-500">Cylindrée</div>
                  <div className="text-sm">{type.type_liter}cc</div>
                </div>
              )}
            </div>

            {/* Période de production */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-xs text-gray-500">Période de production</div>
                <div className="text-sm">
                  {type.type_year_from}
                  {type.type_year_to ? ` - ${type.type_year_to}` : ' - Actuel'}
                </div>
              </div>
            </div>

            {/* Carrosserie */}
            {type.type_body && (
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-xs text-gray-500">Carrosserie</div>
                  <div className="text-sm capitalize">{type.type_body}</div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
