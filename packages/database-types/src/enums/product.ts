/**
 * Product Enums
 *
 * Enums for product/piece-related data
 *
 * @version 2.0.0
 * @package @repo/database-types
 */

import { z } from 'zod';

// ====================================
// PIECE QUALITY
// ====================================

export const PieceQualitySchema = z.enum([
  'OES',
  'AFTERMARKET',
  'Echange Standard',
  'Origine',
  'Adaptable',
]);

export type PieceQuality = z.infer<typeof PieceQualitySchema>;

export const PIECE_QUALITY_LABELS = {
  OES: 'Origine Equipementier',
  AFTERMARKET: 'Aftermarket',
  'Echange Standard': 'Echange Standard',
  Origine: 'Origine Constructeur',
  Adaptable: 'Adaptable',
} as const;

export const PIECE_QUALITY_RATINGS = {
  Origine: 5,
  OES: 4,
  'Echange Standard': 3,
  AFTERMARKET: 2,
  Adaptable: 1,
} as const;

// ====================================
// PRODUCT STATUS
// ====================================

export const ProductStatusSchema = z.enum([
  'active',
  'inactive',
  'discontinued',
  'pending',
  'out_of_stock',
]);

export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export const PRODUCT_STATUS_LABELS = {
  active: 'Actif',
  inactive: 'Inactif',
  discontinued: 'Arrete',
  pending: 'En attente',
  out_of_stock: 'Rupture de stock',
} as const;

// ====================================
// AVAILABILITY STATUS
// ====================================

export const AvailabilityStatusSchema = z.enum([
  'in_stock',
  'low_stock',
  'out_of_stock',
  'on_order',
  'discontinued',
]);

export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;

export const AVAILABILITY_STATUS_LABELS = {
  in_stock: 'En stock',
  low_stock: 'Stock faible',
  out_of_stock: 'Rupture',
  on_order: 'Sur commande',
  discontinued: 'Arrete',
} as const;

// ====================================
// PIECE SIDE FILTER
// ====================================

export const PieceSideSchema = z.enum([
  'gauche',
  'droit',
  'avant',
  'arriere',
  'superieur',
  'inferieur',
  'interieur',
  'exterieur',
]);

export type PieceSide = z.infer<typeof PieceSideSchema>;

export const PIECE_SIDE_LABELS = {
  gauche: 'Gauche',
  droit: 'Droit',
  avant: 'Avant',
  arriere: 'Arriere',
  superieur: 'Superieur',
  inferieur: 'Inferieur',
  interieur: 'Interieur',
  exterieur: 'Exterieur',
} as const;

// ====================================
// SUPPLIER TYPE
// ====================================

export const SupplierTypeSchema = z.enum([
  'OEM',
  'aftermarket',
  'distributor',
  'manufacturer',
]);

export type SupplierType = z.infer<typeof SupplierTypeSchema>;

export const SUPPLIER_TYPE_LABELS = {
  OEM: 'Equipementier Origine',
  aftermarket: 'Aftermarket',
  distributor: 'Distributeur',
  manufacturer: 'Fabricant',
} as const;

// ====================================
// DISPLAY STATUS
// ====================================

export const DisplayStatusSchema = z.union([z.literal(0), z.literal(1)]);

export type DisplayStatus = z.infer<typeof DisplayStatusSchema>;

// ====================================
// PIECE OES TYPE
// ====================================

export const PieceOesTypeSchema = z.enum(['O', '1', 'A']);

export type PieceOesType = z.infer<typeof PieceOesTypeSchema>;

export const PIECE_OES_TYPE_LABELS = {
  O: 'Origine',
  '1': 'Premiere monte',
  A: 'Aftermarket',
} as const;

// ====================================
// PRICE TYPE
// ====================================

export const PriceTypeSchema = z.enum([
  'public',
  'pro',
  'wholesale',
  'promo',
  'clearance',
]);

export type PriceType = z.infer<typeof PriceTypeSchema>;

export const PRICE_TYPE_LABELS = {
  public: 'Prix public',
  pro: 'Prix professionnel',
  wholesale: 'Prix grossiste',
  promo: 'Prix promo',
  clearance: 'Prix destockage',
} as const;
