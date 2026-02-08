import { memo } from "react";
import { type VehicleData } from "~/types/vehicle.types";

interface VehicleHeaderProps {
  vehicle: VehicleData;
}

export const VehicleHeader = memo(function VehicleHeader({
  vehicle,
}: VehicleHeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {vehicle.brand} {vehicle.model}
            </h1>
            <p className="text-lg text-gray-600 mt-1">
              {vehicle.type} - {vehicle.year || "Toutes années"}
            </p>
            {vehicle.engine && (
              <p className="text-sm text-gray-500 mt-1">
                Moteur: {vehicle.engine}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {vehicle.imageUrl && (
              <img
                src={vehicle.imageUrl}
                alt={`${vehicle.brand} ${vehicle.model}`}
                className="w-24 h-24 object-cover rounded-lg shadow-md"
                loading="lazy"
              />
            )}

            <div className="text-right">
              <div className="text-sm text-gray-500">Pièces disponibles</div>
              <div className="text-2xl font-bold text-blue-600">
                {vehicle.partsCount || 0}
              </div>
            </div>
          </div>
        </div>

        {vehicle.description && (
          <div className="mt-4">
            <p className="text-gray-700">{vehicle.description}</p>
          </div>
        )}

        {/* Breadcrumb */}
        <nav className="mt-4" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-gray-500">
            <li>
              <a href="/" className="hover:text-gray-700">
                Accueil
              </a>
            </li>
            <li>›</li>
            <li>
              <a href="/vehicles" className="hover:text-gray-700">
                Véhicules
              </a>
            </li>
            <li>›</li>
            <li>
              <a
                href={`/vehicles/${vehicle.brand.toLowerCase()}`}
                className="hover:text-gray-700"
              >
                {vehicle.brand}
              </a>
            </li>
            <li>›</li>
            <li>
              <a
                href={`/vehicles/${vehicle.brand.toLowerCase()}/${vehicle.model.toLowerCase()}`}
                className="hover:text-gray-700"
              >
                {vehicle.model}
              </a>
            </li>
            <li>›</li>
            <li className="text-gray-900 font-medium">{vehicle.type}</li>
          </ol>
        </nav>
      </div>
    </header>
  );
});
