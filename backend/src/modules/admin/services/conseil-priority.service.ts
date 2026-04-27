/**
 * ConseilPriorityService — Ranks gammes by processing priority for conseil enrichment.
 * Priority = gap_penalty × 50 + volume × 30 + rag_readiness × 20
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';
import {
  type PackLevel,
  PACK_DEFINITIONS,
} from '../../../config/conseil-pack.constants';

// ── Result types ─────────────────────────────────────────

export interface PriorityQueueItem {
  pgId: number;
  pgAlias: string;
  pgName: string;
  volume: number;
  existingSections: number;
  existingTypes: string[];
  missingSections: string[];
  standardCoverage: number;
  recentFails: number;
  priorityScore: number;
}

@Injectable()
export class ConseilPriorityService extends SupabaseBaseService {
  private readonly log = new Logger(ConseilPriorityService.name);

  /**
   * Return gammes ranked by priority for conseil enrichment.
   */
  async getPriorityQueue(
    targetPack: PackLevel = 'standard',
    limit = 50,
  ): Promise<PriorityQueueItem[]> {
    const pack = PACK_DEFINITIONS[targetPack];
    const requiredSections = pack.requiredSections;

    // Single query via the coverage view + keyword volume
    const { data, error } = await this.client.rpc(
      'get_conseil_priority_queue',
      {
        p_limit: limit,
      },
    );

    // If RPC doesn't exist yet, fallback to raw query via view
    if (error) {
      this.log.warn(
        `RPC get_conseil_priority_queue not found, using view fallback: ${error.message}`,
      );
      return this.getPriorityQueueFallback(requiredSections, limit);
    }

    return (data || []).map((row: Record<string, unknown>) =>
      this.mapRow(row, requiredSections),
    );
  }

  /**
   * Return the next batch of N gammes ready for processing.
   * Filters: has existing sections or purchase guide, not recently failed.
   */
  async getNextBatch(
    targetPack: PackLevel = 'standard',
    batchSize = 10,
  ): Promise<PriorityQueueItem[]> {
    const queue = await this.getPriorityQueue(targetPack, batchSize);
    return queue.filter((item) => item.recentFails < 3);
  }

  // ── Fallback using view ──────────────────────────────────

  private async getPriorityQueueFallback(
    requiredSections: string[],
    limit: number,
  ): Promise<PriorityQueueItem[]> {
    // Get all gammes from purchase guide (active gammes)
    const { data: gammes, error: gammeError } = await this.client
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id')
      .limit(500);

    if (gammeError || !gammes) {
      this.log.error(`Error loading active gammes: ${gammeError?.message}`);
      return [];
    }

    const activePgIds = gammes.map((g: { sgpg_pg_id: string }) => g.sgpg_pg_id);

    // Get coverage data from the view
    const { data: coverage, error: covError } = await this.client
      .from('v_conseil_pack_coverage')
      .select(
        'pg_id, pg_alias, pg_name, section_types, section_count, standard_coverage',
      )
      .in('pg_id', activePgIds);

    if (covError) {
      this.log.error(`Error loading coverage: ${covError.message}`);
      return [];
    }

    // Build a set of pgIds that have coverage data
    const coveredPgIds = new Set(
      (coverage || []).map((c: { pg_id: string }) => c.pg_id),
    );

    // Gammes with ZERO counsel — highest priority
    const zeroCoverageGammes: PriorityQueueItem[] = [];
    for (const pgId of activePgIds) {
      if (!coveredPgIds.has(pgId)) {
        // Get gamme details
        const { data: pg } = await this.client
          .from('pieces_gamme')
          .select('pg_id, pg_alias, pg_name')
          .eq('pg_id', parseInt(pgId, 10))
          .single();

        if (pg) {
          zeroCoverageGammes.push({
            pgId: pg.pg_id,
            pgAlias: pg.pg_alias || String(pg.pg_id),
            pgName: pg.pg_name || '',
            volume: 0,
            existingSections: 0,
            existingTypes: [],
            missingSections: requiredSections,
            standardCoverage: 0,
            recentFails: 0,
            priorityScore: 100,
          });
        }
      }
    }

    // Gammes with partial coverage — sorted by gap
    const partialGammes: PriorityQueueItem[] = (coverage || [])
      .map((row: Record<string, unknown>) => this.mapRow(row, requiredSections))
      .filter((item: PriorityQueueItem) => item.missingSections.length > 0)
      .sort(
        (a: PriorityQueueItem, b: PriorityQueueItem) =>
          b.priorityScore - a.priorityScore,
      );

    return [...zeroCoverageGammes, ...partialGammes].slice(0, limit);
  }

  // ── Mapping ──────────────────────────────────────────────

  private mapRow(
    row: Record<string, unknown>,
    requiredSections: string[],
  ): PriorityQueueItem {
    const existingTypes = (row.section_types as string[]) || [];
    const missingSections = requiredSections.filter(
      (t) => !existingTypes.includes(t),
    );

    const gapPenalty = missingSections.length / requiredSections.length;
    const volume = Number(row.volume || 0);
    const maxVolume = 10000;
    const volumeNorm = Math.min(volume / maxVolume, 1);

    const priorityScore = Math.round(gapPenalty * 50 + volumeNorm * 30 + 20);

    return {
      pgId: Number(row.pg_id || row.pgId || 0),
      pgAlias: String(row.pg_alias || row.pgAlias || ''),
      pgName: String(row.pg_name || row.pgName || ''),
      volume,
      existingSections: Number(row.section_count || 0),
      existingTypes,
      missingSections,
      standardCoverage: Number(row.standard_coverage || 0),
      recentFails: Number(row.recent_fails || 0),
      priorityScore,
    };
  }
}
