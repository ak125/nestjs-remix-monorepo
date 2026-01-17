/**
 * RM Mapper - Convertit les produits RM en PieceData
 *
 * 📝 CHANGELOG:
 * - 2026-01-17 v3: Fix stock - masquer "En stock" (stock: "")
 * - 2026-01-17 v2: Fix images - utiliser pmi_folder/pmi_name de la BDD (pas hardcodé "260")
 * - 2026-01-17 v1: Fix images - utiliser imgproxy au lieu de Supabase /render/image/ (supprimé car payant)
 */

import { type RmProduct } from "~/services/api/rm-api.service";
import { type PieceData } from "~/types/pieces-route.types";
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
