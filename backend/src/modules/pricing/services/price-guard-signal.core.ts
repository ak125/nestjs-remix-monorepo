/**
 * Garde-fou des prix → rapport du matin (mandat EI, décisions 51 et 67).
 *
 * Producteur de l'entrée `GARDE_PRIX_JSON` lue par
 * `.github/scripts/morning-health-digest.sh`, format garde-prix.v1 :
 *   {"schema":"garde-prix.v1","generated_at":ISO,"declenchements":[{"cle","at"}]}
 * Chaque `cle` présente = un incident en cours (signal rouge, un mail urgent par
 * incident) ; une clé absente au passage suivant = incident terminé.
 *
 * Trois familles de déclenchements, chacune lue dans un état persisté :
 *  - `invariants:<fournisseur>` — le dernier lot d'import tarif du fournisseur
 *    (`price_import_batches`, operation nulle, DRY_RUN_OK ou COMMITTED) porte
 *    `failed_rows > 0` : des lignes refusées par validatePriceChain
 *    (PricingInvariantError). `failed_rows` est écrit par PriceImportService
 *    (countInvariantRejections) ; un nouveau lot propre du fournisseur clôt
 *    l'incident.
 *  - `arret51:<fournisseur>` — le dernier lot de retrait de dispo du fournisseur
 *    est un arrêt du garde-fou (décision 51, OPERATION_ARRET_GARDE_FOU, FAILED) :
 *    le lot attend Marwane. Un retrait accepté ensuite (COMMITTED) le clôt.
 *  - `perte:pm<marque>` — des lignes vendables (DISPOS_VENDABLES, tarif non
 *    gelé, vente TTC > 0, achat HT > 0 ; `piece_display` non lu, donc un
 *    sur-ensemble) ont une vente HT inférieure à l'achat HT (invariant « jamais
 *    de vente à perte »), une clé par marque.
 *
 * Aucune lecture ne devient un zéro : une source illisible fait échouer le
 * producteur, le rapport écrit alors « indisponible » et garde les incidents
 * déjà ouverts (contrat du digest).
 */
import type { DryRunReport } from './price-import.dry-run';
import type { InvariantCode } from './pricing-invariants.service';
import { OPERATION_ARRET_GARDE_FOU } from '../config/supplier-sale-rules';
import {
  DISPO_DEACTIVATION_OPERATION,
  type GuardBatchRow,
  type SellAtLossScan,
} from './pricing.repository';

export const GARDE_PRIX_SCHEMA = 'garde-prix.v1';

/** Exhaustif à la compilation : un code ajouté à InvariantCode doit figurer ici. */
const INVARIANT_CODES: Record<InvariantCode, true> = {
  ACHAT_NOT_POSITIVE: true,
  VENTE_BELOW_ACHAT: true,
  MARGE_EXCEEDS_MAX: true,
  TVA_NOT_WHITELISTED: true,
  NON_FINITE_OR_NEGATIVE: true,
  TTC_NOT_POSITIVE: true,
  DELTA_EXCEEDS_MAX: true,
};

const isInvariantCode = (c: string): boolean =>
  Object.prototype.hasOwnProperty.call(INVARIANT_CODES, c);

/**
 * Lignes refusées par le garde-fou des prix (validatePriceChain) dans un
 * rapport d'import. Les autres refus (ligne illisible, aucune règle de marge)
 * ne sont pas des déclenchements du garde-fou et ne sont pas comptés.
 */
export function countInvariantRejections(
  report: Pick<DryRunReport, 'rows'>,
): number {
  let n = 0;
  for (const row of report.rows) {
    if (!row.rejected || !row.rejectReason) continue;
    const codes = row.rejectReason.split(',');
    if (codes.length > 0 && codes.every(isInvariantCode)) n++;
  }
  return n;
}

// Types de lignes définis par le dépôt qui les lit ; réexportés pour les appelants.
export type { GuardBatchRow, SellAtLossScan };

export interface GardePrixDeclenchement {
  cle: string;
  at: string;
}

export interface GardePrixV1 {
  schema: typeof GARDE_PRIX_SCHEMA;
  generated_at: string;
  declenchements: GardePrixDeclenchement[];
}

/** Clé lisible par le digest : `[A-Za-z0-9_.:-]`, 64 caractères au plus. */
export function guardKey(prefix: string, id: string): string {
  return `${prefix}:${id}`.replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 64);
}

const IMPORT_STATUSES = new Set(['DRY_RUN_OK', 'COMMITTED']);

const startedMs = (b: GuardBatchRow): number => {
  const t = Date.parse(b.started_at ?? '');
  return Number.isFinite(t) ? t : -Infinity;
};

/** Dernier lot par fournisseur parmi ceux que `keep` retient. */
function latestPerSupplier(
  batches: GuardBatchRow[],
  keep: (b: GuardBatchRow) => boolean,
): Map<string, GuardBatchRow> {
  const latest = new Map<string, GuardBatchRow>();
  for (const b of batches) {
    if (!b.supplier_id || !keep(b)) continue;
    const prev = latest.get(b.supplier_id);
    if (!prev || startedMs(b) > startedMs(prev)) latest.set(b.supplier_id, b);
  }
  return latest;
}

const batchAt = (b: GuardBatchRow, fallback: string): string =>
  b.completed_at ?? b.started_at ?? fallback;

/** Assemble garde-prix.v1 à partir des états persistés (fonction pure). */
export function buildGardePrix(input: {
  generatedAt: string;
  batches: GuardBatchRow[];
  sellAtLoss: SellAtLossScan;
}): GardePrixV1 {
  const { generatedAt, batches, sellAtLoss } = input;
  const out: GardePrixDeclenchement[] = [];

  const imports = latestPerSupplier(
    batches,
    (b) => b.operation == null && IMPORT_STATUSES.has(b.status),
  );
  for (const [supplier, b] of imports) {
    if ((b.failed_rows ?? 0) > 0) {
      out.push({
        cle: guardKey('invariants', supplier),
        at: batchAt(b, generatedAt),
      });
    }
  }

  const withdrawals = latestPerSupplier(
    batches,
    (b) =>
      (b.operation === OPERATION_ARRET_GARDE_FOU && b.status === 'FAILED') ||
      (b.operation === DISPO_DEACTIVATION_OPERATION &&
        b.status === 'COMMITTED'),
  );
  for (const [supplier, b] of withdrawals) {
    if (b.operation === OPERATION_ARRET_GARDE_FOU) {
      out.push({
        cle: guardKey('arret51', supplier),
        at: batchAt(b, generatedAt),
      });
    }
  }

  for (const [pm, count] of sellAtLoss.byBrand) {
    if (count > 0)
      out.push({ cle: guardKey('perte', `pm${pm}`), at: generatedAt });
  }

  out.sort((a, b) => a.cle.localeCompare(b.cle));
  return {
    schema: GARDE_PRIX_SCHEMA,
    generated_at: generatedAt,
    declenchements: out,
  };
}

/** Lecteurs persistés dont le producteur a besoin (PricingRepository). */
export interface GuardSignalSource {
  listBatchesForGuardSignal(): Promise<GuardBatchRow[]>;
  scanSellableAtLoss(): Promise<SellAtLossScan>;
}

/** Lit les deux sources puis assemble garde-prix.v1. Une lecture en échec rejette. */
export async function readGardePrix(
  source: GuardSignalSource,
  now: Date = new Date(),
): Promise<GardePrixV1> {
  const [batches, sellAtLoss] = await Promise.all([
    source.listBatchesForGuardSignal(),
    source.scanSellableAtLoss(),
  ]);
  // Le catalogue vendable n'est jamais vide (406 699 lignes au 2026-11-20) : un
  // parcours à 0 ligne est une lecture cassée, pas l'absence de vente à perte.
  if (sellAtLoss.scanned === 0) {
    throw new Error(
      'aucune ligne vendable lue : lecture de pieces_price suspecte',
    );
  }
  return buildGardePrix({
    generatedAt: now.toISOString(),
    batches,
    sellAtLoss,
  });
}
