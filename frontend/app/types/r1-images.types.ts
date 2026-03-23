/**
 * Contrat canonique R1 Images — source unique de vérité.
 *
 * Utilisé par :
 *  - frontend/app/services/api/gamme-api.service.ts (GammeApiResponse)
 *  - frontend/app/routes/pieces.$slug.tsx (PiecesPageSyncData + meta)
 *  - backend shape miroir : backend/src/modules/gamme-rest/services/gamme-response-builder.service.ts
 */

/** Les 5 emplacements image d'une page R1 */
export type R1ImageSlot = "HERO" | "TYPES" | "PRICE" | "LOCATION" | "OG";

/** Une image R1 normalisée (1 par slot maximum) */
export interface R1ImageItem {
  slot: R1ImageSlot;
  /** Chemin relatif dans le bucket uploads (ex: articles/gammes-produits/r1/filtre-a-huile.webp) */
  path: string;
  alt: string;
  caption: string | null;
  /** Ratio d'affichage (ex: "16:9", "4:3", "1200:630") */
  aspect: string;
}

/** Map slot → image unique, retournée par l'API */
export type R1ImagesBySlot = Partial<Record<R1ImageSlot, R1ImageItem>>;
