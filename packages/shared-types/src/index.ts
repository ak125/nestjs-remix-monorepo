/**
 * 🏗️ SHARED TYPES - Types partagés du monorepo
 * 
 * Point d'entrée principal pour tous les types partagés
 * entre le backend NestJS et le frontend Remix
 * 
 * @version 2.0.0
 * @package @monorepo/shared-types
 */

// ====================================
// 🚗 EXPORTS VÉHICULES
// ====================================

export * from './vehicle.types';

// ====================================
// 🔧 EXPORTS PIÈCES
// ====================================

export * from './pieces.types';

// ====================================
// 🌐 EXPORTS API GÉNÉRIQUES
// ====================================

export * from './api.types';

// ====================================
// 📋 TYPES CATALOGUE LEGACY
// ====================================

export interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_name_system?: string;
  mf_description?: string;
  mf_pic?: string;
  mf_sort?: number;
  mf_display?: number;
  gammes: CatalogGamme[];
}

export interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_url?: string;
  pg_name_meta?: string;
  pg_pic?: string;
  pg_img?: string;
  mc_sort?: number;
}

export interface CatalogFamiliesResponse {
  families: CatalogFamily[];
  success: boolean;
  totalFamilies?: number;
  message?: string;
}

// ====================================
// 🎭 TYPES LEGACY POUR COMPATIBILITÉ
// ====================================

export interface VehicleBrandLegacy {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

export interface VehicleModelLegacy {
  id: number;
  name: string;
  brandId: number;
  isActive: boolean;
}

export interface LegacyApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ====================================
// � ENUMS ET CONSTANTES
// ====================================

export enum VehicleFuelType {
  ESSENCE = 'essence',
  DIESEL = 'diesel',
  HYBRIDE = 'hybride',
  ELECTRIQUE = 'electrique',
  GPL = 'gpl',
  AUTRE = 'autre',
}

export enum PieceQuality {
  OES = 'OES',
  AFTERMARKET = 'AFTERMARKET',
  ECHANGE_STANDARD = 'Echange Standard',
}

export enum CacheType {
  VEHICLES = 'vehicles',
  PIECES = 'pieces',
  CATALOG = 'catalog',
  USER = 'user',
}

export const CONFIG = {
  API: {
    DEFAULT_TIMEOUT: 30000,
    MAX_RETRIES: 3,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
  },
  CACHE: {
    DEFAULT_TTL: 300, // 5 minutes
    LONG_TTL: 3600,   // 1 heure
    SHORT_TTL: 60,    // 1 minute
  },
  VALIDATION: {
    MIN_SEARCH_LENGTH: 2,
    MAX_SEARCH_LENGTH: 100,
    MAX_RESULTS_PER_PAGE: 100,
  },
} as const;

// ====================================
// 🚀 VERSION ET MÉTADONNÉES
// ====================================

export const SHARED_TYPES_VERSION = '2.0.0';

export const SHARED_TYPES_INFO = {
  version: SHARED_TYPES_VERSION,
  name: '@monorepo/shared-types',
  description: 'Types TypeScript partagés pour le monorepo NestJS + Remix',
  author: 'Architecture Team',
  license: 'MIT',
  repository: 'nestjs-remix-monorepo',
  lastUpdated: new Date().toISOString(),
  features: [
    'Types unifiés entre backend et frontend',
    'Validation Zod intégrée',
    'Support TypeScript strict',
    'Types API standardisés',
    'Compatibilité legacy',
    'Tree-shaking optimisé',
    'Documentation complète',
  ],
} as const;