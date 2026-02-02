/**
 * 📦 @repo/database-types
 * 
 * Package de types partagés pour la base de données PostgreSQL/Supabase
 * Synchronisation automatique entre backend (NestJS) et frontend (Remix)
 * 
 * @example Import des types
 * ```ts
 * import type { Pieces, PiecesPrice, Database } from '@repo/database-types';
 * ```
 * 
 * @example Import des constantes
 * ```ts
 * import { TABLES, COLUMNS } from '@repo/database-types/constants';
 * 
 * supabase.from(TABLES.pieces_price)  // ✅ Type-safe
 *         .select(COLUMNS.pieces_price.vente_ttc);
 * ```
 * 
 * @example Import des schémas Zod
 * ```ts
 * import { PiecesSchema, PiecesPriceSchema } from '@repo/database-types/schemas';
 * 
 * const validated = PiecesSchema.parse(data); // ✅ Runtime validation
 * ```
 */

// ============================================================================
// 🎯 EXPORTS PRINCIPAUX
// ============================================================================

/**
 * Types TypeScript pour toutes les tables (97 tables)
 * Compile-time type safety
 */
export * from './types.js';

/**
 * Constantes pour les noms de tables et colonnes
 * Prévient les erreurs de typage comme 'pieces_prix' vs 'pieces_price'
 */
export * from './constants.js';

/**
 * Schémas Zod pour la validation runtime (90 schémas)
 * Auto-générés depuis les types TypeScript
 */
export * from './schemas.js';

// ============================================================================
// 🆕 TYPES API & ENUMS & HELPERS (P4.5 Migration)
// ============================================================================

/**
 * Types de réponse API génériques
 * ApiResponse<T>, ApiError, PaginationInfo, etc.
 */
export * from './api/index.js';

/**
 * Enums métier (véhicules, produits, cache)
 * VehicleFuelType, PieceQuality, CacheType, etc.
 */
export * from './enums/index.js';

/**
 * Helpers utilitaires
 * formatPower(), generateVehicleUrl(), etc.
 */
export * from './helpers/index.js';

// ============================================================================
// 🔥 RE-EXPORTS PRATIQUES
// ============================================================================

import { TABLES, COLUMNS, DEFAULT_VALUES } from './constants.js';
import {
  PiecesSchemas,
  AutoSchemas,
  AllSchemas,
} from './schemas.js';

import type {
  // Tables principales pièces
  Pieces,
  PiecesPrice,
  PiecesMarque,
  PiecesMediaImg,
  PiecesCriteria,
  PiecesCriteriaLink,
  PiecesCriteriaGroup,
  PiecesRelationType,
  PiecesRelationCriteria,
  PiecesSideFiltre,
  PiecesGamme,
  PiecesGammeCross,
  PiecesList,
  PiecesDetails,
  PiecesRefBrand,
  PiecesRefEan,
  PiecesRefOem,
  PiecesRefSearch,
  PiecesStatus,

  // Tables véhicules
  AutoMarque,
  AutoModele,
  AutoModeleGroup,
  AutoType,
  AutoTypeMotorCode,
  AutoTypeMotorFuel,
  AutoTypeNumberCode,

  // Types helpers
  Database,
  TableName,
  TableRow,
  TableInsert,
  TableUpdate,
} from './types.js';

/**
 * 🎁 Bundle de types les plus utilisés
 */
export const DatabaseTypes = {
  // Types
  Pieces: {} as Pieces,
  PiecesPrice: {} as PiecesPrice,
  PiecesMarque: {} as PiecesMarque,
  PiecesMediaImg: {} as PiecesMediaImg,
  PiecesCriteria: {} as PiecesCriteria,
  PiecesCriteriaLink: {} as PiecesCriteriaLink,
  AutoMarque: {} as AutoMarque,
  AutoModele: {} as AutoModele,
  AutoType: {} as AutoType,
} as const;

/**
 * 🎁 Bundle de constantes les plus utilisées
 */
export const DatabaseConstants = {
  TABLES,
  COLUMNS,
  DEFAULT_VALUES,
} as const;

/**
 * 🎁 Bundle de schémas les plus utilisés
 */
export const DatabaseSchemas = {
  Pieces: PiecesSchemas,
  Auto: AutoSchemas,
  All: AllSchemas,
} as const;

// ============================================================================
// 📖 TYPES UTILITAIRES
// ============================================================================

/**
 * Helper pour obtenir le type d'une table par son nom
 * 
 * @example
 * ```ts
 * type PiecesRow = GetTableType<'pieces'>; // → Pieces
 * type PriceRow = GetTableType<'pieces_price'>; // → PiecesPrice
 * ```
 */
export type GetTableType<T extends TableName> = TableRow<T>;

/**
 * Helper pour obtenir le type d'insertion d'une table
 * 
 * @example
 * ```ts
 * const newPiece: GetInsertType<'pieces'> = {
 *   piece_ref: 'ABC123',
 *   piece_name: 'Filtre à huile',
 *   // ... autres champs requis
 * };
 * ```
 */
export type GetInsertType<T extends TableName> = TableInsert<T>;

/**
 * Helper pour obtenir le type de mise à jour d'une table
 * 
 * @example
 * ```ts
 * const update: GetUpdateType<'pieces'> = {
 *   piece_name: 'Nouveau nom',
 *   // Tous les champs sont optionnels
 * };
 * ```
 */
export type GetUpdateType<T extends TableName> = TableUpdate<T>;
