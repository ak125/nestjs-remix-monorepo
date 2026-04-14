/**
 * Internal SEO audit + content generation endpoints for AI-COS Paperclip agents.
 * Protected by X-Internal-Key header (same guard as internal-pipeline).
 * NOT exposed through Caddy in prod (localhost only).
 *
 * GET /api/internal/seo/audit/coverage     — coverage gaps for AI-COS heartbeat
 * GET /api/internal/seo/audit/r4-coverage  — R4-specific gaps
 * POST /api/internal/seo/generate/:pgAlias — trigger R1/R3/R4/R6 content generation
 * POST /api/internal/seo/prompts/reload    — hot-reload canonical prompts cache
 */

import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Optional,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import {
  ContentGeneratorService,
  ContentRole,
} from '../services/content-generator.service';
import type { ContentGenJobData } from '../../../workers/processors/content-gen.processor';

const VALID_ROLES: ContentRole[] = [
  'R1_ROUTER',
  'R3_CONSEILS',
  'R4_REFERENCE',
  'R6_GUIDE_ACHAT',
];

interface GammeRow {
  pg_id: string;
  pg_alias: string;
  pg_name: string;
}

interface GapItem {
  pg_alias: string;
  pg_name: string;
}

export interface SeoCoverageAudit {
  timestamp: string;
  gammes_total: number;
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
    @Optional() private readonly contentGenerator?: ContentGeneratorService,
    @Optional()
    @InjectQueue('content-gen')
    private readonly contentGenQueue?: Queue<ContentGenJobData>,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(url!, key!);
  }

  /**
   * POST /api/internal/seo/generate/:pgAlias
   * Trigger SEO content generation for a gamme.
   *
   * Query params:
   *  - role   : R1_ROUTER | R3_CONSEILS | R4_REFERENCE | R6_GUIDE_ACHAT (default R1_ROUTER)
   *  - dryRun : true = skip API call, return preview structure only
   *  - force  : true = bypass idempotence check (7-day draft freshness)
   *  - sync   : true = execute synchronously (dev/test only, may be slow)
   *             false = enqueue BullMQ job (default, async with retry)
   *
   * Returns:
   *  - sync=true  : GenerateResult with full metrics
   *  - sync=false : { jobId, status: 'queued' }
   */
  @Post('generate/:pgAlias')
  async generateContent(
    @Param('pgAlias') pgAlias: string,
    @Query('role') roleParam?: string,
    @Query('dryRun') dryRunParam?: string,
    @Query('force') forceParam?: string,
    @Query('sync') syncParam?: string,
  ) {
    const role = (roleParam ?? 'R1_ROUTER') as ContentRole;
    if (!VALID_ROLES.includes(role)) {
      throw new BadRequestException(
        `Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`,
      );
    }

    const dryRun = dryRunParam === 'true';
    const force = forceParam === 'true';
    const sync = syncParam === 'true';

    this.logger.log(
      `POST generate/${pgAlias} role=${role} dryRun=${dryRun} force=${force} sync=${sync}`,
    );

    // Sync mode: direct call (useful for dev/testing without BullMQ)
    if (sync) {
      if (!this.contentGenerator) {
        throw new BadRequestException('ContentGeneratorService not available');
      }
      const result = await this.contentGenerator.generate({
        role,
        pgAlias,
        dryRun,
        force,
        trigger: 'http',
      });
      return { success: true, data: result };
    }

    // Async mode: enqueue BullMQ job
    if (!this.contentGenQueue) {
      throw new BadRequestException(
        'BullMQ content-gen queue not available. Use sync=true for direct call.',
      );
    }

    const job = await this.contentGenQueue.add('generate', {
      role,
      pgAlias,
      dryRun,
      force,
      trigger: 'http',
    });

    return {
      success: true,
      data: {
        jobId: job.id,
        pgAlias,
        role,
        status: 'queued',
      },
    };
  }

  /**
   * POST /api/internal/seo/prompts/reload
   * Clear the in-memory prompt cache. Call after editing editorial.md or generator.md
   * to force reload without backend restart.
   */
  @Post('prompts/reload')
  async reloadPrompts() {
    if (!this.contentGenerator) {
      throw new BadRequestException('ContentGeneratorService not available');
    }
    this.contentGenerator.clearPromptCache();
    return { success: true, message: 'Prompt cache cleared' };
  }

  /**
   * GET /api/internal/seo/audit/ai-runs
   * Returns recent content generation runs for observability + Paperclip tickets.
   * Used by Paperclip agents to create [R1_DRAFT_READY] / [R1_DRAFT_FAIL] tickets.
   */
  @Get('audit/ai-runs')
  async aiRuns(@Query('last') lastParam?: string) {
    const hoursBack = lastParam
      ? parseInt(lastParam.replace('h', ''), 10) || 24
      : 24;
    const since = new Date(Date.now() - hoursBack * 3600 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('__seo_ai_runs')
      .select('*')
      .gte('sar_created_at', since)
      .order('sar_created_at', { ascending: false })
      .limit(200);

    if (error) {
      this.logger.error('Failed to fetch ai-runs', error.message);
      throw new Error('Database error: ' + error.message);
    }

    const runs = data ?? [];
    const ok = runs.filter((r) => r.sar_status === 'ok').length;
    const failed = runs.filter((r) => r.sar_status === 'failed').length;
    const skipped = runs.filter((r) => r.sar_status === 'skipped').length;
    const totalCost = runs.reduce(
      (sum, r) => sum + (Number(r.sar_cost_usd) || 0),
      0,
    );

    return {
      timestamp: new Date().toISOString(),
      window_hours: hoursBack,
      total: runs.length,
      ok,
      failed,
      skipped,
      total_cost_usd: Number(totalCost.toFixed(4)),
      runs: runs.slice(0, 50), // limit response size
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

    // Gammes explicitement ignorées du pipeline SEO (pas de RAG OEM prévu)
    const IGNORED_ALIASES = [
      'cable-de-boite-vitesse',
      'disque-d-embrayage',
      'mecanisme-d-embrayage',
      'maillon-de-chaine-chaine-de-distribution',
      'poignee-de-capot',
    ];

    // Fetch all active gammes with alias (base)
    const { data: gammes, error: gammesErr } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_display', '1')
      .not('pg_alias', 'is', null)
      .neq('pg_alias', '')
      .not(
        'pg_alias',
        'in',
        `(${IGNORED_ALIASES.map((a) => `"${a}"`).join(',')})`,
      )
      .limit(500);

    if (gammesErr) {
      this.logger.error('Failed to fetch gammes', gammesErr.message);
      throw new Error('Database error: ' + gammesErr.message);
    }

    const allGammes: GammeRow[] = gammes ?? [];
    const total = allGammes.length;

    // Fetch validated KP R3 aliases
    const { data: kpR3Rows } = await this.supabase
      .from('__seo_r3_keyword_plan')
      .select('skp_pg_alias')
      .eq('skp_status', 'validated')
      .limit(500);
    const kpR3Set = new Set(
      (kpR3Rows ?? []).map((r) => r.skp_pg_alias as string),
    );

    // Fetch validated KP R6 aliases
    const { data: kpR6Rows } = await this.supabase
      .from('__seo_r6_keyword_plan')
      .select('r6kp_pg_alias')
      .eq('r6kp_status', 'validated')
      .limit(500);
    const kpR6Set = new Set(
      (kpR6Rows ?? []).map((r) => r.r6kp_pg_alias as string),
    );

    // Fetch pg_ids that have at least one R3 section with content
    const { data: contentRows } = await this.supabase
      .from('__seo_gamme_conseil')
      .select('sgc_pg_id')
      .not('sgc_enriched_by', 'is', null)
      .limit(3000);
    const contentR3Set = new Set(
      (contentRows ?? []).map((r) => String(r.sgc_pg_id)),
    );

    // Fetch pg_ids that have Google Ads keywords in __seo_keywords
    const { data: kwRows } = await this.supabase
      .from('__seo_keywords')
      .select('pg_id')
      .not('pg_id', 'is', null)
      .limit(3000);
    const kwPgIdSet = new Set((kwRows ?? []).map((r) => String(r.pg_id)));

    const toGapItem = (g: GammeRow): GapItem => ({
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

    // P1 = KP manquant (bloque génération), P2 = contenu manquant mais KP présent
    const p1Count = kpR3Missing.length;
    const p2Count = contentR3Missing.filter((g) =>
      kpR3Set.has(g.pg_alias),
    ).length;

    return {
      timestamp: new Date().toISOString(),
      gammes_total: total,
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

  /**
   * GET /api/internal/seo/audit/r4-coverage
   * Returns R4 Reference content gaps for Paperclip R4-Batch-Lead heartbeat.
   */
  @Get('audit/r4-coverage')
  async r4Coverage() {
    this.logger.log('GET /api/internal/seo/audit/r4-coverage');

    // 1. All published R4 references
    const { data: refs } = await this.supabase
      .from('__seo_reference')
      .select(
        'pg_id, slug, takeaways, key_specs, common_questions, variants, role_negatif, regles_metier, scope_limites',
      )
      .eq('is_published', true)
      .limit(500);

    const allRefs = refs ?? [];

    // 2. Count NULL sections
    const gaps = {
      takeaways_null: allRefs.filter((r) => !r.takeaways).length,
      key_specs_null: allRefs.filter((r) => !r.key_specs).length,
      cq_null: allRefs.filter((r) => !r.common_questions).length,
      variants_null: allRefs.filter((r) => !r.variants).length,
      role_neg_null: allRefs.filter((r) => !r.role_negatif).length,
      regles_null: allRefs.filter((r) => !r.regles_metier).length,
      scope_null: allRefs.filter((r) => !r.scope_limites).length,
    };

    // 3. KP coverage
    const { data: kpRows } = await this.supabase
      .from('__seo_r4_keyword_plan')
      .select('r4kp_pg_id')
      .eq('r4kp_status', 'validated')
      .limit(500);
    const kpPgIds = new Set((kpRows ?? []).map((r) => r.r4kp_pg_id));

    const kpValidatedCount = kpPgIds.size;
    const kpMissingCount = allRefs.filter((r) => !kpPgIds.has(r.pg_id)).length;

    // 4. Recent runs (last 24h) to avoid duplicates
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: recentRuns } = await this.supabase
      .from('__seo_r4_batch_runs')
      .select('r4br_pg_alias, r4br_status')
      .gte('r4br_created_at', oneDayAgo)
      .limit(100);

    const recentAliases = new Set(
      (recentRuns ?? []).map((r) => r.r4br_pg_alias),
    );

    // 5. Recommended batch: top 20 gammes sorted by gap severity
    const scored = allRefs
      .map((r) => {
        let score = 0;
        if (!r.takeaways) score += 3;
        if (!r.key_specs) score += 3;
        if (!r.common_questions) score += 3;
        if (!r.variants) score += 2;
        if (!r.role_negatif) score += 1;
        return { pg_alias: r.slug, pg_id: r.pg_id, gap_score: score };
      })
      .filter((r) => r.gap_score > 0)
      .filter((r) => !recentAliases.has(r.pg_alias))
      .sort((a, b) => b.gap_score - a.gap_score)
      .slice(0, 20);

    return {
      timestamp: new Date().toISOString(),
      total_published: allRefs.length,
      gaps,
      kp_validated_count: kpValidatedCount,
      kp_missing_count: kpMissingCount,
      recent_runs_24h: recentRuns?.length ?? 0,
      recommended_batch: scored,
    };
  }
}
