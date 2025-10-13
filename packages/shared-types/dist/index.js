"use strict";
/**
 * 🏗️ SHARED TYPES - Types partagés du monorepo
 *
 * Point d'entrée principal pour tous les types partagés
 * entre le backend NestJS et le frontend Remix
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
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
exports.SHARED_TYPES_INFO = exports.SHARED_TYPES_VERSION = exports.CONFIG = exports.CacheType = exports.PieceQuality = exports.VehicleFuelType = void 0;
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
//# sourceMappingURL=index.js.map