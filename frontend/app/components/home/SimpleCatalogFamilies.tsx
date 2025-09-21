import { Link } from "@remix-run/react";
import { useMemo } from "react";

// Interface pour les gammes (noms en minuscules pour Supabase)
interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_url?: string;
  pg_name_meta?: string;
  pg_pic?: string;
  pg_img?: string;
}

// Interface pour les familles (noms en minuscules pour Supabase)
interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_description?: string;
  mf_pic?: string;
  gammes: CatalogGamme[];
}

interface SimpleCatalogFamiliesProps {
  hierarchyData: {
    families?: CatalogFamily[];
    success?: boolean;
  } | CatalogFamily[] | null;
  className?: string;
  pageTitle?: string;
}

/**
 * Composant qui reproduit la LOGIQUE PHP originale avec design Tailwind
 * Basé sur la requête SQL PHP du catalogue de familles
 */
export function SimpleCatalogFamilies({ 
  hierarchyData, 
  className = "",
  pageTitle = "pièces détachées"
}: SimpleCatalogFamiliesProps) {
  
  // Extraire les familles selon le format de données (logique PHP reproduite)
  const families = useMemo(() => {
    let extractedFamilies: CatalogFamily[] = [];
    
    if (hierarchyData) {
      if (Array.isArray(hierarchyData)) {
        extractedFamilies = hierarchyData;
      } else if (hierarchyData.families && Array.isArray(hierarchyData.families)) {
        extractedFamilies = hierarchyData.families;
      }
    }
    
    return extractedFamilies;
  }, [hierarchyData]);

  // Si pas de familles, ne rien afficher (comme le PHP: if ($request_catalog_family->num_rows > 0))
  if (families.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-50 py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Catalogue {pageTitle}</h2>
          <div className="mt-2 h-1 w-16 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded"></div>
        </div>
        
        {/* Reproduction de la boucle PHP: while($result_catalog_family = $request_catalog_family->fetch_assoc()) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {families.map((family) => {
            // Logique PHP pour l'image de famille
            const familyImageUrl = family.mf_pic 
              ? `/upload/articles/familles-produits/${family.mf_pic}`
              : '/upload/loading-min.gif';
            
            return (
              <div key={family.mf_id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                {/* Image de famille */}
                <div className="aspect-video bg-gray-100">
                  <img 
                    src={familyImageUrl}
                    alt={family.mf_name} 
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                
                <div className="p-4 text-center">
                  {/* Nom de famille */}
                  <h3 className="text-lg font-bold text-gray-900 mb-3">{family.mf_name}</h3>
                  
                  {/* Boucle PHP des gammes reproduite */}
                  <div className="space-y-1 text-sm">
                    {family.gammes && family.gammes.slice(0, 10).map((gamme) => {
                      // URL vers la page gamme (logique PHP)
                      const gammeUrl = `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`;
                      
                      return (
                        <div key={gamme.pg_id}>
                          <Link 
                            to={gammeUrl} 
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          >
                            {gamme.pg_name}
                          </Link>
                        </div>
                      );
                    })}
                    
                    {/* Indicateur si plus de gammes disponibles */}
                    {family.gammes && family.gammes.length > 10 && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <Link 
                          to={`/products/catalog?family=${family.mf_id}`}
                          className="text-xs text-gray-500 hover:text-gray-700 italic"
                        >
                          ... et {family.gammes.length - 10} autres gammes
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
