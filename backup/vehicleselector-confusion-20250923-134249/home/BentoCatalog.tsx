// 📁 frontend/app/components/home/BentoCatalog.tsx
// 🎨 Design Bento pour catalogue de familles - Version améliorée

import { useState, useEffect } from 'react';
import { hierarchyApi, type FamilyWithGammes, type HierarchyStats } from '../../services/api/hierarchy.api';

export default function BentoCatalog() {
  const [families, setFamilies] = useState<FamilyWithGammes[]>([]);
  const [stats, setStats] = useState<HierarchyStats>({
    total_families: 0,
    total_gammes: 0,
    total_manufacturers: 0,
    families_with_gammes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await hierarchyApi.getHomepageData();
        setFamilies(data.families);
        setStats(data.stats);
      } catch (error) {
        console.error('Erreur chargement catalogue:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="py-16">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  // Configuration Bento - Tailles variées pour un design dynamique
  const getBentoClass = (index: number) => {
    const patterns = [
      'col-span-2 row-span-2', // Grande carte
      'col-span-1 row-span-1', // Petite carte
      'col-span-1 row-span-2', // Carte haute
      'col-span-2 row-span-1', // Carte large
      'col-span-1 row-span-1', // Petite carte
      'col-span-1 row-span-1', // Petite carte
    ];
    return patterns[index % patterns.length];
  };

  return (
    <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Notre Catalogue
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Découvrez nos {stats.total_families} familles de produits avec plus de {stats.total_gammes} références
          </p>
        </div>

        {/* Grille Bento */}
        <div className="grid grid-cols-4 gap-4 auto-rows-[200px] max-w-6xl mx-auto">
          {families.map((family, index) => {
            const familyImage = hierarchyApi.getFamilyImage(family);
            
            return (
              <div
                key={family.mf_id}
                className={`${getBentoClass(index)} group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer`}
              >
                {/* Image de fond - SANS overlay pour éviter de couvrir */}
                <div className="absolute inset-0">
                  <img
                    src={familyImage}
                    alt={family.mf_name_system}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = '/images/categories/default.svg';
                    }}
                  />
                </div>

                {/* Overlay gradient subtil - SEULEMENT en bas pour le texte */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>

                {/* Badge compteur - En haut à droite */}
                <div className="absolute top-4 right-4 z-10">
                  <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold text-gray-800 shadow-lg">
                    {family.gammes_count} produits
                  </div>
                </div>

                {/* Contenu textuel - En bas */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                  <h3 className="text-white font-bold text-lg mb-2 leading-tight">
                    {family.mf_name_system || `Famille ${family.mf_id}`}
                  </h3>
                  
                  {family.mf_description && (
                    <p className="text-white/90 text-sm line-clamp-2">
                      {family.mf_description}
                    </p>
                  )}

                  {/* Indicateur hover */}
                  <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="flex items-center text-white text-sm">
                      <span>Voir les produits</span>
                      <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Effet de bordure au hover */}
                <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/30 rounded-2xl transition-all duration-300"></div>
              </div>
            );
          })}
        </div>

        {/* Statistiques en bas */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.total_families}</div>
            <div className="text-gray-600">Familles</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="text-3xl font-bold text-green-600 mb-2">{stats.total_gammes}</div>
            <div className="text-gray-600">Produits</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="text-3xl font-bold text-purple-600 mb-2">{stats.total_manufacturers}</div>
            <div className="text-gray-600">Fabricants</div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="text-3xl font-bold text-orange-600 mb-2">{stats.families_with_gammes}</div>
            <div className="text-gray-600">Catégories actives</div>
          </div>
        </div>
      </div>
    </section>
  );
}