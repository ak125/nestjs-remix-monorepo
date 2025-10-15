import  { type VehicleData } from "~/types/vehicle.types";

interface VehicleInfoProps {
  vehicle: VehicleData;
}

export function VehicleInfo({ vehicle }: VehicleInfoProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Informations techniques
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Informations générales */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">
            Caractéristiques générales
          </h3>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Marque:</dt>
              <dd className="text-sm font-medium text-gray-900">{vehicle.brand}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Modèle:</dt>
              <dd className="text-sm font-medium text-gray-900">{vehicle.model}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Type:</dt>
              <dd className="text-sm font-medium text-gray-900">{vehicle.type}</dd>
            </div>
            {vehicle.year && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Année:</dt>
                <dd className="text-sm font-medium text-gray-900">{vehicle.year}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Informations moteur */}
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-3">
            Motorisation
          </h3>
          <dl className="space-y-2">
            {vehicle.engine && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Moteur:</dt>
                <dd className="text-sm font-medium text-gray-900">{vehicle.engine}</dd>
              </div>
            )}
            {vehicle.fuel && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Carburant:</dt>
                <dd className="text-sm font-medium text-gray-900">{vehicle.fuel}</dd>
              </div>
            )}
            {vehicle.power && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Puissance:</dt>
                <dd className="text-sm font-medium text-gray-900">{vehicle.power}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Description */}
      {vehicle.description && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Description</h3>
          <p className="text-gray-700 leading-relaxed">{vehicle.description}</p>
        </div>
      )}

      {/* Statistiques */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-gray-800 mb-3">Statistiques</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {vehicle.partsCount || 0}
            </div>
            <div className="text-sm text-gray-600">Pièces disponibles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">24h</div>
            <div className="text-sm text-gray-600">Livraison</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">✓</div>
            <div className="text-sm text-gray-600">Garantie</div>
          </div>
        </div>
      </div>
    </div>
  );
}