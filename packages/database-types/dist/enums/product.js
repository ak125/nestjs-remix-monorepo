import { z } from 'zod';
export const PieceQualitySchema = z.enum([
    'OES',
    'AFTERMARKET',
    'Echange Standard',
    'Origine',
    'Adaptable',
]);
export const PIECE_QUALITY_LABELS = {
    OES: 'Origine Equipementier',
    AFTERMARKET: 'Aftermarket',
    'Echange Standard': 'Echange Standard',
    Origine: 'Origine Constructeur',
    Adaptable: 'Adaptable',
};
export const PIECE_QUALITY_RATINGS = {
    Origine: 5,
    OES: 4,
    'Echange Standard': 3,
    AFTERMARKET: 2,
    Adaptable: 1,
};
export const ProductStatusSchema = z.enum([
    'active',
    'inactive',
    'discontinued',
    'pending',
    'out_of_stock',
]);
export const PRODUCT_STATUS_LABELS = {
    active: 'Actif',
    inactive: 'Inactif',
    discontinued: 'Arrete',
    pending: 'En attente',
    out_of_stock: 'Rupture de stock',
};
export const AvailabilityStatusSchema = z.enum([
    'in_stock',
    'low_stock',
    'out_of_stock',
    'on_order',
    'discontinued',
]);
export const AVAILABILITY_STATUS_LABELS = {
    in_stock: 'En stock',
    low_stock: 'Stock faible',
    out_of_stock: 'Rupture',
    on_order: 'Sur commande',
    discontinued: 'Arrete',
};
export const PieceSideSchema = z.enum([
    'gauche',
    'droit',
    'avant',
    'arriere',
    'superieur',
    'inferieur',
    'interieur',
    'exterieur',
]);
export const PIECE_SIDE_LABELS = {
    gauche: 'Gauche',
    droit: 'Droit',
    avant: 'Avant',
    arriere: 'Arriere',
    superieur: 'Superieur',
    inferieur: 'Inferieur',
    interieur: 'Interieur',
    exterieur: 'Exterieur',
};
export const SupplierTypeSchema = z.enum([
    'OEM',
    'aftermarket',
    'distributor',
    'manufacturer',
]);
export const SUPPLIER_TYPE_LABELS = {
    OEM: 'Equipementier Origine',
    aftermarket: 'Aftermarket',
    distributor: 'Distributeur',
    manufacturer: 'Fabricant',
};
export const DisplayStatusSchema = z.union([z.literal(0), z.literal(1)]);
export const PieceOesTypeSchema = z.enum(['O', '1', 'A']);
export const PIECE_OES_TYPE_LABELS = {
    O: 'Origine',
    '1': 'Premiere monte',
    A: 'Aftermarket',
};
export const PriceTypeSchema = z.enum([
    'public',
    'pro',
    'wholesale',
    'promo',
    'clearance',
]);
export const PRICE_TYPE_LABELS = {
    public: 'Prix public',
    pro: 'Prix professionnel',
    wholesale: 'Prix grossiste',
    promo: 'Prix promo',
    clearance: 'Prix destockage',
};
//# sourceMappingURL=product.js.map