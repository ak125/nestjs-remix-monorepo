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
    page: number;
    limit: number;
    data: T["_output"][];
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
}, {
    page: number;
    limit: number;
    data: T["_input"][];
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
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
    isComplete: boolean;
    timestamp: number;
    source: "user" | "api" | "cache" | "reset";
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
    timestamp?: number | undefined;
    source?: "user" | "api" | "cache" | "reset" | undefined;
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
    isLoading?: boolean | undefined;
    error?: string | undefined;
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
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    engine?: string | undefined;
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
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    engine?: string | undefined;
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
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    engine?: string | undefined;
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
    brandId?: number | undefined;
    modelId?: number | undefined;
    typeId?: number | undefined;
    year?: number | undefined;
    fuel?: string | undefined;
    engine?: string | undefined;
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
 * Schema pour les codes moteur (ex: K9K 752, M9R, CAGA)
 * Table: auto_type_motor_code
 */
export declare const VehicleMotorCodeSchema: z.ZodObject<{
    tmc_type_id: z.ZodNumber;
    tmc_code: z.ZodString;
    tmc_display: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    tmc_type_id: number;
    tmc_code: string;
    tmc_display: number;
}, {
    tmc_type_id: number;
    tmc_code: string;
    tmc_display?: number | undefined;
}>;
export type VehicleMotorCode = z.infer<typeof VehicleMotorCodeSchema>;
/**
 * Schema pour les types mines / CNIT (carte grise)
 * Table: auto_type_number_code
 */
export declare const VehicleMineCodeSchema: z.ZodObject<{
    tnc_type_id: z.ZodNumber;
    tnc_code: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tnc_cnit: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    tnc_type_id: number;
    tnc_code?: string | null | undefined;
    tnc_cnit?: string | null | undefined;
}, {
    tnc_type_id: number;
    tnc_code?: string | null | undefined;
    tnc_cnit?: string | null | undefined;
}>;
export type VehicleMineCode = z.infer<typeof VehicleMineCodeSchema>;
/**
 * Schema pour le carburant moteur
 * Table: auto_type_motor_fuel
 */
export declare const VehicleMotorFuelSchema: z.ZodObject<{
    tmf_id: z.ZodNumber;
    tmf_motor: z.ZodOptional<z.ZodString>;
    tmf_engine: z.ZodOptional<z.ZodString>;
    tmf_fuel: z.ZodOptional<z.ZodString>;
    tmf_display: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    tmf_sort: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    tmf_id: number;
    tmf_display: number;
    tmf_motor?: string | undefined;
    tmf_engine?: string | undefined;
    tmf_fuel?: string | undefined;
    tmf_sort?: number | undefined;
}, {
    tmf_id: number;
    tmf_motor?: string | undefined;
    tmf_engine?: string | undefined;
    tmf_fuel?: string | undefined;
    tmf_display?: number | undefined;
    tmf_sort?: number | undefined;
}>;
export type VehicleMotorFuel = z.infer<typeof VehicleMotorFuelSchema>;
/**
 * Schema pour un véhicule avec TOUTES ses données
 * Équivalent du PHP avec marque + modèle + type + codes moteur + types mines
 */
export declare const VehicleFullDetailsSchema: z.ZodObject<{
    marque_id: z.ZodNumber;
    marque_name: z.ZodString;
    marque_name_meta: z.ZodOptional<z.ZodString>;
    marque_name_meta_title: z.ZodOptional<z.ZodString>;
    marque_alias: z.ZodString;
    marque_logo: z.ZodOptional<z.ZodString>;
    marque_relfollow: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    marque_top: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    modele_id: z.ZodNumber;
    modele_name: z.ZodString;
    modele_name_meta: z.ZodOptional<z.ZodString>;
    modele_alias: z.ZodString;
    modele_pic: z.ZodOptional<z.ZodString>;
    modele_ful_name: z.ZodOptional<z.ZodString>;
    modele_body: z.ZodOptional<z.ZodString>;
    modele_relfollow: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    modele_year_from: z.ZodOptional<z.ZodString>;
    modele_year_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type_id: z.ZodNumber;
    type_name: z.ZodString;
    type_name_meta: z.ZodOptional<z.ZodString>;
    type_alias: z.ZodString;
    type_power_ps: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    type_power_kw: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    type_fuel: z.ZodOptional<z.ZodString>;
    type_body: z.ZodOptional<z.ZodString>;
    type_engine: z.ZodOptional<z.ZodString>;
    type_liter: z.ZodOptional<z.ZodString>;
    type_month_from: z.ZodOptional<z.ZodString>;
    type_year_from: z.ZodOptional<z.ZodString>;
    type_month_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type_year_to: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type_relfollow: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    type_display: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
    motor_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    motor_codes_formatted: z.ZodOptional<z.ZodString>;
    mine_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    mine_codes_formatted: z.ZodOptional<z.ZodString>;
    cnit_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    cnit_codes_formatted: z.ZodOptional<z.ZodString>;
    production_date_formatted: z.ZodOptional<z.ZodString>;
    power_formatted: z.ZodOptional<z.ZodString>;
    cylinder_cm3: z.ZodOptional<z.ZodNumber>;
    vehicle_url: z.ZodOptional<z.ZodString>;
    image_url: z.ZodOptional<z.ZodString>;
    logo_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    marque_id: number;
    marque_name: string;
    marque_alias: string;
    modele_id: number;
    modele_name: string;
    modele_alias: string;
    type_id: number;
    type_name: string;
    type_alias: string;
    marque_name_meta?: string | undefined;
    marque_name_meta_title?: string | undefined;
    marque_logo?: string | undefined;
    marque_top?: string | number | undefined;
    marque_relfollow?: string | number | undefined;
    modele_name_meta?: string | undefined;
    modele_ful_name?: string | undefined;
    modele_pic?: string | undefined;
    modele_year_from?: string | undefined;
    modele_year_to?: string | null | undefined;
    type_name_meta?: string | undefined;
    type_fuel?: string | undefined;
    type_power_ps?: string | number | undefined;
    type_power_kw?: string | number | undefined;
    type_liter?: string | undefined;
    type_year_from?: string | undefined;
    type_year_to?: string | null | undefined;
    type_month_from?: string | undefined;
    type_month_to?: string | null | undefined;
    type_engine?: string | undefined;
    type_display?: string | number | undefined;
    modele_body?: string | undefined;
    modele_relfollow?: string | number | undefined;
    type_body?: string | undefined;
    type_relfollow?: string | number | undefined;
    motor_codes?: string[] | undefined;
    motor_codes_formatted?: string | undefined;
    mine_codes?: string[] | undefined;
    mine_codes_formatted?: string | undefined;
    cnit_codes?: string[] | undefined;
    cnit_codes_formatted?: string | undefined;
    production_date_formatted?: string | undefined;
    power_formatted?: string | undefined;
    cylinder_cm3?: number | undefined;
    vehicle_url?: string | undefined;
    image_url?: string | undefined;
    logo_url?: string | undefined;
}, {
    marque_id: number;
    marque_name: string;
    marque_alias: string;
    modele_id: number;
    modele_name: string;
    modele_alias: string;
    type_id: number;
    type_name: string;
    type_alias: string;
    marque_name_meta?: string | undefined;
    marque_name_meta_title?: string | undefined;
    marque_logo?: string | undefined;
    marque_top?: string | number | undefined;
    marque_relfollow?: string | number | undefined;
    modele_name_meta?: string | undefined;
    modele_ful_name?: string | undefined;
    modele_pic?: string | undefined;
    modele_year_from?: string | undefined;
    modele_year_to?: string | null | undefined;
    type_name_meta?: string | undefined;
    type_fuel?: string | undefined;
    type_power_ps?: string | number | undefined;
    type_power_kw?: string | number | undefined;
    type_liter?: string | undefined;
    type_year_from?: string | undefined;
    type_year_to?: string | null | undefined;
    type_month_from?: string | undefined;
    type_month_to?: string | null | undefined;
    type_engine?: string | undefined;
    type_display?: string | number | undefined;
    modele_body?: string | undefined;
    modele_relfollow?: string | number | undefined;
    type_body?: string | undefined;
    type_relfollow?: string | number | undefined;
    motor_codes?: string[] | undefined;
    motor_codes_formatted?: string | undefined;
    mine_codes?: string[] | undefined;
    mine_codes_formatted?: string | undefined;
    cnit_codes?: string[] | undefined;
    cnit_codes_formatted?: string | undefined;
    production_date_formatted?: string | undefined;
    power_formatted?: string | undefined;
    cylinder_cm3?: number | undefined;
    vehicle_url?: string | undefined;
    image_url?: string | undefined;
    logo_url?: string | undefined;
}>;
export type VehicleFullDetails = z.infer<typeof VehicleFullDetailsSchema>;
/**
 * Formate les dates de production comme dans le PHP
 * @example
 * formatProductionDate("06", "2005", "12", "2012") => "de 2005 à 2012"
 * formatProductionDate("06", "2020", null, null) => "depuis 06/2020"
 */
export declare function formatProductionDate(monthFrom?: string | null, yearFrom?: string | null, monthTo?: string | null, yearTo?: string | null): string;
/**
 * Formate les dates de production en version détaillée avec mois
 * @example
 * formatProductionDateDetailed("06", "2005", "12", "2012") => "06/2005 → 12/2012"
 */
export declare function formatProductionDateDetailed(monthFrom?: string | null, yearFrom?: string | null, monthTo?: string | null, yearTo?: string | null): string;
/**
 * Formate la puissance en ch et kW
 * @example
 * formatPower(75, 55) => "75 ch / 55 kW"
 * formatPower(75) => "75 ch / 55 kW" (calcule kW)
 */
export declare function formatPower(powerPs?: number | string | null, powerKw?: number | string | null): string;
/**
 * Convertit la cylindrée de litres en cm³
 * @example
 * literToCm3("1.5") => 1500
 * literToCm3("2.0") => 2000
 */
export declare function literToCm3(liter?: string | null): number | undefined;
/**
 * Formate la cylindrée avec les deux unités
 * @example
 * formatCylinder("1.5") => "1500 cm³ (1.5 L)"
 */
export declare function formatCylinder(liter?: string | null): string;
/**
 * Formate un tableau de codes en chaîne séparée par virgules
 * @example
 * formatCodes(["K9K 752", "K9K 764"]) => "K9K 752, K9K 764"
 */
export declare function formatCodes(codes?: string[] | null): string;
/**
 * Génère l'URL du véhicule au format Automecanik
 * @example
 * generateVehicleUrl({marque_alias: "renault", marque_id: 5, ...})
 * => "/constructeurs/renault-5/clio-iii-5010/1-5-dci-16789.html"
 */
export declare function generateVehicleUrl(vehicle: {
    marque_alias: string;
    marque_id: number;
    modele_alias: string;
    modele_id: number;
    type_alias: string;
    type_id: number;
}): string;
/**
 * Génère l'URL d'une page produit pour un véhicule
 */
export declare function generateProductVehicleUrl(params: {
    gamme_alias: string;
    gamme_id: number;
    marque_alias: string;
    marque_id: number;
    modele_alias: string;
    modele_id: number;
    type_alias: string;
    type_id: number;
}): string;
/**
 * Schema pour la recherche par code moteur
 */
export declare const MotorCodeSearchSchema: z.ZodObject<{
    code: z.ZodString;
    exact: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    code: string;
    exact: boolean;
}, {
    code: string;
    exact?: boolean | undefined;
}>;
export type MotorCodeSearch = z.infer<typeof MotorCodeSearchSchema>;
/**
 * Schema pour la recherche par type mine
 */
export declare const MineCodeSearchSchema: z.ZodObject<{
    code: z.ZodString;
    includeCnit: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    code: string;
    includeCnit: boolean;
}, {
    code: string;
    includeCnit?: boolean | undefined;
}>;
export type MineCodeSearch = z.infer<typeof MineCodeSearchSchema>;
/**
 * Schema pour les marques populaires (homepage)
 */
export declare const TopBrandSchema: z.ZodObject<{
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
} & {
    models_count: z.ZodOptional<z.ZodNumber>;
    types_count: z.ZodOptional<z.ZodNumber>;
    image_url: z.ZodOptional<z.ZodString>;
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
    image_url?: string | undefined;
    models_count?: number | undefined;
    types_count?: number | undefined;
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
    image_url?: string | undefined;
    models_count?: number | undefined;
    types_count?: number | undefined;
}>;
export type TopBrand = z.infer<typeof TopBrandSchema>;
//# sourceMappingURL=vehicle.types.d.ts.map