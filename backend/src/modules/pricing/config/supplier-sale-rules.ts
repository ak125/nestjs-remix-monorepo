/**
 * Règles de sortie de vente par fournisseur — décision 51 de l'owner
 * (2026-11-15/16). Configuration versionnée : la modifier passe par une PR
 * approuvée par l'owner (zone STOP prix/stock), jamais par une variable
 * d'environnement ni une écriture en base.
 *
 * 1. Garde-fou : un lot de retrait qui ferait sortir de la vente plus de
 *    {@link SEUIL_GARDE_FOU_SORTIE} des pièces vendables du périmètre du lot
 *    s'arrête (lot FAILED, operation {@link OPERATION_ARRET_GARDE_FOU}) et
 *    attend l'accord de l'owner.
 *
 * 2. Fraîcheur : tant qu'un fournisseur n'a pas eu sa PREMIÈRE mise à jour
 *    complète (tarif entier importé et activé), l'absence d'une pièce dans son
 *    tarif (motif DISCONTINUED_TARIFF) ne fait qu'ALERTER : aucune ligne ne
 *    sort. Une fois la date renseignée, une pièce ne sort que si elle est
 *    absente ou indisponible dans le nouveau tarif ; l'ancienneté seule d'un
 *    prix ne retire jamais une pièce.
 *
 * Relevé du 2026-11-16 : aucun fournisseur n'a eu de mise à jour complète
 * (dernier import 2026-06-13, 92 % des lignes sans trace). Toutes les entrées
 * sont donc à `null` : alerte seulement.
 */

/** Part maximale des pièces vendables qu'un lot peut faire sortir (5 %). */
export const SEUIL_GARDE_FOU_SORTIE = 0.05;

/** `price_import_batches.operation` d'un lot arrêté par le garde-fou. */
export const OPERATION_ARRET_GARDE_FOU = 'DISPO_DEACTIVATION_GUARD_HALT';

export interface RegleFraicheurFournisseur {
  /**
   * Date ISO (AAAA-MM-JJ) de la première mise à jour complète du fournisseur,
   * ou `null` : condition de fraîcheur inactive, alerte seulement.
   */
  premiereMajCompleteLe: string | null;
}

/**
 * Clé = libellé `pieces_price.pri_frs` (correspondance `___xtr_supplier` par
 * nom ou alias, relevée le 2026-11-16). Un libellé absent de cette table est
 * traité comme inactif (alerte seulement).
 */
export const FRAICHEUR_PAR_FOURNISSEUR: Readonly<
  Record<string, RegleFraicheurFournisseur>
> = Object.freeze({
  ACR: { premiereMajCompleteLe: null },
  AFP: { premiereMajCompleteLe: null },
  CAL: { premiereMajCompleteLe: null },
  CEVAM: { premiereMajCompleteLe: null },
  CS: { premiereMajCompleteLe: null },
  DCA: { premiereMajCompleteLe: null },
  LIZARTE: { premiereMajCompleteLe: null },
  'LIZARTE PRIX NE': { premiereMajCompleteLe: null },
  MGA: { premiereMajCompleteLe: null },
  NED: { premiereMajCompleteLe: null },
  NPS: { premiereMajCompleteLe: null },
  OTTOGO: { premiereMajCompleteLe: null },
  PAP: { premiereMajCompleteLe: null },
  'RCA France': { premiereMajCompleteLe: null },
  SASIC: { premiereMajCompleteLe: null },
  SOREA: { premiereMajCompleteLe: null },
});

/** La condition de fraîcheur est-elle active pour ce libellé fournisseur ? */
export function fraicheurActive(
  libelleFournisseur: string | null | undefined,
  regles: Readonly<
    Record<string, RegleFraicheurFournisseur>
  > = FRAICHEUR_PAR_FOURNISSEUR,
): boolean {
  if (!libelleFournisseur) return false;
  const regle = regles[libelleFournisseur];
  return regle != null && regle.premiereMajCompleteLe != null;
}

export interface GardeFouSortie {
  /** Pièces vendables (décision 51) du périmètre du lot avant retrait. */
  vendablesAvant: number;
  /** Pièces que le lot ferait sortir de la vente. */
  sortantes: number;
  /** sortantes / vendablesAvant (0 si aucun vendable). */
  part: number;
  seuil: number;
  /** true = le lot s'arrête et attend l'owner. */
  arret: boolean;
}

/** Garde-fou pur : arrêt strictement au-delà du seuil. */
export function evaluerGardeFou(
  sortantes: number,
  vendablesAvant: number,
  seuil: number = SEUIL_GARDE_FOU_SORTIE,
): GardeFouSortie {
  const part =
    vendablesAvant > 0 ? sortantes / vendablesAvant : sortantes > 0 ? 1 : 0;
  return { vendablesAvant, sortantes, part, seuil, arret: part > seuil };
}
