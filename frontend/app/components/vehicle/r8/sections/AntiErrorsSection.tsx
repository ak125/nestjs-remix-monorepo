// ⚠️ R8 Vehicle — S_ANTI_ERRORS
// Common mistakes to avoid when picking parts for this vehicle.

import { AlertTriangle } from "lucide-react";
import { type LoaderData } from "../r8.types";

interface Props {
  vehicle: LoaderData["vehicle"];
}

export function AntiErrorsSection({ vehicle }: Props) {
  return (
    <div className="mb-12" data-section="S_ANTI_ERRORS">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle
            size={24}
            className="text-amber-600 flex-shrink-0 mt-0.5"
          />
          <h2 className="text-xl font-bold text-gray-900">
            Erreurs fréquentes à éviter
          </h2>
        </div>
        <ul className="space-y-3 ml-9">
          <li className="flex items-start gap-2 text-gray-700">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
            <span>
              Vérifier l'année exacte ({vehicle.type_year_from}–
              {vehicle.type_year_to || "aujourd'hui"}) : les pièces peuvent
              différer d'une année à l'autre
            </span>
          </li>
          <li className="flex items-start gap-2 text-gray-700">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
            <span>
              Puissance proche ≠ moteur identique : confirmez avec le CNIT ou le
              code moteur
              {vehicle.motor_codes_formatted
                ? ` (${vehicle.motor_codes_formatted})`
                : ""}
            </span>
          </li>
          <li className="flex items-start gap-2 text-gray-700">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
            <span>
              En cas de doute entre deux motorisations, utilisez le VIN (17
              caractères, carte grise case E)
            </span>
          </li>
          {vehicle.type_body && vehicle.type_body.includes("/") && (
            <li className="flex items-start gap-2 text-gray-700">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
              <span>
                Attention à la carrosserie ({vehicle.type_body}) : les pièces
                peuvent varier selon la version
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
