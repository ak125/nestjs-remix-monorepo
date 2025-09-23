// 🚗 VehicleCard - Composant moderne pour l'affichage des véhicules
// Design moderne avec animations et informations enrichies

import { Link } from '@remix-run/react';
import { Calendar, Car, Fuel, Zap } from 'lucide-react';

interface VehicleCardProps {
  vehicle: {
    cgc_type_id: number;
    type_alias: string;
    type_name: string;
    type_name_meta: string;
    type_power_ps: number;
    type_month_from: number;
    type_year_from: number;
    type_month_to?: number;
    type_year_to?: number;
    type_fuel?: string;
    type_liter?: string;
    modele_id: number;
    modele_alias: string;
    modele_name: string;
    modele_name_meta?: string;
    modele_pic?: string;
    marque_id: number;
    marque_alias: string;
    marque_name: string;
    marque_name_meta?: string;
    marque_name_meta_title?: string;
  };
  className?: string;
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, className = "" }) => {
  // 🔗 Construction de l'URL du véhicule
  const vehicleUrl = `/constructeurs/${vehicle.marque_alias}/${vehicle.modele_alias}/${vehicle.type_alias}.html`;
  
  // 📅 Formatage de la période
  const formatDateRange = (monthFrom: number, yearFrom: number, monthTo?: number, yearTo?: number) => {
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const fromMonth = monthNames[monthFrom - 1] || '';
    const toMonth = monthTo ? monthNames[monthTo - 1] : '';
    
    if (yearTo && yearTo !== yearFrom) {
      return `${fromMonth} ${yearFrom} - ${toMonth} ${yearTo}`;
    } else if (monthTo && monthTo !== monthFrom) {
      return `${fromMonth} - ${toMonth} ${yearFrom}`;
    } else {
      return `Depuis ${fromMonth} ${yearFrom}`;
    }
  };

  const dateRange = formatDateRange(
    vehicle.type_month_from, 
    vehicle.type_year_from, 
    vehicle.type_month_to, 
    vehicle.type_year_to
  );

  // 🖼️ URL de l'image avec fallback
  const vehicleImageUrl = vehicle.modele_pic 
    ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-modeles/${vehicle.marque_alias}/${vehicle.modele_pic}`
    : '/images/placeholder-vehicle.png';

  return (
    <Link 
      to={vehicleUrl}
      className={`block group ${className}`}
      aria-label={`Voir les pièces pour ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`}
    >
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-blue-200 hover:-translate-y-1 h-full">
        
        {/* 🖼️ Image du véhicule */}
        <div className="relative overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          <img
            src={vehicleImageUrl}
            alt={`${vehicle.marque_name} ${vehicle.modele_name}`}
            className="w-full h-48 object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/placeholder-vehicle.png';
            }}
          />
          
          {/* 🏷️ Badge marque */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1 shadow-md">
            <span className="text-sm font-semibold text-gray-800">
              {vehicle.marque_name}
            </span>
          </div>

          {/* ⚡ Badge puissance */}
          {vehicle.type_power_ps && (
            <div className="absolute top-3 right-3 bg-blue-600/95 backdrop-blur-sm rounded-lg px-2 py-1 shadow-md">
              <div className="flex items-center space-x-1 text-white">
                <Zap className="w-3 h-3" />
                <span className="text-xs font-medium">{vehicle.type_power_ps} PS</span>
              </div>
            </div>
          )}
        </div>

        {/* 📋 Informations du véhicule */}
        <div className="p-6 space-y-4">
          
          {/* 🏷️ Titre principal */}
          <div>
            <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors duration-200 line-clamp-2">
              {vehicle.marque_name_meta_title || vehicle.marque_name} {vehicle.modele_name_meta || vehicle.modele_name}
            </h3>
            <p className="text-blue-600 font-semibold text-base mt-1">
              {vehicle.type_name_meta || vehicle.type_name}
            </p>
          </div>

          {/* 📊 Caractéristiques techniques */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            
            {/* 🗓️ Période */}
            <div className="flex items-center space-x-2 text-gray-600">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{dateRange}</span>
            </div>

            {/* ⛽ Carburant */}
            {vehicle.type_fuel && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Fuel className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{vehicle.type_fuel}</span>
              </div>
            )}

            {/* 🔧 Cylindrée */}
            {vehicle.type_liter && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Car className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{vehicle.type_liter}L</span>
              </div>
            )}

            {/* ⚡ Puissance (si pas déjà affichée en badge) */}
            {vehicle.type_power_ps && (
              <div className="flex items-center space-x-2 text-gray-600">
                <Zap className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{vehicle.type_power_ps} PS</span>
              </div>
            )}
          </div>

          {/* 🔗 Call-to-action */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                Voir les pièces
              </span>
              <div className="flex items-center space-x-1 text-blue-600 group-hover:text-blue-700">
                <span className="text-sm font-medium">Découvrir</span>
                <svg 
                  className="w-4 h-4 transform transition-transform duration-200 group-hover:translate-x-1" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 5l7 7-7 7" 
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default VehicleCard;