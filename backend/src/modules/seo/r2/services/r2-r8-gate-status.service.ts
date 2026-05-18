/**
 * ADR-072 PR 2D-3 — R8 readiness gate status service.
 *
 * Reads `__seo_r8_snapshot_store` and `auto_type` counts + a small sample of
 * type_ids joined against the snapshot store, returning the canonical
 * readiness signal consumed by the admin UI and the CI gate
 * (`pr-2e-readiness-gate.yml`).
 *
 * Cache canon (mirrors `feedback_cache_observability_kpi_framework`) :
 *   - In-memory LRU with a tight 30s TTL — sufficient for ops dashboards and
 *     CI gates (the workflow only runs on PR events, never tight loops).
 *   - Process-local cache : multi-instance backend pods each warm
 *     independently. Acceptable because the underlying state changes slowly
 *     (seed runs ~once per deploy).
 *
 * Race safety :
 *   - Two parallel reads can both miss → both fetch. Acceptable (worst case
 *     2 SELECT count(*) calls / 30s). No coalescing layer added — would
 *     trade complexity for negligible gain.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import {
  R8GateStatus,
  R8GateSampleEntry,
} from '../schemas/r8-gate-status.schema';

const CACHE_TTL_SECONDS = 30;
const CACHE_KEY = 'r2:r8-gate-status:v1';
const SAMPLE_SIZE = 10;

interface CacheEntry {
  value: R8GateStatus;
  expiresAt: number;
}

@Injectable()
export class R2R8GateStatusService extends SupabaseBaseService {
  protected readonly logger = new Logger(R2R8GateStatusService.name);

  // Process-local cache. Multi-instance backend pods each warm independently.
  private readonly cache = new Map<string, CacheEntry>();

  async getStatus(forceFresh = false): Promise<R8GateStatus> {
    if (!forceFresh) {
      const cached = this.cache.get(CACHE_KEY);
      if (cached && cached.expiresAt > Date.now()) {
        return { ...cached.value, fromCache: true };
      }
    }

    const [snapshots, autoTypes, sample] = await Promise.all([
      this.countSnapshots(),
      this.countAutoTypes(),
      this.fetchSample(SAMPLE_SIZE),
    ]);

    const lag = snapshots - autoTypes;
    const lagPercent =
      autoTypes === 0 ? 0 : ((autoTypes - snapshots) / autoTypes) * 100;
    const pass = snapshots >= autoTypes && autoTypes > 0;
    const computedAt = new Date().toISOString();

    const status: R8GateStatus = {
      snapshots,
      autoTypes,
      pass,
      lag,
      lagPercent: Math.round(lagPercent * 100) / 100,
      sample,
      computedAt,
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      fromCache: false,
    };

    this.cache.set(CACHE_KEY, {
      value: status,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });

    return status;
  }

  /**
   * Force-invalidate the in-process cache. Hook for ops endpoint after a seed
   * run completes so the next read reflects truth immediately.
   */
  invalidate(): void {
    this.cache.delete(CACHE_KEY);
  }

  private async countSnapshots(): Promise<number> {
    const { count, error } = await this.supabase
      .from('__seo_r8_snapshot_store')
      .select('id', { count: 'exact', head: true });
    if (error) {
      this.logger.error(`countSnapshots failed: ${error.message}`);
      throw new Error(`r8_gate_count_snapshots_failed: ${error.message}`);
    }
    return count ?? 0;
  }

  private async countAutoTypes(): Promise<number> {
    const { count, error } = await this.supabase
      .from('auto_type')
      .select('type_id', { count: 'exact', head: true });
    if (error) {
      this.logger.error(`countAutoTypes failed: ${error.message}`);
      throw new Error(`r8_gate_count_auto_types_failed: ${error.message}`);
    }
    return count ?? 0;
  }

  private async fetchSample(limit: number): Promise<R8GateSampleEntry[]> {
    const { data, error } = await this.supabase
      .from('auto_type')
      .select('type_id')
      .order('type_id', { ascending: true })
      .limit(limit);
    if (error) {
      this.logger.warn(`fetchSample failed: ${error.message} — empty list`);
      return [];
    }
    const rows = (data ?? []) as { type_id: string }[];
    const typeIds = rows
      .map((row) => Number.parseInt(row.type_id, 10))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (typeIds.length === 0) {
      return [];
    }

    const { data: pagesData, error: pagesError } = await this.supabase
      .from('__seo_r8_pages')
      .select('type_id, current_snapshot_id')
      .in('type_id', typeIds);

    if (pagesError) {
      this.logger.warn(
        `fetchSample pages join failed: ${pagesError.message} — defaulting hasSnapshot=false`,
      );
    }

    const pageMap = new Map<number, number | null>();
    for (const row of (pagesData ?? []) as {
      type_id: number;
      current_snapshot_id: number | null;
    }[]) {
      pageMap.set(row.type_id, row.current_snapshot_id);
    }

    const snapshotIds = Array.from(pageMap.values()).filter(
      (id): id is number => typeof id === 'number',
    );

    const statusMap = new Map<number, R8GateSampleEntry['enrichmentStatus']>();
    if (snapshotIds.length > 0) {
      const { data: snapshotData, error: snapshotError } = await this.supabase
        .from('__seo_r8_snapshot_store')
        .select('id, type_id, enrichment_status')
        .in('id', snapshotIds);
      if (snapshotError) {
        this.logger.warn(
          `fetchSample snapshot join failed: ${snapshotError.message}`,
        );
      }
      for (const row of (snapshotData ?? []) as {
        type_id: number;
        enrichment_status: R8GateSampleEntry['enrichmentStatus'];
      }[]) {
        statusMap.set(row.type_id, row.enrichment_status);
      }
    }

    return typeIds.map((typeId): R8GateSampleEntry => {
      const currentSnapshotId = pageMap.get(typeId);
      return {
        typeId,
        hasSnapshot:
          typeof currentSnapshotId === 'number' && currentSnapshotId > 0,
        enrichmentStatus: statusMap.get(typeId) ?? null,
      };
    });
  }
}
