import { Link } from "@remix-run/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { type TopGamme } from "../../types/catalog.types";

interface TopGammesProps {
  topGammesData: {
    data?: TopGamme[];
    stats?: { total_top_gammes: number };
    success?: boolean;
  } | null;
  className?: string;
  title?: string;
}

/**
 * Composant TopGammes - Reproduit la section 4 PHP
 * Affiche les gammes avec PG_TOP=1 en carousel
 * Basé sur: SELECT DISTINCT pg_name, pg_alias, pg_id FROM pieces_gamme WHERE pg_top = 1
 */
export function TopGammes({ 
  topGammesData, 
  className = "",
  title = "Nos gammes les plus populaires"
}: TopGammesProps) {
  
  // Extraire les gammes TOP
  const topGammes = useMemo(() => {
    if (!topGammesData?.data) return [];
    return topGammesData.data;
  }, [topGammesData]);

  // Si pas de gammes TOP, ne rien afficher
  if (topGammes.length === 0) {
    return null;
  }

  return (
    <div className={`bg-white py-16 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* En-tête de section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
          <div className="mt-2 h-1 w-20 bg-gradient-to-r from-orange-500 to-red-600 mx-auto rounded"></div>
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
            Découvrez notre sélection des {topGammes.length} gammes de pièces les plus demandées par nos clients
          </p>
        </div>

        {/* Carousel des gammes TOP */}
        <div className="relative">
          {/* Container avec scroll horizontal pour mobile */}
          <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-hide lg:grid lg:grid-cols-4 lg:gap-8 lg:overflow-visible lg:pb-0">
            {topGammes.map((gamme) => {
              // URL vers la page gamme (logique PHP reproduite)
              const gammeUrl = `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`;
              
              // Image de gamme (logique PHP)
              const gammeImageUrl = gamme.pg_img 
                ? `/upload/articles/gammes/${gamme.pg_img}`
                : '/upload/loading-min.gif';

              return (
                <div 
                  key={gamme.pg_id} 
                  className="flex-shrink-0 w-64 lg:w-auto bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 group"
                >
                  <Link to={gammeUrl} className="block">
                    {/* Image de gamme */}
                    <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-xl overflow-hidden">
                      <img 
                        src={gammeImageUrl}
                        alt={gamme.pg_name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                    
                    {/* Contenu */}
                    <div className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                        {gamme.pg_name}
                      </h3>
                      <div className="mt-3 flex items-center text-orange-600 font-medium group-hover:text-orange-700">
                        <span className="text-sm">Voir les produits</span>
                        <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Boutons de navigation pour desktop (optionnel) */}
          <div className="hidden lg:flex justify-center mt-8 gap-4">
            <button className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <button className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Statistiques */}
        {topGammesData?.stats && (
          <div className="mt-12 text-center">
            <div className="inline-flex items-center px-6 py-3 bg-orange-50 rounded-full">
              <span className="text-orange-800 font-medium">
                {topGammesData.stats.total_top_gammes} gammes sélectionnées pour leur qualité exceptionnelle
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopGammes;