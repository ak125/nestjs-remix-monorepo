/**
 * 🚗 TYPES VÉHICULES UNIFIÉS
 *
 * Types partagés entre backend (NestJS) et frontend (Remix)
 * Basés sur l'analyse des types existants et consolidés
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 */
import { z } from 'zod';
/**

// ====================================
// 🏭 TYPES DE BASE VÉHICULES
// ====================================

/**
 * Schema Zod pour validation VehicleBrand
 */
export declare const VehicleBrandSchema: z.ZodObject<{
    marque_id: z.ZodNumber;
    marque_name: z.ZodString;
    marque_alias: z.ZodOptional<z.ZodString>;
    marque_name_meta: z.ZodOptional<z.ZodString>;
    marque_name_meta_title: z.ZodOptional<z.ZodString>;
    marque_logo: z.ZodOptional<z.ZodString>;
    marque_wall: z.ZodOptional<z.ZodString>;
    marque_country: z.ZodOptional<z.ZodString>;
    marque_display: z.ZodDefault<z.ZodNumber>;
    marque_sort: z.ZodOptional<z.ZodNumber>;
    marque_top: z.ZodOptional<z.ZodNumber>;
    marque_relfollow: z.ZodDefault<z.ZodNumber>;
    marque_sitemap: z.ZodDefault<z.ZodNumber>;
    products_count: z.ZodOptional<z.ZodNumber>;
    is_featured: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    marque_id: number;
    marque_name: string;
    marque_display: number;
    marque_relfollow: number;
    marque_sitemap: number;
    marque_alias?: string | undefined;
    marque_name_meta?: string | undefined;
    marque_name_meta_title?: string | undefined;
    marque_logo?: string | undefined;
    marque_wall?: string | undefined;
    marque_country?: string | undefined;
    marque_sort?: number | undefined;
    marque_top?: number | undefined;
    products_count?: number | undefined;
    is_featured?: boolean | undefined;
}, {
    marque_id: number;
    marque_name: string;
    marque_alias?: string | undefined;
    marque_name_meta?: string | undefined;
    marque_name_meta_title?: string | undefined;
    marque_logo?: string | undefined;
    marque_wall?: string | undefined;
    marque_country?: string | undefined;
    marque_display?: number | undefined;
    marque_sort?: number | undefined;
    marque_top?: number | undefined;
    marque_relfollow?: number | undefined;
    marque_sitemap?: number | undefined;
    products_count?: number | undefined;
    is_featured?: boolean | undefined;
}>;
/**
 * Interface TypeScript pour VehicleBrand (générée depuis Zod)
 */
export type VehicleBrand = z.infer<typeof VehicleBrandSchema>;
/**
 * Schema Zod pour validation VehicleModel
 */
export declare const VehicleModelSchema: z.ZodObject<{
    modele_id: z.ZodNumber;
    modele_name: z.ZodString;
    modele_alias: z.ZodOptional<z.ZodString>;
    modele_name_meta: z.ZodOptional<z.ZodString>;
    modele_ful_name: z.ZodOptional<z.ZodString>;
    modele_marque_id: z.ZodNumber;
    modele_pic: z.ZodOptional<z.ZodString>;
    modele_year_from: z.ZodOptional<z.ZodNumber>;
    modele_year_to: z.ZodOptional<z.ZodNumber>;
    modele_display: z.ZodDefault<z.ZodNumber>;
    modele_sort: z.ZodOptional<z.ZodNumber>;
    auto_marque: z.ZodOptional<z.ZodObject<{
        marque_id: z.ZodNumber;
        marque_name: z.ZodString;
        marque_alias: z.ZodOptional<z.ZodString>;
        marque_name_meta: z.ZodOptional<z.ZodString>;
        marque_name_meta_title: z.ZodOptional<z.ZodString>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_wall: z.ZodOptional<z.ZodString>;
        marque_country: z.ZodOptional<z.ZodString>;
        marque_display: z.ZodDefault<z.ZodNumber>;
        marque_sort: z.ZodOptional<z.ZodNumber>;
        marque_top: z.ZodOptional<z.ZodNumber>;
        marque_relfollow: z.ZodDefault<z.ZodNumber>;
        marque_sitemap: z.ZodDefault<z.ZodNumber>;
        products_count: z.ZodOptional<z.ZodNumber>;
        is_featured: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        marque_id: number;
        marque_name: string;
        marque_display: number;
        marque_relfollow: number;
        marque_sitemap: number;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    }, {
        marque_id: number;
        marque_name: string;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_display?: number | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        marque_relfollow?: number | undefined;
        marque_sitemap?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    modele_id: number;
    modele_name: string;
    modele_marque_id: number;
    modele_display: number;
    modele_alias?: string | undefined;
    modele_name_meta?: string | undefined;
    modele_ful_name?: string | undefined;
    modele_pic?: string | undefined;
    modele_year_from?: number | undefined;
    modele_year_to?: number | undefined;
    modele_sort?: number | undefined;
    auto_marque?: {
        marque_id: number;
        marque_name: string;
        marque_display: number;
        marque_relfollow: number;
        marque_sitemap: number;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    } | undefined;
}, {
    modele_id: number;
    modele_name: string;
    modele_marque_id: number;
    modele_alias?: string | undefined;
    modele_name_meta?: string | undefined;
    modele_ful_name?: string | undefined;
    modele_pic?: string | undefined;
    modele_year_from?: number | undefined;
    modele_year_to?: number | undefined;
    modele_display?: number | undefined;
    modele_sort?: number | undefined;
    auto_marque?: {
        marque_id: number;
        marque_name: string;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_display?: number | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        marque_relfollow?: number | undefined;
        marque_sitemap?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    } | undefined;
}>;
/**
 * Interface TypeScript pour VehicleModel
 */
export type VehicleModel = z.infer<typeof VehicleModelSchema>;
/**
 * Schema Zod pour validation VehicleType
 */
export declare const VehicleTypeSchema: z.ZodObject<{
    type_id: z.ZodNumber;
    type_name: z.ZodString;
    type_alias: z.ZodOptional<z.ZodString>;
    type_name_meta: z.ZodOptional<z.ZodString>;
    type_engine_code: z.ZodOptional<z.ZodString>;
    type_fuel: z.ZodOptional<z.ZodString>;
    type_power: z.ZodOptional<z.ZodString>;
    type_power_ps: z.ZodOptional<z.ZodNumber>;
    type_power_kw: z.ZodOptional<z.ZodNumber>;
    type_liter: z.ZodOptional<z.ZodString>;
    type_year_from: z.ZodOptional<z.ZodString>;
    type_year_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type_month_from: z.ZodOptional<z.ZodNumber>;
    type_month_to: z.ZodOptional<z.ZodNumber>;
    type_engine: z.ZodOptional<z.ZodString>;
    type_engine_description: z.ZodOptional<z.ZodString>;
    type_slug: z.ZodOptional<z.ZodString>;
    type_display: z.ZodDefault<z.ZodNumber>;
    type_sort: z.ZodOptional<z.ZodNumber>;
    modele_id: z.ZodNumber;
    auto_modele: z.ZodOptional<z.ZodObject<{
        modele_id: z.ZodNumber;
        modele_name: z.ZodString;
        modele_alias: z.ZodOptional<z.ZodString>;
        modele_name_meta: z.ZodOptional<z.ZodString>;
        modele_ful_name: z.ZodOptional<z.ZodString>;
        modele_marque_id: z.ZodNumber;
        modele_pic: z.ZodOptional<z.ZodString>;
        modele_year_from: z.ZodOptional<z.ZodNumber>;
        modele_year_to: z.ZodOptional<z.ZodNumber>;
        modele_display: z.ZodDefault<z.ZodNumber>;
        modele_sort: z.ZodOptional<z.ZodNumber>;
        auto_marque: z.ZodOptional<z.ZodObject<{
            marque_id: z.ZodNumber;
            marque_name: z.ZodString;
            marque_alias: z.ZodOptional<z.ZodString>;
            marque_name_meta: z.ZodOptional<z.ZodString>;
            marque_name_meta_title: z.ZodOptional<z.ZodString>;
            marque_logo: z.ZodOptional<z.ZodString>;
            marque_wall: z.ZodOptional<z.ZodString>;
            marque_country: z.ZodOptional<z.ZodString>;
            marque_display: z.ZodDefault<z.ZodNumber>;
            marque_sort: z.ZodOptional<z.ZodNumber>;
            marque_top: z.ZodOptional<z.ZodNumber>;
            marque_relfollow: z.ZodDefault<z.ZodNumber>;
            marque_sitemap: z.ZodDefault<z.ZodNumber>;
            products_count: z.ZodOptional<z.ZodNumber>;
            is_featured: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        }, {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_display: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    }, {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_display?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    }>>;
    year_from: z.ZodOptional<z.ZodNumber>;
    year_to: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    modele_id: number;
    type_id: number;
    type_name: string;
    type_display: number;
    type_alias?: string | undefined;
    type_name_meta?: string | undefined;
    type_engine_code?: string | undefined;
    type_fuel?: string | undefined;
    type_power?: string | undefined;
    type_power_ps?: number | undefined;
    type_power_kw?: number | undefined;
    type_liter?: string | undefined;
    type_year_from?: string | undefined;
    type_year_to?: string | null | undefined;
    type_month_from?: number | undefined;
    type_month_to?: number | undefined;
    type_engine?: string | undefined;
    type_engine_description?: string | undefined;
    type_slug?: string | undefined;
    type_sort?: number | undefined;
    auto_modele?: {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_display: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    } | undefined;
    year_from?: number | undefined;
    year_to?: number | undefined;
}, {
    modele_id: number;
    type_id: number;
    type_name: string;
    type_alias?: string | undefined;
    type_name_meta?: string | undefined;
    type_engine_code?: string | undefined;
    type_fuel?: string | undefined;
    type_power?: string | undefined;
    type_power_ps?: number | undefined;
    type_power_kw?: number | undefined;
    type_liter?: string | undefined;
    type_year_from?: string | undefined;
    type_year_to?: string | null | undefined;
    type_month_from?: number | undefined;
    type_month_to?: number | undefined;
    type_engine?: string | undefined;
    type_engine_description?: string | undefined;
    type_slug?: string | undefined;
    type_display?: number | undefined;
    type_sort?: number | undefined;
    auto_modele?: {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_display?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    } | undefined;
    year_from?: number | undefined;
    year_to?: number | undefined;
}>;
/**
 * Interface TypeScript pour VehicleType
 */
export type VehicleType = z.infer<typeof VehicleTypeSchema>;
/**
 * Schema pour les filtres de recherche véhicules
 */
export declare const VehicleFiltersSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
} & {
    brandId: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodNumber>;
    typeId: z.ZodOptional<z.ZodNumber>;
    year: z.ZodOptional<z.ZodNumber>;
    yearFrom: z.ZodOptional<z.ZodNumber>;
    yearTo: z.ZodOptional<z.ZodNumber>;
    fuel: z.ZodOptional<z.ZodString>;
    powerMin: z.ZodOptional<z.ZodNumber>;
    powerMax: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    offset?: number | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    yearFrom?: number | undefined;
    yearTo?: number | undefined;
    fuel?: string | undefined;
    powerMin?: number | undefined;
    powerMax?: number | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    yearFrom?: number | undefined;
    yearTo?: number | undefined;
    fuel?: string | undefined;
    powerMin?: number | undefined;
    powerMax?: number | undefined;
}>;
export type VehicleFilters = z.infer<typeof VehicleFiltersSchema>;
/**
 * Schema pour les réponses véhicules
 */
export declare const VehicleResponseSchema: <T extends z.ZodType>(itemSchema: T) => z.ZodObject<{
    data: z.ZodArray<T, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    limit: z.ZodNumber;
    hasNext: z.ZodBoolean;
    hasPrev: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    data: T["_output"][];
}, {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
    data: T["_input"][];
}>;
/**
 * Type générique pour les réponses véhicules
 */
export type VehicleResponse<T> = {
    data: T[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
};
/**
 * Schema pour les événements de sélection
 */
export declare const VehicleSelectionEventSchema: z.ZodObject<{
    brand: z.ZodOptional<z.ZodObject<{
        marque_id: z.ZodNumber;
        marque_name: z.ZodString;
        marque_alias: z.ZodOptional<z.ZodString>;
        marque_name_meta: z.ZodOptional<z.ZodString>;
        marque_name_meta_title: z.ZodOptional<z.ZodString>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_wall: z.ZodOptional<z.ZodString>;
        marque_country: z.ZodOptional<z.ZodString>;
        marque_display: z.ZodDefault<z.ZodNumber>;
        marque_sort: z.ZodOptional<z.ZodNumber>;
        marque_top: z.ZodOptional<z.ZodNumber>;
        marque_relfollow: z.ZodDefault<z.ZodNumber>;
        marque_sitemap: z.ZodDefault<z.ZodNumber>;
        products_count: z.ZodOptional<z.ZodNumber>;
        is_featured: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        marque_id: number;
        marque_name: string;
        marque_display: number;
        marque_relfollow: number;
        marque_sitemap: number;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    }, {
        marque_id: number;
        marque_name: string;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_display?: number | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        marque_relfollow?: number | undefined;
        marque_sitemap?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    }>>;
    model: z.ZodOptional<z.ZodObject<{
        modele_id: z.ZodNumber;
        modele_name: z.ZodString;
        modele_alias: z.ZodOptional<z.ZodString>;
        modele_name_meta: z.ZodOptional<z.ZodString>;
        modele_ful_name: z.ZodOptional<z.ZodString>;
        modele_marque_id: z.ZodNumber;
        modele_pic: z.ZodOptional<z.ZodString>;
        modele_year_from: z.ZodOptional<z.ZodNumber>;
        modele_year_to: z.ZodOptional<z.ZodNumber>;
        modele_display: z.ZodDefault<z.ZodNumber>;
        modele_sort: z.ZodOptional<z.ZodNumber>;
        auto_marque: z.ZodOptional<z.ZodObject<{
            marque_id: z.ZodNumber;
            marque_name: z.ZodString;
            marque_alias: z.ZodOptional<z.ZodString>;
            marque_name_meta: z.ZodOptional<z.ZodString>;
            marque_name_meta_title: z.ZodOptional<z.ZodString>;
            marque_logo: z.ZodOptional<z.ZodString>;
            marque_wall: z.ZodOptional<z.ZodString>;
            marque_country: z.ZodOptional<z.ZodString>;
            marque_display: z.ZodDefault<z.ZodNumber>;
            marque_sort: z.ZodOptional<z.ZodNumber>;
            marque_top: z.ZodOptional<z.ZodNumber>;
            marque_relfollow: z.ZodDefault<z.ZodNumber>;
            marque_sitemap: z.ZodDefault<z.ZodNumber>;
            products_count: z.ZodOptional<z.ZodNumber>;
            is_featured: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        }, {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_display: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    }, {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_display?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    }>>;
    type: z.ZodOptional<z.ZodObject<{
        type_id: z.ZodNumber;
        type_name: z.ZodString;
        type_alias: z.ZodOptional<z.ZodString>;
        type_name_meta: z.ZodOptional<z.ZodString>;
        type_engine_code: z.ZodOptional<z.ZodString>;
        type_fuel: z.ZodOptional<z.ZodString>;
        type_power: z.ZodOptional<z.ZodString>;
        type_power_ps: z.ZodOptional<z.ZodNumber>;
        type_power_kw: z.ZodOptional<z.ZodNumber>;
        type_liter: z.ZodOptional<z.ZodString>;
        type_year_from: z.ZodOptional<z.ZodString>;
        type_year_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type_month_from: z.ZodOptional<z.ZodNumber>;
        type_month_to: z.ZodOptional<z.ZodNumber>;
        type_engine: z.ZodOptional<z.ZodString>;
        type_engine_description: z.ZodOptional<z.ZodString>;
        type_slug: z.ZodOptional<z.ZodString>;
        type_display: z.ZodDefault<z.ZodNumber>;
        type_sort: z.ZodOptional<z.ZodNumber>;
        modele_id: z.ZodNumber;
        auto_modele: z.ZodOptional<z.ZodObject<{
            modele_id: z.ZodNumber;
            modele_name: z.ZodString;
            modele_alias: z.ZodOptional<z.ZodString>;
            modele_name_meta: z.ZodOptional<z.ZodString>;
            modele_ful_name: z.ZodOptional<z.ZodString>;
            modele_marque_id: z.ZodNumber;
            modele_pic: z.ZodOptional<z.ZodString>;
            modele_year_from: z.ZodOptional<z.ZodNumber>;
            modele_year_to: z.ZodOptional<z.ZodNumber>;
            modele_display: z.ZodDefault<z.ZodNumber>;
            modele_sort: z.ZodOptional<z.ZodNumber>;
            auto_marque: z.ZodOptional<z.ZodObject<{
                marque_id: z.ZodNumber;
                marque_name: z.ZodString;
                marque_alias: z.ZodOptional<z.ZodString>;
                marque_name_meta: z.ZodOptional<z.ZodString>;
                marque_name_meta_title: z.ZodOptional<z.ZodString>;
                marque_logo: z.ZodOptional<z.ZodString>;
                marque_wall: z.ZodOptional<z.ZodString>;
                marque_country: z.ZodOptional<z.ZodString>;
                marque_display: z.ZodDefault<z.ZodNumber>;
                marque_sort: z.ZodOptional<z.ZodNumber>;
                marque_top: z.ZodOptional<z.ZodNumber>;
                marque_relfollow: z.ZodDefault<z.ZodNumber>;
                marque_sitemap: z.ZodDefault<z.ZodNumber>;
                products_count: z.ZodOptional<z.ZodNumber>;
                is_featured: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            }, {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_display: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        }, {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_display?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        }>>;
        year_from: z.ZodOptional<z.ZodNumber>;
        year_to: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_display: number;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_display: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    }, {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_display?: number | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_display?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    }>>;
    year: z.ZodOptional<z.ZodNumber>;
    isComplete: z.ZodBoolean;
    timestamp: z.ZodDefault<z.ZodNumber>;
    source: z.ZodDefault<z.ZodEnum<["user", "api", "cache", "reset"]>>;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    source: "api" | "cache" | "user" | "reset";
    isComplete: boolean;
    type?: {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_display: number;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_display: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    } | undefined;
    year?: number | undefined;
    brand?: {
        marque_id: number;
        marque_name: string;
        marque_display: number;
        marque_relfollow: number;
        marque_sitemap: number;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    } | undefined;
    model?: {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_display: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    } | undefined;
}, {
    isComplete: boolean;
    type?: {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_display?: number | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_display?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    } | undefined;
    timestamp?: number | undefined;
    source?: "api" | "cache" | "user" | "reset" | undefined;
    year?: number | undefined;
    brand?: {
        marque_id: number;
        marque_name: string;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_display?: number | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        marque_relfollow?: number | undefined;
        marque_sitemap?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    } | undefined;
    model?: {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_display?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    } | undefined;
}>;
export type VehicleSelectionEvent = z.infer<typeof VehicleSelectionEventSchema>;
/**
 * Schema pour l'état de chargement
 */
export declare const LoadingStateSchema: z.ZodObject<{
    isLoading: z.ZodDefault<z.ZodBoolean>;
    error: z.ZodOptional<z.ZodString>;
    lastUpdate: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    isLoading: boolean;
    error?: string | undefined;
    lastUpdate?: number | undefined;
}, {
    error?: string | undefined;
    isLoading?: boolean | undefined;
    lastUpdate?: number | undefined;
}>;
export type LoadingState = z.infer<typeof LoadingStateSchema>;
/**
 * Schema pour la configuration de cache
 */
export declare const CacheConfigSchema: z.ZodObject<{
    ttl: z.ZodDefault<z.ZodNumber>;
    maxSize: z.ZodDefault<z.ZodNumber>;
    keyPrefix: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ttl: number;
    maxSize: number;
    keyPrefix: string;
}, {
    ttl?: number | undefined;
    maxSize?: number | undefined;
    keyPrefix?: string | undefined;
}>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
/**
 * Schema pour les données complètes d'un véhicule
 */
export declare const VehicleDataSchema: z.ZodObject<{
    brand: z.ZodString;
    model: z.ZodString;
    type: z.ZodString;
    year: z.ZodOptional<z.ZodNumber>;
    engine: z.ZodOptional<z.ZodString>;
    fuel: z.ZodOptional<z.ZodString>;
    power: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    partsCount: z.ZodOptional<z.ZodNumber>;
    brandId: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodNumber>;
    typeId: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    brand: string;
    model: string;
    engine?: string | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    power?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    slug?: string | undefined;
    partsCount?: number | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}, {
    type: string;
    brand: string;
    model: string;
    engine?: string | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    power?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    slug?: string | undefined;
    partsCount?: number | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}>;
export type VehicleData = z.infer<typeof VehicleDataSchema>;
/**
 * Schema pour les informations enrichies d'un véhicule
 */
export declare const VehicleInfoSchema: z.ZodObject<{
    brand: z.ZodString;
    model: z.ZodString;
    type: z.ZodString;
    year: z.ZodOptional<z.ZodNumber>;
    engine: z.ZodOptional<z.ZodString>;
    fuel: z.ZodOptional<z.ZodString>;
    power: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    partsCount: z.ZodOptional<z.ZodNumber>;
    brandId: z.ZodOptional<z.ZodNumber>;
    modelId: z.ZodOptional<z.ZodNumber>;
    typeId: z.ZodOptional<z.ZodNumber>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
} & {
    vehicleBrand: z.ZodOptional<z.ZodObject<{
        marque_id: z.ZodNumber;
        marque_name: z.ZodString;
        marque_alias: z.ZodOptional<z.ZodString>;
        marque_name_meta: z.ZodOptional<z.ZodString>;
        marque_name_meta_title: z.ZodOptional<z.ZodString>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_wall: z.ZodOptional<z.ZodString>;
        marque_country: z.ZodOptional<z.ZodString>;
        marque_display: z.ZodDefault<z.ZodNumber>;
        marque_sort: z.ZodOptional<z.ZodNumber>;
        marque_top: z.ZodOptional<z.ZodNumber>;
        marque_relfollow: z.ZodDefault<z.ZodNumber>;
        marque_sitemap: z.ZodDefault<z.ZodNumber>;
        products_count: z.ZodOptional<z.ZodNumber>;
        is_featured: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        marque_id: number;
        marque_name: string;
        marque_display: number;
        marque_relfollow: number;
        marque_sitemap: number;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    }, {
        marque_id: number;
        marque_name: string;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_display?: number | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        marque_relfollow?: number | undefined;
        marque_sitemap?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    }>>;
    vehicleModel: z.ZodOptional<z.ZodObject<{
        modele_id: z.ZodNumber;
        modele_name: z.ZodString;
        modele_alias: z.ZodOptional<z.ZodString>;
        modele_name_meta: z.ZodOptional<z.ZodString>;
        modele_ful_name: z.ZodOptional<z.ZodString>;
        modele_marque_id: z.ZodNumber;
        modele_pic: z.ZodOptional<z.ZodString>;
        modele_year_from: z.ZodOptional<z.ZodNumber>;
        modele_year_to: z.ZodOptional<z.ZodNumber>;
        modele_display: z.ZodDefault<z.ZodNumber>;
        modele_sort: z.ZodOptional<z.ZodNumber>;
        auto_marque: z.ZodOptional<z.ZodObject<{
            marque_id: z.ZodNumber;
            marque_name: z.ZodString;
            marque_alias: z.ZodOptional<z.ZodString>;
            marque_name_meta: z.ZodOptional<z.ZodString>;
            marque_name_meta_title: z.ZodOptional<z.ZodString>;
            marque_logo: z.ZodOptional<z.ZodString>;
            marque_wall: z.ZodOptional<z.ZodString>;
            marque_country: z.ZodOptional<z.ZodString>;
            marque_display: z.ZodDefault<z.ZodNumber>;
            marque_sort: z.ZodOptional<z.ZodNumber>;
            marque_top: z.ZodOptional<z.ZodNumber>;
            marque_relfollow: z.ZodDefault<z.ZodNumber>;
            marque_sitemap: z.ZodDefault<z.ZodNumber>;
            products_count: z.ZodOptional<z.ZodNumber>;
            is_featured: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        }, {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_display: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    }, {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_display?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    }>>;
    vehicleType: z.ZodOptional<z.ZodObject<{
        type_id: z.ZodNumber;
        type_name: z.ZodString;
        type_alias: z.ZodOptional<z.ZodString>;
        type_name_meta: z.ZodOptional<z.ZodString>;
        type_engine_code: z.ZodOptional<z.ZodString>;
        type_fuel: z.ZodOptional<z.ZodString>;
        type_power: z.ZodOptional<z.ZodString>;
        type_power_ps: z.ZodOptional<z.ZodNumber>;
        type_power_kw: z.ZodOptional<z.ZodNumber>;
        type_liter: z.ZodOptional<z.ZodString>;
        type_year_from: z.ZodOptional<z.ZodString>;
        type_year_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        type_month_from: z.ZodOptional<z.ZodNumber>;
        type_month_to: z.ZodOptional<z.ZodNumber>;
        type_engine: z.ZodOptional<z.ZodString>;
        type_engine_description: z.ZodOptional<z.ZodString>;
        type_slug: z.ZodOptional<z.ZodString>;
        type_display: z.ZodDefault<z.ZodNumber>;
        type_sort: z.ZodOptional<z.ZodNumber>;
        modele_id: z.ZodNumber;
        auto_modele: z.ZodOptional<z.ZodObject<{
            modele_id: z.ZodNumber;
            modele_name: z.ZodString;
            modele_alias: z.ZodOptional<z.ZodString>;
            modele_name_meta: z.ZodOptional<z.ZodString>;
            modele_ful_name: z.ZodOptional<z.ZodString>;
            modele_marque_id: z.ZodNumber;
            modele_pic: z.ZodOptional<z.ZodString>;
            modele_year_from: z.ZodOptional<z.ZodNumber>;
            modele_year_to: z.ZodOptional<z.ZodNumber>;
            modele_display: z.ZodDefault<z.ZodNumber>;
            modele_sort: z.ZodOptional<z.ZodNumber>;
            auto_marque: z.ZodOptional<z.ZodObject<{
                marque_id: z.ZodNumber;
                marque_name: z.ZodString;
                marque_alias: z.ZodOptional<z.ZodString>;
                marque_name_meta: z.ZodOptional<z.ZodString>;
                marque_name_meta_title: z.ZodOptional<z.ZodString>;
                marque_logo: z.ZodOptional<z.ZodString>;
                marque_wall: z.ZodOptional<z.ZodString>;
                marque_country: z.ZodOptional<z.ZodString>;
                marque_display: z.ZodDefault<z.ZodNumber>;
                marque_sort: z.ZodOptional<z.ZodNumber>;
                marque_top: z.ZodOptional<z.ZodNumber>;
                marque_relfollow: z.ZodDefault<z.ZodNumber>;
                marque_sitemap: z.ZodDefault<z.ZodNumber>;
                products_count: z.ZodOptional<z.ZodNumber>;
                is_featured: z.ZodOptional<z.ZodBoolean>;
            }, "strip", z.ZodTypeAny, {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            }, {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_display: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        }, {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_display?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        }>>;
        year_from: z.ZodOptional<z.ZodNumber>;
        year_to: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_display: number;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_display: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    }, {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_display?: number | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_display?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    }>>;
    stats: z.ZodOptional<z.ZodObject<{
        viewCount: z.ZodOptional<z.ZodNumber>;
        partsCount: z.ZodOptional<z.ZodNumber>;
        popularParts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        lastUpdated: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        partsCount?: number | undefined;
        viewCount?: number | undefined;
        popularParts?: string[] | undefined;
        lastUpdated?: string | undefined;
    }, {
        partsCount?: number | undefined;
        viewCount?: number | undefined;
        popularParts?: string[] | undefined;
        lastUpdated?: string | undefined;
    }>>;
    seo: z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        keywords: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        canonicalUrl: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
        title?: string | undefined;
        keywords?: string[] | undefined;
        canonicalUrl?: string | undefined;
    }, {
        description?: string | undefined;
        title?: string | undefined;
        keywords?: string[] | undefined;
        canonicalUrl?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: string;
    brand: string;
    model: string;
    engine?: string | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    power?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    slug?: string | undefined;
    partsCount?: number | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    vehicleBrand?: {
        marque_id: number;
        marque_name: string;
        marque_display: number;
        marque_relfollow: number;
        marque_sitemap: number;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    } | undefined;
    vehicleModel?: {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_display: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_display: number;
            marque_relfollow: number;
            marque_sitemap: number;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    } | undefined;
    vehicleType?: {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_display: number;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_display: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_display: number;
                marque_relfollow: number;
                marque_sitemap: number;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    } | undefined;
    stats?: {
        partsCount?: number | undefined;
        viewCount?: number | undefined;
        popularParts?: string[] | undefined;
        lastUpdated?: string | undefined;
    } | undefined;
    seo?: {
        description?: string | undefined;
        title?: string | undefined;
        keywords?: string[] | undefined;
        canonicalUrl?: string | undefined;
    } | undefined;
}, {
    type: string;
    brand: string;
    model: string;
    engine?: string | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    power?: string | undefined;
    description?: string | undefined;
    imageUrl?: string | undefined;
    slug?: string | undefined;
    partsCount?: number | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
    vehicleBrand?: {
        marque_id: number;
        marque_name: string;
        marque_alias?: string | undefined;
        marque_name_meta?: string | undefined;
        marque_name_meta_title?: string | undefined;
        marque_logo?: string | undefined;
        marque_wall?: string | undefined;
        marque_country?: string | undefined;
        marque_display?: number | undefined;
        marque_sort?: number | undefined;
        marque_top?: number | undefined;
        marque_relfollow?: number | undefined;
        marque_sitemap?: number | undefined;
        products_count?: number | undefined;
        is_featured?: boolean | undefined;
    } | undefined;
    vehicleModel?: {
        modele_id: number;
        modele_name: string;
        modele_marque_id: number;
        modele_alias?: string | undefined;
        modele_name_meta?: string | undefined;
        modele_ful_name?: string | undefined;
        modele_pic?: string | undefined;
        modele_year_from?: number | undefined;
        modele_year_to?: number | undefined;
        modele_display?: number | undefined;
        modele_sort?: number | undefined;
        auto_marque?: {
            marque_id: number;
            marque_name: string;
            marque_alias?: string | undefined;
            marque_name_meta?: string | undefined;
            marque_name_meta_title?: string | undefined;
            marque_logo?: string | undefined;
            marque_wall?: string | undefined;
            marque_country?: string | undefined;
            marque_display?: number | undefined;
            marque_sort?: number | undefined;
            marque_top?: number | undefined;
            marque_relfollow?: number | undefined;
            marque_sitemap?: number | undefined;
            products_count?: number | undefined;
            is_featured?: boolean | undefined;
        } | undefined;
    } | undefined;
    vehicleType?: {
        modele_id: number;
        type_id: number;
        type_name: string;
        type_alias?: string | undefined;
        type_name_meta?: string | undefined;
        type_engine_code?: string | undefined;
        type_fuel?: string | undefined;
        type_power?: string | undefined;
        type_power_ps?: number | undefined;
        type_power_kw?: number | undefined;
        type_liter?: string | undefined;
        type_year_from?: string | undefined;
        type_year_to?: string | null | undefined;
        type_month_from?: number | undefined;
        type_month_to?: number | undefined;
        type_engine?: string | undefined;
        type_engine_description?: string | undefined;
        type_slug?: string | undefined;
        type_display?: number | undefined;
        type_sort?: number | undefined;
        auto_modele?: {
            modele_id: number;
            modele_name: string;
            modele_marque_id: number;
            modele_alias?: string | undefined;
            modele_name_meta?: string | undefined;
            modele_ful_name?: string | undefined;
            modele_pic?: string | undefined;
            modele_year_from?: number | undefined;
            modele_year_to?: number | undefined;
            modele_display?: number | undefined;
            modele_sort?: number | undefined;
            auto_marque?: {
                marque_id: number;
                marque_name: string;
                marque_alias?: string | undefined;
                marque_name_meta?: string | undefined;
                marque_name_meta_title?: string | undefined;
                marque_logo?: string | undefined;
                marque_wall?: string | undefined;
                marque_country?: string | undefined;
                marque_display?: number | undefined;
                marque_sort?: number | undefined;
                marque_top?: number | undefined;
                marque_relfollow?: number | undefined;
                marque_sitemap?: number | undefined;
                products_count?: number | undefined;
                is_featured?: boolean | undefined;
            } | undefined;
        } | undefined;
        year_from?: number | undefined;
        year_to?: number | undefined;
    } | undefined;
    stats?: {
        partsCount?: number | undefined;
        viewCount?: number | undefined;
        popularParts?: string[] | undefined;
        lastUpdated?: string | undefined;
    } | undefined;
    seo?: {
        description?: string | undefined;
        title?: string | undefined;
        keywords?: string[] | undefined;
        canonicalUrl?: string | undefined;
    } | undefined;
}>;
export type VehicleInfo = z.infer<typeof VehicleInfoSchema>;
/**
 * Schema pour les props de sélecteur de base
 */
export declare const BaseSelectorPropsSchema: z.ZodObject<{
    value: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
    disabled: z.ZodDefault<z.ZodBoolean>;
    className: z.ZodOptional<z.ZodString>;
    allowClear: z.ZodDefault<z.ZodBoolean>;
    autoFocus: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    disabled: boolean;
    allowClear: boolean;
    autoFocus: boolean;
    value?: string | undefined;
    placeholder?: string | undefined;
    className?: string | undefined;
}, {
    value?: string | undefined;
    placeholder?: string | undefined;
    disabled?: boolean | undefined;
    className?: string | undefined;
    allowClear?: boolean | undefined;
    autoFocus?: boolean | undefined;
}>;
export type BaseSelectorProps = z.infer<typeof BaseSelectorPropsSchema>;
/**
 * Schema pour les props de sélecteur de marques
 */
export declare const BrandSelectorPropsSchema: z.ZodObject<{
    value: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
    disabled: z.ZodDefault<z.ZodBoolean>;
    className: z.ZodOptional<z.ZodString>;
    allowClear: z.ZodDefault<z.ZodBoolean>;
    autoFocus: z.ZodDefault<z.ZodBoolean>;
} & {
    showFeaturedFirst: z.ZodDefault<z.ZodBoolean>;
    showLogos: z.ZodDefault<z.ZodBoolean>;
    showCountries: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    disabled: boolean;
    allowClear: boolean;
    autoFocus: boolean;
    showFeaturedFirst: boolean;
    showLogos: boolean;
    showCountries: boolean;
    value?: string | undefined;
    placeholder?: string | undefined;
    className?: string | undefined;
}, {
    value?: string | undefined;
    placeholder?: string | undefined;
    disabled?: boolean | undefined;
    className?: string | undefined;
    allowClear?: boolean | undefined;
    autoFocus?: boolean | undefined;
    showFeaturedFirst?: boolean | undefined;
    showLogos?: boolean | undefined;
    showCountries?: boolean | undefined;
}>;
export type BrandSelectorProps = z.infer<typeof BrandSelectorPropsSchema>;
/**
 * Schema pour les props de sélecteur de modèles
 */
export declare const ModelSelectorPropsSchema: z.ZodObject<{
    value: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
    disabled: z.ZodDefault<z.ZodBoolean>;
    className: z.ZodOptional<z.ZodString>;
    allowClear: z.ZodDefault<z.ZodBoolean>;
    autoFocus: z.ZodDefault<z.ZodBoolean>;
} & {
    brandId: z.ZodOptional<z.ZodNumber>;
    searchPlaceholder: z.ZodDefault<z.ZodString>;
    autoLoadOnMount: z.ZodDefault<z.ZodBoolean>;
    showYearRange: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    disabled: boolean;
    allowClear: boolean;
    autoFocus: boolean;
    searchPlaceholder: string;
    autoLoadOnMount: boolean;
    showYearRange: boolean;
    value?: string | undefined;
    brandId?: number | undefined;
    placeholder?: string | undefined;
    className?: string | undefined;
}, {
    value?: string | undefined;
    brandId?: number | undefined;
    placeholder?: string | undefined;
    disabled?: boolean | undefined;
    className?: string | undefined;
    allowClear?: boolean | undefined;
    autoFocus?: boolean | undefined;
    searchPlaceholder?: string | undefined;
    autoLoadOnMount?: boolean | undefined;
    showYearRange?: boolean | undefined;
}>;
export type ModelSelectorProps = z.infer<typeof ModelSelectorPropsSchema>;
/**
 * Schema pour les props de sélecteur de types
 */
export declare const TypeSelectorPropsSchema: z.ZodObject<{
    value: z.ZodOptional<z.ZodString>;
    placeholder: z.ZodOptional<z.ZodString>;
    disabled: z.ZodDefault<z.ZodBoolean>;
    className: z.ZodOptional<z.ZodString>;
    allowClear: z.ZodDefault<z.ZodBoolean>;
    autoFocus: z.ZodDefault<z.ZodBoolean>;
} & {
    modelId: z.ZodOptional<z.ZodNumber>;
    brandId: z.ZodOptional<z.ZodNumber>;
    searchPlaceholder: z.ZodDefault<z.ZodString>;
    autoLoadOnMount: z.ZodDefault<z.ZodBoolean>;
    showEngineDetails: z.ZodDefault<z.ZodBoolean>;
    showPowerDetails: z.ZodDefault<z.ZodBoolean>;
    onlyActive: z.ZodDefault<z.ZodBoolean>;
    showDetails: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    disabled: boolean;
    allowClear: boolean;
    autoFocus: boolean;
    searchPlaceholder: string;
    autoLoadOnMount: boolean;
    showEngineDetails: boolean;
    showPowerDetails: boolean;
    onlyActive: boolean;
    showDetails: boolean;
    value?: string | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    placeholder?: string | undefined;
    className?: string | undefined;
}, {
    value?: string | undefined;
    brandId?: number | undefined;
    modelId?: number | undefined;
    placeholder?: string | undefined;
    disabled?: boolean | undefined;
    className?: string | undefined;
    allowClear?: boolean | undefined;
    autoFocus?: boolean | undefined;
    searchPlaceholder?: string | undefined;
    autoLoadOnMount?: boolean | undefined;
    showEngineDetails?: boolean | undefined;
    showPowerDetails?: boolean | undefined;
    onlyActive?: boolean | undefined;
    showDetails?: boolean | undefined;
}>;
export type TypeSelectorProps = z.infer<typeof TypeSelectorPropsSchema>;
/**
 * Valide les données d'une marque
 */
export declare const validateVehicleBrand: (data: unknown) => VehicleBrand;
/**
 * Valide les données d'un modèle
 */
export declare const validateVehicleModel: (data: unknown) => VehicleModel;
/**
 * Valide les données d'un type
 */
export declare const validateVehicleType: (data: unknown) => VehicleType;
/**
 * Valide les filtres de recherche
 */
export declare const validateVehicleFilters: (data: unknown) => VehicleFilters;
/**
 * @deprecated Utiliser VehicleModel à la place
 */
export type Model = VehicleModel;
/**
 * @deprecated Utiliser VehicleBrand à la place
 */
export interface VehicleBrandComponent extends VehicleBrand {
}
/**
 * @deprecated Utiliser VehicleBrand à la place
 */
export interface VehicleBrandAPI extends VehicleBrand {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
    isFavorite: boolean;
    displayOrder: number;
}
//# sourceMappingURL=vehicle.types.d.ts.map