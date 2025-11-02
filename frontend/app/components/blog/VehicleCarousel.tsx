/**
 * 🚗 VehicleCarousel - Affichage moderne des véhicules compatibles
 * Grid responsive avec cartes véhicules élégantes (shadcn/ui)
 */

import { Car, Fuel, Gauge, Calendar } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Card } from '~/components/ui/card';

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

interface SeoItemSwitch {
  sis_id: string;
  sis_pg_id: string;
  sis_alias: string;
  sis_content: string;
}

interface VehicleCarouselProps {
  vehicles: CompatibleVehicle[];
  gamme?: string;
  title?: string;
  seoSwitches?: SeoItemSwitch[];
}

const VehicleCarousel: React.FC<VehicleCarouselProps> = ({ 
  vehicles,
  gamme,
  title,
  seoSwitches = []
}) => {
  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  // Générer un titre dynamique basé sur la gamme
  const dynamicTitle = title || (
    gamme 
      ? `${gamme.charAt(0).toUpperCase() + gamme.slice(1).replace(/-/g, ' ')} pour les véhicules les plus concernés par le remplacement`
      : "🚗 Véhicules compatibles"
  );

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
        <div className="inline-flex items-center gap-3 bg-muted dark:bg-primary/98/30 px-6 py-3 rounded-full mb-4">
          <Car className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {dynamicTitle}
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          <strong>{vehicles.length} véhicules</strong> nécessitant le remplacement de cette pièce. 
          Sélectionnez votre modèle pour découvrir toutes les pièces détachées compatibles.
        </p>
      </div>

      {/* Grid responsive */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {vehicles.map((vehicle) => (
          <VehicleCard 
            key={vehicle.type_id} 
            vehicle={vehicle} 
            fuelTypeMap={fuelTypeMap}
            gamme={gamme}
            seoSwitches={seoSwitches}
          />
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
  gamme?: string;
  seoSwitches?: SeoItemSwitch[];
}

const VehicleCard: React.FC<VehicleCardProps> = ({ vehicle, fuelTypeMap, gamme, seoSwitches = [] }) => {
  const fuelDisplay = fuelTypeMap[vehicle.type_fuel] || vehicle.type_fuel;
  
  // Générer un nom de pièce lisible
  const pieceName = gamme 
    ? gamme.charAt(0).toUpperCase() + gamme.slice(1).replace(/-/g, ' ')
    : 'cette pièce';
  
  // Utiliser les vrais switches depuis la BDD ou fallback aléatoire
  let seoContent = '';
  if (seoSwitches && seoSwitches.length > 0) {
    // Utiliser un switch aléatoire depuis la base de données
    const randomSwitch = seoSwitches[Math.floor(Math.random() * seoSwitches.length)];
    seoContent = randomSwitch.sis_content;
  } else {
    // Fallback: générer aléatoirement (ancien système)
    const actions = [
      `contrôler si usée`,
      `vérifier en cas de bruit`,
      `changer si abîmé`,
      `remplacer si bloqué`,
      `contrôler si défaillant`,
      `vérifier si nécessaire`
    ];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    
    const purposes = [
      `pour garantir la production de l'énergie électrique nécessaire`,
      `pour assurer le courant d'alimentation des composants électriques`,
      `pour la production du courant nécessaire à l'alimentation du système électrique`,
      `pour garantir le bon fonctionnement du système électrique`,
      `pour assurer une alimentation électrique stable`
    ];
    const randomPurpose = purposes[Math.floor(Math.random() * purposes.length)];
    
    seoContent = `${randomAction} les ${pieceName} ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_power} ch, ${randomPurpose} du véhicule.`;
  }

  return (
    <a
      href={vehicle.catalog_url}
      className="block group h-full"
      aria-label={`Voir les pièces pour ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_name}`}
    >
      <Card className="h-full hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transform hover:-translate-y-1">
        
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
              <Badge variant="secondary" className="text-white bg-white/20 font-bold text-base border-0">
                {vehicle.marque_name}
              </Badge>
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
          <Badge className="absolute top-2 right-2 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg hover:bg-white dark:hover:bg-gray-900 border-gray-200 dark:border-gray-700">
            <Calendar className="w-3 h-3 inline mr-1" />
            {vehicle.period}
          </Badge>
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
              <div className="p-2 bg-muted dark:bg-primary/98/30 rounded-lg">
                <Gauge className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Puissance</p>
                <p className="font-semibold text-gray-900 dark:text-white">{vehicle.type_power} ch</p>
              </div>
            </div>

            {/* Carburant */}
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 bg-success/10 dark:bg-success/98/30 rounded-lg">
                <Fuel className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Carburant</p>
                <p className="font-semibold text-gray-900 dark:text-white text-xs">{fuelDisplay}</p>
              </div>
            </div>
          </div>

          {/* Contenu dynamique SEO depuis la BDD */}
          {gamme && seoContent && (
            <div className="pt-3 pb-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {pieceName} prix bas {vehicle.marque_name} {vehicle.modele_name}
                </span>
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                {seoContent}
              </p>
            </div>
          )}

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
      </Card>
    </a>
  );
};

export default VehicleCarousel;
