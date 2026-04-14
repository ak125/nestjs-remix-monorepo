/**
 * ContentGeneratorService — Generic multi-role SEO content generation.
 *
 * Loads canonical prompts from .claude/prompts/R{X}_* directories at runtime (no hardcoded prompts).
 * Writes exclusively to `sg_content_draft` — the LIVE `sg_content` is NEVER touched.
 * Logs every run to `__seo_ai_runs` for observability + cost tracking.
 *
 * Supports R1_ROUTER, R3_CONSEILS, R4_REFERENCE, R6_GUIDE_ACHAT via `role` parameter.
 *
 * Promotion `sg_content_draft` → `sg_content` is a MANUAL human action
 * (not automated by this service).
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { AiContentService } from '../../ai-content/ai-content.service';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

// ─── Types ──

export type ContentRole =
  | 'R1_ROUTER'
  | 'R3_CONSEILS'
  | 'R4_REFERENCE'
  | 'R6_GUIDE_ACHAT';

export interface GenerateParams {
  role: ContentRole;
  pgAlias: string;
  dryRun?: boolean;
  force?: boolean;
  trigger?: 'http' | 'cron_inbox' | 'bullmq' | 'paperclip' | 'manual' | 'test';
}

export interface GenerateResult {
  status: 'ok' | 'failed' | 'skipped';
  pgId: number;
  pgAlias: string;
  role: ContentRole;
  contentLength: number;
  h2Count: number;
  kwScore: number;
  tokensInput: number;
  tokensOutput: number;
  tokensCached: number;
  costUsd: number;
  durationMs: number;
  error?: string;
  lintErrors?: string[];
  skipReason?: string;
}

// ─── Constants ──

const PROMPTS_DIR = '/opt/automecanik/app/.claude/prompts';
const PROMPT_FILES: Record<ContentRole, string> = {
  R1_ROUTER: 'R1_ROUTER/editorial.md',
  R3_CONSEILS: 'R3_CONSEILS/generator.md',
  R4_REFERENCE: 'R4_REFERENCE/generator.md',
  R6_GUIDE_ACHAT: 'R6_GUIDE_ACHAT/generator.md',
};

// Anthropic pricing (Claude Sonnet 4, 2026-04): $3/M input, $15/M output
// Cached input tokens are read at 10% of base rate ($0.30/M)
const PRICING = {
  inputPer1M: 3.0,
  outputPer1M: 15.0,
  cachedReadPer1M: 0.3,
} as const;

// Draft freshness window for idempotence (7 days)
const DRAFT_FRESHNESS_DAYS = 7;

// Forbidden vocabulary (aligned with editorial.md FORBIDDEN VOCABULARY)
const FORBIDDEN_TERMS = [
  // Anglicismes non-whitelist
  'spin-on',
  'spin on',
  'multi-pass',
  'multi pass',
  'anti-drain back',
  'anti-drainback',
  'brake fluid',
  'oil pan',
  // Cross-role (R3/R4/R5/R6)
  'demonter',
  'démonter',
  'remontage',
  'couple de serrage',
  'tutoriel',
  'pas-a-pas',
  'pas à pas',
  'symptome',
  'symptôme',
  "qu'est-ce que",
  'comment choisir',
  "guide d'achat",
  'comparatif qualite',
  // Scope R1 hors-auto
  'tondeuse',
  'briggs stratton',
  'briggs et stratton',
  'tracteur agricole',
  'engin agricole',
  'poids lourd',
  'poids lourds',
  'hydraulique', // when not "clapet hydraulique" — caught by regex below
  'filtre centrifuge',
];
// Whitelisted jargon (NOT flagged): OEM, OES, longlife, aftermarket, by-pass

// ─── Service ──

@Injectable()
export class ContentGeneratorService extends SupabaseBaseService {
  protected override readonly logger = new Logger(ContentGeneratorService.name);

  // LRU cache of loaded prompt files (hot-reloadable via clearPromptCache)
  private readonly promptCache = new Map<ContentRole, string>();

  constructor(
    configService: ConfigService,
    @Optional() private readonly aiContent?: AiContentService,
  ) {
    super(configService);
  }

  /**
   * Main entry point: generate content for a gamme + role.
   */
  async generate(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    const {
      role,
      pgAlias,
      dryRun = false,
      force = false,
      trigger = 'manual',
    } = params;

    const baseResult: Partial<GenerateResult> = {
      pgAlias,
      role,
      contentLength: 0,
      h2Count: 0,
      kwScore: 0,
      tokensInput: 0,
      tokensOutput: 0,
      tokensCached: 0,
      costUsd: 0,
    };

    try {
      // ── 1. Resolve gamme ──
      const gamme = await this.resolveGamme(pgAlias);
      if (!gamme) {
        return this.buildResult({
          ...baseResult,
          status: 'failed',
          pgId: 0,
          error: `Gamme not found: ${pgAlias}`,
          durationMs: Date.now() - start,
        });
      }

      // ── 2. Idempotence check ──
      if (!force && !dryRun) {
        const isRecent = await this.hasRecentDraft(gamme.pg_id);
        if (isRecent) {
          const result = this.buildResult({
            ...baseResult,
            status: 'skipped',
            pgId: gamme.pg_id,
            skipReason: `draft exists and is < ${DRAFT_FRESHNESS_DAYS} days old (use force=true to override)`,
            durationMs: Date.now() - start,
          });
          await this.logRun(result, trigger);
          return result;
        }
      }

      // ── 3. Load prompt ──
      const systemPrompt = this.loadPrompt(role);
      if (!systemPrompt) {
        return this.buildResult({
          ...baseResult,
          status: 'failed',
          pgId: gamme.pg_id,
          error: `Prompt file not found for role ${role}`,
          durationMs: Date.now() - start,
        });
      }

      // ── 4. Load context ──
      const context = await this.loadContext(gamme.pg_id, gamme.pg_alias, role);

      // Gate: require KW classified (HIGH or MED) for quality generation
      if (context.kwHigh.length === 0 && context.kwMed.length === 0) {
        const result = this.buildResult({
          ...baseResult,
          status: 'failed',
          pgId: gamme.pg_id,
          error: `No KW classified for role ${role}. Run /kw-classify ${pgAlias} first.`,
          durationMs: Date.now() - start,
        });
        await this.logRun(result, trigger);
        return result;
      }

      // Gate: require RAG file
      if (!context.rag) {
        const result = this.buildResult({
          ...baseResult,
          status: 'failed',
          pgId: gamme.pg_id,
          error: `RAG file not found: ${gamme.pg_alias}.md`,
          durationMs: Date.now() - start,
        });
        await this.logRun(result, trigger);
        return result;
      }

      // ── 5. Build user message ──
      const userMessage = this.buildUserMessage(gamme, context, role);

      // ── 6. Dry-run: skip API call, return preview ──
      if (dryRun) {
        const result = this.buildResult({
          ...baseResult,
          status: 'ok',
          pgId: gamme.pg_id,
          contentLength: 0,
          durationMs: Date.now() - start,
          error: '[DRY RUN] API call skipped',
        });
        return result;
      }

      // ── 7. Call Anthropic via AiContentService ──
      if (!this.aiContent) {
        return this.buildResult({
          ...baseResult,
          status: 'failed',
          pgId: gamme.pg_id,
          error: 'AiContentService not available (ANTHROPIC_API_KEY missing?)',
          durationMs: Date.now() - start,
        });
      }

      const apiResult = await this.aiContent.generateWithSystemPrompt({
        systemPrompt,
        userMessage,
        maxTokens: 8000,
        temperature: 0.4,
        cacheSystemPrompt: true,
      });

      // ── 8. Validate lint gates ──
      const html = this.extractHtml(apiResult.content);
      const lintErrors = this.validateLintGates(html, context);
      const h2Count = (html.match(/<h2[^>]*>/g) || []).length;
      const kwScore = this.computeKwScore(html, context.kwHigh, context.kwMed);

      if (lintErrors.length > 0) {
        const result = this.buildResult({
          ...baseResult,
          status: 'failed',
          pgId: gamme.pg_id,
          contentLength: html.length,
          h2Count,
          kwScore,
          tokensInput: apiResult.tokensInput,
          tokensOutput: apiResult.tokensOutput,
          tokensCached: apiResult.tokensCached,
          costUsd: this.computeCost(apiResult),
          lintErrors,
          error: `Lint gates failed: ${lintErrors.join('; ')}`,
          durationMs: Date.now() - start,
        });
        await this.logRun(result, trigger);
        return result;
      }

      // ── 9. Write draft (DRAFT ONLY — never touches sg_content live) ──
      const meta = this.extractMeta(html, gamme.pg_name);
      await this.writeDraft(gamme.pg_id, html, meta, apiResult.model);

      // ── 10. Success ──
      const result = this.buildResult({
        ...baseResult,
        status: 'ok',
        pgId: gamme.pg_id,
        contentLength: html.length,
        h2Count,
        kwScore,
        tokensInput: apiResult.tokensInput,
        tokensOutput: apiResult.tokensOutput,
        tokensCached: apiResult.tokensCached,
        costUsd: this.computeCost(apiResult),
        durationMs: Date.now() - start,
      });
      await this.logRun(result, trigger);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `generate(${role}, ${pgAlias}) failed: ${errorMessage}`,
      );
      const result = this.buildResult({
        ...baseResult,
        status: 'failed',
        pgId: 0,
        error: errorMessage,
        durationMs: Date.now() - start,
      });
      await this.logRun(result, trigger);
      return result;
    }
  }

  /**
   * Clear the in-memory prompt cache.
   * Call via admin endpoint when editorial.md is modified.
   */
  clearPromptCache(): void {
    this.promptCache.clear();
    this.logger.log('Prompt cache cleared');
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE: Pipeline steps
  // ══════════════════════════════════════════════════════════════════════

  private async resolveGamme(
    pgAlias: string,
  ): Promise<{ pg_id: number; pg_alias: string; pg_name: string } | null> {
    const { data } = await this.supabase
      .from('pieces_gamme')
      .select('pg_id, pg_alias, pg_name')
      .eq('pg_alias', pgAlias)
      .maybeSingle();
    return (
      (data as { pg_id: number; pg_alias: string; pg_name: string } | null) ??
      null
    );
  }

  private async hasRecentDraft(pgId: number): Promise<boolean> {
    const { data } = await this.supabase
      .from('__seo_gamme')
      .select('sg_draft_updated_at, sg_content_draft')
      .eq('sg_pg_id', String(pgId))
      .maybeSingle();

    if (!data?.sg_content_draft || !data?.sg_draft_updated_at) return false;

    const updatedAt = new Date(data.sg_draft_updated_at).getTime();
    const cutoff = Date.now() - DRAFT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000;
    return updatedAt > cutoff;
  }

  private loadPrompt(role: ContentRole): string | null {
    if (this.promptCache.has(role)) {
      return this.promptCache.get(role)!;
    }
    const filePath = join(PROMPTS_DIR, PROMPT_FILES[role]);
    if (!existsSync(filePath)) {
      this.logger.error(`Prompt file not found: ${filePath}`);
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    this.promptCache.set(role, content);
    this.logger.log(
      `Loaded prompt ${role} from ${filePath} (${content.length} chars)`,
    );
    return content;
  }

  private async loadContext(
    pgId: number,
    pgAlias: string,
    role: ContentRole,
  ): Promise<{
    rag: string | null;
    kwHigh: Array<{ kw: string; intent: string }>;
    kwMed: Array<{ kw: string; intent: string }>;
    aggregates: {
      products_total?: number;
      top_brands?: unknown;
      vehicle_coverage?: string;
    } | null;
    links: Array<{
      target_pg_id: number;
      anchor_text: string;
      context: string;
      relation: string;
    }>;
  }> {
    // RAG file
    const ragPath = join(RAG_KNOWLEDGE_PATH, 'gammes', `${pgAlias}.md`);
    const rag = existsSync(ragPath) ? readFileSync(ragPath, 'utf-8') : null;

    // KW classified for this role — role param maps to DB 'role' column (R1, R3, R4, R6)
    const roleDb = role.split('_')[0]; // R1_ROUTER → R1
    const [kwHighRes, kwMedRes] = await Promise.all([
      this.supabase
        .from('__seo_keyword_results')
        .select('kw, intent')
        .eq('pg_id', pgId)
        .eq('role', roleDb)
        .eq('vol', 'HIGH'),
      this.supabase
        .from('__seo_keyword_results')
        .select('kw, intent')
        .eq('pg_id', pgId)
        .eq('role', roleDb)
        .eq('vol', 'MED'),
    ]);

    // Aggregates
    const { data: agg } = await this.supabase
      .from('gamme_aggregates')
      .select('products_total, top_brands, vehicle_coverage')
      .eq('ga_pg_id', pgId)
      .maybeSingle();

    // Internal links
    const { data: links } = await this.supabase
      .from('__seo_gamme_links')
      .select('target_pg_id, anchor_text, context, relation')
      .eq('source_pg_id', pgId);

    return {
      rag,
      kwHigh: (kwHighRes.data ?? []) as Array<{ kw: string; intent: string }>,
      kwMed: (kwMedRes.data ?? []) as Array<{ kw: string; intent: string }>,
      aggregates: agg as {
        products_total?: number;
        top_brands?: unknown;
        vehicle_coverage?: string;
      } | null,
      links: (links ?? []) as Array<{
        target_pg_id: number;
        anchor_text: string;
        context: string;
        relation: string;
      }>,
    };
  }

  private buildUserMessage(
    gamme: { pg_id: number; pg_alias: string; pg_name: string },
    context: {
      rag: string | null;
      kwHigh: Array<{ kw: string; intent: string }>;
      kwMed: Array<{ kw: string; intent: string }>;
      aggregates: unknown;
      links: Array<{
        target_pg_id: number;
        anchor_text: string;
        context: string;
        relation: string;
      }>;
    },
    role: ContentRole,
  ): string {
    const payload = {
      gamme_name: gamme.pg_name,
      gamme_alias: gamme.pg_alias,
      pg_id: gamme.pg_id,
      role,
      keywords: {
        HIGH: context.kwHigh.map((k) => k.kw),
        MED: context.kwMed.map((k) => k.kw),
      },
      rag_frontmatter: context.rag?.slice(0, 18000) ?? '', // limit RAG to frontmatter + first paragraphs
      aggregates: context.aggregates,
      internal_links: context.links,
    };

    return [
      `Genere le contenu ${role} pour la gamme "${gamme.pg_name}" selon la structure obligatoire`,
      `(8 H2), les regles de qualite, le forbidden vocabulary strict, et le scope R1 voiture.`,
      `Retourne UNIQUEMENT le HTML (pas de markdown code block, pas d'explication).`,
      ``,
      `DONNEES GAMME :`,
      '```json',
      JSON.stringify(payload, null, 2),
      '```',
    ].join('\n');
  }

  private extractHtml(content: string): string {
    // Strip markdown code blocks if wrapped
    const codeBlockMatch = content.match(/```(?:html)?\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return content.trim();
  }

  private validateLintGates(
    html: string,
    context: { kwHigh: Array<{ kw: string }>; kwMed: Array<{ kw: string }> },
  ): string[] {
    const errors: string[] = [];

    // Gate 1: Length
    if (html.length < 8000) {
      errors.push(`LENGTH: ${html.length} chars < 8000 min`);
    }
    if (html.length > 25000) {
      errors.push(`LENGTH: ${html.length} chars > 25000 max`);
    }

    // Gate 2: H2 count
    const h2Count = (html.match(/<h2[^>]*>/g) || []).length;
    if (h2Count < 6) {
      errors.push(`H2_COUNT: ${h2Count} < 6`);
    }
    if (h2Count > 10) {
      errors.push(`H2_COUNT: ${h2Count} > 10`);
    }

    // Gate 3: Forbidden vocabulary
    const htmlLower = html.toLowerCase();
    const found = FORBIDDEN_TERMS.filter((term) =>
      htmlLower.includes(term.toLowerCase()),
    );
    if (found.length > 0) {
      errors.push(`FORBIDDEN_VOCAB: ${found.slice(0, 5).join(', ')}`);
    }

    // Gate 4: KW HIGH coverage (100%)
    const missingHigh = context.kwHigh.filter(
      (k) => !this.fuzzyMatch(k.kw, html),
    );
    if (missingHigh.length > 0) {
      errors.push(
        `KW_HIGH_MISSING: ${missingHigh.length}/${context.kwHigh.length}`,
      );
    }

    return errors;
  }

  private fuzzyMatch(kw: string, html: string): boolean {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const kwNorm = norm(kw);
    const htmlNorm = norm(html);

    // Direct substring
    if (htmlNorm.includes(kwNorm)) return true;

    // Token-based: all tokens present within 100-char window
    const tokens = kwNorm.split(' ').filter((t) => t.length >= 2);
    if (tokens.length === 0) return false;

    let idx = 0;
    while (idx < htmlNorm.length) {
      const pos = htmlNorm.indexOf(tokens[0], idx);
      if (pos === -1) return false;
      const window = htmlNorm.slice(pos, pos + 100);
      if (tokens.every((t) => window.includes(t))) return true;
      idx = pos + 1;
    }
    return false;
  }

  private computeKwScore(
    html: string,
    high: Array<{ kw: string }>,
    med: Array<{ kw: string }>,
  ): number {
    const highFound = high.filter((k) => this.fuzzyMatch(k.kw, html)).length;
    const medFound = med.filter((k) => this.fuzzyMatch(k.kw, html)).length;

    const highPct = high.length > 0 ? (highFound / high.length) * 50 : 50;
    const medPct = med.length > 0 ? (medFound / med.length) * 35 : 35;
    return Math.round(highPct + medPct + 15); // 15 = base bonus for LOW
  }

  private extractMeta(
    html: string,
    fallbackName: string,
  ): { h1: string; title: string; descrip: string } {
    // H1 = first <h2> text (first section title) truncated
    const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/);
    const firstH2 = h2Match ? h2Match[1].trim() : fallbackName;
    const h1 = firstH2.slice(0, 70);

    // Title = gamme name + brand
    const title = `${fallbackName} | AutoMecanik`.slice(0, 60);

    // Description = first <p> stripped of HTML
    const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/);
    let descrip = pMatch ? pMatch[1].replace(/\s+/g, ' ').trim() : '';
    if (descrip.length > 155) {
      descrip = descrip.slice(0, 152) + '...';
    }

    return { h1, title, descrip };
  }

  private async writeDraft(
    pgId: number,
    html: string,
    meta: { h1: string; title: string; descrip: string },
    model: string,
  ): Promise<void> {
    // DRAFT ONLY — never UPDATE sg_content, sg_title, sg_descrip live
    const { error } = await this.supabase
      .from('__seo_gamme')
      .update({
        sg_content_draft: html,
        sg_title_draft: meta.title,
        sg_descrip_draft: meta.descrip,
        sg_draft_source: 'content-generator-service-v1',
        sg_draft_updated_at: new Date().toISOString(),
        sg_draft_llm_model: model,
      })
      .eq('sg_pg_id', String(pgId));

    if (error) {
      throw new Error(`Draft write failed: ${error.message}`);
    }
  }

  private computeCost(apiResult: {
    tokensInput: number;
    tokensOutput: number;
    tokensCached: number;
  }): number {
    const nonCachedInput = Math.max(
      0,
      apiResult.tokensInput - apiResult.tokensCached,
    );
    const inputCost = (nonCachedInput / 1_000_000) * PRICING.inputPer1M;
    const cachedCost =
      (apiResult.tokensCached / 1_000_000) * PRICING.cachedReadPer1M;
    const outputCost =
      (apiResult.tokensOutput / 1_000_000) * PRICING.outputPer1M;
    return Number((inputCost + cachedCost + outputCost).toFixed(6));
  }

  private async logRun(
    result: GenerateResult,
    trigger: GenerateParams['trigger'],
  ): Promise<void> {
    try {
      await this.supabase.from('__seo_ai_runs').insert({
        sar_pg_id: result.pgId,
        sar_pg_alias: result.pgAlias,
        sar_role: result.role,
        sar_status: result.status,
        sar_tokens_input: result.tokensInput,
        sar_tokens_output: result.tokensOutput,
        sar_tokens_cached: result.tokensCached,
        sar_cost_usd: result.costUsd,
        sar_duration_ms: result.durationMs,
        sar_content_length: result.contentLength,
        sar_h2_count: result.h2Count,
        sar_kw_score: result.kwScore,
        sar_lint_errors: result.lintErrors ?? null,
        sar_error: result.error ?? null,
        sar_trigger: trigger ?? 'manual',
        sar_llm_model: 'claude-sonnet-4-20250514',
      });
    } catch (err) {
      this.logger.warn(
        `logRun failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private buildResult(partial: Partial<GenerateResult>): GenerateResult {
    return {
      status: partial.status ?? 'failed',
      pgId: partial.pgId ?? 0,
      pgAlias: partial.pgAlias ?? '',
      role: partial.role ?? 'R1_ROUTER',
      contentLength: partial.contentLength ?? 0,
      h2Count: partial.h2Count ?? 0,
      kwScore: partial.kwScore ?? 0,
      tokensInput: partial.tokensInput ?? 0,
      tokensOutput: partial.tokensOutput ?? 0,
      tokensCached: partial.tokensCached ?? 0,
      costUsd: partial.costUsd ?? 0,
      durationMs: partial.durationMs ?? 0,
      error: partial.error,
      lintErrors: partial.lintErrors,
      skipReason: partial.skipReason,
    };
  }
}
