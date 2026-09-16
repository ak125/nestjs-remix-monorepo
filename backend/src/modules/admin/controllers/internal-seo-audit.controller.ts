/**
 * Internal read-only SEO audit endpoints.
 * Protected by X-Internal-Key header (same guard as internal-pipeline).
 * NOT exposed through Caddy in prod (localhost only).
 *
 * R3 audit combines stored-section checks with one bounded served-page GET.
 * Coverage remains an inventory of work candidates.
 */

import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { ConseilQualityScorerService } from '../services/conseil-quality-scorer.service';
import {
  PACK_DEFINITIONS,
  type PackLevel,
} from '../../../config/conseil-pack.constants';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import { getEffectiveSupabaseKey } from '@common/utils';

interface GammeRow {
  pg_id: string | number;
  pg_alias: string;
  pg_name: string;
}

interface GapItem {
  pg_id: string;
  pg_alias: string;
  pg_name: string;
}

export interface SeoCoverageAudit {
  timestamp: string;
  gammes_total: number;
  /** All active gammes, including those already planned and populated. */
  r3_audit_candidates: GapItem[];
  /** Planning/content inventory cannot establish WIKI evidence. */
  wiki_evidence_status: 'not_evaluated';
  kp_r3_missing: GapItem[];
  kp_r3_missing_count: number;
  kp_r6_missing: GapItem[];
  kp_r6_missing_count: number;
  content_r3_missing: GapItem[];
  content_r3_missing_count: number;
  kw_missing: GapItem[];
  kw_missing_count: number;
  p1_count: number;
  p2_count: number;
}

@Controller('api/internal/seo')
@UseGuards(InternalApiKeyGuard)
export class InternalSeoAuditController {
  private readonly logger = new Logger(InternalSeoAuditController.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly qualityScorer: ConseilQualityScorerService,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key);
  }

  /** Stored + served R3 diagnosis; no plan write, enrichment dispatch or publication. */
  @Get('audit/r3/:pgId')
  async auditR3(
    @Param('pgId') pgId: string,
    @Query('pack') pack: string = 'standard',
  ) {
    const input = z
      .object({
        pgId: z
          .string()
          .regex(/^[1-9]\d*$/)
          .refine((value) => Number.isSafeInteger(Number(value))),
        pack: z.custom<PackLevel>(
          (value) =>
            typeof value === 'string' &&
            Object.prototype.hasOwnProperty.call(PACK_DEFINITIONS, value),
        ),
      })
      .safeParse({ pgId, pack });
    if (!input.success) throw new BadRequestException(input.error.issues);
    return {
      success: true,
      data: await this.qualityScorer.auditGamme(
        input.data.pgId,
        input.data.pack,
      ),
    };
  }

  /**
   * GET /api/internal/seo/audit/coverage
   * Returns SEO coverage gaps for IA-SEO Master heartbeat audit.
   * Called from AI-COS via HTTP with X-Internal-Key header.
   */
  @Get('audit/coverage')
  async coverage(): Promise<SeoCoverageAudit> {
    this.logger.log('GET /api/internal/seo/audit/coverage');

    const allGammes = await this.readCoverageRows<GammeRow>(
      'gammes',
      (from, to) =>
        this.supabase
          .from('pieces_gamme')
          .select('pg_id, pg_alias, pg_name', { count: 'exact' })
          .eq('pg_display', '1')
          .not('pg_alias', 'is', null)
          .neq('pg_alias', '')
          .order('pg_id', { ascending: true })
          .range(from, to),
    );
    const total = allGammes.length;

    const kpR3Rows = await this.readCoverageRows<{ skp_pg_alias: string }>(
      'plans R3',
      (from, to) =>
        this.supabase
          .from('__seo_r3_keyword_plan')
          .select('skp_pg_alias', { count: 'exact' })
          .eq('skp_status', 'validated')
          .order('skp_id', { ascending: true })
          .range(from, to),
    );
    const kpR3Set = new Set(kpR3Rows.map((row) => row.skp_pg_alias));
    const kpR6Rows = await this.readCoverageRows<{ r6kp_pg_alias: string }>(
      'plans R6',
      (from, to) =>
        this.supabase
          .from('__seo_r6_keyword_plan')
          .select('r6kp_pg_alias', { count: 'exact' })
          .eq('r6kp_status', 'validated')
          .order('r6kp_id', { ascending: true })
          .range(from, to),
    );
    const kpR6Set = new Set(kpR6Rows.map((row) => row.r6kp_pg_alias));

    // Presence means stored nonblank content, never an enrichment marker or WIKI qualification.
    const contentRows = await this.readCoverageRows<{
      sgc_pg_id: string;
      sgc_content: string | null;
    }>('contenus R3', (from, to) =>
      this.supabase
        .from('__seo_gamme_conseil')
        .select('sgc_pg_id, sgc_content', { count: 'exact' })
        .order('sgc_id', { ascending: true })
        .range(from, to),
    );
    const contentR3Set = new Set(
      contentRows
        .filter(
          (row) =>
            typeof row.sgc_content === 'string' &&
            row.sgc_content.trim().length > 0,
        )
        .map((row) => String(row.sgc_pg_id)),
    );

    const kwRows = await this.readCoverageRows<{ pg_id: number }>(
      'signaux de demande',
      (from, to) =>
        this.supabase
          .from('__seo_keywords')
          .select('pg_id', { count: 'exact' })
          .not('pg_id', 'is', null)
          .order('id', { ascending: true })
          .range(from, to),
    );
    const kwPgIdSet = new Set(kwRows.map((row) => String(row.pg_id)));

    const toGapItem = (g: GammeRow): GapItem => ({
      pg_id: String(g.pg_id),
      pg_alias: g.pg_alias,
      pg_name: g.pg_name,
    });

    // Compute gaps
    const kpR3Missing = allGammes
      .filter((g) => !kpR3Set.has(g.pg_alias))
      .map(toGapItem);
    const kpR6Missing = allGammes
      .filter((g) => !kpR6Set.has(g.pg_alias))
      .map(toGapItem);
    const contentR3Missing = allGammes
      .filter((g) => !contentR3Set.has(String(g.pg_id)))
      .map(toGapItem);
    // kw_missing = gammes sans données Google Ads dans __seo_keywords (informatif, non bloquant)
    const kwMissing = allGammes
      .filter((g) => !kwPgIdSet.has(String(g.pg_id)))
      .map(toGapItem);

    // Legacy counters retained for compatibility: planning gaps, never evidence verdicts.
    const p1Count = kpR3Missing.length;
    const p2Count = contentR3Missing.filter((g) =>
      kpR3Set.has(g.pg_alias),
    ).length;

    return {
      timestamp: new Date().toISOString(),
      gammes_total: total,
      r3_audit_candidates: allGammes.map(toGapItem),
      wiki_evidence_status: 'not_evaluated',
      kp_r3_missing: kpR3Missing,
      kp_r3_missing_count: kpR3Missing.length,
      kp_r6_missing: kpR6Missing,
      kp_r6_missing_count: kpR6Missing.length,
      content_r3_missing: contentR3Missing,
      content_r3_missing_count: contentR3Missing.length,
      kw_missing: kwMissing,
      kw_missing_count: kwMissing.length,
      p1_count: p1Count,
      p2_count: p2Count,
    } satisfies SeoCoverageAudit;
  }

  /** Shared by the five inventory reads; no silently capped or failed result becomes a gap. */
  private async readCoverageRows<T>(
    label: string,
    fetchPage: (
      from: number,
      to: number,
    ) => PromiseLike<{
      data: T[] | null;
      error: unknown;
      count: number | null;
    }>,
  ): Promise<T[]> {
    const pageSize = 500;
    const rows: T[] = [];
    let expectedTotal: number | null = null;
    for (;;) {
      const { data, error, count } = await fetchPage(
        rows.length,
        rows.length + pageSize - 1,
      );
      if (
        error ||
        !Array.isArray(data) ||
        count === null ||
        !Number.isSafeInteger(count) ||
        count < 0
      ) {
        throw new ServiceUnavailableException(
          `SEO coverage read failed: ${label}`,
        );
      }
      if (expectedTotal !== null && count !== expectedTotal) {
        throw new ServiceUnavailableException(
          `SEO coverage changed during read: ${label}`,
        );
      }
      expectedTotal = count;
      if (
        rows.length + data.length > count ||
        (data.length === 0 && rows.length < count)
      ) {
        throw new ServiceUnavailableException(
          `SEO coverage read incomplete: ${label}`,
        );
      }
      rows.push(...data);
      if (rows.length === count) return rows;
      // Continue by the actual returned size, even if the server cap is smaller than pageSize.
    }
  }
}
