// 📁 frontend/app/components/home/CatalogGammeDisplay.tsx
// 🔧 Composant d'affichage des gammes de catalogue (table catalog_gamme)

import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
// TODO: Créer le fichier gammes.api.ts
// import { gammesApi, type GammesDisplayData, type CatalogGamme } from '../../services/api/gammes.api';

// Types temporaires en attendant la création du fichier API
type _CatalogGamme = any;
type GammesDisplayData = {
  manufacturers: Record<string, { name: string; gammes: any[] }>;
  stats: { total_gammes: number; total_manufacturers: number };
};
const gammesApi = { getGammesForDisplay: async () => ({ manufacturers: {}, stats: { total_gammes: 0, total_manufacturers: 0 } }) };

interface CatalogGammeDisplayProps {
  className?: string;
}

export default function CatalogGammeDisplay({ className = '' }: CatalogGammeDisplayProps) {
  const [gammesData, setGammesData] = useState<GammesDisplayData>({
    manufacturers: {},
    stats: { total_gammes: 0, total_manufacturers: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [expandedManufacturers, setExpandedManufacturers] = useState<string[]>([]);

  // Charger les gammes au montage du composant
  useEffect(() => {
    const loadGammes = async () => {
      try {
        const data = await gammesApi.getGammesForDisplay();
        setGammesData(data);
        
        // Auto-expand les premiers fabricants pour l'affichage
        const manufacturerIds = Object.keys(data.manufacturers);
        if (manufacturerIds.length > 0) {
          setExpandedManufacturers(manufacturerIds.slice(0, 3)); // Afficher les 3 premiers fabricants
        }
      } catch (error) {
        console.error('Erreur chargement gammes:', error);
      } finally {
        setLoading(false);
      }
    };

    loadGammes();
  }, []);
  
  // Toggle d'expansion d'un fabricant
  const toggleManufacturer = (manufacturerId: string) => {
    setExpandedManufacturers(prev => 
      prev.includes(manufacturerId)
        ? prev.filter(id => id !== manufacturerId)
        : [...prev, manufacturerId]
    );
  };

  // Fonction pour obtenir une couleur par fabricant
  const getManufacturerColor = (manufacturerId: string): string => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600', 
      'from-purple-500 to-purple-600',
      'from-red-500 to-red-600',
      'from-yellow-500 to-yellow-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600'
    ];
    const index = parseInt(manufacturerId) % colors.length;
    return colors[index];
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <p className="text-center text-gray-500 mt-4">
          🔧 Chargement des gammes de catalogue...
        </p>
      </div>
    );
  }

  if (gammesData.stats.total_gammes === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Aucune gamme disponible
          </h3>
          <p className="text-gray-600">
            Les gammes de catalogue ne sont pas encore configurées.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* En-tête avec statistiques */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🔧 Gammes de Catalogue</h2>
          <div className="text-right">
            <div className="text-3xl font-bold">{gammesData.stats.total_gammes}</div>
            <div className="text-sm opacity-90">Gammes disponibles</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Fabricants</span>
              <span className="text-xl font-bold">{gammesData.stats.total_manufacturers}</span>
            </div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Moyenne par fabricant</span>
              <span className="text-xl font-bold">
                {gammesData.stats.total_manufacturers > 0 
                  ? Math.round(gammesData.stats.total_gammes / gammesData.stats.total_manufacturers)
                  : 0
                }
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des fabricants et leurs gammes */}
      <div className="p-6">
        <div className="grid gap-4">
          {Object.entries(gammesData.manufacturers).map(([manufacturerId, manufacturerData]) => {
            const isExpanded = expandedManufacturers.includes(manufacturerId);
            const gradientColor = getManufacturerColor(manufacturerId);
            
            return (
              <div key={manufacturerId} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* En-tête du fabricant */}
                <button
                  onClick={() => toggleManufacturer(manufacturerId)}
                  className={`w-full bg-gradient-to-r ${gradientColor} text-white p-4 text-left hover:opacity-90 transition-opacity`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold">{manufacturerData.name}</h3>
                      <p className="text-sm opacity-90">
                        {manufacturerData.gammes.length} gammes disponibles
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-white bg-opacity-30 rounded-full px-3 py-1 text-sm font-bold">
                        {manufacturerData.gammes.length}
                      </span>
                      <svg
                        className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Liste des gammes (dépliable) */}
                {isExpanded && (
                  <div className="bg-gray-50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {manufacturerData.gammes.map((gamme) => (
                        <div
                          key={gamme.mc_id}
                          className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="text-sm font-medium text-gray-800">
                              {gamme.pg_name || `Gamme #${gamme.mc_pg_id}`}
                            </div>
                            <div className="text-xs text-gray-500">
                              Sort: {gamme.mc_sort}
                            </div>
                          </div>
                          
                          <div className="space-y-1 text-xs text-gray-600">
                            <div>ID: <span className="font-mono">{gamme.mc_id}</span></div>
                            <div>Fabricant: <span className="font-mono">{gamme.mc_mf_id}</span></div>
                            {gamme.mc_mf_prime && (
                              <div>Prime: <span className="font-mono">{gamme.mc_mf_prime}</span></div>
                            )}
                          </div>

                          <div className="mt-3 pt-2 border-t border-gray-100">
                            <Link
                              to={`/catalog/gamme/${gamme.mc_id}`}
                              className="text-blue-600 hover:text-blue-800 text-xs font-medium transition-colors"
                            >
                              Voir détails →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied de page avec actions */}
      <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {expandedManufacturers.length} fabricant(s) déplié(s) sur {gammesData.stats.total_manufacturers}
          </div>
          <div className="space-x-3">
            <button
              onClick={() => setExpandedManufacturers(Object.keys(gammesData.manufacturers))}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Tout déplier
            </button>
            <button
              onClick={() => setExpandedManufacturers([])}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Tout replier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}