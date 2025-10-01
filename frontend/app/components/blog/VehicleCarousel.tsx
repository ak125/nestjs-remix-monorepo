/**
 * 🚗 VehicleCarousel - Affichage moderne des véhicules compatibles
 * Grid responsive avec cartes véhicules élégantes
 */

import { Car, Fuel, Gauge, Calendar } from 'lucide-react';

export interface CompatibleVehicle {
  type_id: number;
  type_alias: string;
  type_name: string;
  type_power: number;
  type_fuel: string;
  type_body: string;
  period: string;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_pic: string | null;
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_logo: string | null;
  catalog_url: string;
}

interface VehicleCarouselProps {
  vehicles: CompatibleVehicle[];
  title?: string;
}

const VehicleCarousel: React.FC<VehicleCarouselProps> = ({ 
  vehicles,
  title = "🚗 Véhicules compatibles"
}) => {
  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  // Map des types de carburant pour affichage
  const fuelTypeMap: Record<string, string> = {
    'Diesel': '⛽ Diesel',
    'Essence': '⛽ Essence',
    'Electrique': '🔋 Électrique',
    'Hybrid': '🔌 Hybride',
    'GPL': '💨 GPL',
  };

  return (
    <section className="my-12 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 bg-blue-100 dark:bg-blue-900/30 px-6 py-3 rounded-full mb-4">
          <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Découvrez les {vehicles.length} véhicules compatibles avec cette pièce. 
          Cliquez sur un véhicule pour voir toutes les pièces disponibles.
        </p>
      </div>

      {/* Grid responsive */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.type_id} vehicle={vehicle} fuelTypeMap={fuelTypeMap} />
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          💡 <strong>Astuce :</strong> Sélectionnez votre véhicule pour découvrir toutes les pièces compatibles
        </p>
      </div>
    </section>
  );
};

// 🎴 Carte véhicule individuelle
interface VehicleCardProps {
  vehicle: CompatibleVehicle;
  fuelTypeMap: Record<string, string>;
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, fuelTypeMap }) => {
  const fuelDisplay = fuelTypeMap[vehicle.type_fuel] || vehicle.type_fuel;

  return (
    <a
      href={vehicle.catalog_url}
      className="block group h-full"
      aria-label={`Voir les pièces pour ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`}
    >
      <div className="h-full bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transform hover:-translate-y-1">
        
        {/* Header avec logo marque */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 p-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 transform -skew-y-3"></div>
          <div className="relative flex items-center justify-between">
            {vehicle.marque_logo ? (
              <img
                src={vehicle.marque_logo}
                alt={vehicle.marque_name}
                className="h-8 w-auto object-contain filter brightness-0 invert"
                loading="lazy"
              />
            ) : (
              <span className="text-white font-bold text-lg">{vehicle.marque_name}</span>
            )}
            <Car className="w-6 h-6 text-white/80" />
          </div>
        </div>

        {/* Image modèle */}
        <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center overflow-hidden">
          {vehicle.modele_pic ? (
            <img
              src={vehicle.modele_pic}
              alt={`${vehicle.marque_name} ${vehicle.modele_name}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="text-center">
              <Car className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">Image non disponible</p>
            </div>
          )}
          
          {/* Badge période */}
          <div className="absolute top-2 right-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-gray-700 dark:text-gray-300 shadow-lg">
            <Calendar className="w-3 h-3 inline mr-1" />
            {vehicle.period}
          </div>
        </div>

        {/* Contenu */}
        <div className="p-5 space-y-3">
          {/* Titre */}
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
              {vehicle.modele_name}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium line-clamp-1">
              {vehicle.type_name}
            </p>
          </div>

          {/* Specs */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            {/* Puissance */}
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Puissance</p>
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.type_power} ch</p>
              </div>
            </div>

            {/* Carburant */}
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Fuel className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Carburant</p>
                <p className="font-semibold text-gray-900 dark:text-white text-xs">{fuelDisplay}</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 font-semibold text-sm">
              <span>Voir les pièces disponibles</span>
              <svg 
                className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
};

export default VehicleCarousel;
