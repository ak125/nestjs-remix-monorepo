// 📁 frontend/app/components/home/FamilyGammeHierarchy.tsx
// 🏗️ Composant d'affichage de la hiérarchie Familles → Gammes (sous-catégories)

import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { hierarchyApi, type FamilyWithGammes, type HierarchyStats } from '../../services/api/hierarchy.api';

interface FamilyGammeHierarchyProps {
  className?: string;
  hierarchyData?: {
    families: FamilyWithGammes[];
    stats: HierarchyStats;
    success: boolean;
  } | null;
}

export default function FamilyGammeHierarchy({ 
  className = '',
  hierarchyData
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

  // Charger les données depuis les props ou faire un appel API
  useEffect(() => {
    console.log('🔍 FamilyGammeHierarchy - hierarchyData reçu:', hierarchyData);
    
    if (hierarchyData) {
      // Format de l'API: { success: true, families: [...], stats: {...} }
      if (hierarchyData.success && hierarchyData.families) {
        console.log('✅ Format API détecté avec', hierarchyData.families.length, 'familles');
        setFamilies(hierarchyData.families);
        setStats(hierarchyData.stats);
        
        // Auto-expand les premières familles pour l'affichage
        if (hierarchyData.families.length > 0) {
          setExpandedFamilies(hierarchyData.families.slice(0, 3).map(f => f.mf_id));
        }
        setLoading(false);
      } else if (Array.isArray(hierarchyData)) {
        // Format tableau direct
        console.log('✅ Format tableau détecté avec', hierarchyData.length, 'familles');
        setFamilies(hierarchyData);
        setStats({
          total_families: hierarchyData.length,
          total_gammes: hierarchyData.reduce((sum, family) => sum + (family.gammes_count || 0), 0),
          total_manufacturers: hierarchyData.length,
          families_with_gammes: hierarchyData.filter(f => f.gammes && f.gammes.length > 0).length
        });
        
        // Auto-expand les premières familles pour l'affichage
        if (hierarchyData.length > 0) {
          setExpandedFamilies(hierarchyData.slice(0, 3).map(f => f.mf_id));
        }
        setLoading(false);
      } else if (hierarchyData.families) {
        // Structure alternative avec families wrapper
        console.log('✅ Format wrapper détecté avec', hierarchyData.families.length, 'familles');
        setFamilies(hierarchyData.families);
        setStats(hierarchyData.stats || {
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0
        });
        
        // Auto-expand les premières familles pour l'affichage
        if (hierarchyData.families.length > 0) {
          setExpandedFamilies(hierarchyData.families.slice(0, 3).map(f => f.mf_id));
        }
        setLoading(false);
      } else {
        // Fallback vide
        console.log('⚠️ Format de données non reconnu:', hierarchyData);
        setFamilies([]);
        setStats({
          total_families: 0,
          total_gammes: 0,
          total_manufacturers: 0,
          families_with_gammes: 0
        });
        setLoading(false);
      }
    } else {
      console.log('⚠️ Aucune donnée hierarchyData fournie, fallback vers API');
      // Fallback : charger via API si pas de données en props
      const loadHierarchy = async () => {
        try {
          const data = await hierarchyApi.getHomepageData();
          setFamilies(data.families);
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
    }
  }, [hierarchyData]);
  
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
                                            {family.gammes.slice(0, 10).map((gamme, index) => {
                        console.log('🔍 Debug gamme:', { 
                          gamme, 
                          pgId: gamme.pg_id, 
                          mcPgId: gamme.mc_pg_id,
                          name: gamme.pg_name,
                          alias: gamme.pg_alias
                        });
                        
                        // Générer l'URL directement vers la page gamme au format pieces/{alias}-{id}.html
                        const categoryUrl = gamme.pg_id && gamme.pg_alias
                            ? `/pieces/${gamme.pg_alias}-${gamme.pg_id}.html`
                            : `/products/catalog?search=${encodeURIComponent(gamme.pg_name || '')}&gamme=${gamme.pg_id}`;
                        
                        return (
                          <Link
                            key={gamme.mc_id}
                            to={categoryUrl}
                            className="bg-white rounded p-2 text-sm hover:bg-blue-50 transition-colors block"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700">
                                {gamme.pg_name || `Gamme #${gamme.pg_id}`}
                              </span>
                              <span className="text-xs text-gray-500">
                                Fab. {gamme.mc_mf_id}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                      
                      {family.gammes_count > 10 && (
                        <div className="text-center py-2">
                          <Link
                            to={`/products/catalog?family=${family.mf_id}`}
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
                    to={`/products/catalog?family=${family.mf_id}`}
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