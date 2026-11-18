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
 * Sortie : {"read_at": ISO, "indicators": {<kpi_input id>: Reading}}
 *   Reading = {producer, status, value, certified, window_days}
 *           | {producer, unmeasured: "<raison>"}
 * `value` reste interne : le rapport, publié sur un dépôt public, ne la publie pas.
 */
import { writeFileSync } from 'node:fs';
import { ConfigService } from '@nestjs/config';
import { CommandCenterKpiService } from '../../backend/src/modules/admin/services/command-center-kpi.service';
import { TrackingIntegrityService } from '../../backend/src/modules/analytics/tracking-integrity/tracking-integrity.service';

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

/** Nom de l'erreur seulement : un message brut peut citer une URL ou une clé. */
const failure = (e: unknown): string =>
  `lecture du producteur en échec (${e instanceof Error ? e.name : typeof e})`;

/** sales.payments-kept : verdict de toPaymentsKeptKpi, via computeLiveKpis('full'). */
async function cancelledAfterPayment(now: Date): Promise<Reading> {
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
    return { producer: KPI_PRODUCER, unmeasured: failure(e) };
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
    console.error(`registry-threshold-read : ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  },
);
