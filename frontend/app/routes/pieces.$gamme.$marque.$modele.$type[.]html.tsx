// 🔧 Route pièces avec véhicule - Version REFACTORISÉE 
// Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
// ⚠️ URLs PRÉSERVÉES - Ne jamais modifier le format d'URL

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
import { useCallback } from "react";
import { fetchGammePageData } from "~/services/api/gamme-api.service";

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI (ordre alphabétique)
import { Error410 } from '../components/errors/Error410';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { PiecesBuyingGuide } from '../components/pieces/PiecesBuyingGuide';
import { PiecesComparisonView } from '../components/pieces/PiecesComparisonView';
import { PiecesCompatibilityInfo } from '../components/pieces/PiecesCompatibilityInfo';
import { PiecesCrossSelling } from '../components/pieces/PiecesCrossSelling';
import { PiecesFAQSection } from '../components/pieces/PiecesFAQSection';
import { PiecesFilterSidebar } from '../components/pieces/PiecesFilterSidebar';
import { PiecesGridView } from '../components/pieces/PiecesGridView';
import { PiecesHeader } from '../components/pieces/PiecesHeader';
import { PiecesListView } from '../components/pieces/PiecesListView';
import { PiecesSEOSection } from '../components/pieces/PiecesSEOSection';
import { PiecesStatistics } from '../components/pieces/PiecesStatistics';
import VehicleSelectorV2 from '../components/vehicle/VehicleSelectorV2';

// Hook custom
import { usePiecesFilters } from '../hooks/use-pieces-filters';

// Services API
import { fetchBlogArticle, fetchCrossSellingGammes } from '../services/pieces/pieces-route.service';
import { hierarchyApi } from '../services/api/hierarchy.api';

// Types centralisés
import { 
  type GammeData, 
  type LoaderData,
  type PieceData,
  type VehicleData
} from '../types/pieces-route.types';

// Utilitaires
import {
  generateBuyingGuide,
  generateFAQ,
  generateRelatedArticles,
  generateSEOContent,
  parseUrlParam,
  resolveGammeId,
  resolveVehicleIds,
  toTitleCaseFromSlug,
  validateVehicleIds
} from '../utils/pieces-route.utils';

// ========================================
// 🔄 LOADER - Récupération des données
// ========================================

export async function loader({ params, request }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  // Debug URL complète
  const url = new URL(request.url);
  console.log('🔍 [LOADER] URL complète:', url.pathname);
  
  // 1. Parse des paramètres URL
  const { gamme: rawGamme, marque: rawMarque, modele: rawModele, type: rawType } = params;
  
  if (!rawGamme || !rawMarque || !rawModele || !rawType) {
    throw new Response(`Paramètres manquants`, { status: 400 });
  }

  // 2. Parse les IDs depuis les URLs
  const gammeData = parseUrlParam(rawGamme);
  const marqueData = parseUrlParam(rawMarque);
  const modeleData = parseUrlParam(rawModele);
  const typeData = parseUrlParam(rawType);

  // 3. Résolution des IDs via API
  const vehicleIds = await resolveVehicleIds(rawMarque, rawModele, rawType);
  const gammeId = await resolveGammeId(rawGamme);

  // Validation des IDs
  validateVehicleIds({
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId,
    typeId: vehicleIds.typeId,
    gammeId: gammeId,
    source: 'loader-validation'
  });

  // 4. Batch Loader & Parallel Fetches
  // On lance tout en parallèle pour optimiser le temps de réponse
  const batchLoaderPromise = fetch(`http://localhost:3000/api/catalog/batch-loader`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      typeId: vehicleIds.typeId,
      gammeId,
      marqueId: vehicleIds.marqueId,
      modeleId: vehicleIds.modeleId
    })
  }).then(res => res.json());

  const [
    batchResponse,
    typeApiResponse,
    modelsApiResponse,
    pageData,
    hierarchyData
  ] = await Promise.all([
    batchLoaderPromise,
    fetch(`http://localhost:3000/api/vehicles/types/${vehicleIds.typeId}`).catch(() => null),
    fetch(`http://localhost:3000/api/vehicles/brands/${vehicleIds.marqueId}/models`).catch(() => null),
    fetchGammePageData(gammeId).catch(() => null),
    fetch(`http://localhost:3000/api/catalog/gammes/hierarchy`, {
      headers: { 'Accept': 'application/json' }
    }).then(res => res.ok ? res.json() : null).catch(() => null)
  ]);

  // 5. Construction des objets Vehicle & Gamme
  
  // Extraction type_name
  let typeName = toTitleCaseFromSlug(typeData.alias);
  try {
    if (typeApiResponse?.ok) {
      const typeApiData = await typeApiResponse.json();
      if (typeApiData?.type_name) typeName = typeApiData.type_name;
    }
  } catch (e) { console.error('⚠️ Error type_name:', e); }
  
  // Extraction photo modèle
  let modelePic: string | undefined = undefined;
  try {
    if (modelsApiResponse?.ok) {
      const modelsData = await modelsApiResponse.json();
      const modelData = modelsData.data?.find((m: any) => m.modele_id === vehicleIds.modeleId);
      if (modelData) modelePic = modelData.modele_pic || modelData.pic;
    }
  } catch (e) { console.error('⚠️ Error model pic:', e); }
  
  const vehicle: VehicleData = {
    marque: toTitleCaseFromSlug(marqueData.alias),
    modele: toTitleCaseFromSlug(modeleData.alias),
    type: toTitleCaseFromSlug(typeData.alias),
    typeName,
    typeId: vehicleIds.typeId,
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId,
    marqueAlias: marqueData.alias,
    modeleAlias: modeleData.alias,
    modelePic
  };

  const gamme: GammeData = {
    id: gammeId,
    name: toTitleCaseFromSlug(gammeData.alias),
    alias: gammeData.alias,
    description: `${toTitleCaseFromSlug(gammeData.alias)} de qualité pour votre véhicule`,
    image: undefined
  };

  // Fetch Blog Article (needs constructed objects)
  const blogArticle = await fetchBlogArticle(gamme, vehicle);

  // 6. Traitement de la réponse Batch
  
  // Validation
  if (batchResponse.validation && !batchResponse.validation.valid) {
    const statusCode = batchResponse.validation.http_status || 410;
    const reason = batchResponse.validation.recommendation || "Cette combinaison n'est pas disponible.";
    throw new Response(reason, { 
      status: statusCode,
      statusText: statusCode === 410 ? 'Gone' : 'Not Found',
      headers: {
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }

  // Mapping Pièces
  const piecesData: PieceData[] = (batchResponse.pieces || []).map((piece: any) => ({
    id: piece.id,
    name: piece.nom || piece.name || 'Pièce',
    brand: piece.marque || piece.brand || 'Marque inconnue',
    reference: piece.reference || '',
    price: piece.prix_unitaire || piece.prix_ttc || piece.price || 0,
    priceFormatted: (piece.prix_unitaire || piece.prix_ttc || piece.price || 0).toFixed(2),
    image: piece.image || '',
    images: piece.images || [], // ✅ Mapping des images
    stock: piece.dispo ? 'En stock' : 'Sur commande',
    quality: piece.qualite || '',
    description: piece.description || '',
    url: piece.url || '',
    marque_id: piece.marque_id,
    marque_logo: piece.marque_logo
  }));

  if (piecesData.length === 0) {
    throw new Response(
      `Cette combinaison ${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} n'est pas disponible.`,
      { status: 410, statusText: 'Gone', headers: { 'X-Robots-Tag': 'noindex, nofollow' } }
    );
  }

  // Stats prix
  const prices = piecesData.map(p => p.price).filter(p => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // SEO Content
  let seoContent = generateSEOContent(vehicle, gamme);
  if (batchResponse.seo) {
    const seoData = batchResponse.seo;
    const content = seoData.content || seoData.data?.content;
    const h1 = seoData.h1 || seoData.data?.h1;
    
    seoContent = {
      h1: h1 || seoContent.h1,
      h2Sections: seoContent.h2Sections,
      longDescription: content || seoContent.longDescription,
      technicalSpecs: seoContent.technicalSpecs,
      compatibilityNotes: seoContent.compatibilityNotes,
      installationTips: seoContent.installationTips
    };
  }

  // Cross Selling
  const crossSellingGammes = batchResponse.crossSelling || [];

  // Generated Content
  const faqItems = generateFAQ(vehicle, gamme);
  const relatedArticles = generateRelatedArticles(vehicle, gamme);
  const buyingGuide = generateBuyingGuide(vehicle, gamme);
  const compatibilityInfo = {
    engines: [vehicle.type],
    years: "2010-2024",
    notes: ["Vérifiez la référence d'origine avant commande", "Compatible avec toutes les versions du moteur"]
  };

  // Catalogue Famille Logic
  let catalogueMameFamille = pageData?.catalogueMameFamille;
  let famille = pageData?.famille;
  
  if (hierarchyData && famille?.mf_id) {
    const family = hierarchyData.families?.find((f: any) => f.id === famille.mf_id);
    if (family && family.gammes) {
      const otherGammes = family.gammes.filter((g: any) => (typeof g.id === 'string' ? parseInt(g.id) : g.id) !== gammeId);
      catalogueMameFamille = {
        title: `Catalogue ${famille.mf_name}`,
        items: otherGammes.map((g: any) => ({
          name: g.name,
          link: `/pieces/${g.alias}-${g.id}.html`,
          image: g.image 
            ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${g.image}`
            : `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/articles/gammes-produits/catalogue/${g.alias}.webp`,
          description: `Automecanik vous conseils de contrôlez l'état du ${g.name.toLowerCase()} de votre véhicule`,
          meta_description: `${g.name} pas cher à contrôler régulièrement`,
          sort: g.sort_order,
        }))
      };
    }
  }

  const loadTime = Date.now() - startTime;

  return json({
    vehicle,
    gamme,
    pieces: piecesData,
    count: piecesData.length,
    minPrice,
    maxPrice,
    seoContent,
    faqItems,
    relatedArticles,
    buyingGuide,
    compatibilityInfo,
    crossSellingGammes,
    blogArticle: blogArticle || undefined,
    catalogueMameFamille,
    famille,
    seo: {
      title: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} | Pièces Auto`,
      h1: seoContent.h1,
      description: seoContent.longDescription.substring(0, 160)
    },
    performance: {
      loadTime,
      source: 'batch-loader',
      cacheHit: false
    }
  }, {
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=600' }
  });
}

// ========================================
// 📄 META - SEO (Schema.org généré par composant Breadcrumbs)
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: 'Pièces automobile' },
      { name: 'description', content: 'Catalogue de pièces détachées' }
    ];
  }

  // Construire URL canonique complète
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;
  
  // Générer Schema.org Product pour rich snippets (première pièce comme exemple)
  const firstPiece = data.pieces[0];
  const productSchema = firstPiece ? {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": `${data.gamme.name} ${data.vehicle.marque} ${data.vehicle.modele}`,
    "description": data.seo.description,
    "brand": {
      "@type": "Brand",
      "name": firstPiece.brand
    },
    "offers": {
      "@type": "AggregateOffer",
      "priceCurrency": "EUR",
      "lowPrice": data.minPrice,
      "highPrice": data.maxPrice,
      "offerCount": data.count,
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": data.count > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": "4.5",
      "reviewCount": data.count
    } : undefined
  } : null;

  return [
    { title: data.seo.title },
    { name: 'description', content: data.seo.description },
    { property: 'og:title', content: data.seo.title },
    { property: 'og:description', content: data.seo.description },
    { name: 'robots', content: 'index, follow' },
    
    // ✨ NOUVEAU: Canonical URL
    { tagName: 'link', rel: 'canonical', href: canonicalUrl },
    
    // ✨ NOUVEAU: Resource Hints pour Supabase (préconnexion)
    { tagName: 'link', rel: 'preconnect', href: 'https://cxpojprgwgubzjyqzmoq.supabase.co' },
    { tagName: 'link', rel: 'dns-prefetch', href: 'https://cxpojprgwgubzjyqzmoq.supabase.co' },
    
    // ✨ NOUVEAU: Schema.org Product (rich snippets)
    ...(productSchema ? [{
      'script:ld+json': productSchema
    }] : [])
  ];
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================

export default function PiecesVehicleRoute() {
  const data = useLoaderData<typeof loader>();
  
  // Hook custom pour la logique de filtrage (gère son propre état)
  const {
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    filteredProducts,
    uniqueBrands,
    recommendedPieces,
    setActiveFilters,
    setSortBy,
    setViewMode,
    resetAllFilters,
    togglePieceSelection
  } = usePiecesFilters(data.pieces);

  // Actions de sélection pour mode comparaison
  // ⚡ Optimisé avec useCallback pour éviter re-création à chaque render
  const handleSelectPiece = useCallback((pieceId: number) => {
    if (viewMode === 'comparison') {
      togglePieceSelection(pieceId);
    }
  }, [viewMode, togglePieceSelection]);

  const handleRemoveFromComparison = useCallback((pieceId: number) => {
    togglePieceSelection(pieceId);
  }, [togglePieceSelection]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header moderne */}
      <PiecesHeader
        vehicle={data.vehicle}
        gamme={data.gamme}
        count={data.count}
        performance={data.performance}
      />

      {/* 🍞 Fil d'ariane avec composant existant - COHÉRENT AVEC URL */}
      {/* URL: /pieces/{gamme}/{marque}/{modele}/{type}.html */}
      {/* Breadcrumb suit l'ordre URL: Gamme → Véhicule → Résultat */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <Breadcrumbs
            items={[
              { 
                label: data.gamme.name, 
                href: `/pieces/${data.gamme.alias}`
              },
              { 
                label: `${data.vehicle.marque} ${data.vehicle.modele}`, 
                href: `/constructeurs/${data.vehicle.marque.toLowerCase().replace(/\s+/g, '-')}-${data.vehicle.marqueId}/${data.vehicle.modele.toLowerCase().replace(/\s+/g, '-')}-${data.vehicle.modeleId}/${data.vehicle.typeId}.html`
              },
              { 
                label: `${data.count} pièce${data.count > 1 ? 's' : ''}`,
                current: true
              }
            ]}
            separator="arrow"
            showHome={true}
            enableSchema={true}
          />
        </div>
      </div>

      {/* Conteneur principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 🚗 Sélecteur de véhicule - Mode compact sticky */}
        <div className="mb-6 sticky top-4 z-10">
          <VehicleSelectorV2
            mode="compact"
            context="pieces"
            variant="card"
            redirectOnSelect={false}
            onVehicleSelect={(vehicle) => {
              console.log('🔄 Véhicule sélectionné:', vehicle);
              // Construire URL avec format alias-id
              const brandSlug = `${vehicle.brand.marque_alias || vehicle.brand.marque_name.toLowerCase()}-${vehicle.brand.marque_id}`;
              const modelSlug = `${vehicle.model.modele_alias || vehicle.model.modele_name.toLowerCase()}-${vehicle.model.modele_id}`;
              const typeSlug = `${vehicle.type.type_alias || vehicle.type.type_name.toLowerCase()}-${vehicle.type.type_id}`;
              const url = `/pieces/${data.gamme.alias}/${brandSlug}/${modelSlug}/${typeSlug}.html`;
              window.location.href = url;
            }}
            currentVehicle={{
              brand: { id: data.vehicle.marqueId, name: data.vehicle.marque },
              model: { id: data.vehicle.modeleId, name: data.vehicle.modele },
              type: { id: data.vehicle.typeId, name: data.vehicle.type }
            }}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar filtres et catalogue */}
          <aside className="lg:w-80 flex-shrink-0 space-y-6">
            {/* Filtres */}
            <PiecesFilterSidebar
              activeFilters={activeFilters}
              setActiveFilters={setActiveFilters}
              uniqueBrands={uniqueBrands}
              piecesCount={filteredProducts.length}
              resetAllFilters={resetAllFilters}
              getBrandCount={(brand) => 
                data.pieces.filter(p => p.brand === brand).length
              }
            />

            {/* Catalogue inline - même présentation que test-catalogue-optimized */}
            {data.catalogueMameFamille && data.catalogueMameFamille.items.length > 0 && (() => {
              // Calculer la couleur de la famille
              const familleColor = data.famille ? hierarchyApi.getFamilyColor({
                mf_id: data.famille.mf_id,
                mf_name: data.famille.mf_name,
                mf_pic: data.famille.mf_pic,
              } as any) : 'from-blue-950 via-indigo-900 to-purple-900';

              return (
                <div>
                  <div className={`relative rounded-lg overflow-hidden shadow-lg bg-gradient-to-br ${familleColor}`}>
                    {/* Overlay pour améliorer le contraste du titre */}
                    <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/20 to-transparent"></div>
                    
                    <div className="relative p-3">
                      <h2 className="text-sm font-bold text-white mb-3 text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        Catalogue {data.famille?.mf_name || "Système de freinage"}
                      </h2>
                      <div className="grid grid-cols-4 gap-1.5 auto-rows-max">
                        {data.catalogueMameFamille.items.slice(0, 32).map((item, index) => (
                          <a
                            key={index}
                            href={item.link}
                            className="group relative aspect-square rounded-md overflow-hidden bg-white border border-white/20 hover:border-white hover:shadow-2xl hover:scale-110 hover:z-10 transition-all duration-300 cursor-pointer"
                            title={item.name}
                          >
                            {/* Image du produit */}
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-contain p-1 group-hover:p-0.5 transition-all duration-300"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.src = '/images/placeholder-product.png';
                              }}
                            />
                            
                            {/* Nom du produit - toujours visible en bas */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white text-[6px] p-1 group-hover:from-black/95 group-hover:via-black/85 transition-all duration-300">
                              <p className="line-clamp-2 font-medium text-center leading-tight">{item.name}</p>
                            </div>
                            
                            {/* Badge "Voir" au hover - apparaît en haut à droite */}
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                              <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
                                <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>Voir</span>
                              </div>
                            </div>
                            
                            {/* Effet de brillance au hover */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-transparent group-hover:via-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                          </a>
                        ))}
                        {data.catalogueMameFamille.items.length > 32 && (
                          <div className="flex items-center justify-center aspect-square rounded-md bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-[9px] shadow-sm">
                            +{data.catalogueMameFamille.items.length - 32}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </aside>

          {/* Contenu principal */}
          <main className="flex-1 min-w-0">
            <div className="space-y-6">
              
              {/* Titre catégorie */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-6 py-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {data.gamme.name}
                </h2>
              </div>

              {/* Barre d'outils vue */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="text-sm text-gray-600">
                    <strong>{filteredProducts.length}</strong> pièce{filteredProducts.length > 1 ? 's' : ''} trouvée{filteredProducts.length > 1 ? 's' : ''}
                    {data.minPrice > 0 && (
                      <span className="ml-2">• À partir de <strong>{data.minPrice.toFixed(2)}€</strong></span>
                    )}
                  </div>
                  
                  {/* Sélecteur de vue */}
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'grid' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Grille
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'list' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Liste
                    </button>
                    <button
                      onClick={() => setViewMode('comparison')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'comparison' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Comparer ({selectedPieces.length})
                    </button>
                  </div>

                  {/* Tri */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="name">Nom</option>
                    <option value="price-asc">Prix croissant</option>
                    <option value="price-desc">Prix décroissant</option>
                    <option value="brand">Marque</option>
                  </select>
                </div>
              </div>

              {/* Affichage des pièces selon le mode */}
              {viewMode === 'grid' && (
                <PiecesGridView
                  pieces={filteredProducts}
                  onSelectPiece={handleSelectPiece}
                  selectedPieces={selectedPieces}
                />
              )}

              {viewMode === 'list' && (
                <PiecesListView
                  pieces={filteredProducts}
                  onSelectPiece={handleSelectPiece}
                  selectedPieces={selectedPieces}
                />
              )}

              {viewMode === 'comparison' && (
                <PiecesComparisonView
                  pieces={filteredProducts}
                  selectedPieces={selectedPieces}
                  onRemovePiece={handleRemoveFromComparison}
                />
              )}

              {/* Pièces recommandées */}
              {recommendedPieces.length > 0 && viewMode !== 'comparison' && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
                  <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Nos recommandations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recommendedPieces.map(piece => (
                      <div key={piece.id} className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="font-medium text-gray-900 mb-1 line-clamp-2">{piece.name}</div>
                        <div className="text-sm text-gray-600 mb-2">{piece.brand}</div>
                        <div className="text-lg font-bold text-blue-600">{piece.priceFormatted}€</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sections SEO */}
              <div className="space-y-6 mt-12">
                <PiecesSEOSection
                  content={data.seoContent}
                  vehicleName={`${data.vehicle.marque} ${data.vehicle.modele} ${data.vehicle.type}`}
                  gammeName={data.gamme.name}
                />

                <PiecesBuyingGuide guide={data.buyingGuide} />

                <PiecesFAQSection items={data.faqItems} />

                <PiecesCompatibilityInfo
                  compatibility={data.compatibilityInfo}
                  vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                />

                <PiecesStatistics
                  pieces={data.pieces}
                  vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                  gammeName={data.gamme.name}
                />
              </div>
            </div>
          </main>
        </div>

        {/* Cross-selling */}
        {data.crossSellingGammes.length > 0 && (
          <div className="mt-12">
            <PiecesCrossSelling
              gammes={data.crossSellingGammes}
              vehicle={data.vehicle}
            />
          </div>
        )}
      </div>

      {/* Performance debug (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg backdrop-blur-sm">
          <div>⚡ Load: {data.performance.loadTime}ms</div>
          <div>📦 Pièces: {data.count}</div>
          <div>🔍 Filtrées: {filteredProducts.length}</div>
        </div>
      )}
    </div>
  );
}

// ========================================
// 🚨 ERROR BOUNDARY - Gestion 410 Gone
// ========================================

export function ErrorBoundary() {
  const error = useRouteError();
  
  // Gestion spécifique du 410 Gone (page sans résultats)
  if (isRouteErrorResponse(error) && error.status === 410) {
    return (
      <>
        <head>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="googlebot" content="noindex, nofollow" />
        </head>
        <Error410 
          url={typeof window !== 'undefined' ? window.location.pathname : undefined}
          isOldLink={false}
        />
      </>
    );
  }

  // Autres erreurs (404, 500, etc.)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-6">
          {isRouteErrorResponse(error) 
            ? `Erreur ${error.status}: ${error.statusText}`
            : "Une erreur inattendue s'est produite"}
        </p>
        <a
          href="/"
          className="block w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-center font-medium transition-colors"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  );
}
