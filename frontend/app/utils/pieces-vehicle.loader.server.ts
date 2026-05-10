/**
 * Loader server-only pour la route R2 Produit
 * /pieces/:gamme/:marque/:modele/:type.html
 *
 * Extrait de la route pour reduire le fichier principal a un thin orchestrator.
 */

import {
  defer,
  json,
  redirect,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { type NoProductsData } from "~/components/pieces/NoProductsAlternatives";
import { type FiltersData } from "~/components/pieces/PiecesFilterSidebar";
import { fetchRmPageV2 } from "~/services/api/rm-api.service";
import {
  fetchBlogArticleWithRelated,
  fetchSeoSwitches,
} from "~/services/pieces/pieces-route.service";
import { fetchJsonOrNull } from "~/utils/fetch.utils";
import { logger } from "~/utils/logger";
import {
  buildCataloguePromise,
  type HierarchyData,
} from "~/utils/pieces-loader.utils";
import {
  detectMalformedSegment,
  generateBuyingGuide,
  generateFAQ,
  parseUrlParam,
  resolveGammeId,
  resolveVehicleIds,
  validateVehicleIds,
} from "~/utils/pieces-route.utils";
import { mapRmV2ToLoaderData, isRmV2DataUsable } from "~/utils/rm-mapper";
import { stripHtmlForMeta } from "~/utils/seo-clean.utils";
import {
  buildTypeSlug,
  buildVoirAussiLinks,
  normalizeAlias,
} from "~/utils/url-builder.utils";

const INITIAL_PRODUCTS_LIMIT = 200;

export async function piecesVehicleLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  const startTime = Date.now();

  // Debug URL complete
  const url = new URL(request.url);
  logger.log("📍 [LOADER] URL complète:", url.pathname);

  // 1. Parse des parametres URL
  const {
    gamme: rawGamme,
    marque: rawMarque,
    modele: rawModele,
    type: rawType,
  } = params;

  if (!rawGamme || !rawMarque || !rawModele || !rawType) {
    throw new Response(`Paramètres manquants`, { status: 400 });
  }

  // 1b. Guard: detection URLs mal formees AVANT appels API
  // Economise les API calls pour ~60k URLs historiques (anciens sitemaps, liens externes)
  const malformedReason = detectMalformedSegment(
    rawGamme,
    rawMarque,
    rawModele,
    rawType,
  );
  if (malformedReason) {
    // 410 Gone pour patterns générés par sitemap legacy / TecDoc V1 orphelins
    // (désindexation GSC plus rapide que 404)
    // 404 conservé pour patterns récupérables (URL tapée, lien externe mal encodé)
    const PERMANENT_MALFORMED = new Set([
      "type_prefix_fallback", // /type-{id}.html : alias fallback quand type_alias était NULL
      "missing_alias", // /-{id}.html : slug vide, alias n'existait pas
      "null_in_url", // /null-{id}.html : null littéral
      "repeated_id", // /12563-12563.html : bug sitemap pagination
      "repeated_id_multi", // /12563-12563-12563.html
    ]);
    const status = PERMANENT_MALFORMED.has(malformedReason) ? 410 : 404;
    logger.log(
      `🚫 [${status}] URL mal formée (${malformedReason}): ${url.pathname}`,
    );
    throw new Response(
      JSON.stringify({ reason: malformedReason, url: url.pathname }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=86400",
        },
      },
    );
  }

  // 2. Parse les IDs depuis les URLs
  const gammeData = parseUrlParam(rawGamme);
  const _marqueData = parseUrlParam(rawMarque);
  const _modeleData = parseUrlParam(rawModele);
  const _typeData = parseUrlParam(rawType);

  // 3. Resolution des IDs via API (PARALLELISE pour performance)
  let vehicleIds: Awaited<ReturnType<typeof resolveVehicleIds>>;
  let gammeId: number;
  try {
    [vehicleIds, gammeId] = await Promise.all([
      resolveVehicleIds(rawMarque, rawModele, rawType),
      resolveGammeId(rawGamme),
    ]);
  } catch (resolveErr) {
    // Si la resolution echoue (API down, params invalides), retourner 404
    logger.error(
      `❌ [LOADER] ID resolution failed for ${url.pathname}:`,
      resolveErr instanceof Error ? resolveErr.message : resolveErr,
    );
    throw new Response(
      JSON.stringify({ reason: "id_resolution_failed", url: url.pathname }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=60, s-maxage=300",
        },
      },
    );
  }

  // Validation des IDs vehicule - Si invalides, 301 redirect vers page gamme
  // gammeId n'est PAS valide ici - delegue au RM V2 RPC pour permettre gammeId=0 -> 404 SEO
  let vehicleValidationFailed = false;
  try {
    validateVehicleIds({
      marqueId: vehicleIds.marqueId,
      modeleId: vehicleIds.modeleId,
      typeId: vehicleIds.typeId,
      // gammeId: gammeId, // Retire - validation par RM V2 RPC
      source: "loader-validation",
    });
  } catch (validationError) {
    // IDs invalides -> 301 redirect vers page gamme (SEO optimal)
    logger.warn(
      `⚠️ [LOADER] Validation IDs échouée, redirect 301 vers gamme:`,
      validationError,
    );
    vehicleValidationFailed = true;
  }

  // SEO: Si validation vehicule echouee -> 410 Gone (désindexation GSC rapide)
  // Raison TecDoc V2 remap : ~3,545 type_ids orphelins (100001-134362) héritent du
  // sitemap V1. Ces IDs ne seront jamais restaurés -> 410 permanent.
  // Historique : 301 vers gamme créait 43.9k "pages avec redirection" dans GSC,
  // 404 signalait juste "peut-être temporaire" (désindexation lente, >6 mois).
  // 410 = "definitely gone" -> désindexation GSC en semaines, pas mois.
  if (vehicleValidationFailed) {
    logger.log(
      `🚫 [410] Validation véhicule échouée (type orphelin): /pieces/${gammeData.alias}-${gammeId}.html`,
    );
    throw new Response(
      JSON.stringify({
        reason: "invalid_vehicle",
        gammeAlias: gammeData.alias,
        gammeId,
        gammeUrl: `/pieces/${gammeData.alias}-${gammeId}.html`,
      }),
      {
        status: 410,
        headers: {
          "Content-Type": "application/json",
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control":
            "public, max-age=60, s-maxage=3600, stale-while-revalidate=3600",
        },
      },
    );
  }

  // RM API V2 - Complete Read Model (single source of truth)
  // Returns: products, grouped_pieces, vehicleInfo, gamme, seo, oemRefs, crossSelling, filters

  // LCP V8: Lancer hierarchy immediatement (pour catalogueMameFamille deferred)
  const hierarchyPromise = fetchJsonOrNull<HierarchyData>(
    `http://127.0.0.1:3000/api/catalog/homepage-families`,
    3000,
  );

  // SEO switches pour anchor text varies
  const seoSwitchesPromise = fetchSeoSwitches(gammeId, 3000);

  // RM V2: Single RPC for ALL data (~400ms, cached in Redis)
  const rmV2Promise = fetchRmPageV2(
    gammeId,
    vehicleIds.typeId,
    INITIAL_PRODUCTS_LIMIT,
  ).catch((err) => {
    logger.error(
      `❌ [RM V2] Failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  });

  // LCP V9: seoSwitches deferred (below-fold only, has fallback anchors)
  const rmV2Response = await rmV2Promise;

  // SEO: 0 produits -> page utile avec alternatives (200 + noindex)
  // Mieux que 404 : pas d'erreur GSC, liens internes suivis, UX guidee
  if (!rmV2Response || !isRmV2DataUsable(rmV2Response, 1)) {
    logger.log(
      `🔄 [NO_PRODUCTS] 0 produits, page alternatives pour: /pieces/${gammeData.alias}-${gammeId}.html`,
    );

    // Fetch alternatives en parallele (autres gammes pour ce vehicule + autres vehicules pour cette gamme)
    const alternativesData = await fetchJsonOrNull<{
      success: boolean;
      alternativeGammes: Array<{
        pg_id: number;
        pg_name: string;
        pg_alias: string;
        pg_pic: string | null;
      }>;
      alternativeVehicles: Array<{
        type_id: string;
        type_name: string;
        type_alias: string | null;
        modele_name: string;
        modele_alias: string;
        modele_id: number;
        marque_name: string;
        marque_alias: string;
        marque_id: number;
      }>;
    }>(
      `http://127.0.0.1:3000/api/rm/alternatives?gamme_id=${gammeId}&type_id=${vehicleIds.typeId}&limit=12`,
      3000,
    );

    // Construire le label vehicule lisible depuis les params URL
    const vehicleLabel = [rawMarque, rawModele, rawType]
      .filter(Boolean)
      .map((s) => s!.replace(/-\d+$/, "").replace(/-/g, " "))
      .join(" ");

    return json(
      {
        noProducts: true as const,
        gammeId,
        gammeAlias: gammeData.alias,
        gammeName:
          rmV2Response?.gamme?.pg_name || gammeData.alias.replace(/-/g, " "),
        vehicleLabel,
        alternativeGammes: alternativesData?.alternativeGammes || [],
        alternativeVehicles: alternativesData?.alternativeVehicles || [],
      } satisfies NoProductsData,
      {
        headers: {
          "X-Robots-Tag": "noindex, follow",
          "Cache-Control": "public, max-age=300, s-maxage=3600",
        },
      },
    );
  }

  logger.log(
    `🚀 [RM V2] ${rmV2Response.count} products in ${rmV2Response.duration_ms}ms (cache: ${rmV2Response.cacheHit})`,
  );

  // Guard: si la gamme ou le vehicule n'existent pas -> 404
  if (!rmV2Response?.vehicleInfo || !rmV2Response?.gamme) {
    throw new Response("Gamme non trouvée", { status: 404 });
  }

  // Map RM V2 response to LoaderData format
  let loaderData: ReturnType<typeof mapRmV2ToLoaderData>;
  try {
    loaderData = mapRmV2ToLoaderData(rmV2Response, {
      loadTime: Date.now() - startTime,
    });
  } catch (mapErr) {
    logger.error(
      `❌ [LOADER] mapRmV2ToLoaderData failed for ${url.pathname}:`,
      mapErr instanceof Error ? mapErr.message : mapErr,
    );
    throw new Response("Service temporairement indisponible", {
      status: 503,
      headers: {
        "X-Robots-Tag": "noindex",
        "Retry-After": "300",
        "Cache-Control": "no-cache",
      },
    });
  }

  // Extract mapped data
  const { vehicle, gamme, pieces: piecesData } = loaderData;

  // try/catch global pour le bloc de construction de la reponse
  // Protege contre les crashes dans canonical, FAQ, mapping, etc.
  try {
    // SEO: Canonical URL calculee depuis les donnees RM V2 (pas location.pathname)
    // Corrige les ~1.4k pages "Page en double" dans Google Search Console
    const correctGammeSlug = `${gamme.alias}-${gamme.id}`;
    const correctBrandSlug = `${vehicle.marqueAlias || normalizeAlias(vehicle.marque)}-${vehicle.marqueId}`;
    const correctModelSlug = `${vehicle.modeleAlias || normalizeAlias(vehicle.modele)}-${vehicle.modeleId}`;
    const correctTypeSlug = buildTypeSlug({
      type_alias: vehicle.typeAlias,
      type_name: vehicle.type,
      type_id: vehicle.typeId,
    });
    const canonicalPath = `/pieces/${correctGammeSlug}/${correctBrandSlug}/${correctModelSlug}/${correctTypeSlug}.html`;

    // 301 redirect si l'URL courante ne correspond pas a l'URL canonique
    // Normalisation URI pour eviter les faux positifs (encoding, trailing slash)
    const currentPath = decodeURIComponent(url.pathname);
    const targetPath = decodeURIComponent(canonicalPath);

    if (currentPath !== targetPath) {
      // Anti-boucle : si deja redirige (param r=1), servir la page telle quelle
      if (url.searchParams.get("r") === "1") {
        logger.warn(
          `⚠️ [301-LOOP] Anti-boucle activé, page servie sans redirect: ${currentPath}`,
        );
      } else {
        logger.log(
          `🔄 [301] Canonical mismatch: ${currentPath} → ${targetPath}`,
        );
        const redirectUrl = new URL(request.url);
        redirectUrl.pathname = canonicalPath;
        redirectUrl.searchParams.set("r", "1");
        return redirect(redirectUrl.toString(), 301);
      }
    }

    // SEO: URLs pre-calculees pour section "Voir aussi" (pas de construction cote client)
    const voirAussiLinks = buildVoirAussiLinks(gamme, vehicle);

    // Generated Content (FAQ and buying guide with vehicle context)
    // FAQ gating : ne garder que les Q/R avec reponse substantielle (>= 20 chars)
    const faqItems = generateFAQ(vehicle, gamme).filter(
      (item) => item.answer && item.answer.length >= 20,
    );
    const buyingGuide = generateBuyingGuide(vehicle, gamme);

    // LCP: blogData deferred (below-fold, non-bloquant pour TTFB)
    // Googlebot execute JS et verra les liens une fois le defer resolu
    const blogDataPromise = fetchBlogArticleWithRelated(gamme, vehicle).catch(
      () => ({ article: null, relatedArticles: [] }),
    );

    // LCP OPTIMIZATION V8: Catalogue Famille streame via defer() (below-fold)
    // T5: Top 8 liens SSR pour crawl interne, reste deferred
    const catalogueMameFamillePromise = buildCataloguePromise(
      gammeId,
      hierarchyPromise,
    );
    // Await hierarchy (already fetched in parallel with RM V2, should be resolved)
    const catalogueMameFamille = await catalogueMameFamillePromise.catch(
      () => null,
    );
    const catalogueTop8 = catalogueMameFamille?.items?.slice(0, 8) ?? [];

    const loadTime = Date.now() - startTime;

    // Filters from RM V2 (already includes counts)
    const filtersData: FiltersData | null = rmV2Response.filters
      ? {
          filters: [],
          summary: {
            total_filters: 3, // brands, qualities, sides
            total_options:
              (rmV2Response.filters.brands?.length || 0) +
              (rmV2Response.filters.qualities?.length || 0) +
              (rmV2Response.filters.sides?.length || 0),
          },
          ...rmV2Response.filters,
        }
      : null;

    // LCP OPTIMIZATION V6: defer() pour streamer donnees non-critiques
    // Donnees critiques (vehicle, pieces, seo) : retournees immediatement
    // Donnees non-critiques (relatedArticles, blogArticle) : streamees apres le first paint
    return defer(
      {
        // === DONNEES CRITIQUES (bloquantes, necessaires pour LCP) ===
        canonicalPath,
        vehicle,
        gamme,
        pieces: piecesData,
        // Map grouped_pieces with null -> undefined conversion for filtre_side
        grouped_pieces: (rmV2Response.grouped_pieces || []).map((g) => ({
          ...g,
          filtre_side: g.filtre_side ?? undefined, // Convert null to undefined
        })),
        count: rmV2Response.count || piecesData.length,
        minPrice: loaderData.minPrice,
        maxPrice: loaderData.maxPrice,
        filtersData,
        seoContent: loaderData.seoContent,
        faqItems,
        buyingGuide,
        compatibilityInfo: loaderData.compatibilityInfo,
        crossSellingGammes: loaderData.crossSellingGammes,
        oemRefs: loaderData.oemRefs,
        oemRefsSeo: loaderData.oemRefsSeo,
        voirAussiLinks,
        catalogueTop8,
        seo: {
          title:
            rmV2Response.seo?.title ||
            `${gamme.name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} | Pièces Auto`,
          h1: rmV2Response.seo?.h1 || loaderData.seoContent.h1,
          description: stripHtmlForMeta(
            rmV2Response.seo?.description ||
              loaderData.seoContent.longDescription,
          ),
        },
        performance: {
          loadTime,
          source: "rm-v2",
          cacheHit: rmV2Response.cacheHit || false,
          rmDuration: rmV2Response.duration_ms,
        },
        dataQuality: rmV2Response.validation?.dataQuality?.quality ?? 0,

        // === DONNEES STREAMEES (non-bloquantes, chargees en background) ===
        // LCP: blogData deferred (below-fold, Googlebot execute JS)
        blogData: blogDataPromise,
        // LCP V9: seoSwitches deferred (below-fold, fallback anchors in getAnchorText)
        seoSwitches: seoSwitchesPromise,
        // Catalogue complet (deja resolu pour SSR top 8, passe en direct)
        catalogueMameFamille: catalogueMameFamille
          ? Promise.resolve(catalogueMameFamille)
          : Promise.resolve(null),
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=86400, stale-while-revalidate=3600",
        },
      },
    );
  } catch (renderErr) {
    // Re-throw Response objects (404, 301, etc.) — they are intentional
    if (renderErr instanceof Response) throw renderErr;

    logger.error(
      `💥 [LOADER] Unhandled error building response for ${url.pathname}:`,
      renderErr instanceof Error ? renderErr.message : renderErr,
    );
    throw new Response("Service temporairement indisponible", {
      status: 503,
      headers: {
        "X-Robots-Tag": "noindex",
        "Retry-After": "300",
        "Cache-Control": "no-cache",
      },
    });
  }
}
