// 🔧 Route pièces avec véhicule - Version REFACTORISÉE 
// Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
// ⚠️ URLs PRÉSERVÉES - Ne jamais modifier le format d'URL

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI (ordre alphabétique)
import { ScrollToTop } from '../components/blog/ScrollToTop';
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

// Types centralisés
import { getPrixPasCherVariation } from '../services/seo/seo-variations.service';
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
  toTitleCaseFromSlug
} from '../utils/pieces-route.utils';

// Service SEO variations

// ========================================
// 🔄 LOADER - Récupération des données
// ========================================

export async function loader({ params }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  // 1. Parse des paramètres URL
  const { gamme: rawGamme, marque: rawMarque, modele: rawModele, type: rawType } = params;
  
  if (!rawGamme || !rawMarque || !rawModele || !rawType) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  // 2. Parse les IDs depuis les URLs
  const gammeData = parseUrlParam(rawGamme);
  const marqueData = parseUrlParam(rawMarque);
  const modeleData = parseUrlParam(rawModele);
  const typeData = parseUrlParam(rawType);

  // 3. Résolution des IDs via API
  const vehicleIds = await resolveVehicleIds(
    marqueData.alias, 
    modeleData.alias, 
    typeData.alias
  );
  
  // 3.5 Récupération du type_name complet depuis l'API
  let typeName = toTitleCaseFromSlug(typeData.alias);
  try {
    const typeResponse = await fetch(
      `http://localhost:3000/api/vehicles/types/${vehicleIds.typeId}`
    );
    
    if (typeResponse.ok) {
      const typeData = await typeResponse.json();
      if (typeData && typeData.type_name) {
        typeName = typeData.type_name;
      }
    }
  } catch (error) {
    console.error('⚠️ Erreur récupération type_name:', error);
  }
  
  // ✅ Pour cette route avec IDs dans l'URL, utiliser directement l'ID parsé
  const gammeId = gammeData.id > 0 ? gammeData.id : await resolveGammeId(gammeData.alias);

  // 4. Construction des données véhicule
  const vehicle: VehicleData = {
    marque: toTitleCaseFromSlug(marqueData.alias),
    modele: toTitleCaseFromSlug(modeleData.alias),
    type: toTitleCaseFromSlug(typeData.alias),
    typeName: typeName, // Nom complet avec puissance et années
    typeId: vehicleIds.typeId,
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId
  };

  // 4.5 Récupération des infos complètes du véhicule (puissance, années)
  let vehicleDetails = null;
  try {
    const vehicleResponse = await fetch(
      `http://localhost:3000/api/vehicles/${vehicleIds.typeId}`
    );
    
    if (vehicleResponse.ok) {
      vehicleDetails = await vehicleResponse.json();
    }
  } catch (error) {
    console.error('⚠️ Erreur récupération détails véhicule:', error);
  }

  const gamme: GammeData = {
    id: gammeId,
    name: toTitleCaseFromSlug(gammeData.alias),
    alias: gammeData.alias,
    description: `${toTitleCaseFromSlug(gammeData.alias)} de qualité pour votre véhicule`,
    image: undefined
  };

  // 5. Récupération des pièces via RPC V3 (optimisé avec images compressées)
  let piecesData: PieceData[] = [];

  try {
    const response = await fetch(
      `http://localhost:3000/api/catalog/batch-loader/${vehicle.typeId}/${gamme.id}`
    );

    if (response.ok) {
      const data = await response.json();
      piecesData = data.pieces || [];
    }
  } catch (error) {
    console.error('❌ Erreur récupération pièces:', error);
  }

  // 6. Calcul des stats prix
  const prices = piecesData.map(p => p.price || 0).filter(p => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // 7. Génération contenu SEO enrichi
  const seoContent = generateSEOContent(vehicle, gamme);
  const faqItems = generateFAQ(vehicle, gamme);
  const relatedArticles = generateRelatedArticles(vehicle, gamme);
  const buyingGuide = generateBuyingGuide(vehicle, gamme);

  // 8. Infos compatibilité
  const compatibilityInfo = {
    engines: [vehicle.type],
    years: "2010-2024",
    notes: [
      "Vérifiez la référence d'origine avant commande",
      "Compatible avec toutes les versions du moteur",
      "Installation professionnelle recommandée"
    ]
  };

  // 8.5 Récupération variation "pas cher"
  let prixPasCherText = "au meilleur prix";
  try {
    prixPasCherText = await getPrixPasCherVariation(gamme.id, vehicle.typeId);
  } catch (error) {
    console.error('⚠️ Erreur récupération variation prix:', error);
  }

  // 9. Cross-selling et blog (parallèle)
  const [crossSellingGammes, blogArticle] = await Promise.all([
    fetchCrossSellingGammes(vehicle.typeId, gamme.id),
    fetchBlogArticle(gamme, vehicle)
  ]);

  // 10. Construction réponse finale
  const loadTime = Date.now() - startTime;
  
  const loaderData: LoaderData = {
    vehicle,
    vehicleDetails,
    gamme,
    pieces: piecesData,
    count: piecesData.length,
    minPrice,
    maxPrice,
    prixPasCherText, // Ajout du texte dynamique "pas cher"
    seoContent,
    faqItems,
    relatedArticles,
    buyingGuide,
    compatibilityInfo,
    crossSellingGammes,
    blogArticle: blogArticle || undefined,
    seo: {
      title: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} | Pièces Auto`,
      h1: seoContent.h1,
      description: seoContent.longDescription.substring(0, 160)
    },
    performance: {
      loadTime,
      source: 'php-logic-api',
      cacheHit: false
    }
  };

  return json(loaderData, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=600'
    }
  });
}

// ========================================
// 📄 META - SEO
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: 'Pièces automobile' },
      { name: 'description', content: 'Catalogue de pièces détachées' }
    ];
  }

  return [
    { title: data.seo.title },
    { name: 'description', content: data.seo.description },
    { property: 'og:title', content: data.seo.title },
    { property: 'og:description', content: data.seo.description },
    { name: 'robots', content: 'index, follow' }
  ];
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================

export default function PiecesVehicleRoute() {
  const data = useLoaderData<typeof loader>();
  
  // Extraction des données
  const { 
    vehicle, 
    vehicleDetails: _vehicleDetails, 
    gamme, 
    count, 
    minPrice, 
    prixPasCherText,
    performance 
  } = data;
  
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
  const handleSelectPiece = (pieceId: number) => {
    if (viewMode === 'comparison') {
      togglePieceSelection(pieceId);
    }
  };

  const handleRemoveFromComparison = (pieceId: number) => {
    togglePieceSelection(pieceId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          {/* Hero Header */}
          <PiecesHeader 
            vehicle={vehicle} 
            gamme={gamme} 
            count={count}
            minPrice={minPrice}
            prixPasCherText={prixPasCherText}
            performance={performance}
          />      {/* Conteneur principal */}
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
          
          {/* Sidebar filtres */}
          <aside className="lg:w-80 flex-shrink-0">
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
          </aside>

          {/* Contenu principal */}
          <main className="flex-1 min-w-0">
            <div className="space-y-6">
              
              {/* Titre section impactant */}
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 tracking-tight">
                  {data.gamme.name} pour votre véhicule
                </h2>
                <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-600 mx-auto rounded mb-6" />
                <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto font-medium">
                  Découvrez notre sélection de <span className="font-bold text-gray-900">{data.count} pièces</span> compatibles avec votre{" "}
                  <span className="font-bold text-blue-600">{data.vehicle.marque} {data.vehicle.modele} {data.vehicle.type}</span>
                </p>
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
                <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-8 border border-blue-100 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">Nos recommandations</h3>
                      <p className="text-gray-600 text-sm">Sélection qualité pour votre véhicule</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recommendedPieces.map(piece => (
                      <div key={piece.id} className="relative bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow group">
                        {/* Badge "Top vente" */}
                        <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-full text-xs font-semibold text-white shadow-md bg-gradient-to-r from-yellow-500 to-orange-500">
                          ⭐ Top vente
                        </div>
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

      {/* Bouton retour en haut */}
      <ScrollToTop />

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
