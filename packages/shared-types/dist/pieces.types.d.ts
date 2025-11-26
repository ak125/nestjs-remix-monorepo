/**
 * 🔧 TYPES PIÈCES UNIFIÉS
 *
 * Types partagés pour les pièces automobiles entre backend et frontend
 * Basés sur l'analyse des services existants et de la logique PHP
 *
 * @version 2.0.0
 * @package @monorepo/shared-types
 */
import { z } from 'zod';
/**
 * Schema pour les critères techniques des pièces
 */
export declare const TechnicalCriteriaSchema: z.ZodObject<{
    criteria: z.ZodString;
    value: z.ZodString;
    unit: z.ZodOptional<z.ZodString>;
    level: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    value: string;
    criteria: string;
    level: number;
    unit?: string | undefined;
}, {
    value: string;
    criteria: string;
    unit?: string | undefined;
    level?: number | undefined;
}>;
export type TechnicalCriteria = z.infer<typeof TechnicalCriteriaSchema>;
/**
 * Schema pour les marques d'équipementiers (pieces_marques)
 */
export declare const PieceMarqueSchema: z.ZodObject<{
    pm_id: z.ZodNumber;
    pm_name: z.ZodString;
    pm_logo: z.ZodOptional<z.ZodString>;
    pm_alias: z.ZodOptional<z.ZodString>;
    pm_oes: z.ZodOptional<z.ZodString>;
    pm_nb_stars: z.ZodOptional<z.ZodNumber>;
    pm_quality: z.ZodOptional<z.ZodString>;
    pm_preview: z.ZodOptional<z.ZodString>;
    pm_website: z.ZodOptional<z.ZodString>;
    pm_display: z.ZodDefault<z.ZodNumber>;
    pm_sort: z.ZodOptional<z.ZodNumber>;
    pm_top: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pm_id: number;
    pm_name: string;
    pm_display: number;
    pm_logo?: string | undefined;
    pm_alias?: string | undefined;
    pm_oes?: string | undefined;
    pm_nb_stars?: number | undefined;
    pm_quality?: string | undefined;
    pm_preview?: string | undefined;
    pm_website?: string | undefined;
    pm_sort?: number | undefined;
    pm_top?: number | undefined;
}, {
    pm_id: number;
    pm_name: string;
    pm_logo?: string | undefined;
    pm_alias?: string | undefined;
    pm_oes?: string | undefined;
    pm_nb_stars?: number | undefined;
    pm_quality?: string | undefined;
    pm_preview?: string | undefined;
    pm_website?: string | undefined;
    pm_display?: number | undefined;
    pm_sort?: number | undefined;
    pm_top?: number | undefined;
}>;
export type PieceMarque = z.infer<typeof PieceMarqueSchema>;
/**
 * Schema pour les prix des pièces (pieces_price)
 */
export declare const PiecePriceSchema: z.ZodObject<{
    pri_piece_id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    pri_vente_ttc: z.ZodOptional<z.ZodString>;
    pri_consigne_ttc: z.ZodOptional<z.ZodString>;
    pri_dispo: z.ZodOptional<z.ZodString>;
    pri_type: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pri_piece_id: string | number;
    pri_vente_ttc?: string | undefined;
    pri_consigne_ttc?: string | undefined;
    pri_dispo?: string | undefined;
    pri_type?: string | undefined;
}, {
    pri_piece_id: string | number;
    pri_vente_ttc?: string | undefined;
    pri_consigne_ttc?: string | undefined;
    pri_dispo?: string | undefined;
    pri_type?: string | undefined;
}>;
export type PiecePrice = z.infer<typeof PiecePriceSchema>;
/**
 * Schema pour les images des pièces (pieces_media_img)
 */
export declare const PieceImageSchema: z.ZodObject<{
    pmi_piece_id: z.ZodNumber;
    pmi_folder: z.ZodString;
    pmi_name: z.ZodString;
    pmi_display: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pmi_piece_id: number;
    pmi_folder: string;
    pmi_name: string;
    pmi_display: number;
}, {
    pmi_piece_id: number;
    pmi_folder: string;
    pmi_name: string;
    pmi_display?: number | undefined;
}>;
export type PieceImage = z.infer<typeof PieceImageSchema>;
/**
 * Schema pour les filtres latéraux (pieces_side_filtre)
 */
export declare const PieceSideFilterSchema: z.ZodObject<{
    psf_id: z.ZodNumber;
    psf_side: z.ZodString;
}, "strip", z.ZodTypeAny, {
    psf_id: number;
    psf_side: string;
}, {
    psf_id: number;
    psf_side: string;
}>;
export type PieceSideFilter = z.infer<typeof PieceSideFilterSchema>;
/**
 * Schema pour les gammes de pièces (pieces_gamme)
 */
export declare const PieceGammeSchema: z.ZodObject<{
    pg_id: z.ZodNumber;
    pg_name: z.ZodString;
    pg_alias: z.ZodString;
    pg_name_url: z.ZodOptional<z.ZodString>;
    pg_name_meta: z.ZodOptional<z.ZodString>;
    pg_pic: z.ZodOptional<z.ZodString>;
    pg_img: z.ZodOptional<z.ZodString>;
    pg_display: z.ZodDefault<z.ZodNumber>;
    pg_level: z.ZodOptional<z.ZodNumber>;
    pg_top: z.ZodOptional<z.ZodNumber>;
    pg_parent: z.ZodOptional<z.ZodNumber>;
    pg_sort: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_display: number;
    pg_name_url?: string | undefined;
    pg_name_meta?: string | undefined;
    pg_pic?: string | undefined;
    pg_img?: string | undefined;
    pg_level?: number | undefined;
    pg_top?: number | undefined;
    pg_parent?: number | undefined;
    pg_sort?: number | undefined;
}, {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_name_url?: string | undefined;
    pg_name_meta?: string | undefined;
    pg_pic?: string | undefined;
    pg_img?: string | undefined;
    pg_display?: number | undefined;
    pg_level?: number | undefined;
    pg_top?: number | undefined;
    pg_parent?: number | undefined;
    pg_sort?: number | undefined;
}>;
export type PieceGamme = z.infer<typeof PieceGammeSchema>;
/**
 * Schema principal pour une pièce unifiée
 * Combine les données de plusieurs tables selon la logique PHP
 */
export declare const UnifiedPieceSchema: z.ZodObject<{
    id: z.ZodNumber;
    reference: z.ZodString;
    reference_clean: z.ZodOptional<z.ZodString>;
    nom: z.ZodString;
    nom_complet: z.ZodString;
    piece_name: z.ZodString;
    piece_name_side: z.ZodOptional<z.ZodString>;
    piece_name_comp: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    marque: z.ZodString;
    marque_id: z.ZodOptional<z.ZodNumber>;
    marque_logo: z.ZodOptional<z.ZodString>;
    marque_alias: z.ZodOptional<z.ZodString>;
    prix_unitaire: z.ZodNumber;
    prix_ttc: z.ZodNumber;
    prix_consigne: z.ZodNumber;
    prix_total: z.ZodNumber;
    quantite_vente: z.ZodDefault<z.ZodNumber>;
    qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
    nb_stars: z.ZodDefault<z.ZodNumber>;
    pm_oes: z.ZodOptional<z.ZodString>;
    image: z.ZodString;
    image_alt: z.ZodOptional<z.ZodString>;
    image_title: z.ZodOptional<z.ZodString>;
    filtre_gamme: z.ZodOptional<z.ZodString>;
    filtre_side: z.ZodOptional<z.ZodString>;
    filtre_id: z.ZodOptional<z.ZodNumber>;
    psf_id: z.ZodOptional<z.ZodNumber>;
    has_image: z.ZodDefault<z.ZodBoolean>;
    has_oem: z.ZodDefault<z.ZodBoolean>;
    has_price: z.ZodDefault<z.ZodBoolean>;
    has_consigne: z.ZodDefault<z.ZodBoolean>;
    criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
        criteria: z.ZodString;
        value: z.ZodString;
        unit: z.ZodOptional<z.ZodString>;
        level: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        criteria: string;
        level: number;
        unit?: string | undefined;
    }, {
        value: string;
        criteria: string;
        unit?: string | undefined;
        level?: number | undefined;
    }>, "many">>;
    url: z.ZodOptional<z.ZodString>;
    _metadata: z.ZodOptional<z.ZodObject<{
        has_price_data: z.ZodBoolean;
        has_image_data: z.ZodBoolean;
        criterias_count: z.ZodNumber;
        relation_ids: z.ZodOptional<z.ZodObject<{
            pm_id: z.ZodOptional<z.ZodNumber>;
            psf_id: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            pm_id?: number | undefined;
            psf_id?: number | undefined;
        }, {
            pm_id?: number | undefined;
            psf_id?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        has_price_data: boolean;
        has_image_data: boolean;
        criterias_count: number;
        relation_ids?: {
            pm_id?: number | undefined;
            psf_id?: number | undefined;
        } | undefined;
    }, {
        has_price_data: boolean;
        has_image_data: boolean;
        criterias_count: number;
        relation_ids?: {
            pm_id?: number | undefined;
            psf_id?: number | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    id: number;
    reference: string;
    nom: string;
    nom_complet: string;
    piece_name: string;
    marque: string;
    prix_unitaire: number;
    prix_ttc: number;
    prix_consigne: number;
    prix_total: number;
    quantite_vente: number;
    qualite: "OES" | "AFTERMARKET" | "Echange Standard";
    nb_stars: number;
    image: string;
    has_image: boolean;
    has_oem: boolean;
    has_price: boolean;
    has_consigne: boolean;
    criterias_techniques: {
        value: string;
        criteria: string;
        level: number;
        unit?: string | undefined;
    }[];
    marque_id?: number | undefined;
    marque_alias?: string | undefined;
    marque_logo?: string | undefined;
    description?: string | undefined;
    pm_oes?: string | undefined;
    psf_id?: number | undefined;
    reference_clean?: string | undefined;
    piece_name_side?: string | undefined;
    piece_name_comp?: string | undefined;
    image_alt?: string | undefined;
    image_title?: string | undefined;
    filtre_gamme?: string | undefined;
    filtre_side?: string | undefined;
    filtre_id?: number | undefined;
    url?: string | undefined;
    _metadata?: {
        has_price_data: boolean;
        has_image_data: boolean;
        criterias_count: number;
        relation_ids?: {
            pm_id?: number | undefined;
            psf_id?: number | undefined;
        } | undefined;
    } | undefined;
}, {
    id: number;
    reference: string;
    nom: string;
    nom_complet: string;
    piece_name: string;
    marque: string;
    prix_unitaire: number;
    prix_ttc: number;
    prix_consigne: number;
    prix_total: number;
    qualite: "OES" | "AFTERMARKET" | "Echange Standard";
    image: string;
    marque_id?: number | undefined;
    marque_alias?: string | undefined;
    marque_logo?: string | undefined;
    description?: string | undefined;
    pm_oes?: string | undefined;
    psf_id?: number | undefined;
    reference_clean?: string | undefined;
    piece_name_side?: string | undefined;
    piece_name_comp?: string | undefined;
    quantite_vente?: number | undefined;
    nb_stars?: number | undefined;
    image_alt?: string | undefined;
    image_title?: string | undefined;
    filtre_gamme?: string | undefined;
    filtre_side?: string | undefined;
    filtre_id?: number | undefined;
    has_image?: boolean | undefined;
    has_oem?: boolean | undefined;
    has_price?: boolean | undefined;
    has_consigne?: boolean | undefined;
    criterias_techniques?: {
        value: string;
        criteria: string;
        unit?: string | undefined;
        level?: number | undefined;
    }[] | undefined;
    url?: string | undefined;
    _metadata?: {
        has_price_data: boolean;
        has_image_data: boolean;
        criterias_count: number;
        relation_ids?: {
            pm_id?: number | undefined;
            psf_id?: number | undefined;
        } | undefined;
    } | undefined;
}>;
export type UnifiedPiece = z.infer<typeof UnifiedPieceSchema>;
/**
 * Schema pour les blocs de pièces (groupement par filtre)
 */
export declare const PieceBlockSchema: z.ZodObject<{
    filtre_gamme: z.ZodString;
    filtre_side: z.ZodString;
    key: z.ZodString;
    pieces: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        reference: z.ZodString;
        reference_clean: z.ZodOptional<z.ZodString>;
        nom: z.ZodString;
        nom_complet: z.ZodString;
        piece_name: z.ZodString;
        piece_name_side: z.ZodOptional<z.ZodString>;
        piece_name_comp: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        marque: z.ZodString;
        marque_id: z.ZodOptional<z.ZodNumber>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_alias: z.ZodOptional<z.ZodString>;
        prix_unitaire: z.ZodNumber;
        prix_ttc: z.ZodNumber;
        prix_consigne: z.ZodNumber;
        prix_total: z.ZodNumber;
        quantite_vente: z.ZodDefault<z.ZodNumber>;
        qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
        nb_stars: z.ZodDefault<z.ZodNumber>;
        pm_oes: z.ZodOptional<z.ZodString>;
        image: z.ZodString;
        image_alt: z.ZodOptional<z.ZodString>;
        image_title: z.ZodOptional<z.ZodString>;
        filtre_gamme: z.ZodOptional<z.ZodString>;
        filtre_side: z.ZodOptional<z.ZodString>;
        filtre_id: z.ZodOptional<z.ZodNumber>;
        psf_id: z.ZodOptional<z.ZodNumber>;
        has_image: z.ZodDefault<z.ZodBoolean>;
        has_oem: z.ZodDefault<z.ZodBoolean>;
        has_price: z.ZodDefault<z.ZodBoolean>;
        has_consigne: z.ZodDefault<z.ZodBoolean>;
        criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
            criteria: z.ZodString;
            value: z.ZodString;
            unit: z.ZodOptional<z.ZodString>;
            level: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }, {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }>, "many">>;
        url: z.ZodOptional<z.ZodString>;
        _metadata: z.ZodOptional<z.ZodObject<{
            has_price_data: z.ZodBoolean;
            has_image_data: z.ZodBoolean;
            criterias_count: z.ZodNumber;
            relation_ids: z.ZodOptional<z.ZodObject<{
                pm_id: z.ZodOptional<z.ZodNumber>;
                psf_id: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }>, "many">;
    count: z.ZodNumber;
    minPrice: z.ZodNullable<z.ZodNumber>;
    maxPrice: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    key: string;
    count: number;
    filtre_gamme: string;
    filtre_side: string;
    pieces: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }[];
    minPrice: number | null;
    maxPrice: number | null;
}, {
    key: string;
    count: number;
    filtre_gamme: string;
    filtre_side: string;
    pieces: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }[];
    minPrice: number | null;
    maxPrice: number | null;
}>;
export type PieceBlock = z.infer<typeof PieceBlockSchema>;
/**
 * Schema pour les options de récupération des pièces
 */
export declare const GetPiecesOptionsSchema: z.ZodObject<{
    maxPieces: z.ZodDefault<z.ZodNumber>;
    maxRelations: z.ZodOptional<z.ZodNumber>;
    bypassCache: z.ZodDefault<z.ZodBoolean>;
    cacheDuration: z.ZodDefault<z.ZodNumber>;
    includeTechnicalCriteria: z.ZodDefault<z.ZodBoolean>;
    includeImages: z.ZodDefault<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "price", "brand", "quality"]>>;
    filters: z.ZodOptional<z.ZodObject<{
        brands: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        priceRange: z.ZodOptional<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            min: number;
            max: number;
        }, {
            min: number;
            max: number;
        }>>;
        quality: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        quality?: string[] | undefined;
        brands?: string[] | undefined;
        priceRange?: {
            min: number;
            max: number;
        } | undefined;
    }, {
        quality?: string[] | undefined;
        brands?: string[] | undefined;
        priceRange?: {
            min: number;
            max: number;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    maxPieces: number;
    bypassCache: boolean;
    cacheDuration: number;
    includeTechnicalCriteria: boolean;
    includeImages: boolean;
    sortBy: "name" | "brand" | "price" | "quality";
    filters?: {
        quality?: string[] | undefined;
        brands?: string[] | undefined;
        priceRange?: {
            min: number;
            max: number;
        } | undefined;
    } | undefined;
    maxRelations?: number | undefined;
}, {
    filters?: {
        quality?: string[] | undefined;
        brands?: string[] | undefined;
        priceRange?: {
            min: number;
            max: number;
        } | undefined;
    } | undefined;
    maxPieces?: number | undefined;
    maxRelations?: number | undefined;
    bypassCache?: boolean | undefined;
    cacheDuration?: number | undefined;
    includeTechnicalCriteria?: boolean | undefined;
    includeImages?: boolean | undefined;
    sortBy?: "name" | "brand" | "price" | "quality" | undefined;
}>;
export type GetPiecesOptions = z.infer<typeof GetPiecesOptionsSchema>;
/**
 * Schema pour la réponse de catalogue unifiée
 */
export declare const UnifiedCatalogResponseSchema: z.ZodObject<{
    pieces: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        reference: z.ZodString;
        reference_clean: z.ZodOptional<z.ZodString>;
        nom: z.ZodString;
        nom_complet: z.ZodString;
        piece_name: z.ZodString;
        piece_name_side: z.ZodOptional<z.ZodString>;
        piece_name_comp: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        marque: z.ZodString;
        marque_id: z.ZodOptional<z.ZodNumber>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_alias: z.ZodOptional<z.ZodString>;
        prix_unitaire: z.ZodNumber;
        prix_ttc: z.ZodNumber;
        prix_consigne: z.ZodNumber;
        prix_total: z.ZodNumber;
        quantite_vente: z.ZodDefault<z.ZodNumber>;
        qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
        nb_stars: z.ZodDefault<z.ZodNumber>;
        pm_oes: z.ZodOptional<z.ZodString>;
        image: z.ZodString;
        image_alt: z.ZodOptional<z.ZodString>;
        image_title: z.ZodOptional<z.ZodString>;
        filtre_gamme: z.ZodOptional<z.ZodString>;
        filtre_side: z.ZodOptional<z.ZodString>;
        filtre_id: z.ZodOptional<z.ZodNumber>;
        psf_id: z.ZodOptional<z.ZodNumber>;
        has_image: z.ZodDefault<z.ZodBoolean>;
        has_oem: z.ZodDefault<z.ZodBoolean>;
        has_price: z.ZodDefault<z.ZodBoolean>;
        has_consigne: z.ZodDefault<z.ZodBoolean>;
        criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
            criteria: z.ZodString;
            value: z.ZodString;
            unit: z.ZodOptional<z.ZodString>;
            level: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }, {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }>, "many">>;
        url: z.ZodOptional<z.ZodString>;
        _metadata: z.ZodOptional<z.ZodObject<{
            has_price_data: z.ZodBoolean;
            has_image_data: z.ZodBoolean;
            criterias_count: z.ZodNumber;
            relation_ids: z.ZodOptional<z.ZodObject<{
                pm_id: z.ZodOptional<z.ZodNumber>;
                psf_id: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }>, "many">;
    blocs: z.ZodArray<z.ZodObject<{
        filtre_gamme: z.ZodString;
        filtre_side: z.ZodString;
        key: z.ZodString;
        pieces: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            reference: z.ZodString;
            reference_clean: z.ZodOptional<z.ZodString>;
            nom: z.ZodString;
            nom_complet: z.ZodString;
            piece_name: z.ZodString;
            piece_name_side: z.ZodOptional<z.ZodString>;
            piece_name_comp: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            marque: z.ZodString;
            marque_id: z.ZodOptional<z.ZodNumber>;
            marque_logo: z.ZodOptional<z.ZodString>;
            marque_alias: z.ZodOptional<z.ZodString>;
            prix_unitaire: z.ZodNumber;
            prix_ttc: z.ZodNumber;
            prix_consigne: z.ZodNumber;
            prix_total: z.ZodNumber;
            quantite_vente: z.ZodDefault<z.ZodNumber>;
            qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
            nb_stars: z.ZodDefault<z.ZodNumber>;
            pm_oes: z.ZodOptional<z.ZodString>;
            image: z.ZodString;
            image_alt: z.ZodOptional<z.ZodString>;
            image_title: z.ZodOptional<z.ZodString>;
            filtre_gamme: z.ZodOptional<z.ZodString>;
            filtre_side: z.ZodOptional<z.ZodString>;
            filtre_id: z.ZodOptional<z.ZodNumber>;
            psf_id: z.ZodOptional<z.ZodNumber>;
            has_image: z.ZodDefault<z.ZodBoolean>;
            has_oem: z.ZodDefault<z.ZodBoolean>;
            has_price: z.ZodDefault<z.ZodBoolean>;
            has_consigne: z.ZodDefault<z.ZodBoolean>;
            criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
                criteria: z.ZodString;
                value: z.ZodString;
                unit: z.ZodOptional<z.ZodString>;
                level: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }, {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }>, "many">>;
            url: z.ZodOptional<z.ZodString>;
            _metadata: z.ZodOptional<z.ZodObject<{
                has_price_data: z.ZodBoolean;
                has_image_data: z.ZodBoolean;
                criterias_count: z.ZodNumber;
                relation_ids: z.ZodOptional<z.ZodObject<{
                    pm_id: z.ZodOptional<z.ZodNumber>;
                    psf_id: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                }, {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            }, {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            quantite_vente: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            nb_stars: number;
            image: string;
            has_image: boolean;
            has_oem: boolean;
            has_price: boolean;
            has_consigne: boolean;
            criterias_techniques: {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }[];
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }, {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            image: string;
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            quantite_vente?: number | undefined;
            nb_stars?: number | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            has_image?: boolean | undefined;
            has_oem?: boolean | undefined;
            has_price?: boolean | undefined;
            has_consigne?: boolean | undefined;
            criterias_techniques?: {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }[] | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }>, "many">;
        count: z.ZodNumber;
        minPrice: z.ZodNullable<z.ZodNumber>;
        maxPrice: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            quantite_vente: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            nb_stars: number;
            image: string;
            has_image: boolean;
            has_oem: boolean;
            has_price: boolean;
            has_consigne: boolean;
            criterias_techniques: {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }[];
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }, {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            image: string;
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            quantite_vente?: number | undefined;
            nb_stars?: number | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            has_image?: boolean | undefined;
            has_oem?: boolean | undefined;
            has_price?: boolean | undefined;
            has_consigne?: boolean | undefined;
            criterias_techniques?: {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }[] | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }>, "many">;
    pieces_grouped_by_filter: z.ZodArray<z.ZodObject<{
        filtre_gamme: z.ZodString;
        filtre_side: z.ZodString;
        key: z.ZodString;
        pieces: z.ZodArray<z.ZodObject<{
            id: z.ZodNumber;
            reference: z.ZodString;
            reference_clean: z.ZodOptional<z.ZodString>;
            nom: z.ZodString;
            nom_complet: z.ZodString;
            piece_name: z.ZodString;
            piece_name_side: z.ZodOptional<z.ZodString>;
            piece_name_comp: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            marque: z.ZodString;
            marque_id: z.ZodOptional<z.ZodNumber>;
            marque_logo: z.ZodOptional<z.ZodString>;
            marque_alias: z.ZodOptional<z.ZodString>;
            prix_unitaire: z.ZodNumber;
            prix_ttc: z.ZodNumber;
            prix_consigne: z.ZodNumber;
            prix_total: z.ZodNumber;
            quantite_vente: z.ZodDefault<z.ZodNumber>;
            qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
            nb_stars: z.ZodDefault<z.ZodNumber>;
            pm_oes: z.ZodOptional<z.ZodString>;
            image: z.ZodString;
            image_alt: z.ZodOptional<z.ZodString>;
            image_title: z.ZodOptional<z.ZodString>;
            filtre_gamme: z.ZodOptional<z.ZodString>;
            filtre_side: z.ZodOptional<z.ZodString>;
            filtre_id: z.ZodOptional<z.ZodNumber>;
            psf_id: z.ZodOptional<z.ZodNumber>;
            has_image: z.ZodDefault<z.ZodBoolean>;
            has_oem: z.ZodDefault<z.ZodBoolean>;
            has_price: z.ZodDefault<z.ZodBoolean>;
            has_consigne: z.ZodDefault<z.ZodBoolean>;
            criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
                criteria: z.ZodString;
                value: z.ZodString;
                unit: z.ZodOptional<z.ZodString>;
                level: z.ZodDefault<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }, {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }>, "many">>;
            url: z.ZodOptional<z.ZodString>;
            _metadata: z.ZodOptional<z.ZodObject<{
                has_price_data: z.ZodBoolean;
                has_image_data: z.ZodBoolean;
                criterias_count: z.ZodNumber;
                relation_ids: z.ZodOptional<z.ZodObject<{
                    pm_id: z.ZodOptional<z.ZodNumber>;
                    psf_id: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                }, {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                }>>;
            }, "strip", z.ZodTypeAny, {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            }, {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            quantite_vente: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            nb_stars: number;
            image: string;
            has_image: boolean;
            has_oem: boolean;
            has_price: boolean;
            has_consigne: boolean;
            criterias_techniques: {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }[];
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }, {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            image: string;
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            quantite_vente?: number | undefined;
            nb_stars?: number | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            has_image?: boolean | undefined;
            has_oem?: boolean | undefined;
            has_price?: boolean | undefined;
            has_consigne?: boolean | undefined;
            criterias_techniques?: {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }[] | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }>, "many">;
        count: z.ZodNumber;
        minPrice: z.ZodNullable<z.ZodNumber>;
        maxPrice: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            quantite_vente: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            nb_stars: number;
            image: string;
            has_image: boolean;
            has_oem: boolean;
            has_price: boolean;
            has_consigne: boolean;
            criterias_techniques: {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }[];
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }, {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            image: string;
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            quantite_vente?: number | undefined;
            nb_stars?: number | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            has_image?: boolean | undefined;
            has_oem?: boolean | undefined;
            has_price?: boolean | undefined;
            has_consigne?: boolean | undefined;
            criterias_techniques?: {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }[] | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }>, "many">;
    count: z.ZodNumber;
    blocs_count: z.ZodNumber;
    minPrice: z.ZodNullable<z.ZodNumber>;
    maxPrice: z.ZodNullable<z.ZodNumber>;
    averagePrice: z.ZodNullable<z.ZodNumber>;
    relations_found: z.ZodNumber;
    duration: z.ZodString;
    success: z.ZodBoolean;
    message: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    optimization: z.ZodString;
    features: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodObject<{
        requestId: z.ZodString;
        typeId: z.ZodNumber;
        pgId: z.ZodNumber;
        version: z.ZodString;
        timestamp: z.ZodString;
        config: z.ZodAny;
        error: z.ZodOptional<z.ZodObject<{
            message: z.ZodString;
            stack: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            stack?: string | undefined;
        }, {
            message: string;
            stack?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        requestId: string;
        timestamp: string;
        version: string;
        typeId: number;
        pgId: number;
        error?: {
            message: string;
            stack?: string | undefined;
        } | undefined;
        config?: any;
    }, {
        requestId: string;
        timestamp: string;
        version: string;
        typeId: number;
        pgId: number;
        error?: {
            message: string;
            stack?: string | undefined;
        } | undefined;
        config?: any;
    }>;
}, "strip", z.ZodTypeAny, {
    duration: string;
    success: boolean;
    metadata: {
        requestId: string;
        timestamp: string;
        version: string;
        typeId: number;
        pgId: number;
        error?: {
            message: string;
            stack?: string | undefined;
        } | undefined;
        config?: any;
    };
    count: number;
    pieces: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }[];
    minPrice: number | null;
    maxPrice: number | null;
    blocs: {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            quantite_vente: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            nb_stars: number;
            image: string;
            has_image: boolean;
            has_oem: boolean;
            has_price: boolean;
            has_consigne: boolean;
            criterias_techniques: {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }[];
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }[];
    pieces_grouped_by_filter: {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            quantite_vente: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            nb_stars: number;
            image: string;
            has_image: boolean;
            has_oem: boolean;
            has_price: boolean;
            has_consigne: boolean;
            criterias_techniques: {
                value: string;
                criteria: string;
                level: number;
                unit?: string | undefined;
            }[];
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }[];
    blocs_count: number;
    averagePrice: number | null;
    relations_found: number;
    optimization: string;
    features: string[];
    message?: string | undefined;
    error?: string | undefined;
}, {
    duration: string;
    success: boolean;
    metadata: {
        requestId: string;
        timestamp: string;
        version: string;
        typeId: number;
        pgId: number;
        error?: {
            message: string;
            stack?: string | undefined;
        } | undefined;
        config?: any;
    };
    count: number;
    pieces: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }[];
    minPrice: number | null;
    maxPrice: number | null;
    blocs: {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            image: string;
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            quantite_vente?: number | undefined;
            nb_stars?: number | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            has_image?: boolean | undefined;
            has_oem?: boolean | undefined;
            has_price?: boolean | undefined;
            has_consigne?: boolean | undefined;
            criterias_techniques?: {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }[] | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }[];
    pieces_grouped_by_filter: {
        key: string;
        count: number;
        filtre_gamme: string;
        filtre_side: string;
        pieces: {
            id: number;
            reference: string;
            nom: string;
            nom_complet: string;
            piece_name: string;
            marque: string;
            prix_unitaire: number;
            prix_ttc: number;
            prix_consigne: number;
            prix_total: number;
            qualite: "OES" | "AFTERMARKET" | "Echange Standard";
            image: string;
            marque_id?: number | undefined;
            marque_alias?: string | undefined;
            marque_logo?: string | undefined;
            description?: string | undefined;
            pm_oes?: string | undefined;
            psf_id?: number | undefined;
            reference_clean?: string | undefined;
            piece_name_side?: string | undefined;
            piece_name_comp?: string | undefined;
            quantite_vente?: number | undefined;
            nb_stars?: number | undefined;
            image_alt?: string | undefined;
            image_title?: string | undefined;
            filtre_gamme?: string | undefined;
            filtre_side?: string | undefined;
            filtre_id?: number | undefined;
            has_image?: boolean | undefined;
            has_oem?: boolean | undefined;
            has_price?: boolean | undefined;
            has_consigne?: boolean | undefined;
            criterias_techniques?: {
                value: string;
                criteria: string;
                unit?: string | undefined;
                level?: number | undefined;
            }[] | undefined;
            url?: string | undefined;
            _metadata?: {
                has_price_data: boolean;
                has_image_data: boolean;
                criterias_count: number;
                relation_ids?: {
                    pm_id?: number | undefined;
                    psf_id?: number | undefined;
                } | undefined;
            } | undefined;
        }[];
        minPrice: number | null;
        maxPrice: number | null;
    }[];
    blocs_count: number;
    averagePrice: number | null;
    relations_found: number;
    optimization: string;
    features: string[];
    message?: string | undefined;
    error?: string | undefined;
}>;
export type UnifiedCatalogResponse = z.infer<typeof UnifiedCatalogResponseSchema>;
/**
 * Schema pour les filtres de recherche de pièces
 */
export declare const PieceSearchFiltersSchema: z.ZodObject<{
    query: z.ZodOptional<z.ZodString>;
    typeId: z.ZodOptional<z.ZodNumber>;
    pgId: z.ZodOptional<z.ZodNumber>;
    marqueId: z.ZodOptional<z.ZodNumber>;
    modeleId: z.ZodOptional<z.ZodNumber>;
    minPrice: z.ZodOptional<z.ZodNumber>;
    maxPrice: z.ZodOptional<z.ZodNumber>;
    qualites: z.ZodOptional<z.ZodArray<z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>, "many">>;
    marques: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    includeOutOfStock: z.ZodDefault<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["name", "price-asc", "price-desc", "brand", "quality"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
    sortBy: "name" | "brand" | "quality" | "price-asc" | "price-desc";
    includeOutOfStock: boolean;
    query?: string | undefined;
    typeId?: number | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    pgId?: number | undefined;
    marqueId?: number | undefined;
    modeleId?: number | undefined;
    qualites?: ("OES" | "AFTERMARKET" | "Echange Standard")[] | undefined;
    marques?: string[] | undefined;
}, {
    page?: number | undefined;
    limit?: number | undefined;
    query?: string | undefined;
    typeId?: number | undefined;
    minPrice?: number | undefined;
    maxPrice?: number | undefined;
    sortBy?: "name" | "brand" | "quality" | "price-asc" | "price-desc" | undefined;
    pgId?: number | undefined;
    marqueId?: number | undefined;
    modeleId?: number | undefined;
    qualites?: ("OES" | "AFTERMARKET" | "Echange Standard")[] | undefined;
    marques?: string[] | undefined;
    includeOutOfStock?: boolean | undefined;
}>;
export type PieceSearchFilters = z.infer<typeof PieceSearchFiltersSchema>;
/**
 * Schema pour les statistiques de catalogue
 */
export declare const CatalogStatsSchema: z.ZodObject<{
    totalPieces: z.ZodNumber;
    totalGammes: z.ZodNumber;
    totalMarques: z.ZodNumber;
    averagePrice: z.ZodNumber;
    priceRange: z.ZodObject<{
        min: z.ZodNumber;
        max: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        min: number;
        max: number;
    }, {
        min: number;
        max: number;
    }>;
    topGammes: z.ZodOptional<z.ZodArray<z.ZodObject<{
        pg_id: z.ZodNumber;
        pg_name: z.ZodString;
        pieces_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pg_id: number;
        pg_name: string;
        pieces_count: number;
    }, {
        pg_id: number;
        pg_name: string;
        pieces_count: number;
    }>, "many">>;
    topMarques: z.ZodOptional<z.ZodArray<z.ZodObject<{
        pm_id: z.ZodNumber;
        pm_name: z.ZodString;
        pieces_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        pm_id: number;
        pm_name: string;
        pieces_count: number;
    }, {
        pm_id: number;
        pm_name: string;
        pieces_count: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    priceRange: {
        min: number;
        max: number;
    };
    averagePrice: number;
    totalPieces: number;
    totalGammes: number;
    totalMarques: number;
    topGammes?: {
        pg_id: number;
        pg_name: string;
        pieces_count: number;
    }[] | undefined;
    topMarques?: {
        pm_id: number;
        pm_name: string;
        pieces_count: number;
    }[] | undefined;
}, {
    priceRange: {
        min: number;
        max: number;
    };
    averagePrice: number;
    totalPieces: number;
    totalGammes: number;
    totalMarques: number;
    topGammes?: {
        pg_id: number;
        pg_name: string;
        pieces_count: number;
    }[] | undefined;
    topMarques?: {
        pm_id: number;
        pm_name: string;
        pieces_count: number;
    }[] | undefined;
}>;
export type CatalogStats = z.infer<typeof CatalogStatsSchema>;
/**
 * Valide une pièce unifiée
 */
export declare const validateUnifiedPiece: (data: unknown) => UnifiedPiece;
/**
 * Valide les options de récupération des pièces
 */
export declare const validateGetPiecesOptions: (data: unknown) => GetPiecesOptions;
/**
 * Valide une réponse de catalogue
 */
export declare const validateUnifiedCatalogResponse: (data: unknown) => UnifiedCatalogResponse;
/**
 * Valide les filtres de recherche
 */
export declare const validatePieceSearchFilters: (data: unknown) => PieceSearchFilters;
/**
 * Schema pour les props de grille de pièces
 */
export declare const PieceGridPropsSchema: z.ZodObject<{
    pieces: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        reference: z.ZodString;
        reference_clean: z.ZodOptional<z.ZodString>;
        nom: z.ZodString;
        nom_complet: z.ZodString;
        piece_name: z.ZodString;
        piece_name_side: z.ZodOptional<z.ZodString>;
        piece_name_comp: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        marque: z.ZodString;
        marque_id: z.ZodOptional<z.ZodNumber>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_alias: z.ZodOptional<z.ZodString>;
        prix_unitaire: z.ZodNumber;
        prix_ttc: z.ZodNumber;
        prix_consigne: z.ZodNumber;
        prix_total: z.ZodNumber;
        quantite_vente: z.ZodDefault<z.ZodNumber>;
        qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
        nb_stars: z.ZodDefault<z.ZodNumber>;
        pm_oes: z.ZodOptional<z.ZodString>;
        image: z.ZodString;
        image_alt: z.ZodOptional<z.ZodString>;
        image_title: z.ZodOptional<z.ZodString>;
        filtre_gamme: z.ZodOptional<z.ZodString>;
        filtre_side: z.ZodOptional<z.ZodString>;
        filtre_id: z.ZodOptional<z.ZodNumber>;
        psf_id: z.ZodOptional<z.ZodNumber>;
        has_image: z.ZodDefault<z.ZodBoolean>;
        has_oem: z.ZodDefault<z.ZodBoolean>;
        has_price: z.ZodDefault<z.ZodBoolean>;
        has_consigne: z.ZodDefault<z.ZodBoolean>;
        criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
            criteria: z.ZodString;
            value: z.ZodString;
            unit: z.ZodOptional<z.ZodString>;
            level: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }, {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }>, "many">>;
        url: z.ZodOptional<z.ZodString>;
        _metadata: z.ZodOptional<z.ZodObject<{
            has_price_data: z.ZodBoolean;
            has_image_data: z.ZodBoolean;
            criterias_count: z.ZodNumber;
            relation_ids: z.ZodOptional<z.ZodObject<{
                pm_id: z.ZodOptional<z.ZodNumber>;
                psf_id: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }>, "many">;
    loading: z.ZodDefault<z.ZodBoolean>;
    error: z.ZodOptional<z.ZodString>;
    onPieceClick: z.ZodOptional<z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>>;
    onAddToCart: z.ZodOptional<z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>>;
    showFilters: z.ZodDefault<z.ZodBoolean>;
    gridColumns: z.ZodDefault<z.ZodNumber>;
    className: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    pieces: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }[];
    loading: boolean;
    showFilters: boolean;
    gridColumns: number;
    error?: string | undefined;
    className?: string | undefined;
    onPieceClick?: ((...args: unknown[]) => unknown) | undefined;
    onAddToCart?: ((...args: unknown[]) => unknown) | undefined;
}, {
    pieces: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }[];
    error?: string | undefined;
    className?: string | undefined;
    loading?: boolean | undefined;
    onPieceClick?: ((...args: unknown[]) => unknown) | undefined;
    onAddToCart?: ((...args: unknown[]) => unknown) | undefined;
    showFilters?: boolean | undefined;
    gridColumns?: number | undefined;
}>;
export type PieceGridProps = z.infer<typeof PieceGridPropsSchema>;
/**
 * Schema pour les props de carte de pièce
 */
export declare const PieceCardPropsSchema: z.ZodObject<{
    piece: z.ZodObject<{
        id: z.ZodNumber;
        reference: z.ZodString;
        reference_clean: z.ZodOptional<z.ZodString>;
        nom: z.ZodString;
        nom_complet: z.ZodString;
        piece_name: z.ZodString;
        piece_name_side: z.ZodOptional<z.ZodString>;
        piece_name_comp: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        marque: z.ZodString;
        marque_id: z.ZodOptional<z.ZodNumber>;
        marque_logo: z.ZodOptional<z.ZodString>;
        marque_alias: z.ZodOptional<z.ZodString>;
        prix_unitaire: z.ZodNumber;
        prix_ttc: z.ZodNumber;
        prix_consigne: z.ZodNumber;
        prix_total: z.ZodNumber;
        quantite_vente: z.ZodDefault<z.ZodNumber>;
        qualite: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard"]>;
        nb_stars: z.ZodDefault<z.ZodNumber>;
        pm_oes: z.ZodOptional<z.ZodString>;
        image: z.ZodString;
        image_alt: z.ZodOptional<z.ZodString>;
        image_title: z.ZodOptional<z.ZodString>;
        filtre_gamme: z.ZodOptional<z.ZodString>;
        filtre_side: z.ZodOptional<z.ZodString>;
        filtre_id: z.ZodOptional<z.ZodNumber>;
        psf_id: z.ZodOptional<z.ZodNumber>;
        has_image: z.ZodDefault<z.ZodBoolean>;
        has_oem: z.ZodDefault<z.ZodBoolean>;
        has_price: z.ZodDefault<z.ZodBoolean>;
        has_consigne: z.ZodDefault<z.ZodBoolean>;
        criterias_techniques: z.ZodDefault<z.ZodArray<z.ZodObject<{
            criteria: z.ZodString;
            value: z.ZodString;
            unit: z.ZodOptional<z.ZodString>;
            level: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }, {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }>, "many">>;
        url: z.ZodOptional<z.ZodString>;
        _metadata: z.ZodOptional<z.ZodObject<{
            has_price_data: z.ZodBoolean;
            has_image_data: z.ZodBoolean;
            criterias_count: z.ZodNumber;
            relation_ids: z.ZodOptional<z.ZodObject<{
                pm_id: z.ZodOptional<z.ZodNumber>;
                psf_id: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }, {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }, {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }, {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    }>;
    variant: z.ZodDefault<z.ZodEnum<["default", "compact", "detailed"]>>;
    showPrice: z.ZodDefault<z.ZodBoolean>;
    showImage: z.ZodDefault<z.ZodBoolean>;
    showBrand: z.ZodDefault<z.ZodBoolean>;
    showQuickAdd: z.ZodDefault<z.ZodBoolean>;
    onClick: z.ZodOptional<z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>>;
    onAddToCart: z.ZodOptional<z.ZodFunction<z.ZodTuple<[], z.ZodUnknown>, z.ZodUnknown>>;
    className: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    piece: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        quantite_vente: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        nb_stars: number;
        image: string;
        has_image: boolean;
        has_oem: boolean;
        has_price: boolean;
        has_consigne: boolean;
        criterias_techniques: {
            value: string;
            criteria: string;
            level: number;
            unit?: string | undefined;
        }[];
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    };
    variant: "default" | "compact" | "detailed";
    showPrice: boolean;
    showImage: boolean;
    showBrand: boolean;
    showQuickAdd: boolean;
    className?: string | undefined;
    onAddToCart?: ((...args: unknown[]) => unknown) | undefined;
    onClick?: ((...args: unknown[]) => unknown) | undefined;
}, {
    piece: {
        id: number;
        reference: string;
        nom: string;
        nom_complet: string;
        piece_name: string;
        marque: string;
        prix_unitaire: number;
        prix_ttc: number;
        prix_consigne: number;
        prix_total: number;
        qualite: "OES" | "AFTERMARKET" | "Echange Standard";
        image: string;
        marque_id?: number | undefined;
        marque_alias?: string | undefined;
        marque_logo?: string | undefined;
        description?: string | undefined;
        pm_oes?: string | undefined;
        psf_id?: number | undefined;
        reference_clean?: string | undefined;
        piece_name_side?: string | undefined;
        piece_name_comp?: string | undefined;
        quantite_vente?: number | undefined;
        nb_stars?: number | undefined;
        image_alt?: string | undefined;
        image_title?: string | undefined;
        filtre_gamme?: string | undefined;
        filtre_side?: string | undefined;
        filtre_id?: number | undefined;
        has_image?: boolean | undefined;
        has_oem?: boolean | undefined;
        has_price?: boolean | undefined;
        has_consigne?: boolean | undefined;
        criterias_techniques?: {
            value: string;
            criteria: string;
            unit?: string | undefined;
            level?: number | undefined;
        }[] | undefined;
        url?: string | undefined;
        _metadata?: {
            has_price_data: boolean;
            has_image_data: boolean;
            criterias_count: number;
            relation_ids?: {
                pm_id?: number | undefined;
                psf_id?: number | undefined;
            } | undefined;
        } | undefined;
    };
    className?: string | undefined;
    onAddToCart?: ((...args: unknown[]) => unknown) | undefined;
    variant?: "default" | "compact" | "detailed" | undefined;
    showPrice?: boolean | undefined;
    showImage?: boolean | undefined;
    showBrand?: boolean | undefined;
    showQuickAdd?: boolean | undefined;
    onClick?: ((...args: unknown[]) => unknown) | undefined;
}>;
export type PieceCardProps = z.infer<typeof PieceCardPropsSchema>;
//# sourceMappingURL=pieces.types.d.ts.map