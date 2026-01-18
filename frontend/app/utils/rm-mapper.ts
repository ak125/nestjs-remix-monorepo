/**
 * RM Mapper - Convertit les produits RM en PieceData
 *
 * 📝 CHANGELOG:
 * - 2026-01-18 v4: Add V2 mapper for complete page data (SEO, OEM, cross-selling)
 * - 2026-01-17 v3: Fix stock - masquer "En stock" (stock: "")
 * - 2026-01-17 v2: Fix images - utiliser pmi_folder/pmi_name de la BDD (pas hardcodé "260")
 * - 2026-01-17 v1: Fix images - utiliser imgproxy au lieu de Supabase /render/image/ (supprimé car payant)
 */

import {
  type RmProduct,
  type RmPageV2Response,
  type RmProductV2,
} from "~/services/api/rm-api.service";
import {
  type PieceData,
  type LoaderData,
  type VehicleData,
  type GammeData,
  type SEOEnrichedContent,
  type CompatibilityInfo,
  type CrossSellingGamme,
  type OemRefsData,
  type SEOInfo,
  type PerformanceInfo,
  type GuideContent,
} from "~/types/pieces-route.types";
import { ImageOptimizer } from "~/utils/image-optimizer";

function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

function getStarsFromQuality(quality: string): number {
  switch (quality) {
    case "OE":
      return 5;
    case "EQUIV":
      return 4;
    case "ECO":
      return 3;
    default:
      return 3;
  }
}

export function mapRmProductsToPieceData(rmProducts: RmProduct[]): PieceData[] {
  return rmProducts.map((p) => ({
    id: p.piece_id,
    name: p.piece_name,
    price: p.price_ttc,
    priceFormatted: formatPrice(p.price_ttc),
    brand: p.pm_name,
    stock: "", // 🚫 Stock masqué selon config
    reference: p.piece_reference,
    quality: p.quality,
    stars: getStarsFromQuality(p.quality),
    marque_id: p.pm_id,
    // ✅ FIX v2: Utiliser pmi_folder et pmi_name de la BDD (pas hardcodé "260")
    image:
      p.has_image && p.pmi_folder && p.pmi_name
        ? ImageOptimizer.getOptimizedUrl(
            `rack-images/${p.pmi_folder}/${p.pmi_name}`,
            { width: 400, quality: 85 },
          )
        : undefined,
    matchKind: 0, // 0 = direct match
  }));
}

export function isRmDataUsable(
  products: RmProduct[] | null | undefined,
  minCount = 1,
): boolean {
  return Array.isArray(products) && products.length >= minCount;
}

// ============================================================================
// V2 Mapper - Complete page data mapping
// ============================================================================

/**
 * Map RM V2 products to PieceData format
 */
function mapRmV2ProductsToPieceData(products: RmProductV2[]): PieceData[] {
  return products.map((p) => ({
    id: p.piece_id,
    name: p.piece_name,
    price: p.price_ttc,
    priceFormatted: formatPrice(p.price_ttc),
    brand: p.pm_name,
    stock: "", // 🚫 Stock masqué selon config
    reference: p.piece_reference,
    quality: p.quality,
    stars: getStarsFromQuality(p.quality),
    marque_id: p.pm_id,
    side: p.piece_position || undefined,
    image: p.image || undefined,
    matchKind: 0,
  }));
}

/**
 * Map RM V2 vehicle info to VehicleData format
 */
function mapVehicleInfo(rmV2: RmPageV2Response): VehicleData {
  const vi = rmV2.vehicleInfo;
  return {
    marque: vi.marqueName,
    modele: vi.modeleName,
    type: vi.typeName,
    typeName: vi.typeName,
    typeId: vi.typeId,
    marqueId: vi.marqueId,
    modeleId: vi.modeleId,
    marqueAlias: vi.marqueAlias,
    modeleAlias: vi.modeleAlias,
    typeAlias: vi.typeAlias,
    modelePic: vi.modelePic || undefined,
    motorCodesFormatted: vi.motorCodesFormatted || undefined,
    mineCodesFormatted: vi.mineCodesFormatted || undefined,
    cnitCodesFormatted: vi.cnitCodesFormatted || undefined,
    typePowerPs: vi.typePowerPs ? parseInt(vi.typePowerPs, 10) : undefined,
    typePowerKw: vi.typePowerKw ? parseInt(vi.typePowerKw, 10) : undefined,
    typeFuel: vi.typeFuel || undefined,
    typeBody: vi.typeBody || undefined,
    typeDateStart: vi.typeYearFrom || undefined,
    typeDateEnd: vi.typeYearTo || undefined,
  };
}

/**
 * Map RM V2 gamme info to GammeData format
 */
function mapGammeInfo(rmV2: RmPageV2Response): GammeData {
  const g = rmV2.gamme;
  return {
    id: g.pg_id,
    name: g.pg_name,
    alias: g.pg_alias,
    description: "", // Will be filled from SEO
    image: g.pg_pic || undefined,
  };
}

/**
 * Map SEO data to SEOEnrichedContent format
 */
function mapSeoContent(rmV2: RmPageV2Response): SEOEnrichedContent {
  const seo = rmV2.seo;
  // Extract h2 sections from grouped_pieces titles
  const h2Sections = rmV2.grouped_pieces?.map((g) => g.title_h2) || [];

  return {
    h1: seo.h1 || "",
    h2Sections,
    longDescription: seo.content || "",
    technicalSpecs: [],
    compatibilityNotes: "",
    installationTips: [],
  };
}

/**
 * Map SEO info for meta tags
 */
function mapSeoInfo(rmV2: RmPageV2Response): SEOInfo {
  const seo = rmV2.seo;
  return {
    title: seo.title || "",
    h1: seo.h1 || "",
    description: seo.description || "",
  };
}

/**
 * Map OEM refs data
 */
function mapOemRefs(rmV2: RmPageV2Response): {
  oemRefs: OemRefsData;
  oemRefsSeo: string[];
} {
  const oemRefs: OemRefsData = {
    vehicleMarque: rmV2.vehicleInfo?.marqueName || "",
    oemRefs: rmV2.oemRefs || [],
    count: rmV2.oemRefs?.length || 0,
  };

  return {
    oemRefs,
    oemRefsSeo: rmV2.oemRefs || [],
  };
}

/**
 * Map compatibility info from vehicle
 */
function mapCompatibilityInfo(rmV2: RmPageV2Response): CompatibilityInfo {
  const vi = rmV2.vehicleInfo;
  const engines: string[] = [];

  if (vi.motorCodesFormatted) {
    engines.push(...vi.motorCodesFormatted.split(",").map((s) => s.trim()));
  }

  const years =
    vi.typeYearFrom && vi.typeYearTo
      ? `${vi.typeYearFrom} - ${vi.typeYearTo}`
      : vi.typeYearFrom || "";

  return {
    engines,
    years,
    notes: [],
  };
}

/**
 * 🚀 V2 Complete Mapper: RmPageV2Response → LoaderData
 *
 * Maps all RM v2 data to the LoaderData format expected by pieces route.
 * Includes SEO, OEM refs, cross-selling, filters, and validation.
 */
export function mapRmV2ToLoaderData(
  rmV2: RmPageV2Response,
  performanceOverride?: Partial<PerformanceInfo>,
): LoaderData {
  // Map pieces
  const pieces = mapRmV2ProductsToPieceData(rmV2.products || []);

  // Map vehicle and gamme
  const vehicle = mapVehicleInfo(rmV2);
  const gamme = mapGammeInfo(rmV2);

  // Map SEO
  const seoContent = mapSeoContent(rmV2);
  const seo = mapSeoInfo(rmV2);

  // Update gamme description from SEO content
  gamme.description = seoContent.longDescription;

  // Map OEM refs
  const { oemRefs, oemRefsSeo } = mapOemRefs(rmV2);

  // Map cross-selling (convert null to undefined for TypeScript compatibility)
  const crossSellingGammes: CrossSellingGamme[] = (rmV2.crossSelling || []).map(
    (cs) => ({
      ...cs,
      PG_IMAGE: cs.PG_IMAGE ?? undefined, // Convert null to undefined
    }),
  );

  // Map compatibility
  const compatibilityInfo = mapCompatibilityInfo(rmV2);

  // Calculate prices
  const prices = pieces.map((p) => p.price);
  const minPrice = rmV2.minPrice || (prices.length ? Math.min(...prices) : 0);
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  // Default performance
  const performance: PerformanceInfo = {
    loadTime: rmV2.duration_ms || 0,
    source: "rm-v2",
    cacheHit: rmV2.cacheHit || false,
    ...performanceOverride,
  };

  // Default buying guide
  const buyingGuide: GuideContent = {
    title: `Comment choisir ${gamme.name}`,
    content: "",
    tips: [],
  };

  return {
    vehicle,
    gamme,
    pieces,
    count: rmV2.count || pieces.length,
    minPrice,
    maxPrice,
    seoContent,
    faqItems: [],
    relatedArticles: [],
    buyingGuide,
    compatibilityInfo,
    crossSellingGammes,
    oemRefs,
    oemRefsSeo,
    seo,
    performance,
  };
}

/**
 * Check if RM V2 response is usable
 */
export function isRmV2DataUsable(
  response: RmPageV2Response | null | undefined,
  minCount = 1,
): boolean {
  if (!response || !response.success) {
    return false;
  }
  if (!response.validation?.valid) {
    return false;
  }
  return (response.count || 0) >= minCount;
}
