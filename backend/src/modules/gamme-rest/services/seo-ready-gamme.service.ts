// @role-purity-skip — ce service de plomberie référence R1 (hub gamme) dans sa
// doc technique ; ce n'est pas du contenu R-role généré (cf. check-role-purity).
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';

/**
 * SEO-readiness signal for the ADDITIVE R1 keyword promotion (owner 2026-06-10).
 *
 * A gamme is "SEO-ready" when it has prepared keyword research, measured as
 * `>= SEO_R1_KW_MIN` rows in `__seo_keywords` (existence/count only — NEVER the
 * keyword VALUES, whose gamme mapping is contaminated). Used to PROMOTE a
 * currently-noindex gamme hub to `index, follow`:
 *
 *     indexable = (pg_level='1')  OR  seoReady(gamme)
 *
 * Promotion only — it never demotes an already-indexed gamme. Gated by
 * `SEO_R1_KW_PROMOTE_ENABLED` (default OFF → inert, no DB call). As the owner
 * injects kw for new families, those gammes auto-become eligible (data-driven).
 *
 * The ready-set is loaded once via the read-only `rpc_seo_ready_gammes` RPC
 * (avoids the supabase-js 1000-row cap) and cached in-process. On any failure
 * the set is `null` → `isSeoReady` returns false → legacy behaviour (fail-safe).
 */
@Injectable()
export class SeoReadyGammeService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoReadyGammeService.name);

  private static readonly DEFAULT_MIN_KW = 50;
  private static readonly TTL_MS = 30 * 60 * 1000; // 30 min — set is very stable

  private cache: { ids: Set<number>; at: number } | null = null;
  private inflight: Promise<Set<number> | null> | null = null;

  /** Additive R1 kw-promotion enabled? `SEO_R1_KW_PROMOTE_ENABLED=true`. Default OFF. */
  isPromoteEnabled(): boolean {
    return process.env.SEO_R1_KW_PROMOTE_ENABLED === 'true';
  }

  /** Minimum prepared kw rows to consider a gamme SEO-ready (filters contaminated noise). */
  private minKw(): number {
    const n = Number.parseInt(process.env.SEO_R1_KW_MIN ?? '', 10);
    return Number.isInteger(n) && n > 0
      ? n
      : SeoReadyGammeService.DEFAULT_MIN_KW;
  }

  /** True if the gamme has prepared keyword research (>= threshold). Fail-safe `false`. */
  async isSeoReady(pgId: number): Promise<boolean> {
    if (!Number.isInteger(pgId) || pgId <= 0) return false;
    const ids = await this.loadReadySet();
    return ids ? ids.has(pgId) : false;
  }

  /** Test-only: clear the in-process cache. */
  resetCache(): void {
    this.cache = null;
    this.inflight = null;
  }

  private async loadReadySet(
    now: number = Date.now(),
  ): Promise<Set<number> | null> {
    if (this.cache && now - this.cache.at < SeoReadyGammeService.TTL_MS) {
      return this.cache.ids;
    }
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      try {
        // callRpc (not direct .rpc) — RPC Safety Gate + circuit breaker.
        const { data, error } = await this.callRpc<Array<{ pg_id: number }>>(
          'rpc_seo_ready_gammes',
          { p_min_kw: this.minKw() },
        );
        if (error) throw new Error(error.message);
        const ids = new Set<number>();
        for (const row of data ?? []) {
          if (typeof row.pg_id === 'number') ids.add(row.pg_id);
        }
        this.cache = { ids, at: now };
        return ids;
      } catch (e) {
        this.logger.error(
          `seo-ready set load failed — R1 kw-promotion inert this call: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        return null;
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }
}
