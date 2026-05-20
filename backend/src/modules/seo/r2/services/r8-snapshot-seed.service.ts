/**
 * ADR-072 PR 2D-2 — R8 snapshot seed job (idempotent batch).
 *
 * Walks `auto_type` once and ensures `__seo_r8_snapshot_store` has at least a
 * `minimal` row for every `type_id` (gate SQL `snapshots >= auto_types` canon
 * MEMORY project-r2-v2-canon-sequence-202605).
 *
 * Resumable & idempotent : relies on `__seo_r8_snapshot_store.version_sha`
 * UNIQUE constraint — re-running the seed never duplicates rows. Optionally
 * the job can be invoked with a `sinceTypeId` cursor to restart from a known
 * point after a crash.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import { R8ParentEnrichmentService } from './r8-parent-enrichment.service';

export interface SeedRunOptions {
  batchSize?: number;
  sinceTypeId?: number; // inclusive lower bound for resume
  maxBatches?: number; // safety cap (default unlimited)
  dryRun?: boolean; // count only, no writes
}

export interface SeedRunReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalScanned: number;
  totalSeeded: number;
  totalAlreadyPresent: number;
  totalSkipped: number;
  totalFailed: number;
  lastTypeIdProcessed: number | null;
  dryRun: boolean;
}

const DEFAULT_BATCH_SIZE = 200;

@Injectable()
export class R8SnapshotSeedService extends SupabaseBaseService {
  protected readonly logger = new Logger(R8SnapshotSeedService.name);

  constructor(private readonly enrichment: R8ParentEnrichmentService) {
    super();
  }

  async run(options: SeedRunOptions = {}): Promise<SeedRunReport> {
    const startedAtMs = Date.now();
    const startedAt = new Date(startedAtMs).toISOString();
    const batchSize = Math.max(1, options.batchSize ?? DEFAULT_BATCH_SIZE);
    const dryRun = options.dryRun === true;

    let cursor = Math.max(0, options.sinceTypeId ?? 0);
    let totalScanned = 0;
    let totalSeeded = 0;
    let totalAlreadyPresent = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let lastTypeIdProcessed: number | null = null;
    let batchesRun = 0;

    this.logger.log(
      `R8 seed run start — batchSize=${batchSize}, sinceTypeId=${cursor}, dryRun=${dryRun}`,
    );

    while (true) {
      if (
        options.maxBatches !== undefined &&
        batchesRun >= options.maxBatches
      ) {
        this.logger.log(
          `R8 seed reached maxBatches=${options.maxBatches}, stopping`,
        );
        break;
      }
      const batch = await this.fetchBatch(cursor, batchSize);
      if (batch.length === 0) {
        break;
      }
      batchesRun += 1;

      for (const typeIdStr of batch) {
        const typeId = Number.parseInt(typeIdStr, 10);
        if (!Number.isFinite(typeId) || typeId <= 0) {
          totalSkipped += 1;
          continue;
        }
        totalScanned += 1;
        lastTypeIdProcessed = typeId;
        cursor = typeId + 1;

        if (dryRun) {
          continue;
        }

        try {
          const outcome = await this.enrichment.enrichTypeId(typeId, 'seed');
          if (!outcome) {
            totalSkipped += 1;
            continue;
          }
          if (outcome.inserted) {
            totalSeeded += 1;
          } else {
            totalAlreadyPresent += 1;
          }
        } catch (e) {
          totalFailed += 1;
          this.logger.warn(
            `seed typeId=${typeId} failed (continuing): ${(e as Error).message}`,
          );
        }
      }

      // Soft yield — let other I/O proceed between batches.
      await new Promise((resolve) => setImmediate(resolve));
    }

    const finishedAtMs = Date.now();
    const report: SeedRunReport = {
      startedAt,
      finishedAt: new Date(finishedAtMs).toISOString(),
      durationMs: finishedAtMs - startedAtMs,
      totalScanned,
      totalSeeded,
      totalAlreadyPresent,
      totalSkipped,
      totalFailed,
      lastTypeIdProcessed,
      dryRun,
    };

    this.logger.log(
      `R8 seed done — scanned=${totalScanned} seeded=${totalSeeded} already=${totalAlreadyPresent} skipped=${totalSkipped} failed=${totalFailed} duration=${report.durationMs}ms`,
    );

    return report;
  }

  private async fetchBatch(cursor: number, limit: number): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('auto_type')
      .select('type_id')
      .gte('type_id', String(cursor))
      .order('type_id', { ascending: true })
      .limit(limit);

    if (error) {
      this.logger.error(
        `fetchBatch(cursor=${cursor}) failed: ${error.message}`,
      );
      throw new Error(`seed_fetch_batch_failed: ${error.message}`);
    }
    return (data ?? []).map((row) => String(row.type_id));
  }
}
