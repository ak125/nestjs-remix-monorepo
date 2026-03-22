import {
  Body,
  Controller,
  Get,
  Logger,
  Optional,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { AuthenticatedGuard } from '../../../auth/authenticated.guard';
import { IsAdminGuard } from '../../../auth/is-admin.guard';
import { R1KeywordPlanBatchService } from '../services/r1-keyword-plan-batch.service';

interface CoverageRow {
  role: string;
  label: string;
  count: number;
  total: number;
  pct: number;
}

const TEMPLATES_DIR = '/opt/automecanik/rag/scripts/tools/kp_templates';
const RAG_GAMMES_DIR = '/opt/automecanik/rag/knowledge/gammes';
const ALL_ROLES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8'];

@Controller('api/admin/keyword-planner')
@UseGuards(AuthenticatedGuard, IsAdminGuard)
export class AdminKeywordPlannerController {
  private readonly logger = new Logger(AdminKeywordPlannerController.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly r1BatchService?: R1KeywordPlanBatchService,
  ) {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(url!, key!);
  }

  /**
   * GET /api/admin/keyword-planner/coverage
   * Returns KP coverage per role + gammes list with per-role flags.
   */
  @Get('coverage')
  async coverage() {
    this.logger.log('GET /api/admin/keyword-planner/coverage');

    // 1. Active gammes (source of truth — sgpg_pg_id is VARCHAR in DB)
    const { data: guideRows } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('sgpg_pg_id');
    const activeIds = (guideRows ?? []).map(
      (r: { sgpg_pg_id: string | number }) => Number(r.sgpg_pg_id),
    );
    const totalGammes = activeIds.length || 221;

    // 2. Gamme names (pg_id is INTEGER — pass numbers)
    const { data: pgRows } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .in('pg_id', activeIds);
    const pgMap = new Map(
      (pgRows ?? []).map(
        (r: { pg_id: number; pg_alias: string; pg_name: string }) => [
          Number(r.pg_id),
          r,
        ],
      ),
    );

    // 3. Coverage counts per role
    const tables: [string, string, string][] = [
      ['R1', '__seo_r1_keyword_plan', 'rkp_pg_id'],
      ['R3', '__seo_r3_keyword_plan', 'skp_pg_id'],
      ['R4', '__seo_r4_keyword_plan', 'r4kp_pg_id'],
      ['R5', '__seo_r5_keyword_plan', 'rkp_pg_id'],
      ['R6', '__seo_r6_keyword_plan', 'r6kp_pg_id'],
    ];

    const roleLabels: Record<string, string> = {
      R1: 'Router',
      R2: 'Product',
      R3: 'Conseils',
      R4: 'Reference',
      R5: 'Diagnostic',
      R6: 'Guide Achat',
      R7: 'Brand',
      R8: 'Vehicle',
    };

    const kpSets: Record<string, Set<number>> = {};
    for (const [role, table, col] of tables) {
      try {
        const { data } = await this.supabase.from(table).select(col);
        kpSets[role] = new Set(
          (data ?? []).map((r) =>
            Number((r as unknown as Record<string, unknown>)[col]),
          ),
        );
      } catch {
        kpSets[role] = new Set();
      }
    }
    // R2, R7, R8 = empty for now
    kpSets['R2'] = new Set();
    kpSets['R7'] = new Set();
    kpSets['R8'] = new Set();

    const coverage: CoverageRow[] = Object.entries(roleLabels).map(
      ([role, label]) => {
        const count = kpSets[role]?.size ?? 0;
        return {
          role,
          label,
          count,
          total: totalGammes,
          pct: Math.round((count / totalGammes) * 100),
        };
      },
    );

    // 4. Gammes with per-role flags (all IDs normalized to number)
    const gammes = activeIds.map((pid: number) => {
      const pg = pgMap.get(Number(pid));
      return {
        pg_id: pid,
        pg_alias: pg?.pg_alias ?? '',
        pg_name: pg?.pg_name ?? `Gamme #${pid}`,
        has_r1: kpSets['R1']?.has(pid) ?? false,
        has_r3: kpSets['R3']?.has(pid) ?? false,
        has_r4: kpSets['R4']?.has(pid) ?? false,
        has_r5: kpSets['R5']?.has(pid) ?? false,
        has_r6: kpSets['R6']?.has(pid) ?? false,
      };
    });
    gammes.sort((a: { pg_name: string }, b: { pg_name: string }) =>
      a.pg_name.localeCompare(b.pg_name),
    );

    return { coverage, gammes, totalGammes };
  }

  /**
   * POST /api/admin/keyword-planner/generate
   * Generates prompt(s) for a gamme + role(s).
   */
  @Post('generate')
  async generate(@Body() body: { pg_id: number; roles?: string[] }) {
    const { pg_id, roles = ALL_ROLES } = body;
    this.logger.log(`POST generate pg_id=${pg_id} roles=${roles.join(',')}`);

    // 1. Resolve gamme
    const { data: pgRow } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_id', pg_id)
      .single();
    if (!pgRow) return { error: `Gamme #${pg_id} non trouvee` };

    // 2. Load purchase guide
    const { data: guideRow } = await this.supabase
      .from('__seo_gamme_purchase_guide')
      .select('*')
      .eq('sgpg_pg_id', String(pg_id))
      .single();

    // 3. Load aggregates
    const { data: aggRow } = await this.supabase
      .from('gamme_aggregates')
      .select(
        'products_total, top_brands, demand_level, difficulty_level, priority_score, intent_type, content_depth, vehicle_coverage',
      )
      .eq('ga_pg_id', pg_id)
      .single();

    // 4. Load RAG file
    const ragData = this.loadRag(pgRow.pg_alias);

    // 5. Build context
    const ctx = this.buildContext(pgRow, guideRow ?? {}, aggRow ?? {}, ragData);

    // 6. Render each role
    const results = roles.map((role) => {
      const tplFile = path.join(
        TEMPLATES_DIR,
        `${role.toLowerCase()}_template.txt`,
      );
      if (!fs.existsSync(tplFile)) {
        return {
          role,
          error: `Template ${role.toLowerCase()}_template.txt manquant`,
          prompt: null,
        };
      }
      let tpl = fs.readFileSync(tplFile, 'utf-8');
      // Simple Jinja2 {{ var }} replacement
      for (const [key, val] of Object.entries(ctx)) {
        const replacement =
          typeof val === 'string' ? val : JSON.stringify(val ?? '');
        tpl = tpl.replace(
          new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'),
          replacement,
        );
      }
      return { role, prompt: tpl, chars: tpl.length, error: null };
    });

    return { pg_id, pg_name: pgRow.pg_name, pg_alias: pgRow.pg_alias, results };
  }

  /**
   * POST /api/admin/keyword-planner/batch-r1
   * 0-LLM batch generation of R1 keyword plans.
   * Generates deterministic KP from RAG + R3 anti-cannib + vehicles DB.
   */
  @Post('batch-r1')
  async batchR1(
    @Body() body: { limit?: number; minR3Score?: number; dryRun?: boolean },
  ) {
    if (!this.r1BatchService) {
      return { error: 'R1KeywordPlanBatchService not available' };
    }
    const limit = Math.min(body.limit ?? 50, 200);
    this.logger.log(
      `POST batch-r1 limit=${limit} minR3Score=${body.minR3Score ?? 70} dryRun=${body.dryRun ?? false}`,
    );
    return this.r1BatchService.batchGenerate({
      limit,
      minR3Score: body.minR3Score,
      dryRun: body.dryRun,
    });
  }

  // ── Private helpers ──

  private loadRag(slug: string): Record<string, unknown> {
    const filePath = path.join(RAG_GAMMES_DIR, `${slug}.md`);
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content.startsWith('---')) return {};
    const parts = content.split('---', 3);
    if (parts.length < 3) return {};
    try {
      return (yaml.load(parts[1]) as Record<string, unknown>) ?? {};
    } catch {
      return {};
    }
  }

  private nested(obj: unknown, ...keys: string[]): unknown {
    let cur = obj;
    for (const k of keys) {
      if (cur && typeof cur === 'object' && k in cur) {
        cur = (cur as Record<string, unknown>)[k];
      } else {
        return '';
      }
    }
    return cur ?? '';
  }

  private sj(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'string') return val;
    return JSON.stringify(val, null, 2);
  }

  /** Format top_brands as readable one-liner: "BOSCH (2333), ATE (9), FTE (47)" */
  private formatBrands(raw: unknown): string {
    if (!Array.isArray(raw)) return '[non renseigne]';
    return (
      raw
        .map(
          (b: { name?: string; count?: number }) =>
            `${b.name ?? '?'} (${b.count ?? 0})`,
        )
        .join(', ') || '[non renseigne]'
    );
  }

  /** Dedup selection_criteria: remove v4-* duplicates */
  private dedupCriteria(raw: unknown): string {
    if (!Array.isArray(raw)) return '[non renseigne]';
    const seen = new Set<string>();
    const clean = raw.filter((item: { key?: string; label?: string }) => {
      const label = (item.label ?? '')
        .replace(/\*\*/g, '')
        .trim()
        .toLowerCase();
      if (!label || seen.has(label)) return false;
      seen.add(label);
      return true;
    });
    return clean.length > 0
      ? clean
          .map(
            (c: { label?: string }) =>
              `- ${(c.label ?? '').replace(/\*\*/g, '')}`,
          )
          .join('\n')
      : '[non renseigne]';
  }

  /** Parse value to array (handles JSON strings, arrays, nulls) */
  private toArray(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.startsWith('[')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* ignore */
      }
    }
    return [];
  }

  /** Dedup any string array or array of objects (case-insensitive) */
  private dedupArray(raw: unknown): string {
    const arr = this.toArray(raw);
    if (arr.length === 0) return '[non renseigne]';
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const item of arr) {
      const text =
        typeof item === 'string'
          ? item.trim()
          : typeof item === 'object' && item
            ? String(
                (item as Record<string, unknown>).label ??
                  (item as Record<string, unknown>).axis ??
                  JSON.stringify(item),
              )
            : String(item);
      const key = text.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${text}`);
    }
    return lines.length > 0 ? lines.join('\n') : '[non renseigne]';
  }

  /** Format symptoms as bullet list (skip empty entries) */
  private formatSymptoms(raw: unknown): string {
    if (!Array.isArray(raw) || raw.length === 0) return '[non renseigne]';
    const lines = raw
      .map((s: string | { label?: string }) =>
        typeof s === 'string' ? s.trim() : (s.label ?? '').trim(),
      )
      .filter((s: string) => s.length > 0)
      .map((s: string) => `- ${s}`);
    return lines.length > 0 ? lines.join('\n') : '[non renseigne]';
  }

  /** Fallback: return first non-empty value or placeholder */
  private fallback(...values: string[]): string {
    for (const v of values) {
      if (v && v !== '""' && v !== '[]' && v !== '{}' && v !== 'null') return v;
    }
    return '[non renseigne]';
  }

  /** Data quality score: count filled critical fields out of 7 */
  private dataQuality(ctx: Record<string, string>): string {
    const critical = [
      'intro_role',
      'symptoms',
      'selection_criteria',
      'compatibility_axes',
      'interest_nuggets',
      'anti_mistakes',
      'cost_range',
    ];
    const empty = '[non renseigne]';
    const filled = critical.filter((k) => ctx[k] && ctx[k] !== empty);
    const missing = critical.filter((k) => !ctx[k] || ctx[k] === empty);
    const score = filled.length;
    const level = score >= 6 ? 'RICHE' : score >= 4 ? 'PARTIEL' : 'INSUFFISANT';
    const lines = [`- Richesse : ${score}/7 champs renseignes (${level})`];
    if (missing.length > 0)
      lines.push(`- Champs manquants : ${missing.join(', ')}`);
    if (level === 'INSUFFISANT')
      lines.push(
        '- Action : KP de base uniquement, sections concernees seront generiques',
      );
    else if (level === 'PARTIEL')
      lines.push(
        '- Action : generer un KP solide, utiliser des termes generiques pour les champs manquants',
      );
    return lines.join('\n');
  }

  private buildContext(
    info: Record<string, unknown>,
    guide: Record<string, unknown>,
    agg: Record<string, unknown>,
    rag: Record<string, unknown>,
  ): Record<string, string> {
    const g = (k: string) => this.sj(guide[k]);
    const r = (...keys: string[]) => this.sj(this.nested(rag, ...keys));

    // Build context with smart formatting and fallbacks
    const ctx: Record<string, string> = {
      gamme_name: String(info.pg_name ?? ''),
      pg_id: String(info.pg_id ?? 0),
      pg_alias: String(info.pg_alias ?? ''),

      // Guide data — cleaned
      intro_role: this.fallback(g('sgpg_intro_role'), r('domain', 'role')),
      intro_title: g('sgpg_intro_title') || '[non renseigne]',
      symptoms: this.formatSymptoms(guide.sgpg_symptoms),
      selection_criteria: this.dedupCriteria(guide.sgpg_selection_criteria),
      cost_range: this.fallback(g('sgpg_risk_cost_range'), '[non renseigne]'),
      risk_explanation: g('sgpg_risk_explanation') || '[non renseigne]',
      risk_consequences: g('sgpg_risk_consequences') || '[non renseigne]',
      faq: g('sgpg_faq') || '[non renseigne]',
      brands_guide: g('sgpg_brands_guide') || '[non renseigne]',
      when_pro: g('sgpg_when_pro') || '[non renseigne]',
      how_to_choose: g('sgpg_how_to_choose') || '[non renseigne]',
      h1_override: g('sgpg_h1_override') || '[non renseigne]',
      micro_seo_block: g('sgpg_micro_seo_block') || '',
      anti_mistakes: g('sgpg_anti_mistakes') || '[non renseigne]',

      // Fallback chain: DB → RAG for pieces liées (deduped)
      sync_parts: this.dedupArray(
        this.nested(rag, 'domain', 'related_parts') ||
          this.nested(rag, 'domain', 'cross_gammes') ||
          guide.sgpg_intro_sync_parts,
      ),
      compatibility_axes: this.dedupArray(
        guide.sgpg_compatibility_axes ||
          this.nested(rag, 'selection', 'criteria'),
      ),
      interest_nuggets: g('sgpg_interest_nuggets') || '[non renseigne]',
      decision_tree: g('sgpg_decision_tree') || '[non renseigne]',
      use_cases: g('sgpg_use_cases') || '[non renseigne]',

      // Aggregates — formatted
      products_total: String(agg.products_total ?? 0),
      top_brands: this.formatBrands(agg.top_brands),
      demand_level: String(agg.demand_level ?? '?'),
      difficulty_level: String(agg.difficulty_level ?? '?'),
      priority_score: String(agg.priority_score ?? 0),
      intent_type: String(agg.intent_type ?? '?'),
      content_depth: String(agg.content_depth ?? '?'),
      vehicle_coverage: String(agg.vehicle_coverage ?? '?'),

      // RAG evidence
      rag_domain_role: r('domain', 'role') || '[non renseigne]',
      rag_must_be_true: r('domain', 'must_be_true') || '[non renseigne]',
      rag_must_not_contain:
        r('domain', 'must_not_contain') || '[non renseigne]',
      rag_confusion_with: r('domain', 'confusion_with') || '[non renseigne]',
      rag_related_parts: r('domain', 'related_parts') || '[non renseigne]',
      rag_norms: r('domain', 'norms') || '[non renseigne]',
      rag_cross_gammes: r('domain', 'cross_gammes') || '[non renseigne]',
      rag_diagnostic_symptoms: r('diagnostic', 'symptoms') || '[non renseigne]',
      rag_diagnostic_causes: r('diagnostic', 'causes') || '[non renseigne]',
      rag_maintenance: r('maintenance', 'interval') || '[non renseigne]',

      existing_kp: 'aucun',
      mode: 'creation',
    };

    // Add quality indicator
    ctx.data_quality = this.dataQuality(ctx);

    return ctx;
  }
}
