import { getSupplierConnectorConfig } from './connectors/supplier-registry';
import type {
  LectureLive,
  ResultatLecture,
} from './supplier-live-quote.service';
import type {
  OfferSnapshotInsert,
  OffreReleve,
} from './supplier-truth.repository';

/**
 * Relevé des offres fournisseurs (complément BK n° 4, décision de Marwane du
 * 18/11/2026) — fonctions pures, sans lecture, écriture ni réseau.
 *
 * - DEV lit les portails (`SupplierOfferReleveRunner`) et écrit chaque lecture
 *   dans `supplier_offer_snapshot` via `offreDepuisLecture`.
 * - PROD ne lit que ces relevés : `lectureDepuisReleve` rend le dernier relevé
 *   d'un fournisseur sous la forme d'une lecture, ou un motif BLOQUANT
 *   (« relevé absent », « relevé de plus de 30 min »).
 */

/**
 * Âge maximal d'un relevé utilisable par les contrôles 1, 2 et 6 et par la
 * proposition (décision de Marwane : « plus vieux que 30 min = BLOQUE »).
 */
export const FRAICHEUR_RELEVE_MAX_MINUTES = 30;

/**
 * Cadence du relevé planifié sur DEV : toutes les 15 min, pour qu'un relevé
 * reste plus jeune que `FRAICHEUR_RELEVE_MAX_MINUTES` entre deux passages
 * (le test le vérifie).
 */
export const RELEVE_CRON = '*/15 * * * *';
export const RELEVE_INTERVALLE_MINUTES = 15;

export const MOTIF_RELEVE_ABSENT = 'relevé absent';
export const MOTIF_RELEVE_PERIME = `relevé de plus de ${FRAICHEUR_RELEVE_MAX_MINUTES} min`;

const CONFIANCE: Record<
  LectureLive['correspondance'],
  OfferSnapshotInsert['parse_confidence']
> = {
  EXACTE: 'HIGH_CONFIDENCE',
  NON_EXACTE: 'AMBIGUOUS_MAPPING',
  ABSENTE: 'UNKNOWN',
};

const versCentimes = (euros: number | null): number | null =>
  euros == null || !Number.isFinite(euros) ? null : Math.round(euros * 100);

/**
 * Remise effective : remise 1 puis remise 2 en cascade (inoshop). La colonne
 * `remise_pct` n'en porte qu'une ; le prix net lu reste la référence.
 */
const remiseEffective = (
  r1: number | null,
  r2: number | null,
): number | null => {
  if (r1 == null) return null;
  if (!r2) return r1;
  return Math.round((1 - (1 - r1 / 100) * (1 - r2 / 100)) * 10000) / 100;
};

/** Lecture portail (DEV) → ligne à écrire dans `supplier_offer_snapshot`. */
export function offreDepuisLecture(
  lecture: LectureLive,
  pieceId: number,
): OfferSnapshotInsert {
  return {
    piece_id_i: pieceId,
    supplier_id: lecture.splId,
    supplier_ref: lecture.refFournisseur ?? lecture.refDemandee,
    public_ht_cents: versCentimes(lecture.prixPublicHt),
    remise_pct: remiseEffective(lecture.remisePct, lecture.remise2Pct),
    achat_ht_cents: versCentimes(lecture.prixNetHt),
    available: lecture.disponible,
    delay_days: lecture.delaiJours,
    parse_confidence: CONFIANCE[lecture.correspondance],
    source_verified_at: lecture.lueA,
    observed_at: lecture.lueA,
  };
}

const correspondanceDepuis = (
  c: OffreReleve['parse_confidence'],
): LectureLive['correspondance'] =>
  c === 'HIGH_CONFIDENCE'
    ? 'EXACTE'
    : c === 'UNKNOWN'
      ? 'ABSENTE'
      : 'NON_EXACTE';

/** Âge du relevé en millisecondes ; null si la date est illisible. */
function ageMs(observeA: string, maintenant: Date): number | null {
  const t = Date.parse(observeA);
  return Number.isFinite(t) ? maintenant.getTime() - t : null;
}

/** Vrai si le relevé a au plus `maxMinutes` minutes. */
export function releveEstFrais(
  observeA: string,
  maintenant: Date,
  maxMinutes = FRAICHEUR_RELEVE_MAX_MINUTES,
): boolean {
  const age = ageMs(observeA, maintenant);
  return age != null && age <= maxMinutes * 60_000;
}

/**
 * Dernier relevé (PROD) → lecture utilisable par les contrôles, ou motif
 * bloquant : absent (`RELEVE_ABSENT`) ou plus vieux que la fraîcheur
 * (`RELEVE_PERIME`). Aucun portail n'est appelé.
 */
export function lectureDepuisReleve(
  releve: OffreReleve | null,
  splId: string,
  refDemandee: string,
  maintenant: Date,
  maxMinutes = FRAICHEUR_RELEVE_MAX_MINUTES,
): ResultatLecture {
  if (!releve) {
    return {
      ok: false,
      splId,
      motif: 'RELEVE_ABSENT',
      detail: MOTIF_RELEVE_ABSENT,
      lueA: maintenant.toISOString(),
    };
  }
  if (!releveEstFrais(releve.observed_at, maintenant, maxMinutes)) {
    return {
      ok: false,
      splId,
      motif: 'RELEVE_PERIME',
      detail: MOTIF_RELEVE_PERIME,
      lueA: releve.observed_at,
    };
  }
  const correspondance = correspondanceDepuis(releve.parse_confidence);
  const disponible = correspondance !== 'ABSENTE' && releve.available === true;
  return {
    ok: true,
    source: 'RELEVE',
    splId,
    plateforme: getSupplierConnectorConfig(splId)?.platform ?? null,
    refDemandee,
    refFournisseur: releve.supplier_ref,
    correspondance,
    prixPublicHt:
      releve.public_ht_cents == null ? null : releve.public_ht_cents / 100,
    remisePct: releve.remise_pct == null ? null : Number(releve.remise_pct),
    remise2Pct: null,
    prixNetHt:
      releve.achat_ht_cents == null ? null : releve.achat_ht_cents / 100,
    disponible,
    delaiJours: releve.delay_days,
    detailDispo:
      correspondance === 'ABSENTE'
        ? 'introuvable'
        : disponible
          ? 'disponible'
          : releve.delay_days != null
            ? `sur commande, délai ${releve.delay_days} j`
            : 'indisponible',
    lueA: releve.observed_at,
  };
}
