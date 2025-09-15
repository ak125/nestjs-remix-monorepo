// 📁 frontend/app/components/home/FamilyGammeHierarchy.tsx
// 🏗️ Composant d'affichage de la hiérarchie Familles → Gammes (sous-catégories)

import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { hierarchyApi, type FamilyWithGammes, type HierarchyStats } from '../../services/api/hierarchy.api';

interface FamilyGammeHierarchyProps {
  className?: string;
}

export default function FamilyGammeHierarchy({ 
  className = ''
}: FamilyGammeHierarchyProps) {
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [stats, setStats] = useState<HierarchyStats>({
    total_families: 0,
    total_gammes: 0,
    total_manufacturers: 0,
    families_with_gammes: 0
  });
  const [loading, setLoading] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);

  // Charger les données au montage du composant
  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        const data = await hierarchyApi.getHomepageData();
        setFamilies(data.families); // Afficher toutes les familles
        setStats(data.stats);
        
        // Auto-expand les premières familles pour l'affichage
        if (data.families.length > 0) {
          setExpandedFamilies(data.families.slice(0, 3).map(f => f.mf_id));
        }
      } catch (error) {
        console.error('Erreur chargement hiérarchie:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, []); // Plus de dépendance à maxFamilies
  
  // Toggle d'expansion d'une famille
  const toggleFamily = (familyId: string) => {
    setExpandedFamilies(prev => 
      prev.includes(familyId)
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
        <p className="text-center text-gray-500 mt-6">
          🏗️ Chargement de la hiérarchie des catégories...
        </p>
      </div>
    );
  }

  if (families.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏗️</div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Aucune catégorie disponible
          </h3>
          <p className="text-gray-600">
            La hiérarchie des catégories n'est pas encore configurée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg ${className}`}>
      {/* En-tête avec statistiques */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white p-6 rounded-t-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">🏗️ Catégories de Produits</h2>
          <div className="text-right">
            <div className="text-3xl font-bold">{stats.total_gammes}</div>
            <div className="text-sm opacity-90">Sous-catégories</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{families.length}</div>
            <div className="text-xs opacity-90">Familles affichées</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.families_with_gammes}</div>
            <div className="text-xs opacity-90">Familles actives</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{stats.total_manufacturers}</div>
            <div className="text-xs opacity-90">Fabricants</div>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">
              {stats.total_gammes > 0 ? Math.round(stats.total_gammes / stats.families_with_gammes) : 0}
            </div>
            <div className="text-xs opacity-90">Moy./famille</div>
          </div>
        </div>
      </div>

      {/* Grille des familles */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {families.map((family) => {
            const isExpanded = expandedFamilies.includes(family.mf_id);
            const familyIcon = hierarchyApi.getFamilyIcon(family);
            const familyColor = hierarchyApi.getFamilyColor(family);
            const familyImage = hierarchyApi.getFamilyImage(family);
            
            return (
              <div key={family.mf_id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                {/* En-tête de la famille */}
                <div className={`bg-gradient-to-r ${familyColor} text-white p-4`}>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-2xl">{familyIcon}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg">{family.mf_name_system}</h3>
                      <p className="text-sm opacity-90">{family.mf_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="bg-white bg-opacity-30 rounded-full px-3 py-1 text-sm font-bold">
                      {family.gammes_count} sous-catégories
                    </span>
                    <button
                      onClick={() => toggleFamily(family.mf_id)}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Image et description */}
                <div className="p-4">
                  <div className="aspect-video bg-gray-100 rounded-lg mb-3 overflow-hidden">
                    <img
                      src={familyImage}
                      alt={family.mf_name_system}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = '/images/categories/default.svg';
                      }}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-600 line-clamp-3">
                    {family.mf_description}
                  </p>
                </div>

                {/* Sous-catégories (gammes) */}
                {isExpanded && (
                  <div className="bg-gray-50 p-4 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">
                      Sous-catégories ({family.gammes_count})
                    </h4>
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                      {family.gammes.slice(0, 10).map((gamme, index) => (
                        <div
                          key={gamme.mc_id}
                          className="bg-white rounded p-2 text-sm hover:bg-blue-50 transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-700">
                              {gamme.pg_name || `Gamme #${gamme.mc_pg_id}`}
                            </span>
                            <span className="text-xs text-gray-500">
                              Fab. {gamme.mc_mf_id}
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      {family.gammes_count > 10 && (
                        <div className="text-center py-2">
                          <Link
                            to={`/catalog/family/${family.mf_id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Voir les {family.gammes_count - 10} autres →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Pied de carte */}
                <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                  <Link
                    to={`/catalog/family/${family.mf_id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                  >
                    Explorer {family.mf_name_system} →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pied de page avec actions */}
      <div className="bg-gray-50 px-6 py-4 rounded-b-lg border-t border-gray-200">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {expandedFamilies.length} famille(s) dépliée(s) sur {families.length}
          </div>
          <div className="space-x-3">
            <button
              onClick={() => setExpandedFamilies(families.map(f => f.mf_id))}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Tout déplier
            </button>
            <button
              onClick={() => setExpandedFamilies([])}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Tout replier
            </button>
            <Link
              to="/catalog"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              Voir tout le catalogue
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}