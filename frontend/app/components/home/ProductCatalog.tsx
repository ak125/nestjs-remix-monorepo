// 📁 frontend/app/components/home/ProductCatalog.tsx
// 📂 Catalogue produits par catégories

import { Link } from '@remix-run/react';
import { Package, ChevronRight, Wrench, Car, Zap, Shield } from 'lucide-react';
import { useState } from 'react';

interface ProductCategory {
  gamme_id: number;
  gamme_name: string;
  gamme_alias?: string;
  gamme_description?: string;
  gamme_image?: string;
  products_count?: number;
  is_featured?: boolean;
}

interface ProductCatalogProps {
  categories: ProductCategory[];
  showDescription?: boolean;
  maxCategories?: number;
}

export function ProductCatalog({ 
  categories, 
  showDescription = true, 
  maxCategories = 12 
}: ProductCatalogProps) {
  const [showAll, setShowAll] = useState(false);
  
  // Icônes par catégorie (mapping basé sur les noms communs)
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    
    if (name.includes('moteur') || name.includes('engine')) return Wrench;
    if (name.includes('frein') || name.includes('brake')) return Shield;
    if (name.includes('electr') || name.includes('electric')) return Zap;
    if (name.includes('carross') || name.includes('body')) return Car;
    
    return Package; // Icône par défaut
  };

  // Couleurs par catégorie
  const getCategoryColor = (index: number) => {
    const colors = [
      'from-red-500 to-red-600',
      'from-blue-500 to-blue-600', 
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600',
      'from-yellow-500 to-yellow-600',
      'from-gray-500 to-gray-600',
      'from-cyan-500 to-cyan-600',
      'from-emerald-500 to-emerald-600',
    ];
    return colors[index % colors.length];
  };

  const displayedCategories = showAll 
    ? categories 
    : categories.slice(0, maxCategories);

  if (categories.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">Aucune catégorie de produits disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 🎯 En-tête */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Catalogue par catégories
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Explorez notre vaste sélection de pièces automobiles organisées par spécialités. 
          Trouvez rapidement ce dont vous avez besoin pour votre véhicule.
        </p>
      </div>

      {/* 📂 Grille des catégories */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {displayedCategories.map((category, index) => {
          const IconComponent = getCategoryIcon(category.gamme_name);
          const colorClass = getCategoryColor(index);
          
          return (
            <Link
              key={category.gamme_id}
              to={`/catalogue?category=${category.gamme_id}`}
              className="group"
            >
              <div className="bg-white rounded-2xl p-6 text-center hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 hover:border-transparent">
                {/* 🎨 Icône avec gradient */}
                <div className={`w-20 h-20 mx-auto mb-4 bg-gradient-to-br ${colorClass} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <IconComponent className="w-10 h-10 text-white" />
                </div>
                
                {/* 📝 Nom de la catégorie */}
                <h4 className="font-bold text-gray-900 text-lg mb-2 group-hover:text-blue-600 transition-colors">
                  {category.gamme_name}
                </h4>
                
                {/* 📊 Nombre de produits */}
                {category.products_count && (
                  <div className="bg-gray-100 text-gray-700 text-sm py-1 px-3 rounded-full inline-block mb-3 group-hover:bg-blue-100 group-hover:text-blue-800 transition-colors">
                    {category.products_count.toLocaleString()} produits
                  </div>
                )}
                
                {/* ⭐ Badge catégorie premium */}
                {category.is_featured && (
                  <div className="bg-gradient-to-r from-orange-400 to-orange-500 text-white text-xs py-1 px-2 rounded-full inline-block mb-3">
                    ⭐ Populaire
                  </div>
                )}
                
                {/* 📄 Description */}
                {showDescription && category.gamme_description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {category.gamme_description}
                  </p>
                )}
                
                {/* 🔗 Lien d'action */}
                <div className="flex items-center justify-center text-blue-600 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span>Explorer</span>
                  <ChevronRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* 📈 Statistiques rapides */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {categories.length}
            </div>
            <div className="text-gray-600 text-sm">Catégories</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {categories.reduce((total, cat) => total + (cat.products_count || 0), 0).toLocaleString()}
            </div>
            <div className="text-gray-600 text-sm">Produits total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {categories.filter(cat => cat.is_featured).length}
            </div>
            <div className="text-gray-600 text-sm">Populaires</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900 mb-1">
              {Math.round(categories.reduce((total, cat) => total + (cat.products_count || 0), 0) / categories.length).toLocaleString()}
            </div>
            <div className="text-gray-600 text-sm">Moy. par catégorie</div>
          </div>
        </div>
      </div>

      {/* 🔄 Bouton voir plus/moins */}
      {categories.length > maxCategories && (
        <div className="text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-8 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300"
          >
            {showAll ? (
              <>
                Voir moins de catégories
                <ChevronRight className="w-5 h-5 ml-2 rotate-90" />
              </>
            ) : (
              <>
                Voir toutes les catégories ({categories.length - maxCategories} de plus)
                <ChevronRight className="w-5 h-5 ml-2 -rotate-90" />
              </>
            )}
          </button>
        </div>
      )}

      {/* 🎯 Call-to-action complémentaire */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 rounded-2xl p-8 text-white text-center">
        <h4 className="text-2xl font-bold mb-4">Besoin d'aide pour choisir ?</h4>
        <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
          Nos experts techniques sont là pour vous accompagner dans le choix 
          de vos pièces automobiles. Conseil gratuit et personnalisé.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/contact"
            className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Contacter un expert
          </Link>
          <Link
            to="/catalogue"
            className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Voir tout le catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}