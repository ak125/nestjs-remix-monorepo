/**
 * ADR-072 §3 — R8 Snapshot Reader Service
 *
 * R2-facing read service pour R8 Vehicle Domain (canon Round 8 §1 CQRS read-side
 * + §2 DDD bounded contexts).
 *
 * Garanties canon :
 *   - Lecture PERSISTED ONLY : query `__seo_r8_snapshot_store` JOIN
 *     `__seo_r8_pages.current_snapshot_id`. JAMAIS d'attente live R8 enrichment.
 *   - Cache Redis L1 TTL 1h (key `r8:snapshot:{typeId}`), invalidation sur write
 *     nouveau snapshot via outbox event `R8SnapshotUpdated`.
 *   - Si absent → retourne `{found: false, reason: 'r8_snapshot_unavailable'}`,
 *     caller (R2DataLoaderService) décide : verdict review_required + enqueue
 *     async `r8-enrichment` (non-blocking).
 *
 * Cf canon `feedback_no_bricolage_no_alt_port_repro` + `feedback_check_secret_propagation`.
 * Read-only service — pas de write, pas de side-effect, idempotent.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../../database/services/supabase-base.service';
import {
  R8SnapshotReadResult,
  R8SnapshotRowSchema,
  R8SnapshotRow,
} from '../schemas/r8-snapshot.schema';

/**
 * Minimal Redis-like cache contract (avoids hard dep on a specific Redis client).
 * Real wire-up via R2V2Module Redis provider (PR 2D-2 ou PR 2E) — pour PR 2D
 * foundation, le cache est optional (fallback no-cache si null).
 */
export interface R8SnapshotCacheClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, ttlSeconds: number, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

export const R8_SNAPSHOT_CACHE_TOKEN = Symbol('R8_SNAPSHOT_CACHE_TOKEN');

@Injectable()
export class R8SnapshotReaderService extends SupabaseBaseService {
  protected readonly logger = new Logger(R8SnapshotReaderService.name);

  static readonly CACHE_TTL_SECONDS = 3600; // 1h

  constructor(
    @Optional() configService?: ConfigService,
    @Optional()
    @Inject(R8_SNAPSHOT_CACHE_TOKEN)
    private readonly cache?: R8SnapshotCacheClient | null,
  ) {
    super(configService);
  }

  /**
   * Lit le snapshot R8 courant (persisted) pour un type_id.
   *
   * Flow :
   *   1. Redis L1 cache check (key `r8:snapshot:{typeId}`)
   *   2. SQL JOIN `__seo_r8_pages.current_snapshot_id → __seo_r8_snapshot_store`
   *   3. Si snapshot.status='failed' → `{found: false, reason: 'r8_enrichment_failed'}`
   *   4. Sinon return `{found: true, snapshot: ...}`
   *   5. Si pas de current_snapshot_id → `{found: false, reason: 'r8_snapshot_unavailable'}`
   *
   * Pure read. JAMAIS d'attente live (canon ADR-072 §3).
   */
  async getLatestSnapshot(typeId: number): Promise<R8SnapshotReadResult> {
    if (!Number.isInteger(typeId) || typeId <= 0) {
      throw new Error(`Invalid typeId: ${typeId}`);
    }

    // 1. Cache lookup (best-effort, never throws)
    const cacheKey = this.cacheKeyFor(typeId);
    const cached = await this.tryCacheGet(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. SQL query : JOIN __seo_r8_pages.current_snapshot_id
    const { data, error } = await this.supabase
      .from('__seo_r8_pages')
      .select(
        `
        type_id,
        current_snapshot_id,
        snapshot:__seo_r8_snapshot_store!current_snapshot_id (
          id,
          type_id,
          version_sha,
          disambiguation_signature,
          enrichment_status,
          source_lineage,
          created_at
        )
      `,
      )
      .eq('type_id', typeId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `getLatestSnapshot(${typeId}) SQL error: ${error.message}`,
      );
      // Defensive : treat SQL errors as unavailable to allow caller to gracefully
      // degrade (review_required + enqueue async retry).
      return {
        found: false,
        reason: 'r8_snapshot_unavailable',
      };
    }

    if (!data || !data.current_snapshot_id || !data.snapshot) {
      const result: R8SnapshotReadResult = {
        found: false,
        reason: 'r8_snapshot_unavailable',
      };
      await this.tryCacheSet(cacheKey, result);
      return result;
    }

    // 3. Parse + validate row via Zod
    const rawSnapshot = Array.isArray(data.snapshot)
      ? data.snapshot[0]
      : data.snapshot;
    const parsed = R8SnapshotRowSchema.safeParse({
      id: rawSnapshot.id,
      typeId: rawSnapshot.type_id,
      versionSha: rawSnapshot.version_sha,
      disambiguationSignature: rawSnapshot.disambiguation_signature,
      enrichmentStatus: rawSnapshot.enrichment_status,
      sourceLineage: rawSnapshot.source_lineage,
      createdAt: rawSnapshot.created_at,
    });
    if (!parsed.success) {
      this.logger.error(
        `getLatestSnapshot(${typeId}) Zod parse failed: ${parsed.error.message}`,
      );
      return {
        found: false,
        reason: 'r8_snapshot_unavailable',
      };
    }

    const snapshot: R8SnapshotRow = parsed.data;

    // 4. Status 'failed' = R2 retourne review_required reason r8_enrichment_failed
    if (snapshot.enrichmentStatus === 'failed') {
      const result: R8SnapshotReadResult = {
        found: false,
        reason: 'r8_enrichment_failed',
      };
      await this.tryCacheSet(cacheKey, result);
      return result;
    }

    // 5. Success
    const result: R8SnapshotReadResult = {
      found: true,
      snapshot,
    };
    await this.tryCacheSet(cacheKey, result);
    return result;
  }

  /**
   * Invalide cache pour un typeId. Appelé par OutboxRelayService quand un
   * event `R8SnapshotUpdated` est consommé (PR 2D-2). PR 2D foundation expose
   * la méthode mais n'a pas encore de hook outbox.
   */
  async invalidateCache(typeId: number): Promise<void> {
    if (!this.cache) {
      return;
    }
    try {
      await this.cache.del(this.cacheKeyFor(typeId));
    } catch (e) {
      this.logger.warn(
        `invalidateCache(${typeId}) cache.del failed: ${(e as Error).message}`,
      );
    }
  }

  private cacheKeyFor(typeId: number): string {
    return `r8:snapshot:${typeId}`;
  }

  private async tryCacheGet(
    key: string,
  ): Promise<R8SnapshotReadResult | null> {
    if (!this.cache) {
      return null;
    }
    try {
      const raw = await this.cache.get(key);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as R8SnapshotReadResult;
      return parsed;
    } catch (e) {
      this.logger.warn(
        `cache.get(${key}) failed: ${(e as Error).message} — fallback DB`,
      );
      return null;
    }
  }

  private async tryCacheSet(
    key: string,
    value: R8SnapshotReadResult,
  ): Promise<void> {
    if (!this.cache) {
      return;
    }
    try {
      await this.cache.setEx(
        key,
        R8SnapshotReaderService.CACHE_TTL_SECONDS,
        JSON.stringify(value),
      );
    } catch (e) {
      this.logger.warn(
        `cache.setEx(${key}) failed: ${(e as Error).message} — non-fatal`,
      );
    }
  }
}
