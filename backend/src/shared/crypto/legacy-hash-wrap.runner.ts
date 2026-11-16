/**
 * Enveloppe des anciennes empreintes de mot de passe (mandat AP, décisions 88-89).
 *
 * Remplace chaque ancienne empreinte (md5, sha1, md5-crypt à sel fixe) par
 * bcrypt(ancienne_empreinte), au format de PasswordCryptoService.wrapLegacyHash.
 * Le mot de passe n'est pas connu ici : la connexion recalcule l'ancienne
 * empreinte puis convertit le compte en bcrypt simple.
 *
 * Garanties :
 *  - idempotent et reprenable : seules les valeurs ne commençant pas par `$`
 *    sont lues ; une enveloppe ou un bcrypt n'est jamais relu ni réécrit ;
 *  - aucune empreinte perdue : chaque enveloppe est revérifiée contre
 *    l'ancienne valeur avant écriture, et l'écriture est conditionnelle
 *    (identifiant + ancienne valeur) : une ligne modifiée entre-temps par une
 *    connexion est laissée telle quelle et comptée ;
 *  - comptes avant et après par format, sans lire les empreintes ;
 *  - aucune donnée client dans la sortie : comptes et identifiants de compte.
 *
 * Module sans dépendance Supabase : le stockage est injecté (voir
 * legacy-hash-wrap.supabase-store.ts), ce qui le rend testable en mémoire.
 */
import {
  LegacyHashFormat,
  PasswordCryptoService,
} from './password-crypto.service';

export interface WrapTarget {
  table: string;
  idColumn: string;
  hashColumn: string;
}

export const WRAP_TARGETS: readonly WrapTarget[] = [
  { table: '___xtr_customer', idColumn: 'cst_id', hashColumn: 'cst_pswd' },
  { table: '___config_admin', idColumn: 'cnfa_id', hashColumn: 'cnfa_pswd' },
];

/** Catégories comptées en base (expressions régulières PostgreSQL, `~*`). */
export const COUNT_CATEGORIES = {
  bcrypt: '^\\$2[aby]\\$',
  wrapped: '^\\$akwrap\\$v1\\$',
  md5: '^[a-f0-9]{32}$',
  sha1: '^[a-f0-9]{40}$',
  'md5-crypt': '^[^$].{12}$',
} as const;
export type CountCategory = keyof typeof COUNT_CATEGORIES;

export type FormatCounts = Record<CountCategory, number> & {
  total: number;
  null: number;
  /** total - null - catégories : valeurs d'un autre format. */
  other: number;
};

export interface HashRow {
  id: string;
  hash: string | null;
}

export interface WrapStore {
  /** Nombre de lignes de la table, des lignes à NULL, et par catégorie. */
  countTotal(target: WrapTarget): Promise<number>;
  countNull(target: WrapTarget): Promise<number>;
  countMatching(target: WrapTarget, regex: string): Promise<number>;
  /**
   * Lignes dont l'empreinte est non nulle et ne commence pas par `$`,
   * d'identifiant strictement supérieur à `afterId`, triées par identifiant.
   */
  fetchCandidates(
    target: WrapTarget,
    afterId: string | null,
    limit: number,
  ): Promise<HashRow[]>;
  /** Écrit `newHash` seulement si la valeur actuelle vaut `expectedHash`. */
  replaceIfUnchanged(
    target: WrapTarget,
    id: string,
    expectedHash: string,
    newHash: string,
  ): Promise<boolean>;
}

export interface WrapOptions {
  apply: boolean;
  batchSize?: number;
  concurrency?: number;
  /** Arrêt après ce nombre de lignes enveloppées par table (essai borné). */
  maxRowsPerTarget?: number;
  log?: (line: string) => void;
}

export interface TargetReport {
  table: string;
  before: FormatCounts;
  after: FormatCounts | null;
  scanned: number;
  wrapped: Record<LegacyHashFormat, number>;
  /** Lignes que la vérification aurait enveloppées (mode lecture). */
  wouldWrap: Record<LegacyHashFormat, number>;
  skippedUnknownFormat: number;
  skippedChangedConcurrently: number;
  failed: number;
  failedIds: string[];
}

const MAX_FAILED_IDS = 20;

function emptyByFormat(): Record<LegacyHashFormat, number> {
  return { md5: 0, sha1: 0, 'md5-crypt': 0 };
}

export async function countFormats(
  store: WrapStore,
  target: WrapTarget,
): Promise<FormatCounts> {
  const [total, nullCount] = await Promise.all([
    store.countTotal(target),
    store.countNull(target),
  ]);
  const categories = Object.keys(COUNT_CATEGORIES) as CountCategory[];
  const values = await Promise.all(
    categories.map((c) => store.countMatching(target, COUNT_CATEGORIES[c])),
  );
  const byCategory = Object.fromEntries(
    categories.map((c, i) => [c, values[i]]),
  ) as Record<CountCategory, number>;
  const known = values.reduce((a, b) => a + b, 0);
  return {
    ...byCategory,
    total,
    null: nullCount,
    other: total - nullCount - known,
  };
}

/**
 * Contrôle de départ : pour chaque format, une empreinte synthétique est
 * enveloppée puis validée avec le bon et un mauvais mot de passe. Un échec
 * arrête tout avant la première écriture.
 */
export async function runCanary(crypto: PasswordCryptoService): Promise<void> {
  const password = `canary-${Date.now()}`;
  for (const format of ['md5', 'sha1', 'md5-crypt'] as LegacyHashFormat[]) {
    const legacy = crypto.computeLegacyDigest(format, password);
    const wrapped = await crypto.wrapLegacyHash(legacy);
    const ok = await crypto.validatePassword(password, wrapped);
    const ko = await crypto.validatePassword(`${password}x`, wrapped);
    const same = await crypto.wrappedMatchesLegacy(wrapped, legacy);
    if (!ok.isValid || ko.isValid || ok.format !== 'wrapped' || !same) {
      throw new Error(`canary failed for format ${format}`);
    }
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    },
  );
  await Promise.all(workers);
}

export async function wrapTarget(
  store: WrapStore,
  crypto: PasswordCryptoService,
  target: WrapTarget,
  options: WrapOptions,
): Promise<TargetReport> {
  const batchSize = options.batchSize ?? 500;
  const concurrency = options.concurrency ?? 4;
  const log = options.log ?? (() => undefined);
  const report: TargetReport = {
    table: target.table,
    before: await countFormats(store, target),
    after: null,
    scanned: 0,
    wrapped: emptyByFormat(),
    wouldWrap: emptyByFormat(),
    skippedUnknownFormat: 0,
    skippedChangedConcurrently: 0,
    failed: 0,
    failedIds: [],
  };
  log(`${target.table} before ${JSON.stringify(report.before)}`);

  const wrappedTotal = () =>
    report.wrapped.md5 + report.wrapped.sha1 + report.wrapped['md5-crypt'];
  let afterId: string | null = null;

  for (;;) {
    if (
      options.maxRowsPerTarget !== undefined &&
      wrappedTotal() >= options.maxRowsPerTarget
    ) {
      break;
    }
    const rows = await store.fetchCandidates(target, afterId, batchSize);
    if (rows.length === 0) break;
    afterId = rows[rows.length - 1].id;
    report.scanned += rows.length;

    const todo: Array<{
      row: HashRow & { hash: string };
      format: LegacyHashFormat;
    }> = [];
    for (const row of rows) {
      const format = crypto.detectLegacyFormat(row.hash);
      if (!format || row.hash === null) {
        report.skippedUnknownFormat++;
        continue;
      }
      report.wouldWrap[format]++;
      todo.push({ row: { id: row.id, hash: row.hash }, format });
    }

    if (options.apply) {
      const budget =
        options.maxRowsPerTarget === undefined
          ? todo.length
          : Math.max(0, options.maxRowsPerTarget - wrappedTotal());
      await mapWithConcurrency(
        todo.slice(0, budget),
        concurrency,
        async ({ row, format }) => {
          try {
            const wrapped = await crypto.wrapLegacyHash(row.hash);
            if (!(await crypto.wrappedMatchesLegacy(wrapped, row.hash))) {
              throw new Error(
                'wrapped value does not verify against legacy hash',
              );
            }
            const written = await store.replaceIfUnchanged(
              target,
              row.id,
              row.hash,
              wrapped,
            );
            if (written) {
              report.wrapped[format]++;
            } else {
              report.skippedChangedConcurrently++;
            }
          } catch (error) {
            report.failed++;
            if (report.failedIds.length < MAX_FAILED_IDS) {
              report.failedIds.push(row.id);
            }
            log(
              `${target.table} account ${row.id} failed: ${(error as Error).message}`,
            );
          }
        },
      );
    }
    log(
      `${target.table} progress scanned=${report.scanned} wrapped=${wrappedTotal()} ` +
        `failed=${report.failed} skippedChanged=${report.skippedChangedConcurrently}`,
    );
  }

  report.after = await countFormats(store, target);
  log(`${target.table} after ${JSON.stringify(report.after)}`);
  return report;
}

export async function runLegacyHashWrap(
  store: WrapStore,
  crypto: PasswordCryptoService,
  options: WrapOptions,
  targets: readonly WrapTarget[] = WRAP_TARGETS,
): Promise<TargetReport[]> {
  await runCanary(crypto);
  const reports: TargetReport[] = [];
  for (const target of targets) {
    reports.push(await wrapTarget(store, crypto, target, options));
  }
  return reports;
}
