import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { KeywordDensityGateService } from '../services/keyword-density-gate.service';

// Expected overlaps (source of truth: scripts/seo/expected-overlaps.json)
const EXPECTED_OVERLAPS = [
  { gamme_a: 'disque-de-frein', gamme_b: 'plaquette-de-frein' },
];

@Controller('api/admin/keyword-clusters')
@UseGuards(IsAdminGuard)
export class AdminKeywordClustersController {
  private readonly logger = new Logger(AdminKeywordClustersController.name);
  private readonly supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(url!, key!);
  }

  /**
   * GET /api/admin/keyword-clusters
   * List all keyword clusters with stats + overlap_flags + is_expected.
   */
  @Get()
  async list() {
    this.logger.log('GET /api/admin/keyword-clusters');

    const { data, error } = await this.supabase
      .from('__seo_keyword_cluster')
      .select(
        'id, pg_id, pg_alias, primary_keyword, primary_volume, primary_intent, keyword_variants, overlap_flags, role_keywords, built_at',
      )
      .order('pg_alias');

    if (error) {
      return {
        success: false,
        data: [],
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }

    const clusters = (data ?? []).map((c: Record<string, unknown>) => {
      const pgAlias = c.pg_alias as string;
      const rawFlags = Array.isArray(c.overlap_flags) ? c.overlap_flags : [];

      // Tag is_expected on each overlap flag
      const taggedFlags = rawFlags.map((f: Record<string, unknown>) => ({
        ...f,
        is_expected: EXPECTED_OVERLAPS.some(
          (e) =>
            (e.gamme_a === pgAlias &&
              e.gamme_b === (f.overlapping_gamme as string)) ||
            (e.gamme_b === pgAlias &&
              e.gamme_a === (f.overlapping_gamme as string)),
        ),
      }));

      return {
        id: c.id,
        pg_id: c.pg_id,
        pg_alias: pgAlias,
        primary_keyword: c.primary_keyword,
        primary_volume: c.primary_volume,
        primary_intent: c.primary_intent,
        variant_count: Array.isArray(c.keyword_variants)
          ? (c.keyword_variants as unknown[]).length
          : 0,
        role_count: c.role_keywords
          ? Object.keys(c.role_keywords as Record<string, unknown>).length
          : 0,
        overlap_count: taggedFlags.length,
        overlap_flags: taggedFlags,
        role_keywords: c.role_keywords,
        built_at: c.built_at,
      };
    });

    return {
      success: true,
      data: clusters,
      total: clusters.length,
      message: `${clusters.length} clusters`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/admin/keyword-clusters/stats
   * Global stats: total clusters, overlaps by severity.
   */
  @Get('stats')
  async stats() {
    this.logger.log('GET /api/admin/keyword-clusters/stats');

    const { data, error } = await this.supabase
      .from('__seo_keyword_cluster')
      .select('id, pg_alias, overlap_flags, primary_volume, keyword_variants');

    if (error) {
      return {
        success: false,
        data: null,
        message: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }

    const rows = data ?? [];
    let overlapHigh = 0;
    let overlapMedium = 0;
    let overlapLow = 0;
    let withOverlaps = 0;
    let totalVariants = 0;

    for (const row of rows) {
      const flags = Array.isArray(row.overlap_flags) ? row.overlap_flags : [];
      if (flags.length > 0) withOverlaps++;
      for (const f of flags) {
        const sev = (f as Record<string, unknown>).severity;
        if (sev === 'high') overlapHigh++;
        else if (sev === 'medium') overlapMedium++;
        else overlapLow++;
      }
      totalVariants += Array.isArray(row.keyword_variants)
        ? row.keyword_variants.length
        : 0;
    }

    return {
      success: true,
      data: {
        total_clusters: rows.length,
        total_variants: totalVariants,
        with_overlaps: withOverlaps,
        overlap_high: overlapHigh,
        overlap_medium: overlapMedium,
        overlap_low: overlapLow,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /api/admin/keyword-clusters/density-rules
   * Current density gate configuration/thresholds.
   */
  @Get('density-rules')
  getDensityRules() {
    return {
      success: true,
      data: KeywordDensityGateService.getRulesMetadata(),
      timestamp: new Date().toISOString(),
    };
  }
}
