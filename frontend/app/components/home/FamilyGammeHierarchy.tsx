// 📁 frontend/app/components/home/FamilyGammeHierarchy.tsx
// 🏗️ Composant d'affichage de la hiérarchie Familles → Gammes (sous-catégories)

import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';

interface FamilyWithGammes {
  mf_id: string;
  mf_name: string;
  mf_description: string;
  mf_pic: string;
  gammes_count: number;
}

interface FamilyGammeHierarchyProps {
  className?: string;
  initialData?: any; // Données du loader Remix
}

export default function FamilyGammeHierarchy({ 
  className = '',
  initialData = null
}: FamilyGammeHierarchyProps) {
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [loading, setLoading] = useState(!initialData); // Ne pas charger si on a déjà les données
  const [expandedFamilies, setExpandedFamilies] = useState<string[]>([]);

  // Charger les données au montage du composant
  useEffect(() => {
    const loadFamilies = async () => {
      try {
        // Si on a des données initiales, les utiliser
        if (initialData && initialData.categories) {
          console.log('📦 [FamilyGammeHierarchy] Using initial data from loader');
          const transformedFamilies = initialData.categories.map((family: any) => ({
            mf_id: family.mf_id,
            mf_name: family.mf_name,
            mf_description: family.mf_description,
            mf_pic: family.mf_pic,
            gammes_count: family.gammes_count || 0
          }));
          
          console.log('✅ [FamilyGammeHierarchy] Transformed initial families:', transformedFamilies.length);
          setFamilies(transformedFamilies);
          
          if (transformedFamilies.length > 0) {
            setExpandedFamilies(transformedFamilies.slice(0, 3).map((f: any) => f.mf_id));
          }
          setLoading(false);
          return;
        }

        // Sinon, charger depuis l'API
        console.log('🔄 [FamilyGammeHierarchy] Loading families from catalog API...');
        setLoading(true);
        
        const response = await fetch('/api/catalog/families/all');
        if (!response.ok) {
          throw new Error(`Erreur API catalog: ${response.status}`);
        }
        
        const catalogData = await response.json();
        console.log('📦 [FamilyGammeHierarchy] Catalog data received:', Array.isArray(catalogData) ? catalogData.length : 'not array');
        
        if (Array.isArray(catalogData)) {
          const transformedFamilies = catalogData.map((family: any) => ({
            mf_id: family.mf_id,
            mf_name: family.mf_name,
            mf_description: family.mf_description,
            mf_pic: family.mf_pic,
            gammes_count: family.gammes_count || 0
          }));
          
          setFamilies(transformedFamilies);
          
          console.log('✅ [FamilyGammeHierarchy] Transformed families:', transformedFamilies.length);
          console.log('🔍 [FamilyGammeHierarchy] Sample family:', transformedFamilies[0]);
          
          if (transformedFamilies.length > 0) {
            setExpandedFamilies(transformedFamilies.slice(0, 3).map((f: any) => f.mf_id));
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ [FamilyGammeHierarchy] Erreur lors du chargement des familles:', error);
        setLoading(false);
      }
    };

    loadFamilies();
  }, [initialData]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-4 text-gray-600">Chargement des familles...</span>
        </div>
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
          <p className="text-gray-600">La hiérarchie des catégories n'est pas encore configurée.</p>
        </div>
      </div>
    );
  }

  const toggleFamily = (familyId: string) => {
    setExpandedFamilies(prev =>
      prev.includes(familyId)
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* 📊 Affichage des familles par grille adaptative */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {families.map((family) => (
          <div 
            key={family.mf_id}
            className="group bg-gradient-to-br from-white to-gray-50 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 overflow-hidden"
          >
            {/* 🖼️ Image de famille */}
            <div className="h-32 bg-gradient-to-br from-blue-500 to-indigo-600 relative overflow-hidden">
              {family.mf_pic ? (
                <img 
                  src={`/images/families/${family.mf_pic}`}
                  alt={family.mf_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-white text-4xl font-bold opacity-80">
                    {family.mf_name.charAt(0)}
                  </div>
                </div>
              )}
              
              {/* 🏷️ Badge count gammes */}
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-semibold text-gray-700">
                {family.gammes_count} produits
              </div>
            </div>

            {/* 📝 Contenu de la carte */}
            <div className="p-5">
              <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-blue-700 transition-colors">
                {family.mf_name}
              </h3>
              
              <p className="text-gray-600 text-sm leading-relaxed mb-4 line-clamp-3">
                {family.mf_description}
              </p>

              {/* 🔗 Actions */}
              <div className="flex items-center justify-between">
                <Link
                  to={`/catalog/family/${family.mf_id}`}
                  className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm group-hover:underline"
                >
                  Voir la famille
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                <button
                  onClick={() => toggleFamily(family.mf_id)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={`${expandedFamilies.includes(family.mf_id) ? 'Réduire' : 'Développer'} ${family.mf_name}`}
                >
                  <svg 
                    className={`w-5 h-5 transform transition-transform ${
                      expandedFamilies.includes(family.mf_id) ? 'rotate-180' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* �� Zone étendue avec détails (si développée) */}
              {expandedFamilies.includes(family.mf_id) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Gammes disponibles:</strong> {family.gammes_count}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Cliquez sur "Voir la famille" pour explorer toutes les gammes.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 📈 Statistiques globales */}
      {families.length > 0 && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-600">{families.length}</div>
              <div className="text-sm text-blue-800">Familles</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-green-600">
                {families.reduce((sum, f) => sum + f.gammes_count, 0)}
              </div>
              <div className="text-sm text-green-800">Gammes</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-600">{expandedFamilies.length}</div>
              <div className="text-sm text-purple-800">Développées</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="text-2xl font-bold text-orange-600">
                {Math.round((families.reduce((sum, f) => sum + f.gammes_count, 0) / families.length) * 10) / 10}
              </div>
              <div className="text-sm text-orange-800">Gammes/Famille</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
