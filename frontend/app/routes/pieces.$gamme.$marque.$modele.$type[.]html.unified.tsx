import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useSearchParams } from '@remix-run/react';
import React, { useState, useEffect, useMemo } from 'react';

// Types partagés
import type { UnifiedPiece } from "@monorepo/shared-types";

// Services combinés - meilleur des deux mondes
import { unifiedCatalogApi } from '../services/api/unified-catalog.api';

// Components optimisés (importés conditionnellement)
// import { ProductCard } from '~/components/products/ProductCard';
// import { FilterSidebar } from '~/components/filters/FilterSidebar';
// import { VehicleSelector } from '~/components/vehicles/VehicleSelector';
// import { apiClient } from '~/services/api-client';

// ========================================
// 🎯 TYPES UNIFIÉS ET OPTIMISÉS
// ========================================

interface VehicleData {
  type_id: number;
  type_name: string;
  type_alias: string;
  type_display: boolean;
  relfollow: boolean;
  marque: {
    marque_id: number;
    marque_name: string;
    marque_alias: string;
  };
  modele: {
    modele_id: number;
    modele_name: string;
    modele_alias: string;
  };
}

interface GammeData {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
  pg_display: boolean;
  family_name?: string;
  image?: string;
  description?: string;
}

interface ProductData {
  id: number;
  piece_id?: number;
  piece_name: string;
  piece_ref: string;
  manufacturer: {
    id: number;
    alias: string;
    quality: string;
    stars?: number;
  };
  side?: string;
  price: {
    ttc: number;
  };
  stock: "En stock" | "Sur commande";
  delaiLivraison?: number;
}

interface FiltersData {
  manufacturers: Array<{
    id: number;
    alias: string;
    name: string;
  }>;
  qualities: string[];
  sides: string[];
}

interface EnhancedSeoData {
  title: string;
  description: string;
  h1: string;
  content: string;
  keywords: string;
  generatedAt: string;
}

interface LoaderData {
  seo: EnhancedSeoData;
  vehicle: VehicleData;
  gamme: GammeData;
  products: ProductData[];
  filters: FiltersData;
  crossProducts: any[];
  minPrice: number;
  canonical: string;
  performance: {
    loadTime: number;
    cacheHit: boolean;
    dataSource: string;
    articleCount: number;
    avgDeliveryDays: number;
  };
  urlFormat: 'slug' | 'legacy';
}

// ========================================
// 🛠️ UTILITAIRES AVANCÉS
// ========================================

function parseSlugWithId(param: string): { alias: string; id: number } {
  if (!param) throw new Response("Paramètre manquant", { status: 400 });
  
  // Format slug-id : "filtre-a-huile-123"
  const parts = param.split("-");
  const id = Number(parts.pop());
  const alias = parts.join("-");
  
  if (!Number.isFinite(id) || id <= 0) {
    throw new Response(`Paramètre invalide: ${param}`, { status: 400 });
  }
  
  if (!alias || alias.length < 2) {
    throw new Response(`Alias invalide: ${param}`, { status: 400 });
  }
  
  return { alias, id };
}

function toTitleCaseFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function transformUnifiedPieceToProduct(piece: UnifiedPiece): ProductData {
  return {
    id: piece.id,
    piece_id: piece.id,
    piece_name: piece.nom,
    piece_ref: piece.reference,
    manufacturer: {
      id: piece.marque_id || 0,
      alias: piece.marque,
      quality: piece.qualite || 'OES'
    },
    side: piece.cote,
    price: {
      ttc: piece.prix_unitaire || 0
    },
    stock: piece.prix_unitaire && piece.prix_unitaire > 0 ? "En stock" : "Sur commande",
    delaiLivraison: 2
  };
}

function extractFiltersOptimized(products: ProductData[]): FiltersData {
  const manufacturersMap = new Map();
  const qualitiesSet = new Set<string>();
  const sidesSet = new Set<string>();

  products.forEach(product => {
    if (product.manufacturer) {
      manufacturersMap.set(product.manufacturer.id, {
        id: product.manufacturer.id,
        alias: product.manufacturer.alias,
        name: product.manufacturer.alias
      });
      
      if (product.manufacturer.quality) {
        qualitiesSet.add(product.manufacturer.quality);
      }
    }
    
    if (product.side) {
      sidesSet.add(product.side);
    }
  });

  return {
    manufacturers: Array.from(manufacturersMap.values())
      .sort((a, b) => a.name.localeCompare(b.name)),
    qualities: Array.from(qualitiesSet).sort(),
    sides: Array.from(sidesSet).sort()
  };
}

function generateFallbackSeo(
  vehicle: VehicleData, 
  gamme: GammeData, 
  productsData: { products: ProductData[]; total?: number; }
): EnhancedSeoData {
  const title = `${gamme.pg_name} ${vehicle.marque.marque_name} ${vehicle.modele.modele_name} ${vehicle.type_name} - Pièces détachées`;
  const description = `${gamme.pg_name} compatibles ${vehicle.marque.marque_name} ${vehicle.modele.modele_name} ${vehicle.type_name}. ${productsData.total || productsData.products.length} pièces disponibles à prix compétitifs.`;
  
  return {
    title,
    description,
    h1: title,
    content: `Découvrez notre sélection de ${gamme.pg_name.toLowerCase()} pour ${vehicle.marque.marque_name} ${vehicle.modele.modele_name} ${vehicle.type_name}.`,
    keywords: `${gamme.pg_name}, ${vehicle.marque.marque_name}, ${vehicle.modele.modele_name}, pièces détachées`,
    generatedAt: new Date().toISOString()
  };
}

function buildCanonicalUrl(
  origin: string, 
  gamme: GammeData, 
  vehicle: VehicleData
): string {
  return `${origin}/pieces/${gamme.pg_alias}-${gamme.pg_id}/${vehicle.marque.marque_alias}-${vehicle.marque.marque_id}/${vehicle.modele.modele_alias}-${vehicle.modele.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;
}

// ========================================
// 🚀 LOADER UNIFIÉ OPTIMISÉ
// ========================================

// Composants temporaires inline (en attendant l'import des vrais)
const FilterSidebar = ({ filters, selectedFilters, onFilterChange, isLoading }: any) => (
  <div className="p-4">
    <div className="text-sm text-gray-500">Filtres avancés disponibles</div>
    {/* Filtres simplifiés pour demo */}
  </div>
);

const VehicleSelector = ({ currentVehicle, gammeId, onClose }: any) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
      <h2 className="text-lg font-bold mb-4">Sélecteur de véhicule</h2>
      <p className="text-gray-600 mb-4">Fonctionnalité en développement</p>
      <button onClick={onClose} className="bg-blue-600 text-white px-4 py-2 rounded">
        Fermer
      </button>
    </div>
  </div>
);

export async function loader({ params, request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const { gamme, marque, modele, type } = params;
  
  try {
    // 🔒 Validation initiale
    if (!gamme || !marque || !modele || !type) {
      throw new Response("Paramètres manquants", { status: 400 });
    }

    // 🔐 Parsing robuste des slugs avec IDs
    const { alias: gammeAlias, id: gammeId } = parseSlugWithId(gamme);
    const { alias: marqueAlias, id: marqueId } = parseSlugWithId(marque);
    const { alias: modeleAlias, id: modeleId } = parseSlugWithId(modele);
    const { alias: typeAlias, id: typeId } = parseSlugWithId(type);

    // 🚀 Stratégie de récupération hybride - Meilleur des deux mondes
    const [
      vehicleData,
      gammeData, 
      unifiedPiecesResult,
      enhancedServicesResult
    ] = await Promise.allSettled([
      // Basic vehicle data
      Promise.resolve({
        type_id: typeId,
        type_name: toTitleCaseFromSlug(typeAlias),
        type_alias: typeAlias,
        type_display: true,
        relfollow: true,
        marque: {
          marque_id: marqueId,
          marque_name: toTitleCaseFromSlug(marqueAlias),
          marque_alias: marqueAlias
        },
        modele: {
          modele_id: modeleId,
          modele_name: toTitleCaseFromSlug(modeleAlias),
          modele_alias: modeleAlias
        }
      } as VehicleData),
      
      // Basic gamme data
      Promise.resolve({
        pg_id: gammeId,
        pg_name: toTitleCaseFromSlug(gammeAlias),
        pg_alias: gammeAlias,
        pg_display: true,
        image: `pieces-${gammeId}.webp`,
        description: `Pièces ${gammeAlias.replace(/-/g, " ")} de qualité`
      } as GammeData),
      
      // Unified catalog API (meilleur de Route 1)
      unifiedCatalogApi.getPiecesUnified(typeId, gammeId),
      
      // Enhanced services (meilleur de Route 2) - API calls simulés
      Promise.allSettled([
        Promise.resolve({ data: { enhanced: 'vehicle-data' } }),
        Promise.resolve({ data: { enhanced: 'gamme-data' } }),
        Promise.resolve({ 
          data: {
            success: false,
            message: 'SEO Enhanced Service non configuré'
          }
        })
      ])
    ]);

    // 🎯 Résolution des données véhicule et gamme
    let vehicle: VehicleData;
    let gamme: GammeData;
    
    if (vehicleData.status === 'fulfilled') {
      vehicle = vehicleData.value;
    } else {
      throw new Response("Données véhicule non disponibles", { status: 503 });
    }
    
    if (gammeData.status === 'fulfilled') {
      gamme = gammeData.value;
    } else {
      throw new Response("Données gamme non disponibles", { status: 503 });
    }

    // 🔧 Enhancement avec services backend (si disponibles)
    if (enhancedServicesResult.status === 'fulfilled') {
      const [enhancedVehicle, enhancedGamme] = enhancedServicesResult.value;
      
      if (enhancedVehicle.status === 'fulfilled' && enhancedVehicle.value?.data) {
        vehicle = { ...vehicle, ...enhancedVehicle.value.data };
      }
      
      if (enhancedGamme.status === 'fulfilled' && enhancedGamme.value?.data) {
        gamme = { ...gamme, ...enhancedGamme.value.data };
      }
    }

    // 🗄️ Récupération des pièces
    let products: ProductData[] = [];
    let articleCount = 0;
    let minPrice = 0;
    let fromCache = false;

    if (unifiedPiecesResult.status === 'fulfilled' && unifiedPiecesResult.value?.success) {
      const result = unifiedPiecesResult.value;
      
      if (result.pieces?.length) {
        products = result.pieces.map(transformUnifiedPieceToProduct);
        articleCount = result.count ?? products.length;
        minPrice = result.minPrice ?? 0;
        fromCache = result.fromCache ?? false;
      }
    }

    // ❌ Validation business critique
    if (products.length === 0) {
      throw new Response(
        `Aucune pièce ${gamme.pg_name} compatible avec ${vehicle.marque.marque_name} ${vehicle.modele.modele_name} ${vehicle.type_name}`, 
        { 
          status: 410,
          statusText: "Pièces non compatibles"
        }
      );
    }

    // 📊 Extraction des filtres
    const filters = extractFiltersOptimized(products);

    // 🎯 SEO Enhanced ou fallback intelligent
    let seo: EnhancedSeoData;
    
    if (enhancedServicesResult.status === 'fulfilled') {
      const [,, seoResponse] = enhancedServicesResult.value;
      
      if (seoResponse.status === 'fulfilled' && seoResponse.value?.data?.success) {
        seo = {
          ...seoResponse.value.data.data,
          generatedAt: seoResponse.value.data.generatedAt
        };
      } else {
        seo = generateFallbackSeo(vehicle, gamme, { products, total: articleCount });
      }
    } else {
      seo = generateFallbackSeo(vehicle, gamme, { products, total: articleCount });
    }

    // 🔗 Cross-sell intelligent (avec fallback silencieux)
    let crossProducts = [];
    try {
      // Simulation de cross-sell en attendant apiClient
      crossProducts = [
        { pg_id: gammeId + 1, pg_name: 'Pièces complémentaires', products_count: 15 },
        { pg_id: gammeId + 2, pg_name: 'Accessoires', products_count: 8 }
      ];
    } catch (error) {
      // Silent fallback - pas critique
      console.warn('Cross-sell non disponible:', error);
    }

    // 🌐 URL canonique
    const url = new URL(request.url);
    const canonical = buildCanonicalUrl(url.origin, gamme, vehicle);
    
    const loadTime = Date.now() - startTime;

    return json<LoaderData>({
      seo,
      vehicle,
      gamme,
      products,
      filters,
      crossProducts,
      minPrice,
      canonical,
      performance: {
        loadTime,
        cacheHit: fromCache,
        dataSource: 'unified-hybrid',
        articleCount,
        avgDeliveryDays: 2
      },
      urlFormat: 'slug'
    });

  } catch (error) {
    console.error('🚨 Loader error unifié:', {
      error: error.message,
      params: { gamme, marque, modele, type },
      url: request.url,
      timestamp: new Date().toISOString()
    });
    
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response('Erreur serveur interne', { 
      status: 500,
      statusText: 'Internal Server Error'
    });
  }
}

// ========================================
// 🎨 META FUNCTION OPTIMISÉE
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: 'Pièces détachées auto - Erreur' },
      { name: 'robots', content: 'noindex' }
    ];
  }
  
  return [
    { title: data.seo.title },
    { name: 'description', content: data.seo.description },
    { name: 'keywords', content: data.seo.keywords },
    { 
      name: 'robots', 
      content: data.vehicle.relfollow ? 'index, follow' : 'noindex, nofollow' 
    },
    { tagName: 'link', rel: 'canonical', href: data.canonical },
    
    // Schema.org enrichi
    {
      tagName: 'script',
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': data.seo.h1,
        'description': data.seo.description,
        'url': data.canonical,
        'breadcrumb': {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Accueil',
              'item': '/'
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': data.gamme.pg_name,
              'item': `/pieces/${data.gamme.pg_alias}-${data.gamme.pg_id}`
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'name': `${data.vehicle.marque.marque_name} ${data.vehicle.modele.modele_name}`,
              'item': data.canonical
            }
          ]
        },
        'mainEntity': {
          '@type': 'ItemList',
          'numberOfItems': data.products.length,
          'itemListElement': data.products.slice(0, 10).map((product, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'item': {
              '@type': 'Product',
              'name': product.piece_name,
              'sku': product.piece_ref,
              'brand': product.manufacturer.alias,
              'offers': {
                '@type': 'Offer',
                'price': product.price.ttc,
                'priceCurrency': 'EUR',
                'availability': product.stock === 'En stock' ? 'InStock' : 'PreOrder'
              }
            }
          }))
        }
      })
    }
  ];
};

// ========================================
// 🎨 COMPOSANT REACT UNIFIÉ
// ========================================

export default function UnifiedPiecesPage() {
  const data = useLoaderData<LoaderData>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filteredProducts, setFilteredProducts] = useState(data.products);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filtres classiques (Route 1) + filtres avancés (Route 2)
  const [activeFilters, setActiveFilters] = useState({
    brands: [] as string[],
    priceRange: "all" as "all" | "low" | "medium" | "high",
    quality: "all" as "all" | string,
    availability: "all" as "all" | "stock" | "order",
    searchText: "",
    // Filtres avancés de Route 2
    manufacturer: searchParams.getAll('pm'),
    stars: searchParams.getAll('s'),
    side: searchParams.getAll('side')
  });

  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc" | "brand">("name");

  // 🔍 Filtrage hybride optimisé
  const finalFilteredProducts = useMemo(() => {
    let result = [...data.products];

    // Recherche textuelle
    if (activeFilters.searchText.trim()) {
      const q = activeFilters.searchText.toLowerCase();
      result = result.filter(p => 
        p.piece_name.toLowerCase().includes(q) ||
        p.manufacturer.alias.toLowerCase().includes(q) ||
        p.piece_ref.toLowerCase().includes(q)
      );
    }

    // Filtres classiques (Route 1)
    if (activeFilters.brands.length) {
      const brandSet = new Set(activeFilters.brands);
      result = result.filter(p => brandSet.has(p.manufacturer.alias));
    }

    if (activeFilters.priceRange !== "all") {
      const price = (p: ProductData) => p.price.ttc;
      switch (activeFilters.priceRange) {
        case "low": result = result.filter(p => price(p) <= 30); break;
        case "medium": result = result.filter(p => price(p) > 30 && price(p) <= 60); break;
        case "high": result = result.filter(p => price(p) > 60); break;
      }
    }

    if (activeFilters.quality !== "all") {
      result = result.filter(p => p.manufacturer.quality === activeFilters.quality);
    }

    if (activeFilters.availability !== "all") {
      if (activeFilters.availability === "stock") {
        result = result.filter(p => p.stock === "En stock");
      } else if (activeFilters.availability === "order") {
        result = result.filter(p => p.stock === "Sur commande");
      }
    }

    // Filtres avancés URL (Route 2)
    if (activeFilters.manufacturer.length) {
      const manufacturerSet = new Set(activeFilters.manufacturer);
      result = result.filter(p => manufacturerSet.has(p.manufacturer.alias));
    }

    if (activeFilters.stars.length) {
      const starsSet = new Set(activeFilters.stars);
      result = result.filter(p => 
        p.manufacturer.stars && starsSet.has(p.manufacturer.stars.toString())
      );
    }

    if (activeFilters.side.length) {
      const sideSet = new Set(activeFilters.side);
      result = result.filter(p => p.side && sideSet.has(p.side));
    }

    // Tri
    result.sort((a, b) => {
      switch (sortBy) {
        case "name": return a.piece_name.localeCompare(b.piece_name);
        case "price-asc": return a.price.ttc - b.price.ttc;
        case "price-desc": return b.price.ttc - a.price.ttc;
        case "brand": return a.manufacturer.alias.localeCompare(b.manufacturer.alias);
        default: return 0;
      }
    });

    return result;
  }, [data.products, activeFilters, sortBy]);

  // 🔄 Sync avec URL params (Route 2)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilteredProducts(finalFilteredProducts);
      setIsLoading(false);
    }, 100);

    setIsLoading(true);
    return () => clearTimeout(timeoutId);
  }, [finalFilteredProducts]);

  const handleFilterChange = (filterType: string, value: string, checked: boolean) => {
    setIsLoading(true);
    
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      
      if (checked) {
        newParams.append(filterType, value);
      } else {
        const values = newParams.getAll(filterType);
        newParams.delete(filterType);
        values.filter(v => v !== value).forEach(v => newParams.append(filterType, v));
      }
      
      return newParams;
    }, { replace: true });
  };

  const resetAllFilters = () => {
    setActiveFilters({
      brands: [],
      priceRange: "all",
      quality: "all",
      availability: "all",
      searchText: "",
      manufacturer: [],
      stars: [],
      side: []
    });
    setSearchParams({});
  };

  const hasActiveFilters = Object.values(activeFilters).some(f => 
    Array.isArray(f) ? f.length > 0 : f !== "all" && f !== ""
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 🏷️ Header unifié et enrichi */}
      <div className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Breadcrumb SEO */}
          <nav className="text-blue-200 text-sm mb-4">
            <a href="/" className="hover:text-white transition-colors">Constructeurs</a>
            <span className="mx-2">→</span>
            <span className="mx-1">{data.vehicle.marque.marque_name}</span>
            <span className="mx-2">→</span>
            <span className="mx-1">{data.vehicle.modele.modele_name}</span>
            <span className="mx-2">→</span>
            <span className="mx-1">{data.vehicle.type_name}</span>
            <span className="mx-2">→</span>
            <span className="text-white font-medium">{data.gamme.pg_name}</span>
          </nav>

          <h1 className="text-3xl font-bold mb-4">{data.seo.h1}</h1>

          {/* Info véhicule */}
          <div className="flex flex-wrap gap-4 text-blue-100 mb-4">
            <span>🏭 {data.vehicle.marque.marque_name}</span>
            <span>🚗 {data.vehicle.modele.modele_name}</span>
            <span>⚡ {data.vehicle.type_name}</span>
            <span>🔧 {data.gamme.pg_name}</span>
          </div>

          {/* Performance unifiée */}
          <div className="bg-white/10 rounded-lg p-3 inline-block">
            <div className="text-sm flex gap-4 flex-wrap">
              <span>⚡ {data.performance.loadTime}ms</span>
              <span className="text-green-300">
                🔧 {data.performance.dataSource.toUpperCase()}
              </span>
              <span>🔢 {data.performance.articleCount} articles</span>
              <span>💰 À partir de {data.minPrice.toFixed(2)}€</span>
              {data.performance.cacheHit && <span className="text-yellow-300">⚡ CACHE</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 📱 Mobile controls */}
      <div className="lg:hidden sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={() => setShowMobileFilters(true)}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Filtrage...' : `Filtres (${filteredProducts.length})`}
          </button>
          <button
            onClick={() => setShowVehicleSelector(true)}
            className="flex-1 border border-gray-300 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
          >
            Changer véhicule
          </button>
        </div>
      </div>

      {/* 📊 Status bar */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 flex justify-between items-center">
          <div>
            <span className="font-bold text-lg text-gray-900">
              {isLoading ? 'Filtrage...' : `${filteredProducts.length} produits`}
            </span>
            {filteredProducts.length !== data.products.length && (
              <span className="text-gray-500 ml-2">sur {data.products.length} au total</span>
            )}
            <span className="text-gray-500 ml-2">• Prix minimum: {data.minPrice.toFixed(2)}€</span>
            <span className="text-green-600 ml-2 font-medium">
              🔧 {data.performance.dataSource}
            </span>
          </div>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            onClick={hasActiveFilters ? resetAllFilters : () => setShowVehicleSelector(true)}
          >
            {hasActiveFilters ? "Réinitialiser filtres" : "Modifier véhicule"}
          </button>
        </div>

        {/* 🔍 Filtres unifiés */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            value={activeFilters.searchText}
            onChange={(e) => setActiveFilters(prev => ({...prev, searchText: e.target.value}))}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Trier par nom</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="brand">Par marque</option>
          </select>

          <select
            value={activeFilters.priceRange}
            onChange={(e) => setActiveFilters(prev => ({...prev, priceRange: e.target.value as any}))}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tous les prix</option>
            <option value="low">Jusqu'à 30€</option>
            <option value="medium">30€ - 60€</option>
            <option value="high">Plus de 60€</option>
          </select>

          <select
            value={activeFilters.quality}
            onChange={(e) => setActiveFilters(prev => ({...prev, quality: e.target.value as any}))}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Toutes qualités</option>
            {data.filters.qualities.map(quality => (
              <option key={quality} value={quality}>{quality}</option>
            ))}
          </select>
        </div>

        {/* 🏗️ Layout principal */}
        <div className="flex gap-6">
          {/* Sidebar filtres avancés (desktop) */}
          <aside className="hidden lg:block w-64 flex-shrink-0 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border">
              <FilterSidebar
                filters={data.filters}
                selectedFilters={{
                  manufacturer: searchParams.getAll('pm'),
                  quality: searchParams.getAll('q'),
                  stars: searchParams.getAll('s'),
                  side: searchParams.getAll('side')
                }}
                onFilterChange={handleFilterChange}
                isLoading={isLoading}
              />
            </div>
            
            {/* Cross-sell */}
            {data.crossProducts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-4">
                <h3 className="font-semibold mb-3 text-gray-900">
                  Autres {data.gamme.family_name || 'pièces'}
                </h3>
                <ul className="space-y-2">
                  {data.crossProducts.slice(0, 8).map((cross, index) => (
                    <li key={cross.pg_id || index}>
                      <a
                        href={buildCanonicalUrl('', cross, data.vehicle)}
                        className="text-blue-600 hover:text-blue-800 text-sm transition-colors block py-1"
                      >
                        {cross.pg_name}
                        {cross.products_count && (
                          <span className="text-gray-500 ml-1">
                            ({cross.products_count})
                          </span>
                        )}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* 📦 Grille de produits */}
          <main className="flex-1">
            <div className="relative">
              {isLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-75 z-10 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 transform hover:scale-105">
                      <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                        <div className="text-4xl text-gray-400">🔧</div>
                      </div>
                      
                      <h3 className="font-medium text-lg mb-2 line-clamp-2">{product.piece_name}</h3>
                      
                      <div className="space-y-2 text-sm text-gray-600 mb-4">
                        <div>Réf: {product.piece_ref}</div>
                        <div>Marque: {product.manufacturer.alias}</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-1 rounded text-xs ${
                            product.stock === "En stock" 
                              ? "bg-green-100 text-green-800" 
                              : "bg-yellow-100 text-yellow-800"
                          }`}>
                            {product.stock}
                          </span>
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {product.manufacturer.quality}
                          </span>
                          {product.manufacturer.stars && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                              {'★'.repeat(product.manufacturer.stars)}
                            </span>
                          )}
                          {product.side && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                              {product.side}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-lg font-bold text-blue-600">
                          {product.price.ttc.toFixed(2)}€
                        </div>
                        <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                          Ajouter
                        </button>
                      </div>
                      
                      {product.delaiLivraison && (
                        <div className="text-xs text-gray-500 mt-2">
                          Livraison: {product.delaiLivraison} jours
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">Aucun produit trouvé</h3>
                  <p className="text-gray-600 mb-4">
                    Essayez de modifier vos filtres ou votre recherche.
                  </p>
                  <button
                    onClick={resetAllFilters}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              )}
            </div>

            {/* 📝 Contenu SEO enrichi */}
            {data.seo.content && (
              <div className="mt-12 bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">
                  Informations sur les {data.gamme.pg_name.toLowerCase()} 
                  {' '}de la {data.vehicle.marque.marque_name} {data.vehicle.modele.modele_name} {data.vehicle.type_name}
                </h2>
                <div 
                  className="prose max-w-none prose-blue"
                  dangerouslySetInnerHTML={{ __html: data.seo.content }}
                />
                {data.seo.generatedAt && (
                  <div className="mt-4 text-xs text-gray-500">
                    Contenu généré le {new Date(data.seo.generatedAt).toLocaleDateString('fr-FR')}
                    {' • '}Source: {data.performance.dataSource}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 🔄 Modals */}
      {showVehicleSelector && (
        <VehicleSelector
          currentVehicle={data.vehicle}
          gammeId={data.gamme.pg_id}
          onClose={() => setShowVehicleSelector(false)}
        />
      )}

      {showMobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50" 
            onClick={() => setShowMobileFilters(false)} 
          />
          <div className="absolute right-0 top-0 h-full w-80 bg-white overflow-y-auto shadow-xl">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Filtres</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ✕
                </button>
              </div>
              <FilterSidebar
                filters={data.filters}
                selectedFilters={{
                  manufacturer: searchParams.getAll('pm'),
                  quality: searchParams.getAll('q'),
                  stars: searchParams.getAll('s'),
                  side: searchParams.getAll('side')
                }}
                onFilterChange={handleFilterChange}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ========================================
// 🚨 ERROR BOUNDARY UNIFIÉ
// ========================================

export function ErrorBoundary({ error }: { error: Error }) {
  console.error('🚨 Route error:', error);
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Pièces non disponibles
          </h1>
          <p className="text-gray-600 mb-6">
            Aucune pièce compatible n'a été trouvée pour cette combinaison véhicule/gamme.
          </p>
          
          <ul className="text-left text-sm text-gray-500 mb-6 space-y-2">
            <li>• La pièce n'est pas compatible avec ce véhicule</li>
            <li>• La gamme a été discontinuée</li>
            <li>• Le modèle n'existe pas dans notre base</li>
            <li>• Service temporairement indisponible</li>
          </ul>
          
          <div className="space-y-3">
            <a 
              href="/" 
              className="block w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              🏠 Retour à l'accueil
            </a>
            <a 
              href="/contact" 
              className="block w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors"
            >
              💬 Nous contacter
            </a>
          </div>
          
          <div className="mt-4 text-xs text-gray-400">
            Erreur: {error.message}
          </div>
        </div>
      </div>
    </div>
  );
}