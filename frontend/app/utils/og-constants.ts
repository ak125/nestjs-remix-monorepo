/**
 * Constantes OG partagées (client + server).
 *
 * Fichier SANS suffixe .server pour être importable depuis meta() (client-side).
 * Source unique pour IntentClass, OG_BASE, OG_FALLBACK.
 *
 * @see .spec/00-canon/image-matrix-v1.md
 */

export type IntentClass =
  | "transaction"
  | "selection"
  | "guide-achat"
  | "blog-conseil"
  | "diagnostic"
  | "panne-symptome"
  | "glossaire-reference"
  | "outil";

export const OG_BASE = "https://www.automecanik.com";
export const OG_FALLBACK = `${OG_BASE}/logo-og.webp`;
