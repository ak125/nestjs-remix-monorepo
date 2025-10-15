/**
 * 🏗️ SHARED TYPES - Types partagés du monorepo
 *
 * Point d'entrée principal pour tous les types partagés
 * entre le backend NestJS et le frontend Remix
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
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
//# sourceMappingURL=index.d.ts.map