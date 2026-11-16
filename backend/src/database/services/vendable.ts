/**
 * Définition UNIQUE de « vendable » — décision 51 de l'owner (2026-11-15/16).
 *
 * Une ligne `pieces_price` est vendable si et seulement si :
 *   - `pri_dispo = '1'` (les valeurs '0', '2', '3' et l'absence de valeur ne
 *     vendent pas) ;
 *   - la ligne n'est pas gelée (`pricing_state <> 'FROZEN'`) ;
 *   - la pièce n'est pas masquée (`pieces.piece_display = true`) ;
 *   - le prix de vente TTC est strictement positif (jamais de vente à 0 €).
 *
 * Avant cette décision, deux définitions coexistaient : le panier
 * (`PiecePriceDataService`, '1' seul) et le module tarifaire, le skill
 * `supplier-price-load` et son runbook ('1', '2' ou '3'). Tout lecteur côté
 * serveur passe désormais par {@link estVendable} ; les fonctions SQL servies
 * (`get_listing_products_extended_filtered`, `catalog_display_quarantine`) ne
 * sont pas modifiées par ce fichier — l'écart restant est documenté dans
 * `.claude/knowledge/ops/supplier-brand-price-load-procedure.md`.
 *
 * Fonction pure, sans base : testée par `vendable.test.ts`.
 */

/** Seule valeur de `pri_dispo` qui autorise la vente. */
export const DISPO_VENDABLE = '1';

/** État d'une ligne gelée : jamais vendable, quel que soit `pri_dispo`. */
export const ETAT_TARIF_GELE = 'FROZEN';

export interface EntreeVendabilite {
  /** `pieces_price.pri_dispo` */
  dispo: string | null | undefined;
  /** `pieces_price.pricing_state` */
  etatTarif: string | null | undefined;
  /** `pieces_price.pri_vente_ttc_n` */
  venteTtc: number | string | null | undefined;
  /** `pieces.piece_display` — `undefined` (non lu) n'est PAS vendable. */
  pieceAffichee: boolean | null | undefined;
}

export function estVendable(e: EntreeVendabilite): boolean {
  if (e.dispo !== DISPO_VENDABLE) return false;
  if (e.etatTarif === ETAT_TARIF_GELE) return false;
  if (e.pieceAffichee !== true) return false;
  if (e.venteTtc == null || e.venteTtc === '') return false;
  const prix = Number(e.venteTtc);
  return Number.isFinite(prix) && prix > 0;
}
