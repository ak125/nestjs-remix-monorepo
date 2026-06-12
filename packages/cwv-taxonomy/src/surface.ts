/**
 * Surface — granularité métier (ce que vit l'utilisateur).
 *
 * Mirror strict de `.spec/00-canon/seo-runtime/cwv-taxonomy.yaml` §surfaces.
 * Une surface = une intention business. Mapping Surface → FunnelStep figé
 * (cf. SURFACE_TO_FUNNEL_STEP). Cardinalité bornée (~12 valeurs V1).
 *
 * Anti-bricolage : enum const + readonly array → DB CHECK IN enforcé via
 * runtime test (sync DB enum check ↔ ce code, voir __tests__/surface.test.ts).
 */

export const SURFACE_VALUES = [
  'R2_PRODUCT',
  'R2_GAMME_VEHICLE',
  'R3_GUIDE',
  'R5_DIAGNOSTIC',
  'R8_VEHICLE',
  'SEARCH',
  'HOME',
  'CART',
  'CHECKOUT',
  'PAYMENT',
  'ACCOUNT',
  'OTHER',
] as const;

export type Surface = (typeof SURFACE_VALUES)[number];

export const SURFACE_DESCRIPTIONS: Record<Surface, string> = {
  R2_PRODUCT: 'Page produit pieces (fiche article unique)',
  R2_GAMME_VEHICLE: 'Page gamme × véhicule (liste de pièces filtrée)',
  R3_GUIDE: 'Guide thématique / article éditorial',
  R5_DIAGNOSTIC: 'Page symptôme / diagnostic / réparation',
  R8_VEHICLE: 'Fiche véhicule (constructeur/modèle/type)',
  SEARCH: 'Résultats de recherche / autocomplete',
  HOME: "Page d'accueil",
  CART: 'Panier (étape pré-checkout)',
  CHECKOUT: 'Étapes checkout (1..N)',
  PAYMENT: 'Page paiement (Paybox / SystemPay redirect)',
  ACCOUNT: 'Espace client (commandes, profil)',
  OTHER: 'Fallback toute route non classée',
};

export function isSurface(value: unknown): value is Surface {
  return (
    typeof value === 'string' && (SURFACE_VALUES as readonly string[]).includes(value)
  );
}
