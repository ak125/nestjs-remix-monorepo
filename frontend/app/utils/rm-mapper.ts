/**
 * RM Mapper - Convertit les produits RM en PieceData
 */

import { type RmProduct } from "~/services/api/rm-api.service";

// Type simplifié pour PieceData (compatible avec le type existant)
export interface PieceData {
  id: number;
  name: string;
  price: number;
  priceFormatted: string;
  brand: string;
  stock: string;
  reference: string;
  quality: string;
  stars: number;
  marque_id?: number;
  image?: string;
  matchKind?: string;
}

/**
 * Formate un prix en euros
 */
function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

/**
 * Convertit quality en nombre d'étoiles
 */
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

/**
 * Mappe les produits RM vers le format PieceData
 */
export function mapRmProductsToPieceData(rmProducts: RmProduct[]): PieceData[] {
  return rmProducts.map((p) => ({
    id: p.piece_id,
    name: p.piece_name,
    price: p.price_ttc, // Déjà en euros (PAS de division par 100)
    priceFormatted: formatPrice(p.price_ttc),
    brand: p.pm_name,
    stock: "En stock", // RM ne gère pas le stock pour l'instant
    reference: p.piece_reference,
    quality: p.quality,
    stars: getStarsFromQuality(p.quality),
    marque_id: p.pm_id,
    image: p.has_image
      ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/rack-images/260/${p.piece_reference}.JPG`
      : undefined,
    matchKind: "RM",
  }));
}

/**
 * Vérifie si les données RM sont utilisables
 */
export function isRmDataUsable(
  products: RmProduct[] | null | undefined,
  minCount = 1,
): boolean {
  return Array.isArray(products) && products.length >= minCount;
}
