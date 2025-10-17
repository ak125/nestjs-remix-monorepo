// 📁 frontend/app/components/home/FamilyGammeBento.tsx
// 🎨 Design Bento moderne pour le catalogue de familles

import { useState, useEffect } from 'react';
import { hierarchyApi, type FamilyWithGammes, type HierarchyStats } from '../../services/api/hierarchy.api';

interface FamilyGammeBentoProps {
  className?: string;
}

export default function FamilyGammeBento({ className = "" }: FamilyGammeBentoProps) {
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HierarchyStats>({
    total_families: 0,
    total_gammes: 0,
    total_manufacturers: 0,
    families_with_gammes: 0,
  });

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        const data = await hierarchyApi.getHomepageData();
        setFamilies(data.families);
        setStats(data.stats);
      } catch (error) {
        console.error('Erreur chargement hiérarchie:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, []);

  if (loading) {
    return (
      <div className={`w-full max-w-7xl mx-auto p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-lg w-1/2 mx-auto mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full max-w-7xl mx-auto p-6 ${className}`}>
      {/* Header avec statistiques */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Catalogue de Pièces Automobiles
        </h2>
        <div className="flex justify-center gap-8 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            {stats.total_families} familles
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            {stats.total_gammes} gammes
          </span>
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            {stats.total_manufacturers} fabricants
          </span>
        </div>
      </div>

      {/* Grille Bento adaptative */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {families.map((family, index) => {
          const familyIcon = hierarchyApi.getFamilyIcon(family);
          const familyColor = hierarchyApi.getFamilyColor(family);
          const familyImage = hierarchyApi.getFamilyImage(family);
          
          // Logique pour varier les tailles des cartes Bento
          const isLarge = index % 7 === 0; // Une carte large toutes les 7
          const isTall = index % 5 === 0 && index % 7 !== 0; // Une carte haute toutes les 5 (sauf les larges)
          
          return (
            <div
              key={family.mf_id}
              className={`
                group relative overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100
                hover:shadow-xl hover:border-gray-200 transition-all duration-300 cursor-pointer
                ${isLarge ? 'md:col-span-2 lg:col-span-2' : ''}
                ${isTall ? 'md:row-span-2' : ''}
              `}
              style={{
                background: `linear-gradient(135deg, ${familyColor}15 0%, ${familyColor}05 100%)`,
              }}
            >
              {/* Image de fond avec overlay */}
              <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity">
                <img
                  src={familyImage}
                  alt={family.mf_name_system}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/10"></div>
              
              {/* Contenu */}
              <div className="relative h-full p-6 flex flex-col min-h-[200px]">
                {/* Header avec icône */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                      style={{ backgroundColor: familyColor }}
                    >
                      <span className="text-xl">{familyIcon}</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">
                        {family.mf_name_system}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {family.gammes_count} gammes
                      </p>
                    </div>
                  </div>
                  
                  {/* Badge du nombre de gammes */}
                  <div 
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: familyColor }}
                  >
                    {family.gammes_count}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">
                  {family.mf_description || "Découvrez notre gamme complète de pièces automobiles."}
                </p>

                {/* Image produit dans les cartes larges */}
                {isLarge && (
                  <div className="mb-4 rounded-xl overflow-hidden bg-gray-50">
                    <img
                      src={familyImage}
                      alt={family.mf_name_system}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Aperçu des gammes pour cartes hautes */}
                {isTall && family.gammes.length > 0 && (
                  <div className="mt-auto">
                    <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Exemples de gammes
                    </h4>
                    <div className="space-y-1">
                      {family.gammes.slice(0, 3).map((gamme) => (
                        <div 
                          key={gamme.mc_id}
                          className="text-xs text-gray-600 bg-white/50 rounded px-2 py-1"
                        >
                          {gamme.pg_name || `Gamme #${gamme.mc_pg_id}`}
                        </div>
                      ))}
                      {family.gammes.length > 3 && (
                        <div className="text-xs text-gray-500 italic">
                          +{family.gammes.length - 3} autres...
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer avec CTA */}
                <div className="mt-auto pt-4 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {family.gammes_count} produits disponibles
                  </span>
                  <button 
                    className="group-hover:translate-x-1 transition-transform duration-200"
                    style={{ color: familyColor }}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Effet de survol */}
              <div className="absolute inset-0 ring-0 group-hover:ring-2 ring-blue-400/20 rounded-2xl transition-all"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}