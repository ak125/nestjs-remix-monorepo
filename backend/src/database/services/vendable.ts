/**
 * Définition UNIQUE de « vendable » — décision 51 de l'owner (2026-11-15/16),
 * amendée par la décision 118 (2026-11-17) pour les valeurs de `pri_dispo`.
 *
 * Une ligne `pieces_price` est vendable si et seulement si :
 *   - `pri_dispo` vaut '1' (en stock), '2' (stock faible) ou '3' (sur commande,
 *     délai affiché) ; '0', toute autre valeur et l'absence de valeur ne
 *     vendent pas ;
 *   - la ligne n'est pas gelée (`pricing_state <> 'FROZEN'`) ;
 *   - la pièce n'est pas masquée (`pieces.piece_display = true`) ;
 *   - le prix de vente TTC est strictement positif (jamais de vente à 0 €).
 *
 * Même définition pour les pages et le panier (décision 118). Avant la
 * décision 51, le panier (`PiecePriceDataService`, '1' seul depuis #1499)
 * refusait les pièces que les pages R2 montraient vendables ('1', '2', '3').
 * Tout lecteur côté serveur passe par {@link estVendable} ; les fonctions SQL
 * servies (`get_listing_products_extended_filtered`, `get_pieces_for_type_gamme_v3`,
 * `catalog_display_quarantine`) ne sont pas modifiées par ce fichier — l'écart
 * restant est documenté dans
 * `.claude/knowledge/ops/supplier-brand-price-load-procedure.md`.
 *
 * Fonction pure, sans base : testée par `vendable.test.ts`.
 */

/** Valeurs de `pri_dispo` qui autorisent la vente (décision 118). */
export const DISPOS_VENDABLES: ReadonlySet<string> = new Set(['1', '2', '3']);

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
  if (e.dispo == null || !DISPOS_VENDABLES.has(e.dispo)) return false;
  if (e.etatTarif === ETAT_TARIF_GELE) return false;
  if (e.pieceAffichee !== true) return false;
  if (e.venteTtc == null || e.venteTtc === '') return false;
  const prix = Number(e.venteTtc);
  return Number.isFinite(prix) && prix > 0;
}
