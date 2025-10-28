// 🔧 Route pièces avec véhicule - Version REFACTORISÉE 
// Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
// ⚠️ URLs PRÉSERVÉES - Ne jamais modifier le format d'URL

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI (ordre alphabétique)
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
import { Error410 } from '../components/errors/Error410';

// Hook custom
import { usePiecesFilters } from '../hooks/use-pieces-filters';

// Services API
import { fetchBlogArticle, fetchCrossSellingGammes } from '../services/pieces/pieces-route.service';

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

export async function loader({ params }: LoaderFunctionArgs) {
  const startTime = Date.now();
  
  // 1. Parse des paramètres URL
  const { gamme: rawGamme, marque: rawMarque, modele: rawModele, type: rawType } = params;
  
  if (!rawGamme || !rawMarque || !rawModele || !rawType) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  // 2. Parse les IDs depuis les URLs (extraction alias + ID)
  const gammeData = parseUrlParam(rawGamme);
  const marqueData = parseUrlParam(rawMarque);
  const modeleData = parseUrlParam(rawModele);
  const typeData = parseUrlParam(rawType);

  // 3. Résolution des IDs via API
  // ✅ IMPORTANT: Passer les paramètres RAW (avec IDs) pas les alias déjà parsés
  const vehicleIds = await resolveVehicleIds(
    rawMarque,  // ✅ "renault-140"
    rawModele,  // ✅ "clio-iii-140004"
    rawType     // ✅ "1-5-dci-19052"
  );
  
  // ✅ Passer le paramètre COMPLET (avec ID) à resolveGammeId pour qu'il puisse extraire l'ID
  const gammeId = await resolveGammeId(rawGamme);

  // ✅ VALIDATION CRITIQUE: Vérifier que tous les IDs sont présents
  // Empêche le rendu de pages sans articles qui seraient désindexées
  validateVehicleIds({
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId,
    typeId: vehicleIds.typeId,
    gammeId: gammeId,
    source: 'loader-validation'
  });

  // 🛡️ VALIDATION PRÉVENTIVE - NIVEAU 0: Vérifier l'intégrité AVANT de fetcher
  // Évite de fetcher les pièces si on sait déjà que la combinaison est invalide
  try {
    const validationUrl = `http://localhost:3000/api/catalog/integrity/validate/${vehicleIds.typeId}/${gammeId}`;
    const validationResponse = await fetch(validationUrl);
    
    if (validationResponse.ok) {
      const validation = await validationResponse.json();
      
      // Si validation échoue, retourner 404/410 IMMÉDIATEMENT
      if (!validation.success || !validation.data.valid) {
        const statusCode = validation.data?.http_status || 410;
        const reason = validation.data?.recommendation || "Cette combinaison n'est pas disponible.";
        
        console.warn(
          `🚨 PRE-VALIDATION FAILED: type_id=${vehicleIds.typeId}, gamme_id=${gammeId}, status=${statusCode}, reason=${reason}`
        );
        
        throw new Response(
          reason,
          { 
            status: statusCode,
            statusText: statusCode === 410 ? 'Gone' : 'Not Found',
            headers: {
              'X-Robots-Tag': 'noindex, nofollow',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'X-Validation-Failed': 'true',
              'X-Validation-Reason': reason,
              'X-Performance-Hint': 'Pre-validation saved DB query'
            }
          }
        );
      }
      
      console.log(
        `✅ PRE-VALIDATION OK: type_id=${vehicleIds.typeId}, gamme_id=${gammeId}, ${validation.data.relations_count} pièces, ${validation.data.data_quality?.pieces_with_brand_percent}% avec marque`
      );
    }
  } catch (error) {
    // Si l'API de validation est down, continuer avec l'ancienne logique
    if (error instanceof Response) {
      throw error; // Re-throw les erreurs de validation
    }
    console.error('⚠️ Validation API unavailable, falling back to legacy validation');
  }

  // 4. Construction des données véhicule
  const vehicle: VehicleData = {
    marque: toTitleCaseFromSlug(marqueData.alias),
    modele: toTitleCaseFromSlug(modeleData.alias),
    type: toTitleCaseFromSlug(typeData.alias),
    typeId: vehicleIds.typeId,
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId
  };

  const gamme: GammeData = {
    id: gammeId,
    name: toTitleCaseFromSlug(gammeData.alias),
    alias: gammeData.alias,
    description: `${toTitleCaseFromSlug(gammeData.alias)} de qualité pour votre véhicule`,
    image: undefined
  };

  // 5. Récupération des pièces via API directe
  let piecesData: PieceData[] = [];
  
  const apiUrl = `http://localhost:3000/api/catalog/pieces/php-logic/${vehicle.typeId}/${gammeId}`;
  
  try {
    const response = await fetch(apiUrl);
    
    if (response.ok) {
      const apiResponse = await response.json();
      // L'API retourne { data: { pieces: [...], count, minPrice, ... }, success, timestamp }
      const rawPieces = Array.isArray(apiResponse.data?.pieces) ? apiResponse.data.pieces : [];
      
      // 🔧 Mapper les champs FR → EN pour compatibilité avec les composants
      piecesData = rawPieces.map((piece: any) => ({
        id: piece.id,
        name: piece.nom || piece.name || 'Pièce',
        brand: piece.marque || piece.brand || 'Marque inconnue',
        reference: piece.reference || '',
        price: piece.prix_unitaire || piece.prix_ttc || piece.price || 0,
        priceFormatted: (piece.prix_unitaire || piece.prix_ttc || piece.price || 0).toFixed(2),
        image: piece.image || '',
        stock: piece.dispo ? 'En stock' : 'Sur commande',
        quality: piece.qualite || '',
        description: piece.description || '',
        url: piece.url || '',
        marque_id: piece.marque_id,
        marque_logo: piece.marque_logo
      }));
      
      console.log(`📦 ${piecesData.length} pièces récupérées et mappées pour ${vehicle.marque} ${vehicle.modele}`);
    }
  } catch (error) {
    console.error('❌ Erreur récupération pièces:', error);
    piecesData = []; // Fallback sur tableau vide en cas d'erreur
  }

  // 🛡️ PROTECTION SEO ANTI-DÉSINDEXATION - NIVEAU 1: Aucune pièce
  // Si 0 pièces trouvées → 410 Gone (ressource n'existe pas/plus)
  if (piecesData.length === 0) {
    console.warn(
      `🚨 SEO-410: 0 pièces pour ${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`
    );
    
    throw new Response(
      `Cette combinaison ${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} n'est pas disponible.`,
      { 
        status: 410,
        statusText: 'Gone',
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }

  // 🛡️ PROTECTION SEO ANTI-DÉSINDEXATION - NIVEAU 2: Données suspectes
  // Si toutes les pièces n'ont pas de marque → probablement des données incorrectes
  const piecesWithoutBrand = piecesData.filter(p => !p.brand || p.brand === 'Marque inconnue');
  const percentageWithoutBrand = (piecesWithoutBrand.length / piecesData.length) * 100;
  
  if (percentageWithoutBrand > 80) {
    console.warn(
      `🚨 SEO-410: ${percentageWithoutBrand.toFixed(0)}% des pièces sans marque pour ${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} - données suspectes`
    );
    
    throw new Response(
      `Cette combinaison ${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} n'est pas disponible (données incomplètes).`,
      { 
        status: 410,
        statusText: 'Gone',
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }

  // 🛡️ PROTECTION SEO ANTI-DÉSINDEXATION - NIVEAU 2: Mauvaise catégorie
  // Vérifier que les pièces retournées correspondent bien à la gamme demandée
  // Ex: si URL = "/pieces/amortisseur-1/..." mais que les pièces sont des batteries → 410 Gone
  const categoryKeywords: Record<string, string[]> = {
    'amortisseur': ['amortisseur', 'suspension', 'shock'],
    'batterie': ['batterie', 'battery', 'accumulateur'],
    'filtre': ['filtre', 'filter'],
    'plaquette': ['plaquette', 'brake pad', 'frein'],
    'disque': ['disque', 'brake disc', 'rotor'],
  };

  const gammeKeyword = gamme.alias.toLowerCase().split('-')[0]; // "amortisseur" depuis "amortisseur-1"
  const expectedKeywords = categoryKeywords[gammeKeyword] || [gammeKeyword];
  
  // Vérifier si au moins UNE pièce correspond à la catégorie attendue
  const hasCorrectCategory = piecesData.some(piece => {
    const pieceName = (piece.name || '').toLowerCase();
    return expectedKeywords.some(keyword => pieceName.includes(keyword));
  });

  if (!hasCorrectCategory && piecesData.length < 10) {
    // Si aucune pièce ne correspond ET qu'il y a peu de résultats → probablement une erreur de données
    console.warn(
      `🚨 SEO-410: Catégorie incorrecte pour ${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type}`,
      `Attendu: ${expectedKeywords.join('|')}, Trouvé: ${piecesData.map(p => p.name).join(', ')}`
    );
    
    throw new Response(
      `Cette combinaison ${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} n'est pas disponible (catégorie incorrecte).`,
      { 
        status: 410,
        statusText: 'Gone',
        headers: {
          'X-Robots-Tag': 'noindex, nofollow',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      }
    );
  }

  // 6. Calcul des stats prix
  const prices = Array.isArray(piecesData) ? piecesData.map(p => p.price || 0).filter(p => p > 0) : [];
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

  // 9. Cross-selling et blog (parallèle)
  const [crossSellingGammes, blogArticle] = await Promise.all([
    fetchCrossSellingGammes(vehicle.typeId, gamme.id),
    fetchBlogArticle(gamme, vehicle)
  ]);

  // 10. Construction réponse finale
  const loadTime = Date.now() - startTime;
  
  const loaderData: LoaderData = {
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
// 📄 META - SEO (Schema.org généré par composant Breadcrumbs)
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
