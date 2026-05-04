/**
 * Internal SEO audit endpoint for AI-COS Paperclip agents.
 * Protected by X-Internal-Key header (same guard as internal-pipeline).
 * NOT exposed through Caddy in prod (localhost only).
 *
 * GET /api/internal/seo/audit/coverage  — coverage gaps for AI-COS heartbeat
 */

import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InternalApiKeyGuard } from '../../../auth/internal-api-key.guard';
import { getEffectiveSupabaseKey } from '@common/utils';

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

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>('SUPABASE_URL') || '';
    // ADR-028 Option D — fallback to ANON_KEY in read-only mode (RLS protects writes)
    const key = getEffectiveSupabaseKey();
    this.supabase = createClient(url, key);
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
}
