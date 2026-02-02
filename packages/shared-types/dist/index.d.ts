/**
 * 🏗️ SHARED TYPES - Types partagés du monorepo
 *
 * Point d'entrée principal pour tous les types partagés
 * entre le backend NestJS et le frontend Remix
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 *
 * @deprecated Ce package sera déprécié en faveur de @repo/database-types.
 * Migration en cours (P4.5). Nouveaux types disponibles:
 * - import { ApiResponse, ApiError } from '@repo/database-types';
 * - import { VehicleFuelType, PieceQuality } from '@repo/database-types';
 * - import { formatPower, generateVehicleUrl } from '@repo/database-types';
 */
export * from './vehicle.types';
export * from './pieces.types';
export * from './api.types';
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
export declare enum VehicleFuelType {
    ESSENCE = "essence",
    DIESEL = "diesel",
    HYBRIDE = "hybride",
    ELECTRIQUE = "electrique",
    GPL = "gpl",
    AUTRE = "autre"
}
export declare enum PieceQuality {
    OES = "OES",
    AFTERMARKET = "AFTERMARKET",
    ECHANGE_STANDARD = "Echange Standard"
}
export declare enum CacheType {
    VEHICLES = "vehicles",
    PIECES = "pieces",
    CATALOG = "catalog",
    USER = "user"
}
export declare const CONFIG: {
    readonly API: {
        readonly DEFAULT_TIMEOUT: 30000;
        readonly MAX_RETRIES: 3;
        readonly DEFAULT_PAGE_SIZE: 20;
        readonly MAX_PAGE_SIZE: 100;
    };
    readonly CACHE: {
        readonly DEFAULT_TTL: 300;
        readonly LONG_TTL: 3600;
        readonly SHORT_TTL: 60;
    };
    readonly VALIDATION: {
        readonly MIN_SEARCH_LENGTH: 2;
        readonly MAX_SEARCH_LENGTH: 100;
        readonly MAX_RESULTS_PER_PAGE: 100;
    };
};
export declare const SHARED_TYPES_VERSION = "2.0.0";
export declare const SHARED_TYPES_INFO: {
    readonly version: "2.0.0";
    readonly name: "@monorepo/shared-types";
    readonly description: "Types TypeScript partagés pour le monorepo NestJS + Remix";
    readonly author: "Architecture Team";
    readonly license: "MIT";
    readonly repository: "nestjs-remix-monorepo";
    readonly lastUpdated: string;
    readonly features: readonly ["Types unifiés entre backend et frontend", "Validation Zod intégrée", "Support TypeScript strict", "Types API standardisés", "Compatibilité legacy", "Tree-shaking optimisé", "Documentation complète"];
};
/**
 * Types API enrichis depuis database-types
 * @see {@link @repo/database-types} pour la source
 */
export { type ApiResponse as DbApiResponse, type ApiError as DbApiError, type PaginationInfo as DbPaginationInfo, type PaginatedResponse as DbPaginatedResponse, type SearchResponse as DbSearchResponse, type ValidationResponse as DbValidationResponse, type RequestMetadata as DbRequestMetadata, type PerformanceMetadata as DbPerformanceMetadata, type PaginationOptions as DbPaginationOptions, type SortOptions as DbSortOptions, type CacheOptions as DbCacheOptions, type QueryOptions as DbQueryOptions, ApiResponseSchema as DbApiResponseSchema, ApiErrorSchema as DbApiErrorSchema, PaginationInfoSchema as DbPaginationInfoSchema, PaginatedResponseSchema as DbPaginatedResponseSchema, RequestMetadataSchema as DbRequestMetadataSchema, PerformanceMetadataSchema as DbPerformanceMetadataSchema, createSuccessResponse as dbCreateSuccessResponse, createErrorResponse as dbCreateErrorResponse, normalizePaginationOptions as dbNormalizePaginationOptions, generateRequestId as dbGenerateRequestId, } from '@repo/database-types';
/**
 * Enums métier enrichis depuis database-types
 * Suffixe "Db" pour éviter conflits avec enums locaux
 */
export { type VehicleFuelType as DbVehicleFuelType, type TransmissionType as DbTransmissionType, type VehicleBodyType as DbVehicleBodyType, type VehicleDisplayStatus as DbVehicleDisplayStatus, type VehicleSelectionSource as DbVehicleSelectionSource, type EuroEmissionStandard as DbEuroEmissionStandard, type VehicleCountry as DbVehicleCountry, VehicleFuelTypeSchema as DbVehicleFuelTypeSchema, TransmissionTypeSchema as DbTransmissionTypeSchema, VehicleBodyTypeSchema as DbVehicleBodyTypeSchema, VEHICLE_FUEL_TYPES, TRANSMISSION_TYPES, VEHICLE_BODY_TYPES, EURO_EMISSION_STANDARDS, VEHICLE_COUNTRIES, type PieceQuality as DbPieceQuality, type ProductStatus as DbProductStatus, type AvailabilityStatus as DbAvailabilityStatus, type PieceSide as DbPieceSide, type SupplierType as DbSupplierType, type PriceType as DbPriceType, PieceQualitySchema as DbPieceQualitySchema, ProductStatusSchema as DbProductStatusSchema, AvailabilityStatusSchema as DbAvailabilityStatusSchema, PriceTypeSchema as DbPriceTypeSchema, PIECE_QUALITY_LABELS, PIECE_QUALITY_RATINGS, PRODUCT_STATUS_LABELS, AVAILABILITY_STATUS_LABELS, type CacheType as DbCacheType, type CacheTTLPreset as DbCacheTTLPreset, type CacheStrategy as DbCacheStrategy, type CacheInvalidationReason as DbCacheInvalidationReason, CacheTypeSchema as DbCacheTypeSchema, CacheTTLPresetSchema as DbCacheTTLPresetSchema, CacheStrategySchema as DbCacheStrategySchema, CACHE_TYPE_LABELS, CACHE_TTL_SECONDS, CACHE_TTL_LABELS, CACHE_STRATEGY_LABELS, } from '@repo/database-types';
/**
 * Helpers métier depuis database-types
 * Suffixe "Db" pour éviter conflits avec helpers locaux
 */
export { formatPower as dbFormatPower, formatProductionDate as dbFormatProductionDate, formatProductionDateDetailed as dbFormatProductionDateDetailed, literToCm3 as dbLiterToCm3, cm3ToLiter as dbCm3ToLiter, psToKw as dbPsToKw, kwToPs as dbKwToPs, formatCylinder as dbFormatCylinder, formatCodes as dbFormatCodes, parseCodes as dbParseCodes, generateVehicleUrl as dbGenerateVehicleUrl, generateProductVehicleUrl as dbGenerateProductVehicleUrl, generateBrandUrl as dbGenerateBrandUrl, generateModelUrl as dbGenerateModelUrl, generateSlug as dbGenerateSlug, formatVehicleFullName as dbFormatVehicleFullName, formatVehicleShortName as dbFormatVehicleShortName, isYearInRange as dbIsYearInRange, getAvailableYears as dbGetAvailableYears, } from '@repo/database-types';
//# sourceMappingURL=index.d.ts.map