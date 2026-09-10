/**
 * Rattrapage GSC / GA4 borné — point d'entrée ops, PLAN SEUL PAR DÉFAUT.
 *
 * Réutilise les fetchers du job quotidien (même planificateur, même contrat
 * d'un jour, même marqueur de commit) sur une plage explicite. N'amorce PAS
 * `WorkerModule` : son scheduler supprime/réenregistre les jobs répétables sur
 * le Redis partagé et le process consommerait les files. Seuls les 4 providers
 * nécessaires sont instanciés.
 *
 * Idempotent : une plage déjà commitée re-planifie 0 date.
 * Sans `--apply` : GSC = 1 lecture DB + 1 sonde API ; GA4 = lectures de présence ;
 * AUCUNE écriture (ni données ni `__seo_event_log`).
 *
 * Exécution (depuis backend/, code COMPILÉ) :
 *   node dist/modules/seo-monitoring/cli/run-ingestion-backfill.js --source gsc --from 2026-08-01 --to 2026-08-31
 *   # GO owner explicite uniquement :
 *   node dist/modules/seo-monitoring/cli/run-ingestion-backfill.js --source gsc --from 2026-08-01 --to 2026-08-31 --apply
 *
 * Sorties : `SEO_INGEST_BACKFILL_SUMMARY {json}` ; code 0 = OK, 1 = jours en
 * échec, 2 = refus/skip.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { GoogleCredentialsService } from '../services/google-credentials.service';
import { SeoMonitoringRunsService } from '../services/seo-monitoring-runs.service';
import { GscDailyFetcherService } from '../services/gsc-daily-fetcher.service';
import { Ga4DailyFetcherService } from '../services/ga4-daily-fetcher.service';
import { resolveIngestionConfig } from '../services/ingestion-date-planner';
import { parseBackfillArgs } from './run-ingestion-backfill.args';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      expandVariables: true,
    }),
  ],
  providers: [
    GoogleCredentialsService,
    SeoMonitoringRunsService,
    GscDailyFetcherService,
    Ga4DailyFetcherService,
  ],
})
class IngestionBackfillCliModule {}

/* eslint-disable no-console */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    IngestionBackfillCliModule,
    { logger: ['error', 'warn', 'log'] },
  );
  const get = (k: string) => process.env[k];
  const parsed = parseBackfillArgs(process.argv.slice(2), {
    todayUtc: new Date().toISOString().slice(0, 10),
    env: process.env,
    floors: {
      gsc: resolveIngestionConfig('gsc', get).config.floorDate,
      ga4: resolveIngestionConfig('ga4', get).config.floorDate,
    },
  });
  if ('refusal' in parsed) {
    console.error(`SEO_INGEST_BACKFILL_REFUSED ${parsed.refusal}`);
    await app.close();
    process.exit(2);
  }
  const { source, from, to, apply, rangeDays } = parsed.args;
  const common = {
    rollingDays: 0,
    lookbackDays: rangeDays,
    maxBackfillDays: rangeDays,
    floorDate: from,
    dryRun: !apply,
    planOnly: !apply,
    triggeredBy: 'cli' as const,
  };

  const result =
    source === 'gsc'
      ? await app
          .get(GscDailyFetcherService)
          .fetchAndPersistMultiGrain({ date: to, ...common })
      : await app
          .get(Ga4DailyFetcherService)
          .fetchAndPersistWindow({ anchorDate: to, ...common });

  console.log(
    'SEO_INGEST_BACKFILL_SUMMARY ' +
      JSON.stringify({
        source,
        from,
        to,
        apply,
        runId: result.runId,
        warnings: result.warnings,
        rowsInserted: result.rowsInserted,
        apiCalls: result.apiCalls,
        dates: result.dates,
      }),
  );
  const skipped = result.warnings.some(
    (w) => w === 'monitoring_disabled' || w === 'credentials_missing',
  );
  const failed = (result.dates?.failed.length ?? 0) > 0;
  await app.close();
  process.exit(skipped ? 2 : failed ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `SEO_INGEST_BACKFILL_FAILED ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
}
