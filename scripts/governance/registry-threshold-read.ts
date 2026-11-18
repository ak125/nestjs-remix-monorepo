/**
 * registry-threshold-read.ts — lit les indicateurs des seuils évaluables du
 * registre (mandat BZ, décision 9) pour le rapport du matin.
 *
 * Une entrée par `kpi_input` qu'un seuil `threshold.eval` lit : la valeur vient
 * du producteur cité dans le registre (`kpi_input.producer`), par sa méthode
 * publique, sans réécrire sa règle. Lecture impossible ⇒ `unmeasured` + raison,
 * jamais zéro.
 *
 * Usage (depuis backend/, pour ses décorateurs et ses paquets) :
 *   ../node_modules/.bin/tsx ../scripts/governance/registry-threshold-read.ts <sortie.json>
 * Env : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, lus par le producteur, jamais
 * écrits dans la sortie. La sortie est un fichier : les journaux du producteur
 * vont sur stdout.
 *
 * Le producteur est chargé dans le `try` de son indicateur (import dynamique) :
 * un paquet interne non construit (`@repo/*` sans `dist/`, cas d'un
 * `npm ci --ignore-scripts` seul) donne `unmeasured` + raison, pas une sortie
 * en erreur. Les paquets se construisent par
 * `npx turbo run build --filter='@fafa/backend^...' --filter='!@fafa/frontend'`.
 *
 * Sortie : {"read_at": ISO, "indicators": {<kpi_input id>: Reading}}
 *   Reading = {producer, status, value, certified, window_days}
 *           | {producer, unmeasured: "<raison>"}
 * `value` reste interne : le rapport, publié sur un dépôt public, ne la publie pas.
 */
import { writeFileSync } from 'node:fs';

const KPI_PRODUCER =
  'backend/src/modules/admin/services/command-center-kpi.service.ts';

export type Reading =
  | {
      producer: string;
      status: 'OK' | 'WARNING' | 'CRITICAL';
      value: number | null;
      certified: boolean;
      window_days: number;
    }
  | { producer: string; unmeasured: string };

/**
 * Raison sûre d'une erreur : nom, code système (`MODULE_NOT_FOUND`…) et, pour un
 * module introuvable, le seul nom du paquet. Jamais le message brut : il peut
 * citer une URL, une clé ou un chemin.
 */
export function safeReason(e: unknown): string {
  if (!(e instanceof Error)) return typeof e;
  const parts = [/^[A-Za-z]{1,40}$/.test(e.name) ? e.name : 'Error'];
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,40}$/.test(code)) parts.push(code);
  if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
    const pkg = /node_modules\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)/i.exec(e.message);
    if (pkg) parts.push(pkg[1]);
  }
  return parts.join(' ');
}

const failure = (step: string, e: unknown): string =>
  `${step} du producteur en échec (${safeReason(e)})`;

/** sales.payments-kept : verdict de toPaymentsKeptKpi, via computeLiveKpis('full'). */
async function cancelledAfterPayment(now: Date): Promise<Reading> {
  let mods;
  try {
    mods = await Promise.all([
      import('@nestjs/config'),
      import('../../backend/src/modules/admin/services/command-center-kpi.service'),
      import('../../backend/src/modules/analytics/tracking-integrity/tracking-integrity.service'),
    ]);
  } catch (e) {
    return { producer: KPI_PRODUCER, unmeasured: failure('chargement', e) };
  }
  const [{ ConfigService }, { CommandCenterKpiService }, { TrackingIntegrityService }] = mods;
  try {
    const config = new ConfigService();
    const kpis = new CommandCenterKpiService(
      config,
      new TrackingIntegrityService(config),
    );
    const m = (await kpis.computeLiveKpis('full', now)).find(
      (x) => x.kpi.id === 'payments_kept',
    );
    if (!m) {
      return { producer: KPI_PRODUCER, unmeasured: 'indicateur payments_kept absent de la réponse du producteur' };
    }
    if (m.kpi.status === 'UNKNOWN') {
      return { producer: KPI_PRODUCER, unmeasured: 'le producteur répond UNKNOWN (lecture des commandes impossible ou incomplète)' };
    }
    return {
      producer: KPI_PRODUCER,
      status: m.kpi.status,
      value: m.kpi.value,
      certified: m.kpi.certified,
      window_days: m.window_days,
    };
  } catch (e) {
    return { producer: KPI_PRODUCER, unmeasured: failure('lecture', e) };
  }
}

async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out) throw new Error('usage : registry-threshold-read.ts <sortie.json>');
  const now = new Date();
  const indicators: Record<string, Reading> = {
    cancelled_after_payment: await cancelledAfterPayment(now),
  };
  writeFileSync(out, JSON.stringify({ read_at: now.toISOString(), indicators }));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`registry-threshold-read : échec (${safeReason(e)})`);
    process.exit(1);
  },
);
