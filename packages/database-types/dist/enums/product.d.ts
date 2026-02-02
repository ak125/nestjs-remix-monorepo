import { z } from 'zod';
export declare const PieceQualitySchema: z.ZodEnum<["OES", "AFTERMARKET", "Echange Standard", "Origine", "Adaptable"]>;
export type PieceQuality = z.infer<typeof PieceQualitySchema>;
export declare const PIECE_QUALITY_LABELS: {
    readonly OES: "Origine Equipementier";
    readonly AFTERMARKET: "Aftermarket";
    readonly 'Echange Standard': "Echange Standard";
    readonly Origine: "Origine Constructeur";
    readonly Adaptable: "Adaptable";
};
export declare const PIECE_QUALITY_RATINGS: {
    readonly Origine: 5;
    readonly OES: 4;
    readonly 'Echange Standard': 3;
    readonly AFTERMARKET: 2;
    readonly Adaptable: 1;
};
export declare const ProductStatusSchema: z.ZodEnum<["active", "inactive", "discontinued", "pending", "out_of_stock"]>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;
export declare const PRODUCT_STATUS_LABELS: {
    readonly active: "Actif";
    readonly inactive: "Inactif";
    readonly discontinued: "Arrete";
    readonly pending: "En attente";
    readonly out_of_stock: "Rupture de stock";
};
export declare const AvailabilityStatusSchema: z.ZodEnum<["in_stock", "low_stock", "out_of_stock", "on_order", "discontinued"]>;
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;
export declare const AVAILABILITY_STATUS_LABELS: {
    readonly in_stock: "En stock";
    readonly low_stock: "Stock faible";
    readonly out_of_stock: "Rupture";
    readonly on_order: "Sur commande";
    readonly discontinued: "Arrete";
};
export declare const PieceSideSchema: z.ZodEnum<["gauche", "droit", "avant", "arriere", "superieur", "inferieur", "interieur", "exterieur"]>;
export type PieceSide = z.infer<typeof PieceSideSchema>;
export declare const PIECE_SIDE_LABELS: {
    readonly gauche: "Gauche";
    readonly droit: "Droit";
    readonly avant: "Avant";
    readonly arriere: "Arriere";
    readonly superieur: "Superieur";
    readonly inferieur: "Inferieur";
    readonly interieur: "Interieur";
    readonly exterieur: "Exterieur";
};
export declare const SupplierTypeSchema: z.ZodEnum<["OEM", "aftermarket", "distributor", "manufacturer"]>;
export type SupplierType = z.infer<typeof SupplierTypeSchema>;
export declare const SUPPLIER_TYPE_LABELS: {
    readonly OEM: "Equipementier Origine";
    readonly aftermarket: "Aftermarket";
    readonly distributor: "Distributeur";
    readonly manufacturer: "Fabricant";
};
export declare const DisplayStatusSchema: z.ZodUnion<[z.ZodLiteral<0>, z.ZodLiteral<1>]>;
export type DisplayStatus = z.infer<typeof DisplayStatusSchema>;
export declare const PieceOesTypeSchema: z.ZodEnum<["O", "1", "A"]>;
export type PieceOesType = z.infer<typeof PieceOesTypeSchema>;
export declare const PIECE_OES_TYPE_LABELS: {
    readonly O: "Origine";
    readonly '1': "Premiere monte";
    readonly A: "Aftermarket";
};
export declare const PriceTypeSchema: z.ZodEnum<["public", "pro", "wholesale", "promo", "clearance"]>;
export type PriceType = z.infer<typeof PriceTypeSchema>;
export declare const PRICE_TYPE_LABELS: {
    readonly public: "Prix public";
    readonly pro: "Prix professionnel";
    readonly wholesale: "Prix grossiste";
    readonly promo: "Prix promo";
    readonly clearance: "Prix destockage";
};
//# sourceMappingURL=product.d.ts.map