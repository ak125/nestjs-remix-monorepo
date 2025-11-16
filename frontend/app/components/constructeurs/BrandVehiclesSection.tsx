import { Link } from '@remix-run/react';
import { Car, TrendingUp, Zap } from 'lucide-react';

interface Vehicle {
  type_id: number;
  type_name: string;
  type_power_ps: string;
  type_fuel: string;
  type_year_from: string;
  type_year_to: string | null;
  marque_name: string;
  modele_name: string;
  modele_pic: string | null;
  vehicle_url: string;
  image_url: string | null;
}

interface BrandVehiclesSectionProps {
  vehicles: Vehicle[];
  brandName: string;
}

export default function BrandVehiclesSection({ 
  vehicles, 
  brandName 
}: BrandVehiclesSectionProps) {
  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-2xl shadow-xl mb-8 overflow-hidden border border-gray-100">
      {/* Header avec gradient vert/bleu */}
      <div className="relative bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 p-6 md:p-8 overflow-hidden">
        {/* Effet de brillance animé */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]"></div>
        
        {/* Décoration géométrique */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
        
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
              <Car className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Véhicules {brandName} les plus recherchés
              </h2>
              <p className="text-white/80 text-sm mt-1">
                Trouvez rapidement les pièces pour ces modèles populaires
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg border border-white/20 w-fit">
            <TrendingUp className="w-5 h-5 text-white" />
            <span className="text-white font-bold text-lg">{vehicles.length}</span>
            <span className="text-white/90 text-sm font-medium">véhicules</span>
          </div>
        </div>
      </div>

      {/* Grid de véhicules */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-gray-50/50 to-white">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {vehicles.map((vehicle) => (
            <VehicleCard key={vehicle.type_id} vehicle={vehicle} />
          ))}
        </div>
      </div>
    </section>
  );
}

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const yearRange = vehicle.type_year_to 
    ? `${vehicle.type_year_from}-${vehicle.type_year_to}`
    : `depuis ${vehicle.type_year_from}`;

  return (
    <Link
      to={vehicle.vehicle_url}
      className="group relative bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:border-transparent hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* Bordure gradient au hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10 rounded-xl"></div>
      <div className="absolute inset-0 bg-white m-0.5 rounded-lg group-hover:m-[3px] transition-all duration-300"></div>
      
      {/* Contenu */}
      <div className="relative">
        {/* Image avec effet hover */}
        <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-teal-800/20 to-cyan-900/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <img 
            src={vehicle.image_url || '/images/default-vehicle.png'}
            alt={`${vehicle.marque_name} ${vehicle.modele_name}`}
            className="relative w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.src = '/images/default-vehicle.png';
            }}
          />
          
          {/* Badge puissance */}
          <div className="absolute top-3 right-3 bg-gradient-to-br from-emerald-600 to-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {vehicle.type_power_ps} ch
          </div>
        </div>
        
        {/* Info */}
        <div className="p-5">
          <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-teal-600 transition-colors">
            {vehicle.modele_name}
          </h3>
          <p className="text-teal-600 font-semibold text-base mb-3">
            {vehicle.type_name}
          </p>
          
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4 pb-4 border-b border-gray-200">
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-teal-600" />
              <span className="font-medium">{vehicle.type_power_ps} ch</span>
            </span>
            <span className="text-gray-500">{yearRange}</span>
          </div>
          
          {/* CTA */}
          <div className="flex items-center justify-between">
            <span className="text-teal-600 text-sm font-semibold group-hover:underline">
              Voir les pièces
            </span>
            <span className="text-teal-600 transform group-hover:translate-x-1 transition-transform duration-300">
              →
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
