/**
 * 🚗 VehicleCarousel - Affichage moderne des véhicules compatibles
 * Grid responsive avec cartes véhicules élégantes (shadcn/ui)
 */

import { Car, Fuel, Gauge, Calendar, ChevronDown } from "lucide-react";
import { useState } from "react";
import LazySection from "~/components/layout/LazySection";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";

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

const PAGE_SIZE = 12;

const VehicleCarousel: React.FC<VehicleCarouselProps> = ({
  vehicles,
  gamme,
  title,
  seoSwitches = [],
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!vehicles || vehicles.length === 0) {
    return null;
  }

  // Générer un titre dynamique basé sur la gamme
  const gammeName = gamme
    ? gamme.charAt(0).toUpperCase() + gamme.slice(1).replace(/-/g, " ")
    : "";

  const dynamicTitle =
    title ||
    (gamme
      ? `Véhicules fréquemment concernés par le remplacement ${gammeName ? `de ${gammeName}` : ""}`
      : "Véhicules compatibles");

  // Map des types de carburant pour affichage
  const fuelTypeMap: Record<string, string> = {
    Diesel: "⛽ Diesel",
    Essence: "⛽ Essence",
    Electrique: "🔋 Électrique",
    Hybrid: "🔌 Hybride",
    GPL: "💨 GPL",
  };

  const hasMore = vehicles.length > visibleCount;

  return (
    <LazySection minHeight={400}>
      <section className="my-12 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {dynamicTitle}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mt-2">
            <strong className="text-gray-800">
              {vehicles.length} motorisations
            </strong>{" "}
            identifiées d'après les données de compatibilité constructeur —
            usure normale, usage spécifique ou kilométrage élevé.
          </p>
        </div>

        {/* Grid responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicles.slice(0, visibleCount).map((vehicle) => (
            <VehicleCard
              key={vehicle.type_id}
              vehicle={vehicle}
              fuelTypeMap={fuelTypeMap}
              gamme={gamme}
              seoSwitches={seoSwitches}
            />
          ))}
        </div>

        {/* Voir plus */}
        {hasMore && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
              Voir plus de véhicules ({vehicles.length - visibleCount} restants)
            </button>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-lg mx-auto">
            Données de compatibilité constructeur. Vérifiez l'année et la
            motorisation de votre véhicule avant commande.
          </p>
        </div>
      </section>
    </LazySection>
  );
};

// 🎴 Carte véhicule individuelle
interface VehicleCardProps {
  vehicle: CompatibleVehicle;
  fuelTypeMap: Record<string, string>;
  gamme?: string;
  seoSwitches?: SeoItemSwitch[];
}

const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  fuelTypeMap,
  gamme,
  seoSwitches = [],
}) => {
  const fuelDisplay = fuelTypeMap[vehicle.type_fuel] || vehicle.type_fuel;

  // Générer un nom de pièce lisible
  const pieceName = gamme
    ? gamme.charAt(0).toUpperCase() + gamme.slice(1).replace(/-/g, " ")
    : "cette pièce";

  // Utiliser les vrais switches depuis la BDD ou fallback déterministe
  // SSR-safe: sélection basée sur type_id (pas de Math.random() pour éviter mismatch hydratation)
  let seoContent = "";
  if (seoSwitches && seoSwitches.length > 0) {
    // Sélection déterministe basée sur type_id
    const selectedSwitch = seoSwitches[vehicle.type_id % seoSwitches.length];
    seoContent = selectedSwitch.sis_content;
  } else {
    // Fallback: sélection déterministe basée sur type_id
    const actions = [
      `à vérifier si vibrations`,
      `contrôle recommandé en cas de bruit anormal`,
      `à surveiller si usage urbain fréquent`,
      `remplacement courant lors de la révision`,
      `à inspecter si kilométrage > 80 000 km`,
      `à vérifier en cas de perte d'efficacité`,
    ];
    const selectedAction = actions[vehicle.type_id % actions.length];

    const purposes = [
      `pour garantir la production de l'énergie électrique nécessaire`,
      `pour assurer le courant d'alimentation des composants électriques`,
      `pour la production du courant nécessaire à l'alimentation du système électrique`,
      `pour garantir le bon fonctionnement du système électrique`,
      `pour assurer une alimentation électrique stable`,
    ];
    const selectedPurpose = purposes[vehicle.type_id % purposes.length];

    seoContent = `${selectedAction} les ${pieceName} ${vehicle.marque_name} ${vehicle.modele_name} ${vehicle.type_power} ch, ${selectedPurpose} du véhicule.`;
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
                width={96}
                height={32}
                className="h-8 w-auto object-contain filter brightness-0 invert"
                loading="lazy"
              />
            ) : (
              <Badge
                variant="secondary"
                className="text-white bg-white/20 font-bold text-base border-0"
              >
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
              width={300}
              height={160}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="text-center">
              <Car className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Image non disponible
              </p>
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
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Puissance
                </p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {vehicle.type_power} ch
                </p>
              </div>
            </div>

            {/* Carburant */}
            <div className="flex items-center gap-2 text-sm">
              <div className="p-2 bg-success/10 dark:bg-success/98/30 rounded-lg">
                <Fuel className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Carburant
                </p>
                <p className="font-semibold text-gray-900 dark:text-white text-xs">
                  {fuelDisplay}
                </p>
              </div>
            </div>
          </div>

          {/* Contenu dynamique SEO depuis la BDD */}
          {gamme && seoContent && (
            <div className="pt-3 pb-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {pieceName} — {vehicle.marque_name} {vehicle.modele_name}
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
              <span>Voir pièces compatibles</span>
              <svg
                className="w-5 h-5 transform group-hover:translate-x-1 transition-transform"
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
      </Card>
    </a>
  );
};

export default VehicleCarousel;
