/**
 * RM Mapper - Convertit les produits RM en PieceData
 */

import { type RmProduct } from "~/services/api/rm-api.service";

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
    stock: "En stock",
    reference: p.piece_reference,
    quality: p.quality,
    stars: getStarsFromQuality(p.quality),
    marque_id: p.pm_id,
    image: p.has_image
      ? `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/render/image/public/rack-images/260/${p.piece_reference}.JPG?width=400&quality=85`
      : undefined,
    matchKind: "RM",
  }));
}

export function isRmDataUsable(
  products: RmProduct[] | null | undefined,
  minCount = 1,
): boolean {
  return Array.isArray(products) && products.length >= minCount;
}
