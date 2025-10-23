import { Link } from "@remix-run/react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { useMemo } from "react";
import { type Equipementier } from "../../types/catalog.types";

interface EquipementiersCarouselProps {
  equipementiersData: {
    data?: Equipementier[];
    stats?: { total_equipementiers: number };
    success?: boolean;
  } | null;
  className?: string;
  title?: string;
}

/**
 * Composant EquipementiersCarousel - Reproduit la section 6 PHP
 * Affiche les fournisseurs équipementiers de la table PIECES_MARQUE
 * Basé sur: SELECT DISTINCT pm_name, pm_id FROM pieces_marque
 */
export function EquipementiersCarousel({ 
  equipementiersData, 
  className = "",
  title = "Nos partenaires équipementiers"
}: EquipementiersCarouselProps) {
  
  // Extraire les équipementiers
  const equipementiers = useMemo(() => {
    if (!equipementiersData?.data) return [];
    return equipementiersData.data;
  }, [equipementiersData]);

  // Si pas d'équipementiers, ne rien afficher
  if (equipementiers.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-br from-gray-50 to-blue-50 py-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* En-tête de section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
          <div className="mt-2 h-1 w-20 bg-gradient-to-r from-purple-500 to-pink-600 mx-auto rounded"></div>
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
            Nous travaillons avec les meilleurs fabricants et fournisseurs du marché pour vous garantir 
            des pièces de qualité OE et équivalent.
          </p>
        </div>

        {/* Carousel des équipementiers */}
        <div className="relative">
          {/* Container avec scroll horizontal pour mobile */}
          <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide lg:grid lg:grid-cols-6 lg:gap-8 lg:overflow-visible lg:pb-0">
            {equipementiers.slice(0, 12).map((equipementier) => {
              // URL du logo équipementier (logique adaptée)
              const logoUrl = equipementier.pm_logo 
                ? `/upload/logos/equipementiers/${equipementier.pm_logo}`
                : '/upload/logo-placeholder.svg';

              return (
                <div 
                  key={equipementier.pm_id} 
                  className="flex-shrink-0 w-40 lg:w-auto bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 group"
                >
                  {/* Logo et nom */}
                  <div className="p-6 text-center">
                    {/* Logo équipementier */}
                    <div className="aspect-square bg-gray-50 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                      <img 
                        src={logoUrl}
                        alt={`Logo ${equipementier.pm_name}`} 
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    
                    {/* Nom de l'équipementier */}
                    <h3 className="text-sm font-semibold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                      {equipementier.pm_name}
                    </h3>
                    
                    {/* Description courte si disponible */}
                    {equipementier.pm_description && (
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {equipementier.pm_description}
                      </p>
                    )}
                    
                    {/* Lien vers site web si disponible */}
                    {equipementier.pm_website && (
                      <div className="mt-3">
                        <a 
                          href={equipementier.pm_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-xs text-purple-600 hover:text-purple-700 font-medium"
                        >
                          <span>Site web</span>
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Indicateur "voir plus" si plus de 12 équipementiers */}
          {equipementiers.length > 12 && (
            <div className="text-center mt-8">
              <Link 
                to="/equipementiers"
                className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
              >
                <span>Voir tous nos partenaires</span>
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        {/* Section confiance et partenariat */}
        <div className="mt-16 bg-white rounded-2xl shadow-lg p-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            
            {/* Stat 1 */}
            <div>
              <div className="text-3xl font-bold text-purple-600 mb-2">
                {equipementiersData?.stats?.total_equipementiers || equipementiers.length}+
              </div>
              <div className="text-gray-600 font-medium">Partenaires équipementiers</div>
            </div>
            
            {/* Stat 2 */}
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">20+</div>
              <div className="text-gray-600 font-medium">Années d'expérience</div>
            </div>
            
            {/* Stat 3 */}
            <div>
              <div className="text-3xl font-bold text-green-600 mb-2">100%</div>
              <div className="text-gray-600 font-medium">Pièces certifiées</div>
            </div>
            
            {/* Stat 4 */}
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">24h</div>
              <div className="text-gray-600 font-medium">Livraison express</div>
            </div>
          </div>
        </div>

        {/* Call to action */}
        <div className="text-center mt-12">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Vous êtes un équipementier ?
            </h3>
            <p className="text-gray-600 mb-6">
              Rejoignez notre réseau de partenaires de confiance et développez votre activité 
              avec notre plateforme de distribution.
            </p>
            <Link 
              to="/contact/partenaires"
              className="inline-flex items-center px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-medium shadow-lg"
            >
              Devenir partenaire
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EquipementiersCarousel;