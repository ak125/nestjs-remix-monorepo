import type { ConfigService } from '@nestjs/config';

/**
 * Single source of truth for the supplier-sync activation flag.
 *
 * The sentinel is INERT unless this env var is exactly `'true'`. Both the
 * scheduler (which arms the BullMQ repeatable job) and the read-only
 * observability controller (which reports the mode) read it through this helper,
 * so the gate semantics live in ONE place — no magic string duplicated, no risk
 * of the controller reporting "active" while the scheduler stays inert (or vice
 * versa). Strict `=== 'true'`: any other value (`'1'`, `'TRUE'`, unset) is inert.
 */
export const SUPPLIER_TRUTH_SYNC_ENABLED = 'SUPPLIER_TRUTH_SYNC_ENABLED';

export function isSupplierSyncEnabled(config: ConfigService): boolean {
  return config.get<string>(SUPPLIER_TRUTH_SYNC_ENABLED) === 'true';
}

/**
 * Relevé des offres fournisseurs (complément BK n° 4, décision de Marwane du
 * 18/11/2026) : le processus DEV lit les portails avec ses identifiants et écrit
 * un relevé daté dans `supplier_offer_snapshot` ; la PROD n'a aucun identifiant
 * fournisseur et ne lit que ces relevés.
 *
 * Ce drapeau, posé SEULEMENT sur DEV, est à la fois :
 *  - l'interrupteur du job planifié de relevé (`SupplierSyncScheduler`) ;
 *  - l'AUTORISATION de lire un portail dans ce processus : sans lui, aucun
 *    connecteur réel ne se construit (`assertLecturePortailsAutorisee`), même si
 *    des identifiants étaient posés. La PROD ne le porte pas : aucun appel de
 *    connecteur n'y est possible.
 * Strict `=== 'true'`, éteint par défaut, comme `SUPPLIER_TRUTH_SYNC_ENABLED`.
 */
export const SUPPLIER_OFFER_RELEVE_ENABLED = 'SUPPLIER_OFFER_RELEVE_ENABLED';

/** Lecture d'une variable d'environnement (ConfigService ou `process.env`). */
export type LireVariable = (cle: string) => string | undefined;

const lireEnv: LireVariable = (cle) => process.env[cle];

export function isSupplierOfferReleveEnabled(
  lire: LireVariable = lireEnv,
): boolean {
  return lire(SUPPLIER_OFFER_RELEVE_ENABLED) === 'true';
}

/**
 * Garde PROD : lève avant toute construction de connecteur réel si ce processus
 * n'est pas autorisé à lire les portails. Appelée par les deux fabriques de
 * connecteurs réels (`defaultConnectorFactory`, relecture `SupplierLiveQuoteService`).
 */
export function assertLecturePortailsAutorisee(
  lire: LireVariable = lireEnv,
): void {
  if (!isSupplierOfferReleveEnabled(lire)) {
    throw new Error(
      `lecture des portails fournisseurs interdite dans ce processus (${SUPPLIER_OFFER_RELEVE_ENABLED} != true) : seul DEV relève, la PROD lit supplier_offer_snapshot`,
    );
  }
}
