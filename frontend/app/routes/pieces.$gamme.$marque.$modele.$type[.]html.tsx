// 🔧 Route pièces avec véhicule - Version REFACTORISÉE
// Format: /pieces/{gamme}/{marque}/{modele}/{type}.html
// ⚠️ URLs PRÉSERVÉES - Ne jamais modifier le format d'URL

import {
  defer,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
  Link,
  Await,
} from "@remix-run/react";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
// 🚀 LCP OPTIMIZATION: fetchGammePageData supprimé (RPC V2 redondant avec batch-loader RPC V3)

// ========================================
// 📦 IMPORTS DES MODULES REFACTORISÉS
// ========================================

// Composants UI CRITIQUES (above-fold - chargés immédiatement)
import { ScrollToTop } from "../components/blog/ScrollToTop";
import { Error410 } from "../components/errors/Error410";
import { Breadcrumbs } from "../components/layout/Breadcrumbs";
import { PiecesComparisonView } from "../components/pieces/PiecesComparisonView";
import { PiecesFilterSidebar } from "../components/pieces/PiecesFilterSidebar";
import { PiecesGridView } from "../components/pieces/PiecesGridView";
import { PiecesHeader } from "../components/pieces/PiecesHeader";
import { PiecesListView } from "../components/pieces/PiecesListView";
import { PiecesOemSection } from "../components/pieces/PiecesOemSection";
import { PiecesToolbar } from "../components/pieces/PiecesToolbar";
import VehicleSelectorV2 from "../components/vehicle/VehicleSelectorV2";

// Hook custom
import { usePiecesFilters } from "../hooks/use-pieces-filters";
import { useSeoLinkTracking } from "../hooks/useSeoLinkTracking";

// Services API
import { hierarchyApi } from "../services/api/hierarchy.api";
import {
  fetchBlogArticle,
  fetchCrossSellingGammes as _fetchCrossSellingGammes,
  fetchRelatedArticlesForGamme,
} from "../services/pieces/pieces-route.service";

// Types centralisés
import {
  type GammeData,
  type LoaderData as _LoaderData,
  type PieceData,
  type VehicleData,
} from "../types/pieces-route.types";

// Utilitaires
import { normalizeImageUrl } from "../utils/image.utils";
import {
  generateBuyingGuide,
  generateFAQ,
  generateRelatedArticles as _generateRelatedArticles, // Fallback uniquement
  generateSEOContent,
  parseUrlParam,
  resolveGammeId,
  resolveVehicleIds,
  toTitleCaseFromSlug,
  validateVehicleIds,
} from "../utils/pieces-route.utils";

// 🚀 LCP OPTIMIZATION V6: Lazy-load composants below-fold
// Ces sections ne sont pas visibles au premier paint - différer leur chargement
const PiecesBuyingGuide = lazy(() => import("../components/pieces/PiecesBuyingGuide").then(m => ({ default: m.PiecesBuyingGuide })));
const PiecesCompatibilityInfo = lazy(() => import("../components/pieces/PiecesCompatibilityInfo").then(m => ({ default: m.PiecesCompatibilityInfo })));
const PiecesCrossSelling = lazy(() => import("../components/pieces/PiecesCrossSelling").then(m => ({ default: m.PiecesCrossSelling })));
const PiecesFAQSection = lazy(() => import("../components/pieces/PiecesFAQSection").then(m => ({ default: m.PiecesFAQSection })));
const PiecesRelatedArticles = lazy(() => import("../components/pieces/PiecesRelatedArticles").then(m => ({ default: m.PiecesRelatedArticles })));
const PiecesSEOSection = lazy(() => import("../components/pieces/PiecesSEOSection").then(m => ({ default: m.PiecesSEOSection })));
const PiecesStatistics = lazy(() => import("../components/pieces/PiecesStatistics").then(m => ({ default: m.PiecesStatistics })));

// ========================================
// 🔄 LOADER - Récupération des données
// ========================================

export async function loader({ params, request }: LoaderFunctionArgs) {
  const startTime = Date.now();

  // Debug URL complète
  const url = new URL(request.url);
  console.log("📍 [LOADER] URL complète:", url.pathname);

  // 1. Parse des paramètres URL
  const {
    gamme: rawGamme,
    marque: rawMarque,
    modele: rawModele,
    type: rawType,
  } = params;

  if (!rawGamme || !rawMarque || !rawModele || !rawType) {
    throw new Response(`Paramètres manquants`, { status: 400 });
  }

  // 2. Parse les IDs depuis les URLs
  const gammeData = parseUrlParam(rawGamme);
  const marqueData = parseUrlParam(rawMarque);
  const modeleData = parseUrlParam(rawModele);
  const typeData = parseUrlParam(rawType);

  // 3. Résolution des IDs via API (🚀 PARALLÉLISÉ pour performance)
  const [vehicleIds, gammeId] = await Promise.all([
    resolveVehicleIds(rawMarque, rawModele, rawType),
    resolveGammeId(rawGamme),
  ]);

  // Validation des IDs véhicule - Si invalides, on laisse batch-loader retourner 404
  // 🛡️ gammeId n'est PAS validé ici - délégué au batch-loader pour permettre gammeId=0 → 404 SEO
  try {
    validateVehicleIds({
      marqueId: vehicleIds.marqueId,
      modeleId: vehicleIds.modeleId,
      typeId: vehicleIds.typeId,
      // gammeId: gammeId, // Retiré - validation par batch-loader (ligne 117-119 backend)
      source: "loader-validation",
    });
  } catch (validationError) {
    // 🛡️ IDs invalides → 404 SEO au lieu de 500
    console.warn(`⚠️ [LOADER] Validation IDs échouée, retour 404:`, validationError);
    throw new Response("Véhicule non trouvé", {
      status: 404,
      statusText: "Not Found",
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // 4. Batch Loader - Fetch direct sans retry
  // 🚀 LCP OPTIMIZATION V5: Suppression retry loop (économie 1-3s sur mobile)
  // Le cache CDN (s-maxage=86400) gère la robustesse

  const fetchBatchLoader = async (): Promise<any> => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/catalog/batch-loader/${vehicleIds.typeId}/${gammeId}`,
        {
          method: "GET",
          signal: AbortSignal.timeout(8000), // 8s au lieu de 15s - fail fast
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        console.warn(`⚠️ [BATCH-LOADER] HTTP ${response.status}`);
        // Pour 404/410 on laisse passer (gamme invalide)
        if (response.status === 404 || response.status === 410) {
          return { pieces: [], validation: { valid: false, http_status: response.status } };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error(`❌ [BATCH-LOADER] Error:`, error.message);
      // Graceful degradation - retourne structure vide plutôt que 503
      // Cela permet au cache CDN de servir une version stale si disponible
      throw new Response(
        `Service temporairement indisponible.`,
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: {
            "Retry-After": "10",
            "Cache-Control": "no-cache",
          },
        },
      );
    }
  };

  // 🚀 LCP OPTIMIZATION V7: Seul batch-loader bloque le LCP
  // hierarchy et switches sont streamés via defer() car below-fold

  // 1. Lancer les fetches non-critiques IMMÉDIATEMENT (sans await)
  const hierarchyPromise = fetch(`http://localhost:3000/api/catalog/gammes/hierarchy`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(3000), // Timeout 3s pour éviter blocage
  })
    .then((res) => (res.ok ? res.json() : null))
    .catch(() => null);

  const switchesPromise = fetch(`http://localhost:3000/api/blog/seo-switches/${gammeId}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(3000), // Timeout 3s
  })
    .then((res) => (res.ok ? res.json() : { data: [] }))
    .catch(() => ({ data: [] }));

  // 2. Seul le batch-loader bloque le LCP (données critiques)
  const batchResponse = await fetchBatchLoader();

  // 3. Attendre seoSwitches APRÈS batch-loader (ne bloque pas le LCP, mais résolu avant render)
  // seoSwitches est utilisé dans un callback JS donc doit être résolu, pas streamé
  const switchesResponse = await switchesPromise;
  const rawSwitches = switchesResponse?.data || [];
  const seoSwitches = rawSwitches.length > 0 ? {
    verbs: rawSwitches.map((s: any) => ({ id: s.sis_id, content: s.sis_content })),
    verbCount: rawSwitches.length,
  } : undefined;

  console.log(`🚀 [LOADER] batch-loader terminé, hierarchy/switches en streaming`);

  // 5. Construction des objets Vehicle & Gamme

  // 🚀 OPTIMISÉ V3: Utilise vehicleInfo du batch-loader au lieu d'appels séparés
  const vehicleInfo = batchResponse.vehicleInfo;
  const typeName = vehicleInfo?.typeName || toTitleCaseFromSlug(typeData.alias);
  const modelePic = vehicleInfo?.modelePic || undefined;

  const vehicle: VehicleData = {
    marque: vehicleInfo?.marqueName || toTitleCaseFromSlug(marqueData.alias),
    modele: vehicleInfo?.modeleName || toTitleCaseFromSlug(modeleData.alias),
    type: toTitleCaseFromSlug(typeData.alias),
    typeName,
    typeId: vehicleIds.typeId,
    marqueId: vehicleIds.marqueId,
    modeleId: vehicleIds.modeleId,
    marqueAlias: vehicleInfo?.marqueAlias || marqueData.alias,
    modeleAlias: vehicleInfo?.modeleAlias || modeleData.alias,
    typeAlias: vehicleInfo?.typeAlias || typeData.alias,
    modelePic,
    // 🔧 V7: Codes moteur et types mines (depuis batch-loader vehicleInfo)
    motorCodesFormatted: vehicleInfo?.motorCodesFormatted,
    mineCodesFormatted: vehicleInfo?.mineCodesFormatted,
    cnitCodesFormatted: vehicleInfo?.cnitCodesFormatted,
    // 📊 Specs techniques supplementaires
    typePowerPs: vehicleInfo?.typePowerPs,
    typeFuel: vehicleInfo?.typeEngine, // typeEngine contient le type de carburant
    typeBody: vehicleInfo?.typeBody,
    // 📅 Dates de production (pour JSON-LD vehicleModelDate)
    typeDateStart: vehicleInfo?.typeDateStart,
    typeDateEnd: vehicleInfo?.typeDateEnd,
  };

  const gamme: GammeData = {
    id: gammeId,
    name: toTitleCaseFromSlug(gammeData.alias),
    alias: gammeData.alias,
    description: `${toTitleCaseFromSlug(gammeData.alias)} de qualité pour votre véhicule`,
    image: undefined,
  };

  // 🚀 V4: blogArticle et relatedArticles seront récupérés en parallèle plus bas

  // 6. Traitement de la réponse Batch

  // Validation
  if (batchResponse.validation && !batchResponse.validation.valid) {
    const statusCode = batchResponse.validation.http_status || 410;
    const reason =
      batchResponse.validation.recommendation ||
      "Cette combinaison n'est pas disponible.";
    throw new Response(reason, {
      status: statusCode,
      statusText: statusCode === 410 ? "Gone" : "Not Found",
      headers: {
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  }

  // Mapping Pièces
  const piecesData: PieceData[] = (batchResponse.pieces || []).map(
    (piece: any) => ({
      id: piece.id,
      name: piece.nom || piece.name || "Pièce",
      brand: piece.marque || piece.brand || "Marque inconnue",
      reference: piece.reference || "",
      price: piece.prix_unitaire || piece.prix_ttc || piece.price || 0,
      priceFormatted: (
        piece.prix_unitaire ||
        piece.prix_ttc ||
        piece.price ||
        0
      ).toFixed(2),
      image: piece.image || "",
      images: piece.images || [], // âœ… Mapping des images
      stock: piece.dispo ? "En stock" : "Sur commande",
      quality: piece.qualite || "",
      stars: piece.nb_stars ? parseInt(piece.nb_stars) : undefined, // âœ… Étoiles qualité marque
      side: piece.filtre_side || undefined, // âœ… Position (Avant/Arrière ou Gauche/Droite)
      description: piece.description || "",
      url: piece.url || "",
      marque_id: piece.marque_id,
      marque_logo: piece.marque_logo,
    }),
  );

  if (piecesData.length === 0) {
    throw new Response(
      `Cette combinaison ${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type} n'est pas disponible.`,
      {
        status: 410,
        statusText: "Gone",
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  }

  // Stats prix
  const prices = piecesData.map((p) => p.price).filter((p) => p > 0);
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
      installationTips: seoContent.installationTips,
    };
  }

  // Cross Selling
  const crossSellingGammes = batchResponse.crossSelling || [];

  // Generated Content
  const faqItems = generateFAQ(vehicle, gamme);

  // 🚀 LCP OPTIMIZATION V6: blogArticle et relatedArticles streamés via defer()
  // Ces données ne bloquent plus le first paint - chargées en background
  const blogArticlePromise = fetchBlogArticle(gamme, vehicle).catch(() => null);
  const relatedArticlesPromise = fetchRelatedArticlesForGamme(gamme, vehicle).catch(() => []);

  const buyingGuide = generateBuyingGuide(vehicle, gamme);
  const compatibilityInfo = {
    engines: [vehicle.type],
    years: "2010-2024",
    notes: [
      "Vérifiez la référence d'origine avant commande",
      "Compatible avec toutes les versions du moteur",
    ],
  };

  // 🚀 LCP OPTIMIZATION: Catalogue Famille Logic (sans appel RPC V2)
  // Trouver la famille en cherchant quelle famille contient la gamme actuelle
  // 🚀 LCP OPTIMIZATION V7: Catalogue Famille streamé via defer() (below-fold)
  const catalogueMameFamillePromise = hierarchyPromise.then((hierarchyData) => {
    if (!hierarchyData?.families) return null;

    const family = hierarchyData.families.find((f: any) =>
      f.gammes?.some((g: any) =>
        (typeof g.id === "string" ? parseInt(g.id) : g.id) === gammeId
      )
    );

    if (!family || !family.gammes) return null;

    const otherGammes = family.gammes.filter(
      (g: any) => (typeof g.id === "string" ? parseInt(g.id) : g.id) !== gammeId,
    );

    return {
      title: `Catalogue ${family.name}`,
      family: { mf_id: family.id || 0, mf_name: family.name || "", mf_pic: family.image || null },
      items: otherGammes.map((g: any) => ({
        name: g.name,
        link: `/pieces/${g.alias}-${g.id}.html`,
        image: g.image
          ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/articles/gammes-produits/catalogue/${g.image}?width=200&quality=85&t=31536000`
          : `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/articles/gammes-produits/catalogue/${g.alias}.webp?width=200&quality=85&t=31536000`,
        description: `Automecanik vous conseille de contrôler l'état du ${g.name.toLowerCase()} de votre véhicule`,
        meta_description: `${g.name} pas cher à contrôler régulièrement`,
        sort: g.sort_order,
      })),
    };
  }).catch(() => null); // 🛡️ Fallback si hierarchy timeout ou erreur

  const loadTime = Date.now() - startTime;

  // 🚀 OPTIMISÉ V3: filters inclus dans batch-loader, plus d'appel séparé
  const filtersData =
    batchResponse.filters?.data || batchResponse.filters || null;

  // 🚀 LCP OPTIMIZATION V6: defer() pour streamer données non-critiques
  // Données critiques (vehicle, pieces, seo) : retournées immédiatement
  // Données non-critiques (relatedArticles, blogArticle) : streamées après le first paint
  return defer(
    {
      // === DONNÉES CRITIQUES (bloquantes, nécessaires pour LCP) ===
      vehicle,
      gamme,
      pieces: piecesData,
      grouped_pieces: batchResponse.grouped_pieces || batchResponse.blocs || [],
      count: piecesData.length,
      minPrice,
      maxPrice,
      filtersData,
      seoContent,
      faqItems,
      buyingGuide,
      compatibilityInfo,
      crossSellingGammes,
      oemRefs: batchResponse.oemRefs || undefined,
      oemRefsSeo: batchResponse.oemRefsSeo || undefined,
      seo: {
        title: `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} | Pièces Auto`,
        h1: seoContent.h1,
        description: seoContent.longDescription.substring(0, 160),
      },
      performance: {
        loadTime,
        source: "batch-loader",
        cacheHit: false,
      },

      // === DONNÉES CRITIQUES SECONDAIRES (résolues après batch-loader) ===
      seoSwitches, // Résolu car utilisé dans callback JS

      // === DONNÉES STREAMÉES (non-bloquantes, chargées en background) ===
      // 🚀 LCP OPTIMIZATION V7: catalogueMameFamille streamé (below-fold)
      catalogueMameFamille: catalogueMameFamillePromise,
      relatedArticles: relatedArticlesPromise,
      blogArticle: blogArticlePromise,
    },
    {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600" },
    },
  );
}

// ========================================
// 📔 META - SEO (Schema.org généré par composant Breadcrumbs)
// ========================================

export const meta: MetaFunction<typeof loader> = ({ data, location }) => {
  if (!data) {
    return [
      { title: "Pièces automobile" },
      { name: "description", content: "Catalogue de pièces détachées" },
    ];
  }

  // Construire URL canonique complète
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  // Générer Schema.org Product pour rich snippets (première pièce comme exemple)
  const firstPiece = data.pieces[0];

  // 🔗 Préparer les produits liés pour isRelatedTo (cross-selling)
  const relatedProducts =
    data.crossSellingGammes?.slice(0, 3).map((gamme: any) => ({
      "@type": "Product",
      name: gamme.PG_NAME,
      url: `https://www.automecanik.com/pieces/${gamme.PG_ALIAS}-${gamme.PG_ID}.html`,
    })) || [];

  // 🔧 Références OEM pour JSON-LD (mpn = Manufacturer Part Number)
  const oemRefsArray = data.oemRefs?.oemRefs || data.oemRefsSeo || [];

  // 📊 Schema @graph - Meilleure approche SEO
  // Structure: Car (véhicule) ← Product (avec refs OEM) + ItemList (tous les produits)
  const productSchema = firstPiece
    ? {
        "@context": "https://schema.org",
        "@graph": [
          // 1️⃣ Car - Véhicule cible (permet les recherches "pièces Megane 3 1.5 dCi")
          {
            "@type": "Car",
            "@id": `${canonicalUrl}#vehicle`,
            name: `${data.vehicle.marque} ${data.vehicle.modele} ${data.vehicle.typeName || data.vehicle.type}`,
            brand: { "@type": "Brand", name: data.vehicle.marque },
            model: data.vehicle.modele,
            vehicleConfiguration: data.vehicle.typeName || data.vehicle.type,
            // 📅 Année modèle (Schema.org officiel)
            ...(data.vehicle.typeDateStart && {
              vehicleModelDate: data.vehicle.typeDateStart,
            }),
            // 📅 Période de production complète
            ...(data.vehicle.typeDateStart && {
              additionalProperty: [{
                "@type": "PropertyValue",
                name: "Période de production",
                value: data.vehicle.typeDateEnd
                  ? `${data.vehicle.typeDateStart}-${data.vehicle.typeDateEnd}`
                  : `depuis ${data.vehicle.typeDateStart}`,
              }],
            }),
            // TODO: Activer codes moteur quand données disponibles en base
            // 🔧 Codes moteur (K9K 752, etc.) - CLÉ SEO pour recherches techniques
            // ...(data.vehicle.motorCodesFormatted && {
            //   vehicleEngine: {
            //     "@type": "EngineSpecification",
            //     engineType: data.vehicle.motorCodesFormatted,
            //   },
            // }),
          },
          // 2️⃣ Product principal avec refs OEM (permet les recherches "7701206343")
          {
            "@type": "Product",
            "@id": `${canonicalUrl}#product`,
            name: `${data.gamme.name} ${data.vehicle.marque} ${data.vehicle.modele} ${data.vehicle.type}`,
            description: data.seo.description,
            url: canonicalUrl,
            // 🖼️ Image OBLIGATOIRE pour Google Merchant Listings
            // Fallback: image produit → logo marque équipementier → image gamme
            // ⚠️ Utilise normalizeImageUrl pour éviter les URLs dupliquées
            image: firstPiece.image
              ? normalizeImageUrl(firstPiece.image.startsWith('http') ? firstPiece.image : `/rack/${firstPiece.image}`)
              : firstPiece.marque_logo
                ? normalizeImageUrl(`/upload/equipementiers-automobiles/${firstPiece.marque_logo}`)
                : `https://www.automecanik.com/images/gammes/${data.gamme.alias || 'default'}.webp`,
            // 🔧 MPN = Référence OEM principale - CLÉ SEO
            ...(oemRefsArray[0] && { mpn: oemRefsArray[0] }),
            ...(firstPiece.reference && { sku: firstPiece.reference }),
            brand: { "@type": "Brand", name: firstPiece.brand },
            // 🚗 Lien vers le véhicule compatible
            isAccessoryOrSparePartFor: { "@id": `${canonicalUrl}#vehicle` },
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "EUR",
              lowPrice: data.minPrice,
              highPrice: data.maxPrice,
              offerCount: data.count,
              availability: "https://schema.org/InStock",
              seller: { "@type": "Organization", name: "Automecanik", url: "https://www.automecanik.com" },
            },
            // Note: aggregateRating retiré - nécessite de vrais avis clients pour éviter pénalité Google
            // 🔧 Propriétés additionnelles: refs OEM + codes moteur + codes mine
            additionalProperty: [
              // Refs OEM (jusqu'à 15)
              ...oemRefsArray.slice(0, 15).map((ref, i) => ({
                "@type": "PropertyValue",
                name: i === 0 ? "Référence OEM" : "Référence compatible",
                value: ref,
              })),
              // TODO: Activer codes moteur/mine quand données disponibles en base
              // 🔧 Code Moteur (K9K 752, etc.) - recherches techniques
              // ...(data.vehicle.motorCodesFormatted ? [{
              //   "@type": "PropertyValue",
              //   name: "Code Moteur",
              //   value: data.vehicle.motorCodesFormatted,
              // }] : []),
              // 🔧 Type Mine (335AHR, etc.) - recherches par immatriculation
              // ...(data.vehicle.mineCodesFormatted ? [{
              //   "@type": "PropertyValue",
              //   name: "Type Mine",
              //   value: data.vehicle.mineCodesFormatted,
              // }] : []),
            ].filter(p => p.value),
            ...(relatedProducts.length > 0 && { isRelatedTo: relatedProducts }),
          },
          // 3️⃣ ItemList - Liste des produits disponibles (rich snippets catalogue)
          {
            "@type": "ItemList",
            "@id": `${canonicalUrl}#list`,
            name: `${data.gamme.name} pour ${data.vehicle.marque} ${data.vehicle.modele}`,
            numberOfItems: data.count,
            // 🔧 Filtrer les pièces sans image pour éviter erreur GSC "Champ image manquant"
            itemListElement: data.pieces
              .filter((piece) => piece.image || piece.marque_logo)
              .slice(0, 8)
              .map((piece, index) => ({
                "@type": "ListItem",
                position: index + 1,
                item: {
                  "@type": "Product",
                  name: `${piece.name} ${piece.brand}`,
                  // 🔗 URL produit (recommandé pour rich snippets)
                  url: `${canonicalUrl}#product-${piece.id}`,
                  // 🖼️ Image OBLIGATOIRE pour Google Merchant Listings
                  // Fallback: image produit → logo marque équipementier
                  image: piece.image
                    ? normalizeImageUrl(piece.image.startsWith('http') ? piece.image : `/rack/${piece.image}`)
                    : normalizeImageUrl(`/upload/equipementiers-automobiles/${piece.marque_logo}`),
                  ...(piece.reference && { sku: piece.reference }),
                  brand: { "@type": "Brand", name: piece.brand },
                  offers: {
                    "@type": "Offer",
                    price: piece.price,
                    priceCurrency: "EUR",
                    availability: piece.stock === "En stock" ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
                  },
                  isAccessoryOrSparePartFor: { "@id": `${canonicalUrl}#vehicle` },
                },
              })),
          },
        ],
      }
    : null;

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { property: "og:title", content: data.seo.title },
    { property: "og:description", content: data.seo.description },
    { name: "robots", content: "index, follow" },

    // âœ¨ NOUVEAU: Canonical URL
    { tagName: "link", rel: "canonical", href: canonicalUrl },

    // âœ¨ NOUVEAU: Resource Hints pour Supabase (préconnexion)
    {
      tagName: "link",
      rel: "preconnect",
      href: "https://cxpojprgwgubzjyqzmoq.supabase.co",
    },
    {
      tagName: "link",
      rel: "dns-prefetch",
      href: "https://cxpojprgwgubzjyqzmoq.supabase.co",
    },

    // 🚀 LCP Optimization V5: Preload hero vehicle image avec transformation
    // URL DOIT matcher exactement celle du composant PiecesHeader pour éviter double téléchargement
    ...(data.vehicle.modelePic && data.vehicle.modelePic !== "no.webp"
      ? [
          {
            tagName: "link",
            rel: "preload",
            as: "image",
            // Utilise /render/image/ avec width=380&quality=85 (identique à optimizeImageUrl dans PiecesHeader)
            href: `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/uploads/constructeurs-automobiles/marques-concepts/${data.vehicle.marqueAlias || data.vehicle.marque.toLowerCase()}/${data.vehicle.modelePic}?width=380&quality=85&t=31536000`,
            fetchpriority: "high",
          },
        ]
      : []),

    // âœ¨ NOUVEAU: Schema.org Product (rich snippets)
    ...(productSchema
      ? [
          {
            "script:ld+json": productSchema,
          },
        ]
      : []),
  ];
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================

export default function PiecesVehicleRoute() {
  const data = useLoaderData<typeof loader>();
  const { trackClick, trackImpression } = useSeoLinkTracking();

  // Hook custom pour la logique de filtrage (gère son propre état)
  const {
    activeFilters,
    sortBy,
    viewMode,
    selectedPieces,
    filteredProducts,
    uniqueBrands,
    recommendedPieces,
    dynamicFilterCounts, // âœ¨ NOUVEAU: Comptages dynamiques
    brandAverageNotes, // âœ¨ Notes moyennes par marque
    setActiveFilters,
    setSortBy,
    setViewMode,
    resetAllFilters,
    togglePieceSelection,
  } = usePiecesFilters(data.pieces);

  // État pour catalogue collapsible (fermé par défaut)
  const [catalogueOpen, setCatalogueOpen] = useState(false);

  // 📊 Track les impressions de la section "Voir aussi" au montage
  useEffect(() => {
    trackImpression("VoirAussi", 4); // 4 liens dans la section
    if (data.crossSellingGammes?.length > 0) {
      trackImpression("CrossSelling", data.crossSellingGammes.length);
    }
  }, [trackImpression, data.crossSellingGammes?.length]);

  // 📊 Handlers pour tracker les clics "Voir aussi"
  const handleVoirAussiClick = useCallback(
    (url: string, anchorText: string) => {
      trackClick("VoirAussi", url, { anchorText, position: "voiraussi" });
    },
    [trackClick],
  );

  // Actions de sélection pour mode comparaison
  // âš¡ Optimisé avec useCallback pour éviter re-création Ã  chaque render
  const handleSelectPiece = useCallback(
    (pieceId: number) => {
      if (viewMode === "comparison") {
        togglePieceSelection(pieceId);
      }
    },
    [viewMode, togglePieceSelection],
  );

  const handleRemoveFromComparison = useCallback(
    (pieceId: number) => {
      togglePieceSelection(pieceId);
    },
    [togglePieceSelection],
  );

  // âœ¨ Calcul des positions disponibles pour le filtre sidebar
  const availablePositions = useMemo((): string[] => {
    const groupedPieces = data.grouped_pieces || [];
    const positions: string[] = groupedPieces
      .map((g: any) => g.filtre_side as string)
      .filter((side): side is string => Boolean(side));
    return [...new Set(positions)];
  }, [data.grouped_pieces]);

  // âœ¨ Label du filtre position adapté selon la gamme
  const positionLabel = useMemo(() => {
    const gammeAlias = data.gamme?.alias?.toLowerCase() || "";
    // Rétroviseurs, essuie-glaces, clignotants ←' Côté (Gauche/Droite)
    if (
      ["retroviseur", "essuie-glace", "clignotant", "feu", "phare"].some((k) =>
        gammeAlias.includes(k),
      )
    ) {
      return "Côté";
    }
    // Plaquettes, disques, amortisseurs ←' Position (Avant/Arrière)
    return "Position";
  }, [data.gamme]);

  // 🔗 Fonction pour générer des ancres SEO variées depuis les switches
  const getAnchorText = useCallback((index: number): string => {
    const switches = data.seoSwitches?.verbs || [];
    if (switches.length > 0) {
      const switchItem = switches[index % switches.length];
      const verb = switchItem?.content || '';
      if (verb) {
        // Capitaliser la première lettre
        return verb.charAt(0).toUpperCase() + verb.slice(1);
      }
    }
    // Ancres par défaut avec rotation
    const defaultAnchors = ['Voir', 'Découvrir', 'Explorer', 'Détails'];
    return defaultAnchors[index % defaultAnchors.length];
  }, [data.seoSwitches]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 relative">
      {/* Pattern d'arrière-plan subtil */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDE0YzIuMiAwIDQgMS44IDQgNHMtMS44IDQtNCA0LTQtMS44LTQtNGMwLTIuMiAxLjgtNCA0LTR6bTAgNDBjMi4yIDAgNCAxLjggNCA0cy0xLjggNC00IDQtNC0xLjgtNC00YzAtMi4yIDEuOC00IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>

      {/* Header moderne */}
      <div className="relative z-10">
        <PiecesHeader
          vehicle={data.vehicle}
          gamme={data.gamme}
          count={data.count}
          performance={data.performance}
        />
      </div>

      {/* 🍞 Fil d'ariane SEO optimisé - Réutilisation composant Breadcrumbs */}
      <div
        className="bg-white border-b border-gray-200 relative z-[100]"
        style={{ pointerEvents: "auto", position: "relative" }}
      >
        <div
          className="max-w-7xl mx-auto px-4 py-3"
          style={{ pointerEvents: "auto" }}
        >
          <Breadcrumbs
            items={[
              { label: "Accueil", href: "/" },
              {
                label: data.gamme.name,
                href: `/pieces/${data.gamme.alias}-${data.gamme.id}.html`,
              },
              {
                label: `Pièces ${data.vehicle.marque}`,
                href: `/constructeurs/${data.vehicle.marqueAlias}-${data.vehicle.marqueId}.html`,
              },
              {
                label: `${data.vehicle.modele} ${data.vehicle.typeName || data.vehicle.type}`,
                href: `/constructeurs/${data.vehicle.marqueAlias}-${data.vehicle.marqueId}/${data.vehicle.modeleAlias}-${data.vehicle.modeleId}/${data.vehicle.typeAlias}-${data.vehicle.typeId}.html`,
              },
              {
                label: `${data.gamme.name} ${data.vehicle.marque} ${data.vehicle.modele}`,
              },
            ]}
            showHome={false}
            separator="left-arrow"
            enableSchema={true}
          />
        </div>
      </div>

      {/* Conteneur principal */}
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        {/* 🚗 Sélecteur de véhicule - Mode compact sticky */}
        <div className="mb-6 sticky top-4 z-20 animate-in fade-in slide-in-from-top duration-500">
          <VehicleSelectorV2
            mode="compact"
            context="pieces"
            variant="card"
            redirectOnSelect={false}
            onVehicleSelect={(vehicle) => {
              console.log("🔄 Véhicule sélectionné:", vehicle);
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
              type: { id: data.vehicle.typeId, name: data.vehicle.type },
            }}
          />
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filtres et catalogue */}
          <aside className="lg:w-80 flex-shrink-0 space-y-6 animate-in fade-in slide-in-from-left duration-700">
            {/* Filtres */}
            <div className="sticky top-24">
              <PiecesFilterSidebar
                activeFilters={activeFilters}
                setActiveFilters={setActiveFilters}
                uniqueBrands={uniqueBrands}
                piecesCount={filteredProducts.length}
                resetAllFilters={resetAllFilters}
                getBrandCount={(brand) =>
                  dynamicFilterCounts.brandCounts.get(brand) || 0
                }
                getQualityCount={(quality) =>
                  dynamicFilterCounts.qualityCounts.get(quality) || 0
                }
                getPriceRangeCount={(range) =>
                  dynamicFilterCounts.priceCounts[
                    range as "low" | "medium" | "high"
                  ] || 0
                }
                filtersData={data.filtersData}
                availablePositions={availablePositions}
                positionLabel={positionLabel}
                brandAverageNotes={brandAverageNotes}
              />
            </div>

            {/* Catalogue collapsible - 🚀 LCP V7: Streamé via Await */}
            <Suspense fallback={null}>
              <Await resolve={data.catalogueMameFamille}>
                {(catalogueMameFamille) => catalogueMameFamille && catalogueMameFamille.items?.length > 0 && (() => {
                  // Calculer la couleur de la famille depuis catalogueMameFamille
                  const familleColor = catalogueMameFamille.family
                  ? hierarchyApi.getFamilyColor({
                      mf_id: catalogueMameFamille.family.mf_id,
                      mf_name: catalogueMameFamille.family.mf_name,
                      mf_pic: catalogueMameFamille.family.mf_pic,
                    } as any)
                  : "from-blue-950 via-indigo-900 to-purple-900";

                return (
                  <div>
                    <div
                      className={`relative rounded-lg overflow-hidden shadow-lg bg-gradient-to-br ${familleColor}`}
                    >
                      {/* Header cliquable pour toggle */}
                      <button
                        onClick={() => setCatalogueOpen(!catalogueOpen)}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/10 transition-colors"
                      >
                        <h2 className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] flex items-center gap-2">
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                            />
                          </svg>
                          Catalogue{" "}
                          {catalogueMameFamille?.family?.mf_name || "Système de freinage"}
                          <span className="text-xs font-normal opacity-75">
                            ({catalogueMameFamille.items.length})
                          </span>
                        </h2>
                        <svg
                          className={`w-5 h-5 text-white transition-transform duration-300 ${catalogueOpen ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Contenu collapsible */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ${catalogueOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}
                      >
                        <div className="p-3 pt-0">
                          <div className="grid grid-cols-4 gap-1.5 auto-rows-max">
                            {catalogueMameFamille.items
                              .slice(0, 32)
                              .map((item, index) => (
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
                                      e.currentTarget.src =
                                        "/images/placeholder-product.png";
                                    }}
                                  />

                                  {/* Nom du produit - toujours visible en bas */}
                                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent text-white text-[6px] p-1 group-hover:from-black/95 group-hover:via-black/85 transition-all duration-300">
                                    <p className="line-clamp-2 font-medium text-center leading-tight">
                                      {item.name}
                                    </p>
                                  </div>

                                  {/* Badge "Voir" au hover - apparaît en haut Ã  droite */}
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                    <div className="bg-white/90 backdrop-blur-sm text-gray-900 text-[7px] font-bold px-1.5 py-0.5 rounded-full shadow-lg flex items-center gap-0.5">
                                      <svg
                                        className="w-2 h-2"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                        />
                                      </svg>
                                      <span>{getAnchorText(index)}</span>
                                    </div>
                                  </div>

                                  {/* Effet de brillance au hover */}
                                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/0 to-transparent group-hover:via-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                </a>
                              ))}
                            {catalogueMameFamille.items.length > 32 && (
                              <div className="flex items-center justify-center aspect-square rounded-md bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-[9px] shadow-sm">
                                +{catalogueMameFamille.items.length - 32}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })()}
              </Await>
            </Suspense>
          </aside>

          {/* Contenu principal */}
          <main className="flex-1 min-w-0">
            <div className="space-y-6">
              {/* Barre d'outils vue - Composant extrait */}
              <PiecesToolbar
                viewMode={viewMode}
                setViewMode={setViewMode}
                sortBy={sortBy}
                setSortBy={setSortBy}
                filteredCount={filteredProducts.length}
                minPrice={data.minPrice}
                selectedPiecesCount={selectedPieces.length}
              />

              {/* Affichage des pièces selon le mode */}
              {data.grouped_pieces && data.grouped_pieces.length > 0 ? (
                // âœ¨ AFFICHAGE GROUPÉ avec titres H2
                <div className="space-y-8">
                  {data.grouped_pieces
                    // 🎯 Filtrer les groupes par position (Avant/Arrière ou Gauche/Droite)
                    .filter((group: any) => {
                      if (
                        !activeFilters.position ||
                        activeFilters.position === "all"
                      ) {
                        return true;
                      }
                      return group.filtre_side === activeFilters.position;
                    })
                    .map((group: any, idx: number) => {
                      // Filtrer les pièces du groupe selon les filtres actifs
                      // âœ… Protection: group.pieces peut être undefined
                      const groupPieces = (group.pieces || []).filter(
                        (p: any) => {
                          // Mapper l'objet API vers PieceData pour compatibilité avec filtres
                          const pieceData = {
                            id: p.id,
                            name: p.nom || p.name || "Pièce",
                            brand: p.marque || p.brand || "Marque inconnue",
                            reference: p.reference || "",
                            price:
                              p.prix_unitaire || p.prix_ttc || p.price || 0,
                            priceFormatted: (
                              p.prix_unitaire ||
                              p.prix_ttc ||
                              p.price ||
                              0
                            ).toFixed(2),
                            image: p.image || "",
                            images: p.images || [],
                            stock: p.dispo ? "En stock" : "Sur commande",
                            quality: p.qualite || p.quality || "",
                            stars: p.nb_stars
                              ? parseInt(p.nb_stars)
                              : undefined,
                            description: p.description || "",
                            url: p.url || "",
                            marque_id: p.marque_id,
                            marque_logo: p.marque_logo,
                          };

                          // Appliquer les filtres
                          if (
                            activeFilters.brands.length > 0 &&
                            !activeFilters.brands.includes(pieceData.brand)
                          ) {
                            return false;
                          }
                          if (
                            activeFilters.searchText &&
                            !pieceData.name
                              .toLowerCase()
                              .includes(activeFilters.searchText.toLowerCase())
                          ) {
                            return false;
                          }
                          // 🎯 Filtre par qualité
                          if (
                            activeFilters.quality !== "all" &&
                            pieceData.quality !== activeFilters.quality
                          ) {
                            return false;
                          }
                          // 🎯 Filtre par prix
                          if (activeFilters.priceRange !== "all") {
                            const price = pieceData.price;
                            if (
                              activeFilters.priceRange === "low" &&
                              price >= 50
                            )
                              return false;
                            if (
                              activeFilters.priceRange === "medium" &&
                              (price < 50 || price >= 150)
                            )
                              return false;
                            if (
                              activeFilters.priceRange === "high" &&
                              price < 150
                            )
                              return false;
                          }
                          // 🎯 Filtre par disponibilité
                          if (
                            activeFilters.availability === "stock" &&
                            pieceData.stock !== "En stock"
                          ) {
                            return false;
                          }
                          // 🎯 Filtre par note minimale (sur 10)
                          if (
                            activeFilters.minNote &&
                            activeFilters.minNote > 0
                          ) {
                            const stars = pieceData.stars || 3;
                            const note = Math.round((stars / 6) * 10);
                            if (note < activeFilters.minNote) return false;
                          }
                          return true;
                        },
                      );

                      if (groupPieces.length === 0) return null;

                      return (
                        <div
                          key={`${group.filtre_gamme}-${group.filtre_side}-${idx}`}
                          className="animate-in fade-in slide-in-from-top duration-500"
                        >
                          {/* Titre H2 dynamique avec modèle véhicule */}
                          <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b-2 border-blue-500 flex items-center gap-3">
                            <span className="w-1.5 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></span>
                            {group.title_h2 ||
                              `${group.filtre_gamme} ${group.filtre_side}`}{" "}
                            {data.vehicle.modele}
                            <span className="text-sm font-normal text-gray-500 ml-auto">
                              ({groupPieces.length} article
                              {groupPieces.length > 1 ? "s" : ""})
                            </span>
                          </h2>

                          {/* Grille de pièces du groupe */}
                          {viewMode === "grid" && (
                            <PiecesGridView
                              pieces={groupPieces.map((p: any) => ({
                                id: p.id,
                                name: p.nom || p.name || "Pièce",
                                brand: p.marque || p.brand || "Marque inconnue",
                                reference: p.reference || "",
                                price:
                                  p.prix_unitaire || p.prix_ttc || p.price || 0,
                                priceFormatted: (
                                  p.prix_unitaire ||
                                  p.prix_ttc ||
                                  p.price ||
                                  0
                                ).toFixed(2),
                                image: p.image || "",
                                images: p.images || [],
                                stock: p.dispo ? "En stock" : "Sur commande",
                                quality: p.qualite || "",
                                stars: p.nb_stars
                                  ? parseInt(p.nb_stars)
                                  : undefined,
                                description: p.description || "",
                                url: p.url || "",
                                marque_id: p.marque_id,
                                marque_logo: p.marque_logo,
                              }))}
                              onSelectPiece={handleSelectPiece}
                              selectedPieces={selectedPieces}
                              vehicleMarque={data.vehicle.marque}
                            />
                          )}

                          {viewMode === "list" && (
                            <PiecesListView
                              pieces={groupPieces.map((p: any) => ({
                                id: p.id,
                                name: p.nom || p.name || "Pièce",
                                brand: p.marque || p.brand || "Marque inconnue",
                                reference: p.reference || "",
                                price:
                                  p.prix_unitaire || p.prix_ttc || p.price || 0,
                                priceFormatted: (
                                  p.prix_unitaire ||
                                  p.prix_ttc ||
                                  p.price ||
                                  0
                                ).toFixed(2),
                                image: p.image || "",
                                images: p.images || [],
                                stock: p.dispo ? "En stock" : "Sur commande",
                                quality: p.qualite || "",
                                stars: p.nb_stars
                                  ? parseInt(p.nb_stars)
                                  : undefined,
                                description: p.description || "",
                                url: p.url || "",
                                marque_id: p.marque_id,
                                marque_logo: p.marque_logo,
                              }))}
                              onSelectPiece={handleSelectPiece}
                              selectedPieces={selectedPieces}
                            />
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                // âœ¨ FALLBACK: Affichage simple si pas de groupes
                <>
                  {viewMode === "grid" && (
                    <PiecesGridView
                      pieces={filteredProducts}
                      onSelectPiece={handleSelectPiece}
                      selectedPieces={selectedPieces}
                      vehicleMarque={data.vehicle.marque}
                    />
                  )}

                  {viewMode === "list" && (
                    <PiecesListView
                      pieces={filteredProducts}
                      onSelectPiece={handleSelectPiece}
                      selectedPieces={selectedPieces}
                    />
                  )}
                </>
              )}

              {viewMode === "comparison" && (
                <PiecesComparisonView
                  pieces={filteredProducts}
                  selectedPieces={selectedPieces}
                  onRemovePiece={handleRemoveFromComparison}
                />
              )}

              {/* Pièces recommandées */}
              {recommendedPieces.length > 0 && viewMode !== "comparison" && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
                  <h3 className="text-lg font-bold text-orange-900 mb-4 flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Nos recommandations
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recommendedPieces.map((piece) => (
                      <div
                        key={piece.id}
                        className="bg-white rounded-lg p-4 shadow-sm"
                      >
                        <div className="font-medium text-gray-900 mb-1 line-clamp-2">
                          {piece.name}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {piece.brand}
                        </div>
                        <div className="text-lg font-bold text-blue-600">
                          {piece.priceFormatted}â‚¬
                        </div>
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

                {/* 🎯 Section Références OEM Constructeur - Composant extrait */}
                <PiecesOemSection
                  groupedPieces={data.grouped_pieces}
                  vehicle={data.vehicle}
                  gamme={data.gamme}
                />

                {/* 🚀 LCP OPTIMIZATION V6: Suspense boundaries pour composants lazy below-fold */}
                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesBuyingGuide guide={data.buyingGuide} />
                </Suspense>

                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesFAQSection items={data.faqItems} />
                </Suspense>

                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesCompatibilityInfo
                    compatibility={data.compatibilityInfo}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                    motorCodesFormatted={data.vehicle.motorCodesFormatted}
                    mineCodesFormatted={data.vehicle.mineCodesFormatted}
                  />
                </Suspense>

                <Suspense fallback={<div className="h-24 bg-gray-100 animate-pulse rounded-lg" />}>
                  <PiecesStatistics
                    pieces={data.pieces}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                    gammeName={data.gamme.name}
                  />
                </Suspense>
              </div>
            </div>
          </main>
        </div>

        {/* Cross-selling - Suspense pour lazy component */}
        {data.crossSellingGammes.length > 0 && (
          <div className="mt-12">
            <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded-lg mx-4" />}>
              <PiecesCrossSelling
                gammes={data.crossSellingGammes}
                vehicle={data.vehicle}
              />
            </Suspense>
          </div>
        )}

        {/* 🚀 LCP OPTIMIZATION V6: Articles liés streamés via defer() + Await */}
        <Suspense fallback={<div className="h-32 bg-gray-100 animate-pulse rounded-lg mx-4" />}>
          <Await resolve={data.relatedArticles}>
            {(resolvedArticles) => {
              // Filtrer les nulls et vérifier qu'il y a des articles
              const validArticles = (resolvedArticles || []).filter((a): a is NonNullable<typeof a> => a !== null);
              return validArticles.length > 0 ? (
                <div className="container mx-auto px-4">
                  <PiecesRelatedArticles
                    articles={validArticles}
                    gammeName={data.gamme.name}
                    vehicleName={`${data.vehicle.marque} ${data.vehicle.modele}`}
                  />
                </div>
              ) : null;
            }}
          </Await>
        </Suspense>

        {/* Section "Voir aussi" - Maillage interne SEO */}
        <section className="container mx-auto px-4 mt-8 mb-12">
          <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Voir aussi
            </h2>
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {/* Lien vers la gamme parent - Ancre enrichie SEO */}
              <li>
                <Link
                  to={`/pieces/${data.gamme.alias}-${data.gamme.id}.html`}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  onClick={() =>
                    handleVoirAussiClick(
                      `/pieces/${data.gamme.alias}-${data.gamme.id}.html`,
                      `Voir toutes les ${data.gamme.name} neuves - Prix discount`,
                    )
                  }
                  title={`Découvrez notre gamme complète de ${data.gamme.name} neuves Ã  prix réduit`}
                >
                  <span className="text-gray-400">←’</span>
                  Voir toutes les {data.gamme.name} neuves
                </Link>
              </li>
              {/* Lien vers le constructeur - Ancre enrichie avec marque */}
              <li>
                <Link
                  to={`/constructeurs/${data.vehicle.marqueAlias || data.vehicle.marque.toLowerCase()}-${data.vehicle.marqueId}.html`}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  onClick={() =>
                    handleVoirAussiClick(
                      `/constructeurs/${data.vehicle.marqueAlias || data.vehicle.marque.toLowerCase()}-${data.vehicle.marqueId}.html`,
                      `Toutes les pièces auto ${data.vehicle.marque} pas chères`,
                    )
                  }
                  title={`Catalogue complet de pièces détachées ${data.vehicle.marque} - Qualité origine`}
                >
                  <span className="text-gray-400">←’</span>
                  Pièces auto {data.vehicle.marque} pas chères
                </Link>
              </li>
              {/* Lien vers le modèle - Ancre enrichie avec marque + modèle */}
              <li>
                <Link
                  to={`/constructeurs/${data.vehicle.marqueAlias || data.vehicle.marque.toLowerCase()}-${data.vehicle.marqueId}/${data.vehicle.modeleAlias || data.vehicle.modele.toLowerCase()}-${data.vehicle.modeleId}.html`}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  onClick={() =>
                    handleVoirAussiClick(
                      `/constructeurs/${data.vehicle.marqueAlias || data.vehicle.marque.toLowerCase()}-${data.vehicle.marqueId}/${data.vehicle.modeleAlias || data.vehicle.modele.toLowerCase()}-${data.vehicle.modeleId}.html`,
                      `Pièces détachées ${data.vehicle.marque} ${data.vehicle.modele} - Livraison rapide`,
                    )
                  }
                  title={`Toutes les pièces détachées pour ${data.vehicle.marque} ${data.vehicle.modele} - Livraison 24/48h`}
                >
                  <span className="text-gray-400">←’</span>
                  Pièces {data.vehicle.marque} {data.vehicle.modele}
                </Link>
              </li>
              {/* Lien vers catalogue complet - Ancre descriptive */}
              <li>
                <Link
                  to="/pieces"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  onClick={() =>
                    handleVoirAussiClick(
                      "/pieces",
                      "Catalogue pièces auto toutes marques",
                    )
                  }
                  title="Explorer notre catalogue complet de pièces détachées auto pour toutes les marques"
                >
                  <span className="text-gray-400">←’</span>
                  Catalogue pièces toutes marques
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>

      {/* Bouton retour en haut */}
      <ScrollToTop />

      {/* Performance debug (dev only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-3 rounded-lg backdrop-blur-sm">
          <div>âš¡ Load: {data.performance.loadTime}ms</div>
          <div>📦 Pièces: {data.count}</div>
          <div>📍 Filtrées: {filteredProducts.length}</div>
        </div>
      )}
    </div>
  );
}

// ========================================
// 🚨 ERROR BOUNDARY - Gestion 410 Gone & 503 Service Unavailable
// ========================================

export function ErrorBoundary() {
  const error = useRouteError();

  // Log détaillé de l'erreur pour debug
  console.error("🚨 [ERROR BOUNDARY] Erreur capturée:", error);
  console.error("🚨 [ERROR BOUNDARY] Type:", typeof error);
  console.error(
    "🚨 [ERROR BOUNDARY] Stack:",
    error instanceof Error ? error.stack : "N/A",
  );

  // 🛡️ Gestion spécifique du 503 Service Unavailable (erreur réseau temporaire)
  if (isRouteErrorResponse(error) && error.status === 503) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-lg w-full text-center">
          <div className="mb-6">
            <div className="inline-flex p-4 bg-blue-100 rounded-full mb-4">
              <svg
                className="w-12 h-12 text-blue-600 animate-pulse"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Chargement en cours...
            </h1>
            <p className="text-gray-600 mb-4">
              Notre service est temporairement surchargé. La page va se
              recharger automatiquement.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🔄 Réessayer maintenant
            </button>
            <a
              href="/"
              className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ← Retour Ã  l'accueil
            </a>
          </div>

          {/* Auto-reload après 5s */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
            setTimeout(() => window.location.reload(), 5000);
          `,
            }}
          />

          <p className="text-xs text-gray-400 mt-4">
            Rechargement automatique dans 5 secondes...
          </p>
        </div>
      </div>
    );
  }

  // Gestion spécifique du 410 Gone (page sans résultats)
  if (isRouteErrorResponse(error) && error.status === 410) {
    return (
      <>
        <head>
          <meta name="robots" content="noindex, nofollow" />
          <meta name="googlebot" content="noindex, nofollow" />
        </head>
        <Error410
          url={
            typeof window !== "undefined" ? window.location.pathname : undefined
          }
          isOldLink={false}
        />
      </>
    );
  }

  // Message d'erreur détaillé pour le développement
  const errorMessage =
    error instanceof Error
      ? error.message
      : isRouteErrorResponse(error)
        ? `${error.status}: ${error.statusText}`
        : "Une erreur inattendue s'est produite";

  const errorDetails =
    error instanceof Error && error.stack
      ? error.stack
      : JSON.stringify(error, null, 2);

  // Autres erreurs (404, 500, etc.)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-4">{errorMessage}</p>

        {/* Détails de l'erreur en mode développement */}
        {process.env.NODE_ENV === "development" && (
          <details className="mb-6 bg-gray-100 rounded p-4">
            <summary className="cursor-pointer font-semibold text-sm text-gray-700 mb-2">
              Détails techniques (développement)
            </summary>
            <pre className="text-xs text-gray-600 overflow-auto max-h-64 whitespace-pre-wrap">
              {errorDetails}
            </pre>
          </details>
        )}

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
