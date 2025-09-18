// 🎨 Design Bento amélioré avec animations et lazy loading optimisé

import { Link } from '@remix-run/react';
import React, { useState, useEffect } from 'react';
import { hierarchyApi, type FamilyWithGammes, type HierarchyStats } from '../../services/api/hierarchy.api';
import { LazyCard } from '../ui/LazyCard';
import LazyImage from '../ui/LazyImage';

export default function FamilyGammeBentoEnhanced() {
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [stats, setStats] = useState<HierarchyStats>({
    total_families: 0,
    total_gammes: 0,
    total_manufacturers: 0,
    families_with_gammes: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hoveredFamily, setHoveredFamily] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  useEffect(() => {
    const loadHierarchy = async () => {
      try {
        setLoading(true);
        const data = await hierarchyApi.getHomepageData();
        setFamilies(data.families || []);
        setStats(data.stats);
      } catch (error) {
        console.error('❌ Erreur chargement hiérarchie:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHierarchy();
  }, []);

  // Pattern Bento sophistiqué avec 8 positions
  const getBentoLayout = (index: number) => {
    const layouts = [
      { cols: 'col-span-2', rows: 'row-span-2', size: 'large' },  // 0 - Grande carte hero
      { cols: 'col-span-1', rows: 'row-span-1', size: 'small' },  // 1 - Petite
      { cols: 'col-span-1', rows: 'row-span-1', size: 'small' },  // 2 - Petite
      { cols: 'col-span-2', rows: 'row-span-1', size: 'wide' },   // 3 - Large
      { cols: 'col-span-1', rows: 'row-span-2', size: 'tall' },   // 4 - Haute
      { cols: 'col-span-1', rows: 'row-span-1', size: 'small' },  // 5 - Petite
      { cols: 'col-span-1', rows: 'row-span-1', size: 'small' },  // 6 - Petite
      { cols: 'col-span-2', rows: 'row-span-1', size: 'wide' },   // 7 - Large
    ];
    return layouts[index % 8];
  };

  // Thèmes avec icônes et couleurs
  const getFamilyTheme = (family: FamilyWithGammes, index: number) => {
    const themes = [
      { 
        bg: 'from-gradient-to-br from-blue-600 via-blue-700 to-indigo-800', 
        accent: 'bg-blue-500', 
        icon: '🔧', 
        iconBg: 'bg-blue-100 text-blue-700',
        border: 'border-blue-200'
      },
      { 
        bg: 'from-gradient-to-br from-emerald-600 via-green-700 to-teal-800', 
        accent: 'bg-green-500', 
        icon: '⚙️', 
        iconBg: 'bg-green-100 text-green-700',
        border: 'border-green-200'
      },
      { 
        bg: 'from-gradient-to-br from-purple-600 via-violet-700 to-purple-800', 
        accent: 'bg-purple-500', 
        icon: '🛠️', 
        iconBg: 'bg-purple-100 text-purple-700',
        border: 'border-purple-200'
      },
      { 
        bg: 'from-gradient-to-br from-red-600 via-rose-700 to-pink-800', 
        accent: 'bg-red-500', 
        icon: '🔩', 
        iconBg: 'bg-red-100 text-red-700',
        border: 'border-red-200'
      },
      { 
        bg: 'from-gradient-to-br from-orange-600 via-amber-700 to-yellow-800', 
        accent: 'bg-orange-500', 
        icon: '⚡', 
        iconBg: 'bg-orange-100 text-orange-700',
        border: 'border-orange-200'
      },
      { 
        bg: 'from-gradient-to-br from-teal-600 via-cyan-700 to-blue-800', 
        accent: 'bg-teal-500', 
        icon: '🎯', 
        iconBg: 'bg-teal-100 text-teal-700',
        border: 'border-teal-200'
      },
      { 
        bg: 'from-gradient-to-br from-indigo-600 via-blue-700 to-purple-800', 
        accent: 'bg-indigo-500', 
        icon: '💎', 
        iconBg: 'bg-indigo-100 text-indigo-700',
        border: 'border-indigo-200'
      },
      { 
        bg: 'from-gradient-to-br from-pink-600 via-rose-700 to-red-800', 
        accent: 'bg-pink-500', 
        icon: '🚗', 
        iconBg: 'bg-pink-100 text-pink-700',
        border: 'border-pink-200'
      },
    ];
    return themes[index % themes.length];
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Header skeleton */}
          <div className="text-center space-y-4">
            <div className="h-10 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-96 mx-auto animate-pulse"></div>
            <div className="flex justify-center gap-8">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 bg-gray-200 rounded-full w-24 animate-pulse"></div>
              ))}
            </div>
          </div>
          
          {/* Bento grid skeleton */}
          <div className="grid grid-cols-4 gap-6 auto-rows-[180px]">
            {[...Array(8)].map((_, i) => {
              const layout = getBentoLayout(i);
              return (
                <div
                  key={i}
                  className={`${layout.cols} ${layout.rows} bg-gradient-to-br from-gray-200 to-gray-300 rounded-3xl animate-pulse`}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12">
      {/* En-tête premium avec statistiques */}
      <div className="text-center space-y-6 mb-12">
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent">
            Catalogue Premium
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Découvrez notre collection exclusive de pièces automobiles
          </p>
        </div>
        
        {/* Statistiques avec design premium */}
        <div className="flex justify-center gap-8 flex-wrap">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 font-semibold">{stats.total_families} Familles</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 font-semibold">{stats.total_gammes} Gammes</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl px-6 py-4 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></div>
              <span className="text-gray-700 font-semibold">{stats.total_manufacturers} Fabricants</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grille Bento sophistiquée */}
      <div className="grid grid-cols-4 gap-6 auto-rows-[180px] mb-12">
        {families.slice(0, 16).map((family, index) => {
          const layout = getBentoLayout(index);
          const theme = getFamilyTheme(family, index);
          const familyImage = hierarchyApi.getFamilyImage(family);
          const isHovered = hoveredFamily === family.mf_id;
          const isSelected = selectedFamily === family.mf_id;
          const isLarge = layout.size === 'large';
          const isWide = layout.size === 'wide';

          return (
            <LazyCard
              key={family.mf_id}
              className={`
                ${layout.cols} ${layout.rows} 
                group relative overflow-hidden rounded-3xl 
                shadow-xl hover:shadow-2xl
                transition-all duration-700 ease-out cursor-pointer
                transform hover:scale-[1.02] hover:-translate-y-1
                ${isSelected ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}
                ${isHovered ? 'z-10' : ''}
              `}
              onMouseEnter={() => setHoveredFamily(family.mf_id)}
              onMouseLeave={() => setHoveredFamily(null)}
              onClick={() => setSelectedFamily(family.mf_id)}
              animationType="fade"
              delay={index * 150}
            >
              {/* Background avec dégradé sophistiqué */}
              <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg.replace('from-gradient-to-br ', '')} opacity-95`} />
              
              {/* Image de fond avec parallax et lazy loading */}
              {familyImage && (
                <div className="absolute inset-0 overflow-hidden">
                  <LazyImage
                    src={familyImage}
                    alt={family.mf_name_system}
                    className={`
                      w-full h-full object-cover transition-all duration-1000
                      ${isHovered ? 'scale-110 opacity-40' : 'scale-100 opacity-20'}
                    `}
                  />
                </div>
              )}
              
              {/* Overlay avec mesh pattern */}
              <div className="absolute inset-0 bg-black bg-opacity-20" />
              
              {/* Contenu principal */}
              <div className="absolute inset-0 p-6 flex flex-col justify-between">
                {/* Header avec icône et badge */}
                <div className="flex justify-between items-start">
                  <div className="space-y-3">
                    {/* Icône dans un cercle */}
                    <div className={`${theme.iconBg} w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg`}>
                      {theme.icon}
                    </div>
                    
                    {/* Titre */}
                    <h3 className={`font-bold text-white ${isLarge ? 'text-2xl' : isWide ? 'text-xl' : 'text-lg'} line-clamp-2 leading-tight`}>
                      {family.mf_name_system || `Famille ${family.mf_id}`}
                    </h3>
                  </div>
                  
                  {/* Badge flottant */}
                  <div className="bg-white bg-opacity-20 backdrop-blur-md rounded-2xl px-4 py-2 shadow-lg">
                    <span className="text-white font-bold text-sm">
                      {family.gammes_count}
                    </span>
                    <div className="text-white text-xs opacity-75">gammes</div>
                  </div>
                </div>

                {/* Description (pour grandes cartes seulement) */}
                {isLarge && (
                  <div className="text-white text-sm opacity-90 line-clamp-4 leading-relaxed mb-4">
                    {family.mf_description || 'Découvrez notre gamme complète de pièces automobiles de haute qualité.'}
                  </div>
                )}

                {/* Footer interactif */}
                <div className="space-y-3">
                  {/* Gammes populaires au hover */}
                  {isHovered && family.gammes.length > 0 && (
                    <div className="bg-white bg-opacity-15 backdrop-blur-md rounded-2xl p-4 transform transition-all duration-500">
                      <div className="text-white text-xs font-semibold mb-2 opacity-90">
                        🔥 Gammes populaires
                      </div>
                      <div className="space-y-2">
                        {family.gammes.slice(0, isLarge ? 4 : 2).map((gamme) => {
                          // 🔄 Générer l'URL pour la gamme
                          const gammeSlug = (gamme.pg_name || `gamme-${gamme.mc_pg_id}`)
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
                            .replace(/[^a-z0-9\s-]/g, '') // Garde seulement lettres, chiffres, espaces et tirets
                            .replace(/\s+/g, '-') // Remplace espaces par tirets
                            .replace(/-+/g, '-') // Évite les tirets multiples
                            .trim();
                          
                          const gammeUrl = `/pieces/${gammeSlug}-${gamme.mc_pg_id}.html`;
                          
                          return (
                            <Link 
                              key={gamme.mc_id} 
                              to={gammeUrl}
                              className="flex justify-between items-center text-white text-xs hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors"
                            >
                              <span className="truncate opacity-90 hover:opacity-100">
                                {gamme.pg_name || `Gamme #${gamme.mc_pg_id}`}
                              </span>
                              <span className="text-xs opacity-60 ml-2 bg-white bg-opacity-20 px-2 py-1 rounded-full">
                                #{gamme.mc_pg_id}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Call to action avec gradient */}
                  <div className="flex justify-between items-center">
                    <span className="text-white text-xs opacity-75">
                      {family.gammes_count} produits disponibles
                    </span>
                    <button className={`
                      ${theme.accent} text-white px-4 py-2 rounded-xl text-xs font-semibold 
                      shadow-lg hover:shadow-xl transition-all duration-300 
                      transform hover:scale-105 hover:brightness-110
                      backdrop-blur-sm
                    `}>
                      Explorer →
                    </button>
                  </div>
                </div>
              </div>

              {/* Bordure animée au hover */}
              <div className={`
                absolute inset-0 border-2 border-white rounded-3xl transition-all duration-500
                ${isHovered ? 'opacity-30 scale-105' : 'opacity-0 scale-100'}
              `} />
              
              {/* Effet de brillance */}
              <div className={`
                absolute inset-0 bg-gradient-to-br from-white via-transparent to-transparent opacity-0 
                group-hover:opacity-10 transition-opacity duration-700 rounded-3xl
              `} />
            </LazyCard>
          );
        })}
      </div>

      {/* Call to action premium */}
      <div className="text-center space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-8 text-white shadow-2xl">
          <h3 className="text-2xl font-bold mb-4">Prêt à explorer notre catalogue complet ?</h3>
          <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
            Accédez à plus de {stats.total_gammes} gammes de pièces automobiles de qualité professionnelle
          </p>
          <button className="bg-white text-blue-600 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all duration-300 transform hover:scale-105 shadow-xl">
            🚀 Découvrir le catalogue complet
          </button>
        </div>
      </div>
    </div>
  );
}