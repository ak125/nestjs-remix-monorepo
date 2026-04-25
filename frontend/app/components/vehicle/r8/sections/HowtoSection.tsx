// 📋 R8 Vehicle — S_HOWTO
// Step-by-step guide for choosing the right part for this vehicle.

import { ListChecks } from "lucide-react";
import { type LoaderData } from "../r8.types";

interface Props {
  vehicle: LoaderData["vehicle"];
}

export function HowtoSection({ vehicle }: Props) {
  return (
    <div className="mb-12" data-section="S_HOWTO">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <ListChecks
            size={24}
            className="text-blue-600 flex-shrink-0 mt-0.5"
          />
          <h2 className="text-xl font-bold text-gray-900">
            Comment choisir sans se tromper
          </h2>
        </div>
        <ol className="space-y-3 ml-9 list-decimal list-inside">
          <li className="text-gray-700">
            Vérifier la période de production ({vehicle.type_year_from}–
            {vehicle.type_year_to || "aujourd'hui"})
          </li>
          <li className="text-gray-700">
            Confirmer le carburant ({vehicle.type_fuel}) et la puissance (
            {vehicle.type_power_ps} ch)
          </li>
          <li className="text-gray-700">
            Identifier le code moteur
            {vehicle.motor_codes_formatted
              ? ` (${vehicle.motor_codes_formatted})`
              : ""}{" "}
            ou le CNIT (carte grise case D.2)
          </li>
          <li className="text-gray-700">
            Choisir la gamme dans le{" "}
            <a
              href="#catalogue"
              className="text-blue-600 hover:underline font-medium"
            >
              catalogue ci-dessus
            </a>
          </li>
          <li className="text-gray-700">
            En cas de doute →{" "}
            <a
              href="/contact"
              className="text-blue-600 hover:underline font-medium"
            >
              contacter notre assistance
            </a>
          </li>
        </ol>
      </div>
    </div>
  );
}
