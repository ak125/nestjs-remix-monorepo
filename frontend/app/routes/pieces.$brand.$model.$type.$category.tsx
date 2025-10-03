// 📁 frontend/app/routes/pieces.$brand.$model.$type.$category.tsx
// 🔧 Page de catalogue de pièces par catégorie pour un véhicule spécifique

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, Link, useNavigate, useParams } from "@remix-run/react";
import { ArrowLeft, Filter, Grid, List } from "lucide-react";
import { useState } from "react";

// 📊 Types de données
interface VehicleInfo {
  brand: { id: number; name: string; };
  model: { id: number; name: string; };
  type: { id: number; name: string; };
}

interface VehiclePart {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  brand: string;
  partNumber: string;
  category: string;
  subcategory?: string;
  compatibility: string[];
}

interface CategoryInfo {
  name: string;
  icon: string;
  description: string;
  totalParts: number;
  subcategories: string[];
}

// 📡 Loader pour récupérer les pièces de la catégorie
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { brand, model, type, category } = params;
  
  if (!brand || !model || !type || !category) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  try {
    // 🔍 Mapping des catégories
    const categoryMap: Record<string, CategoryInfo> = {
      'filtres': {
        name: 'Filtres',
        icon: '🔧',
        description: 'Filtres à air, carburant, huile et habitacle',
        totalParts: 156,
        subcategories: ['Filtre à air', 'Filtre à carburant', 'Filtre à huile', 'Filtre habitacle']
      },
      'freinage': {
        name: 'Freinage',
        icon: '🛞',
        description: 'Plaquettes, disques, étriers et liquide de frein',
        totalParts: 89,
        subcategories: ['Plaquettes de frein', 'Disques de frein', 'Étriers', 'Liquide de frein']
      },
      'échappement': {
        name: 'Échappement',
        icon: '💨',
        description: 'Système d\'échappement complet et accessoires',
        totalParts: 45,
        subcategories: ['Silencieux', 'Catalyseur', 'Collecteur', 'Tuyaux']
      },
      'suspension': {
        name: 'Suspension',
        icon: '🏗️',
        description: 'Amortisseurs, ressorts et pièces de liaison au sol',
        totalParts: 78,
        subcategories: ['Amortisseurs', 'Ressorts', 'Rotules', 'Silent-blocs']
      },
      'éclairage': {
        name: 'Éclairage',
        icon: '💡',
        description: 'Phares, feux et ampoules pour tous véhicules',
        totalParts: 134,
        subcategories: ['Phares avant', 'Feux arrière', 'Ampoules', 'Feux de signalisation']
      },
      'carrosserie': {
        name: 'Carrosserie',
        icon: '🚗',
        description: 'Éléments de carrosserie et accessoires extérieurs',
        totalParts: 203,
        subcategories: ['Pare-chocs', 'Rétroviseurs', 'Ailes', 'Portières']
      }
    };

    const categoryInfo = categoryMap[category.toLowerCase()];
    
    if (!categoryInfo) {
      throw new Response("Catégorie non trouvée", { status: 404 });
    }

    // 🚗 Informations véhicule (parsing depuis les paramètres URL)
    const vehicleInfo: VehicleInfo = {
      brand: { 
        id: parseInt(brand.split('-').pop() || '0'), 
        name: brand.split('-').slice(0, -1).join(' ').toUpperCase() 
      },
      model: { 
        id: parseInt(model.split('-').pop() || '0'), 
        name: model.split('-').slice(0, -1).join(' ').toUpperCase() 
      },
      type: { 
        id: parseInt(type.replace('.html', '').split('-').pop() || '0'), 
        name: type.replace('.html', '').split('-').slice(0, -1).join(' ').toUpperCase() 
      }
    };

    // 📚 Extraire pg_id du paramètre category et charger les conseils
    const categoryParts = category.split('-');
    const pg_id = categoryParts[categoryParts.length - 1];
    
    let conseils: Array<{ title: string; content: string }> = [];
    try {
      const conseilResponse = await fetch(
        `http://localhost:3000/api/blog/conseil/${pg_id}`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (conseilResponse.ok) {
        const conseilData = await conseilResponse.json();
        conseils = conseilData.conseils || [];
        console.log(`[Catalog] ✅ ${conseils.length} conseils chargés pour pg_id=${pg_id}`);
      }
    } catch (error) {
      console.error('[Catalog] ❌ Erreur chargement conseils:', error);
      // Continue sans conseils
    }

    // 🔧 Données mockées pour les pièces (à remplacer par vraie API)
    const mockParts: VehiclePart[] = [
      {
        id: 1,
        name: `${categoryInfo.subcategories[0]} Premium`,
        description: `${categoryInfo.subcategories[0]} haute performance pour ${vehicleInfo.brand.name} ${vehicleInfo.model.name}`,
        price: 45.99,
        currency: 'EUR',
        imageUrl: '/images/parts/filter-air.jpg',
        availability: 'in-stock',
        brand: 'BOSCH',
        partNumber: 'F026400123',
        category: categoryInfo.name,
        subcategory: categoryInfo.subcategories[0],
        compatibility: [`${vehicleInfo.brand.name} ${vehicleInfo.model.name}`]
      },
      {
        id: 2,
        name: `${categoryInfo.subcategories[1]} Standard`,
        description: `${categoryInfo.subcategories[1]} qualité OEM`,
        price: 32.50,
        currency: 'EUR',
        availability: 'in-stock',
        brand: 'MANN',
        partNumber: 'W712/95',
        category: categoryInfo.name,
        subcategory: categoryInfo.subcategories[1],
        compatibility: [`${vehicleInfo.brand.name} ${vehicleInfo.model.name}`]
      },
      // Ajouter plus de pièces mockées...
      ...Array.from({ length: 10 }, (_, i) => ({
        id: i + 3,
        name: `${categoryInfo.name} #${i + 3}`,
        description: `Pièce ${categoryInfo.name.toLowerCase()} compatible ${vehicleInfo.brand.name} ${vehicleInfo.model.name}`,
        price: Math.floor(Math.random() * 200) + 20,
        currency: 'EUR',
        availability: ['in-stock', 'low-stock', 'out-of-stock'][Math.floor(Math.random() * 3)] as any,
        brand: ['BOSCH', 'MANN', 'VALEO', 'FEBI', 'LEMFÖRDER'][Math.floor(Math.random() * 5)],
        partNumber: `${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        category: categoryInfo.name,
        subcategory: categoryInfo.subcategories[Math.floor(Math.random() * categoryInfo.subcategories.length)],
        compatibility: [`${vehicleInfo.brand.name} ${vehicleInfo.model.name}`]
      }))
    ];

  return json({
    vehicle: vehicleInfo,
    category: categoryInfo,
    parts: mockParts,
    conseils,
    breadcrumb: [
      { label: 'Accueil', path: '/' },
      { label: vehicleInfo.brand.name, path: `/pieces/${brand}` },
      { label: vehicleInfo.model.name, path: `/pieces/${brand}/${model}` },
      { label: categoryInfo.name, path: `/pieces/${brand}/${model}/${type}/${category}` },
    ],
  });  } catch (error) {
    console.error('Erreur loader pièces:', error);
    throw new Response("Erreur de chargement", { status: 500 });
  }
};

// 🏷️ Métadonnées SEO
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data || 'error' in data) {
    return [
      { title: "Pièces non trouvées" },
      { name: "description", content: "Les pièces demandées n'ont pas été trouvées." }
    ];
  }

  const { vehicle, category } = data;
  const title = `${category.name} ${vehicle.brand.name} ${vehicle.model.name} ${vehicle.type.name} | Pièces Auto`;
  const description = `${category.description} pour ${vehicle.brand.name} ${vehicle.model.name} ${vehicle.type.name}. ${category.totalParts} pièces disponibles.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" }
  ];
};

// 🎨 Composant principal
export default function CatalogPage() {
  const { vehicle, category, parts, conseils } = useLoaderData<typeof loader>();
  const params = useParams();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'brand'>('name');

  // 🔍 Filtrage des pièces
  const filteredParts = parts.filter(part => 
    selectedSubcategory === 'all' || part.subcategory === selectedSubcategory
  ).sort((a, b) => {
    switch (sortBy) {
      case 'price': return a.price - b.price;
      case 'brand': return a.brand.localeCompare(b.brand);
      default: return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 🍞 Fil d'Ariane */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm" aria-label="Fil d'Ariane">
            <Link to="/" className="text-gray-600 hover:text-blue-600 transition-colors duration-200">
              🏠 Accueil
            </Link>
            <span className="text-gray-400">/</span>
            <Link to="/constructeurs" className="text-gray-600 hover:text-blue-600 transition-colors duration-200">
              Constructeurs
            </Link>
            <span className="text-gray-400">/</span>
            <Link 
              to={`/constructeurs/${params.brand}/${params.model}/${params.type}`}
              className="text-gray-600 hover:text-blue-600 transition-colors duration-200"
            >
              {vehicle.brand.name} {vehicle.model.name}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded">
              {category.icon} {category.name}
            </span>
          </nav>
        </div>
      </div>

      {/* 🎯 En-tête catégorie */}
      <div className="bg-white shadow-lg border-b-2 border-blue-100">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl">{category.icon}</div>
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
                    {category.name}
                  </h1>
                  <p className="text-lg text-gray-600 mt-1">
                    Pour {vehicle.brand.name} {vehicle.model.name} {vehicle.type.name}
                  </p>
                </div>
              </div>
              
              <p className="text-gray-700 text-lg max-w-2xl mb-4">
                {category.description}
              </p>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium">
                  {category.totalParts} pièces disponibles
                </span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium">
                  Livraison rapide
                </span>
              </div>
            </div>
            
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-6 py-3 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Retour
            </button>
          </div>
        </div>
      </div>

      {/* 🛠️ Filtres et options */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Filtres subcategories */}
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Toutes les sous-catégories</option>
                {category.subcategories.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            
            {/* Options tri et affichage */}
            <div className="flex items-center gap-4">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name">Tri par nom</option>
                <option value="price">Tri par prix</option>
                <option value="brand">Tri par marque</option>
              </select>
              
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 📦 Liste des pièces */}
        <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {filteredParts.map((part) => (
            <div key={part.id} className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900 mb-2">{part.name}</h3>
                  <p className="text-gray-600 text-sm mb-2">{part.description}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="bg-gray-100 px-2 py-1 rounded">{part.brand}</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">{part.partNumber}</span>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                  part.availability === 'in-stock' ? 'bg-green-100 text-green-800' :
                  part.availability === 'low-stock' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {part.availability === 'in-stock' ? 'En stock' :
                   part.availability === 'low-stock' ? 'Stock limité' : 'Rupture'}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-blue-600">
                  {part.price.toFixed(2)} {part.currency}
                </div>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  Ajouter au panier
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredParts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Aucune pièce trouvée</h3>
            <p className="text-gray-600">Essayez de modifier vos filtres ou contactez notre support.</p>
          </div>
        )}

        {/* 📚 Guides et conseils de remplacement */}
        {conseils && conseils.length > 0 && (
          <div className="mt-16 space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Guide de remplacement</h2>
              <p className="text-gray-600">Tout ce que vous devez savoir pour remplacer cette pièce</p>
            </div>

            {conseils.map((conseil, index) => {
              // Définir les couleurs selon le type de conseil
              const isSymptome = conseil.title.toLowerCase().includes('symptôme') || 
                               conseil.title.toLowerCase().includes('défaillance') ||
                               conseil.title.toLowerCase().includes('quand changer') ||
                               conseil.title.toLowerCase().includes('rôle');
              const isProcedure = conseil.title.toLowerCase().includes('démontage') || 
                                conseil.title.toLowerCase().includes('remontage') ||
                                conseil.title.toLowerCase().includes('changement');

              let colorClasses = {
                gradient: 'from-blue-50 to-indigo-50',
                border: 'border-blue-200',
                iconColor: 'text-blue-600',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              };

              if (isSymptome) {
                colorClasses = {
                  gradient: 'from-orange-50 to-red-50',
                  border: 'border-orange-200',
                  iconColor: 'text-orange-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )
                };
              } else if (isProcedure) {
                colorClasses = {
                  gradient: 'from-green-50 to-emerald-50',
                  border: 'border-green-200',
                  iconColor: 'text-green-600',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )
                };
              }

              return (
                <div 
                  key={index}
                  className={`p-6 bg-gradient-to-r ${colorClasses.gradient} rounded-xl border-2 ${colorClasses.border} shadow-lg`}
                >
                  <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                    <span className={colorClasses.iconColor}>
                      {colorClasses.icon}
                    </span>
                    {conseil.title}
                  </h3>
                  <div 
                    className="prose prose-lg max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: conseil.content }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}