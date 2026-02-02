"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbGenerateVehicleUrl = exports.dbParseCodes = exports.dbFormatCodes = exports.dbFormatCylinder = exports.dbKwToPs = exports.dbPsToKw = exports.dbCm3ToLiter = exports.dbLiterToCm3 = exports.dbFormatProductionDateDetailed = exports.dbFormatProductionDate = exports.dbFormatPower = exports.CACHE_STRATEGY_LABELS = exports.CACHE_TTL_LABELS = exports.CACHE_TTL_SECONDS = exports.CACHE_TYPE_LABELS = exports.DbCacheStrategySchema = exports.DbCacheTTLPresetSchema = exports.DbCacheTypeSchema = exports.AVAILABILITY_STATUS_LABELS = exports.PRODUCT_STATUS_LABELS = exports.PIECE_QUALITY_RATINGS = exports.PIECE_QUALITY_LABELS = exports.DbPriceTypeSchema = exports.DbAvailabilityStatusSchema = exports.DbProductStatusSchema = exports.DbPieceQualitySchema = exports.VEHICLE_COUNTRIES = exports.EURO_EMISSION_STANDARDS = exports.VEHICLE_BODY_TYPES = exports.TRANSMISSION_TYPES = exports.VEHICLE_FUEL_TYPES = exports.DbVehicleBodyTypeSchema = exports.DbTransmissionTypeSchema = exports.DbVehicleFuelTypeSchema = exports.dbGenerateRequestId = exports.dbNormalizePaginationOptions = exports.dbCreateErrorResponse = exports.dbCreateSuccessResponse = exports.DbPerformanceMetadataSchema = exports.DbRequestMetadataSchema = exports.DbPaginatedResponseSchema = exports.DbPaginationInfoSchema = exports.DbApiErrorSchema = exports.DbApiResponseSchema = exports.SHARED_TYPES_INFO = exports.SHARED_TYPES_VERSION = exports.CONFIG = exports.CacheType = exports.PieceQuality = exports.VehicleFuelType = void 0;
exports.dbGetAvailableYears = exports.dbIsYearInRange = exports.dbFormatVehicleShortName = exports.dbFormatVehicleFullName = exports.dbGenerateSlug = exports.dbGenerateModelUrl = exports.dbGenerateBrandUrl = exports.dbGenerateProductVehicleUrl = void 0;
// ====================================
// 🚗 EXPORTS VÉHICULES
// ====================================
__exportStar(require("./vehicle.types"), exports);
// ====================================
// 🔧 EXPORTS PIÈCES
// ====================================
__exportStar(require("./pieces.types"), exports);
// ====================================
// 🌐 EXPORTS API GÉNÉRIQUES
// ====================================
__exportStar(require("./api.types"), exports);
// ====================================
// � ENUMS ET CONSTANTES
// ====================================
var VehicleFuelType;
(function (VehicleFuelType) {
    VehicleFuelType["ESSENCE"] = "essence";
    VehicleFuelType["DIESEL"] = "diesel";
    VehicleFuelType["HYBRIDE"] = "hybride";
    VehicleFuelType["ELECTRIQUE"] = "electrique";
    VehicleFuelType["GPL"] = "gpl";
    VehicleFuelType["AUTRE"] = "autre";
})(VehicleFuelType || (exports.VehicleFuelType = VehicleFuelType = {}));
var PieceQuality;
(function (PieceQuality) {
    PieceQuality["OES"] = "OES";
    PieceQuality["AFTERMARKET"] = "AFTERMARKET";
    PieceQuality["ECHANGE_STANDARD"] = "Echange Standard";
})(PieceQuality || (exports.PieceQuality = PieceQuality = {}));
var CacheType;
(function (CacheType) {
    CacheType["VEHICLES"] = "vehicles";
    CacheType["PIECES"] = "pieces";
    CacheType["CATALOG"] = "catalog";
    CacheType["USER"] = "user";
})(CacheType || (exports.CacheType = CacheType = {}));
exports.CONFIG = {
    API: {
        DEFAULT_TIMEOUT: 30000,
        MAX_RETRIES: 3,
        DEFAULT_PAGE_SIZE: 20,
        MAX_PAGE_SIZE: 100,
    },
    CACHE: {
        DEFAULT_TTL: 300, // 5 minutes
        LONG_TTL: 3600, // 1 heure
        SHORT_TTL: 60, // 1 minute
    },
    VALIDATION: {
        MIN_SEARCH_LENGTH: 2,
        MAX_SEARCH_LENGTH: 100,
        MAX_RESULTS_PER_PAGE: 100,
    },
};
// ====================================
// 🚀 VERSION ET MÉTADONNÉES
// ====================================
exports.SHARED_TYPES_VERSION = '2.0.0';
exports.SHARED_TYPES_INFO = {
    version: exports.SHARED_TYPES_VERSION,
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
};
// ====================================
// 🔄 RE-EXPORTS @repo/database-types (P4.5 Migration)
// ====================================
// Ces exports permettent une migration progressive.
// Pour les nouveaux fichiers, préférer importer directement depuis @repo/database-types.
/**
 * Types API enrichis depuis database-types
 * @see {@link @repo/database-types} pour la source
 */
var database_types_1 = require("@repo/database-types");
// Schémas Zod
Object.defineProperty(exports, "DbApiResponseSchema", { enumerable: true, get: function () { return database_types_1.ApiResponseSchema; } });
Object.defineProperty(exports, "DbApiErrorSchema", { enumerable: true, get: function () { return database_types_1.ApiErrorSchema; } });
Object.defineProperty(exports, "DbPaginationInfoSchema", { enumerable: true, get: function () { return database_types_1.PaginationInfoSchema; } });
Object.defineProperty(exports, "DbPaginatedResponseSchema", { enumerable: true, get: function () { return database_types_1.PaginatedResponseSchema; } });
Object.defineProperty(exports, "DbRequestMetadataSchema", { enumerable: true, get: function () { return database_types_1.RequestMetadataSchema; } });
Object.defineProperty(exports, "DbPerformanceMetadataSchema", { enumerable: true, get: function () { return database_types_1.PerformanceMetadataSchema; } });
// Helpers
Object.defineProperty(exports, "dbCreateSuccessResponse", { enumerable: true, get: function () { return database_types_1.createSuccessResponse; } });
Object.defineProperty(exports, "dbCreateErrorResponse", { enumerable: true, get: function () { return database_types_1.createErrorResponse; } });
Object.defineProperty(exports, "dbNormalizePaginationOptions", { enumerable: true, get: function () { return database_types_1.normalizePaginationOptions; } });
Object.defineProperty(exports, "dbGenerateRequestId", { enumerable: true, get: function () { return database_types_1.generateRequestId; } });
/**
 * Enums métier enrichis depuis database-types
 * Suffixe "Db" pour éviter conflits avec enums locaux
 */
var database_types_2 = require("@repo/database-types");
// Véhicules (schémas Zod)
Object.defineProperty(exports, "DbVehicleFuelTypeSchema", { enumerable: true, get: function () { return database_types_2.VehicleFuelTypeSchema; } });
Object.defineProperty(exports, "DbTransmissionTypeSchema", { enumerable: true, get: function () { return database_types_2.TransmissionTypeSchema; } });
Object.defineProperty(exports, "DbVehicleBodyTypeSchema", { enumerable: true, get: function () { return database_types_2.VehicleBodyTypeSchema; } });
// Véhicules (constantes)
Object.defineProperty(exports, "VEHICLE_FUEL_TYPES", { enumerable: true, get: function () { return database_types_2.VEHICLE_FUEL_TYPES; } });
Object.defineProperty(exports, "TRANSMISSION_TYPES", { enumerable: true, get: function () { return database_types_2.TRANSMISSION_TYPES; } });
Object.defineProperty(exports, "VEHICLE_BODY_TYPES", { enumerable: true, get: function () { return database_types_2.VEHICLE_BODY_TYPES; } });
Object.defineProperty(exports, "EURO_EMISSION_STANDARDS", { enumerable: true, get: function () { return database_types_2.EURO_EMISSION_STANDARDS; } });
Object.defineProperty(exports, "VEHICLE_COUNTRIES", { enumerable: true, get: function () { return database_types_2.VEHICLE_COUNTRIES; } });
// Produits (schémas Zod)
Object.defineProperty(exports, "DbPieceQualitySchema", { enumerable: true, get: function () { return database_types_2.PieceQualitySchema; } });
Object.defineProperty(exports, "DbProductStatusSchema", { enumerable: true, get: function () { return database_types_2.ProductStatusSchema; } });
Object.defineProperty(exports, "DbAvailabilityStatusSchema", { enumerable: true, get: function () { return database_types_2.AvailabilityStatusSchema; } });
Object.defineProperty(exports, "DbPriceTypeSchema", { enumerable: true, get: function () { return database_types_2.PriceTypeSchema; } });
// Produits (constantes)
Object.defineProperty(exports, "PIECE_QUALITY_LABELS", { enumerable: true, get: function () { return database_types_2.PIECE_QUALITY_LABELS; } });
Object.defineProperty(exports, "PIECE_QUALITY_RATINGS", { enumerable: true, get: function () { return database_types_2.PIECE_QUALITY_RATINGS; } });
Object.defineProperty(exports, "PRODUCT_STATUS_LABELS", { enumerable: true, get: function () { return database_types_2.PRODUCT_STATUS_LABELS; } });
Object.defineProperty(exports, "AVAILABILITY_STATUS_LABELS", { enumerable: true, get: function () { return database_types_2.AVAILABILITY_STATUS_LABELS; } });
// Cache (schémas Zod)
Object.defineProperty(exports, "DbCacheTypeSchema", { enumerable: true, get: function () { return database_types_2.CacheTypeSchema; } });
Object.defineProperty(exports, "DbCacheTTLPresetSchema", { enumerable: true, get: function () { return database_types_2.CacheTTLPresetSchema; } });
Object.defineProperty(exports, "DbCacheStrategySchema", { enumerable: true, get: function () { return database_types_2.CacheStrategySchema; } });
// Cache (constantes)
Object.defineProperty(exports, "CACHE_TYPE_LABELS", { enumerable: true, get: function () { return database_types_2.CACHE_TYPE_LABELS; } });
Object.defineProperty(exports, "CACHE_TTL_SECONDS", { enumerable: true, get: function () { return database_types_2.CACHE_TTL_SECONDS; } });
Object.defineProperty(exports, "CACHE_TTL_LABELS", { enumerable: true, get: function () { return database_types_2.CACHE_TTL_LABELS; } });
Object.defineProperty(exports, "CACHE_STRATEGY_LABELS", { enumerable: true, get: function () { return database_types_2.CACHE_STRATEGY_LABELS; } });
/**
 * Helpers métier depuis database-types
 * Suffixe "Db" pour éviter conflits avec helpers locaux
 */
var database_types_3 = require("@repo/database-types");
// Formatage dates/puissance
Object.defineProperty(exports, "dbFormatPower", { enumerable: true, get: function () { return database_types_3.formatPower; } });
Object.defineProperty(exports, "dbFormatProductionDate", { enumerable: true, get: function () { return database_types_3.formatProductionDate; } });
Object.defineProperty(exports, "dbFormatProductionDateDetailed", { enumerable: true, get: function () { return database_types_3.formatProductionDateDetailed; } });
// Conversions
Object.defineProperty(exports, "dbLiterToCm3", { enumerable: true, get: function () { return database_types_3.literToCm3; } });
Object.defineProperty(exports, "dbCm3ToLiter", { enumerable: true, get: function () { return database_types_3.cm3ToLiter; } });
Object.defineProperty(exports, "dbPsToKw", { enumerable: true, get: function () { return database_types_3.psToKw; } });
Object.defineProperty(exports, "dbKwToPs", { enumerable: true, get: function () { return database_types_3.kwToPs; } });
// Formatage
Object.defineProperty(exports, "dbFormatCylinder", { enumerable: true, get: function () { return database_types_3.formatCylinder; } });
Object.defineProperty(exports, "dbFormatCodes", { enumerable: true, get: function () { return database_types_3.formatCodes; } });
Object.defineProperty(exports, "dbParseCodes", { enumerable: true, get: function () { return database_types_3.parseCodes; } });
// URLs
Object.defineProperty(exports, "dbGenerateVehicleUrl", { enumerable: true, get: function () { return database_types_3.generateVehicleUrl; } });
Object.defineProperty(exports, "dbGenerateProductVehicleUrl", { enumerable: true, get: function () { return database_types_3.generateProductVehicleUrl; } });
Object.defineProperty(exports, "dbGenerateBrandUrl", { enumerable: true, get: function () { return database_types_3.generateBrandUrl; } });
Object.defineProperty(exports, "dbGenerateModelUrl", { enumerable: true, get: function () { return database_types_3.generateModelUrl; } });
Object.defineProperty(exports, "dbGenerateSlug", { enumerable: true, get: function () { return database_types_3.generateSlug; } });
// Noms véhicules
Object.defineProperty(exports, "dbFormatVehicleFullName", { enumerable: true, get: function () { return database_types_3.formatVehicleFullName; } });
Object.defineProperty(exports, "dbFormatVehicleShortName", { enumerable: true, get: function () { return database_types_3.formatVehicleShortName; } });
// Années
Object.defineProperty(exports, "dbIsYearInRange", { enumerable: true, get: function () { return database_types_3.isYearInRange; } });
Object.defineProperty(exports, "dbGetAvailableYears", { enumerable: true, get: function () { return database_types_3.getAvailableYears; } });
//# sourceMappingURL=index.js.map