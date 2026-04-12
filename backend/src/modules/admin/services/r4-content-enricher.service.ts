/**
 * R4ContentEnricherService — 0-LLM audit & orchestration pipeline for R4 Reference pages.
 *
 * Skills-first architecture: content generation is delegated to Claude Code
 * agents/skills (/content-gen --r4). This service provides:
 * - Section audit (identifies what needs improvement)
 * - RAG + KW loading (data preparation)
 * - Lint gates (post-write quality validation)
 * - DB write with anti-regression guards
 *
 * Registered in ExecutionRouter via source='r4_batch'.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { FeatureFlagsService } from '../../../config/feature-flags.service';
import { ContentWriteGateService } from '../../../config/content-write-gate.service';
import { R4LintGatesService, R4LintInput } from './r4-lint-gates.service';
import {
  R4_CONTENT_TABLE,
  type R4ContentSection,
} from '../../../config/r4-keyword-plan.constants';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAG_KNOWLEDGE_PATH } from '../../../config/rag.config';

// ── Types ──

export interface R4EnrichResult {
  status: 'success' | 'failed' | 'skipped' | 'delegated';
  pgAlias: string;
  pgId: number;
  sectionsAudited: string[];
  sectionsImproved: string[];
  /** Sections marked IMPROVE by audit — used by /content-gen skill */
  sectionsToImprove?: string[];
  lintScore: number;
  lintReport: Record<string, unknown> | null;
  providerUsed: string;
  durationMs: number;
  error?: string;
  kpMode: 'full' | 'skip_kp';
  /** RAG content available for the skill (true if .md file exists) */
  ragAvailable?: boolean;
  /** Target keywords from KP */
  targetKeywords?: string[];
}

interface SectionAudit {
  sectionId: R4ContentSection;
  dbColumn: string;
  status: 'KEEP' | 'IMPROVE';
  reason?: string;
  priority: number;
}

interface ExistingR4Row {
  pg_id: number;
  slug: string;
  definition?: string;
  takeaways?: string[];
  role_mecanique?: string;
  composition?: string[];
  variants?: unknown;
  key_specs?: unknown;
  confusions_courantes?: string[];
  common_questions?: unknown[];
  role_negatif?: string;
  regles_metier?: string[];
  scope_limites?: string;
  contamination_flags?: string[];
}

// ── Service ──

@Injectable()
export class R4ContentEnricherService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R4ContentEnricherService.name,
  );

  constructor(
    configService: ConfigService,
    private readonly lintGates: R4LintGatesService,
    private readonly flags: FeatureFlagsService,
    @Optional() private readonly writeGate?: ContentWriteGateService,
  ) {
    super(configService);
  }

  /**
   * Enrich a single gamme's R4 Reference sections.
   * Pipeline: Load → Audit → Blueprint → Improve → Lint → Write
   */
  async enrichSingle(
    pgAlias: string,
    options: {
      dryRun?: boolean;
      source?: 'r4_batch' | 'manual' | 'rag_change';
      maxSections?: number;
    } = {},
  ): Promise<R4EnrichResult> {
    const start = Date.now();
    const { dryRun = false, source = 'r4_batch', maxSections = 6 } = options;

    this.logger.log(
      `[R4] enrichSingle: ${pgAlias} (dryRun=${dryRun}, source=${source})`,
    );

    try {
      // ── Step 1: Load ──
      const existing = await this.loadExisting(pgAlias);
      if (!existing) {
        return this.buildResult(pgAlias, 0, 'skipped', start, {
          error: `No __seo_reference entry for slug=${pgAlias}`,
        });
      }

      const ragContent = this.loadRagFile(pgAlias);
      const kpMode = await this.detectKpMode(existing.pg_id);
      const targetKeywords =
        kpMode === 'full' ? await this.loadTargetKeywords(existing.pg_id) : [];

      // ── Step 2: Audit ──
      const audits = this.auditSections(existing);
      const sectionsToImprove = audits
        .filter((a) => a.status === 'IMPROVE')
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxSections);

      if (sectionsToImprove.length === 0) {
        return this.buildResult(pgAlias, existing.pg_id, 'skipped', start, {
          kpMode,
          sectionsAudited: audits.map((a) => a.sectionId),
          error: 'All sections KEEP — nothing to improve',
        });
      }

      // ── Step 3: Delegate to skill ──
      // Skills-first: content generation is handled by /content-gen --r4 (Claude Code).
      // This service returns the audit data for the skill to consume.

      this.logger.log(
        `[R4] Delegating ${sectionsToImprove.length} sections to /content-gen skill for ${pgAlias}`,
      );

      await this.logRun(existing.pg_id, pgAlias, {
        status: 'delegated',
        sectionsAudited: audits.map((a) => a.sectionId),
        sectionsImproved: [],
        lintScore: 0,
        lintReport: null,
        providerUsed: 'skill:content-gen',
        durationMs: Date.now() - start,
        source,
        kpMode,
      });

      return this.buildResult(pgAlias, existing.pg_id, 'delegated', start, {
        kpMode,
        sectionsAudited: audits.map((a) => a.sectionId),
        sectionsToImprove: sectionsToImprove.map((s) => s.sectionId),
        ragAvailable: ragContent.length > 0,
        targetKeywords,
        providerUsed: 'skill:content-gen',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`[R4] enrichSingle error for ${pgAlias}: ${error}`);
      return this.buildResult(pgAlias, 0, 'failed', start, { error });
    }
  }

  /**
   * Batch enrichment — sequential to respect rate limits.
   */
  async enrichBatch(
    pgAliases: string[],
    options: {
      dryRun?: boolean;
      source?: 'r4_batch' | 'manual' | 'rag_change';
    } = {},
  ): Promise<R4EnrichResult[]> {
    const results: R4EnrichResult[] = [];
    for (const alias of pgAliases) {
      const result = await this.enrichSingle(alias, options);
      results.push(result);
    }
    return results;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE: Pipeline steps
  // ══════════════════════════════════════════════════════════════════════

  private async loadExisting(pgAlias: string): Promise<ExistingR4Row | null> {
    const { data } = await this.supabase
      .from(R4_CONTENT_TABLE)
      .select(
        'pg_id, slug, definition, takeaways, role_mecanique, composition, ' +
          'variants, key_specs, confusions_courantes, common_questions, ' +
          'role_negatif, regles_metier, scope_limites, contamination_flags',
      )
      .eq('slug', pgAlias)
      .single();

    return data as unknown as ExistingR4Row | null;
  }

  private loadRagFile(pgAlias: string): string {
    const filePath = join(RAG_KNOWLEDGE_PATH, 'gammes', `${pgAlias}.md`);
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8');
    }
    return '';
  }

  private async detectKpMode(pgId: number): Promise<'full' | 'skip_kp'> {
    const { data } = await this.supabase
      .from('__seo_r4_keyword_plan')
      .select('r4kp_id')
      .eq('r4kp_pg_id', pgId)
      .eq('r4kp_status', 'validated')
      .limit(1);

    return data && data.length > 0 ? 'full' : 'skip_kp';
  }

  private async loadTargetKeywords(pgId: number): Promise<string[]> {
    const { data } = await this.supabase
      .from('__seo_r4_keyword_plan')
      .select('r4kp_section_terms')
      .eq('r4kp_pg_id', pgId)
      .eq('r4kp_status', 'validated')
      .single();

    if (!data?.r4kp_section_terms) return [];

    // Flatten all section terms into a keyword list
    const terms = data.r4kp_section_terms as Record<string, string[]>;
    return Object.values(terms).flat();
  }

  private auditSections(existing: ExistingR4Row): SectionAudit[] {
    const audits: SectionAudit[] = [];

    // B1: definition + takeaways
    const defWords = (existing.definition ?? '')
      .split(/\s+/)
      .filter(Boolean).length;
    if (!existing.definition || defWords < 50 || defWords > 110) {
      audits.push({
        sectionId: 'R4_B1_DEFINITION',
        dbColumn: 'definition',
        status: 'IMPROVE',
        reason: `${defWords} words (need 50-110)`,
        priority: 9,
      });
    } else {
      audits.push({
        sectionId: 'R4_B1_DEFINITION',
        dbColumn: 'definition',
        status: 'KEEP',
        priority: 0,
      });
    }

    if (!existing.takeaways || existing.takeaways.length < 3) {
      audits.push({
        sectionId: 'R4_B1_DEFINITION',
        dbColumn: 'takeaways',
        status: 'IMPROVE',
        reason: 'NULL or < 3 items',
        priority: 10,
      });
    }

    // B2: role_mecanique
    const rmWords = (existing.role_mecanique ?? '')
      .split(/\s+/)
      .filter(Boolean).length;
    if (!existing.role_mecanique || rmWords < 70) {
      audits.push({
        sectionId: 'R4_B2_ROLE',
        dbColumn: 'role_mecanique',
        status: 'IMPROVE',
        reason: `${rmWords} words (need >= 70)`,
        priority: 9,
      });
    } else {
      audits.push({
        sectionId: 'R4_B2_ROLE',
        dbColumn: 'role_mecanique',
        status: 'KEEP',
        priority: 0,
      });
    }

    // B3: composition
    if (!existing.composition || existing.composition.length < 4) {
      audits.push({
        sectionId: 'R4_B3_COMPOSITION',
        dbColumn: 'composition',
        status: 'IMPROVE',
        reason: 'NULL or < 4 items',
        priority: 7,
      });
    } else {
      audits.push({
        sectionId: 'R4_B3_COMPOSITION',
        dbColumn: 'composition',
        status: 'KEEP',
        priority: 0,
      });
    }

    // B4: variants
    if (!existing.variants) {
      audits.push({
        sectionId: 'R4_B4_VARIANTS',
        dbColumn: 'variants',
        status: 'IMPROVE',
        reason: 'NULL',
        priority: 6,
      });
    } else {
      audits.push({
        sectionId: 'R4_B4_VARIANTS',
        dbColumn: 'variants',
        status: 'KEEP',
        priority: 0,
      });
    }

    // B5: key_specs
    if (!existing.key_specs) {
      audits.push({
        sectionId: 'R4_B5_KEY_SPECS',
        dbColumn: 'key_specs',
        status: 'IMPROVE',
        reason: 'NULL',
        priority: 9,
      });
    } else {
      audits.push({
        sectionId: 'R4_B5_KEY_SPECS',
        dbColumn: 'key_specs',
        status: 'KEEP',
        priority: 0,
      });
    }

    // B6: FAQ (confusions + common_questions)
    if (
      !existing.common_questions ||
      (existing.common_questions as unknown[]).length < 3
    ) {
      audits.push({
        sectionId: 'R4_B6_FAQ',
        dbColumn: 'common_questions',
        status: 'IMPROVE',
        reason: 'NULL or < 3 items',
        priority: 9,
      });
    } else {
      audits.push({
        sectionId: 'R4_B6_FAQ',
        dbColumn: 'common_questions',
        status: 'KEEP',
        priority: 0,
      });
    }

    // B7: role_negatif (does_not)
    if (!existing.role_negatif) {
      audits.push({
        sectionId: 'R4_B7_DOES_NOT',
        dbColumn: 'role_negatif',
        status: 'IMPROVE',
        reason: 'NULL',
        priority: 5,
      });
    } else {
      audits.push({
        sectionId: 'R4_B7_DOES_NOT',
        dbColumn: 'role_negatif',
        status: 'KEEP',
        priority: 0,
      });
    }

    // B8: regles_metier
    if (!existing.regles_metier || existing.regles_metier.length < 5) {
      audits.push({
        sectionId: 'R4_B8_RULES',
        dbColumn: 'regles_metier',
        status: 'IMPROVE',
        reason: 'NULL or < 5 items',
        priority: 8,
      });
    } else {
      // Check format: must start with Toujours/Ne jamais/Doit
      const validPrefixes = [
        'toujours',
        'ne jamais',
        'ne pas',
        'doit',
        'vérifier',
        'verifier',
        'respecter',
      ];
      const badFormat = existing.regles_metier.filter(
        (r) => !validPrefixes.some((p) => r.toLowerCase().trim().startsWith(p)),
      );
      if (badFormat.length > 0) {
        audits.push({
          sectionId: 'R4_B8_RULES',
          dbColumn: 'regles_metier',
          status: 'IMPROVE',
          reason: `${badFormat.length} rules bad format`,
          priority: 8,
        });
      } else {
        audits.push({
          sectionId: 'R4_B8_RULES',
          dbColumn: 'regles_metier',
          status: 'KEEP',
          priority: 0,
        });
      }
    }

    // B9: scope_limites
    const scopeWords = (existing.scope_limites ?? '')
      .split(/\s+/)
      .filter(Boolean).length;
    if (!existing.scope_limites || scopeWords < 80) {
      audits.push({
        sectionId: 'R4_B9_SCOPE',
        dbColumn: 'scope_limites',
        status: 'IMPROVE',
        reason: `${scopeWords} words (need >= 80)`,
        priority: 4,
      });
    } else {
      audits.push({
        sectionId: 'R4_B9_SCOPE',
        dbColumn: 'scope_limites',
        status: 'KEEP',
        priority: 0,
      });
    }

    return audits;
  }

  /**
   * Validate existing R4 content against lint gates.
   * Called post-write (after /content-gen skill has written to DB).
   */
  async validatePostWrite(pgAlias: string): Promise<{
    pass: boolean;
    score: number;
    violations: string[];
    gates: Record<string, unknown>;
  }> {
    const existing = await this.loadExisting(pgAlias);
    if (!existing) {
      return {
        pass: false,
        score: 0,
        violations: ['No __seo_reference entry'],
        gates: {},
      };
    }

    const targetKeywords = await this.loadTargetKeywords(existing.pg_id);

    const toStringArray = (v: unknown): string[] | undefined => {
      if (!v) return undefined;
      if (Array.isArray(v)) return v.map(String);
      return undefined;
    };

    const lintInput: R4LintInput = {
      definition: existing.definition,
      takeaways: toStringArray(existing.takeaways),
      role_mecanique: existing.role_mecanique,
      composition: toStringArray(existing.composition),
      variants: existing.variants,
      key_specs: existing.key_specs,
      confusions_courantes: toStringArray(existing.confusions_courantes),
      common_questions: existing.common_questions as unknown[],
      role_negatif: existing.role_negatif,
      regles_metier: toStringArray(existing.regles_metier),
      scope_limites: existing.scope_limites,
      targetKeywords,
    };

    return this.lintGates.validate(lintInput);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PRIVATE: Helpers
  // ══════════════════════════════════════════════════════════════════════

  private buildResult(
    pgAlias: string,
    pgId: number,
    status: R4EnrichResult['status'],
    startMs: number,
    extra: Partial<
      Omit<R4EnrichResult, 'status' | 'pgAlias' | 'pgId' | 'durationMs'>
    > = {},
  ): R4EnrichResult {
    return {
      status,
      pgAlias,
      pgId,
      sectionsAudited: extra.sectionsAudited ?? [],
      sectionsImproved: extra.sectionsImproved ?? [],
      sectionsToImprove: extra.sectionsToImprove,
      lintScore: extra.lintScore ?? 0,
      lintReport: extra.lintReport ?? null,
      providerUsed: extra.providerUsed ?? 'none',
      durationMs: Date.now() - startMs,
      error: extra.error,
      kpMode: extra.kpMode ?? 'skip_kp',
      ragAvailable: extra.ragAvailable,
      targetKeywords: extra.targetKeywords,
    };
  }

  private async logRun(
    pgId: number,
    pgAlias: string,
    data: {
      status: string;
      sectionsAudited: string[];
      sectionsImproved: string[];
      lintScore: number;
      lintReport: unknown;
      providerUsed: string;
      durationMs: number;
      source: string;
      kpMode: string;
      error?: string;
    },
  ): Promise<void> {
    try {
      await this.supabase.from('__seo_r4_batch_runs').insert({
        r4br_pg_id: pgId,
        r4br_pg_alias: pgAlias,
        r4br_status: data.status,
        r4br_sections_audited: data.sectionsAudited,
        r4br_sections_improved: data.sectionsImproved,
        r4br_lint_score: data.lintScore,
        r4br_lint_report: data.lintReport,
        r4br_provider_used: data.providerUsed,
        r4br_duration_ms: data.durationMs,
        r4br_source: data.source,
        r4br_kp_mode: data.kpMode,
        r4br_error: data.error ?? null,
        r4br_completed_at: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`[R4] Failed to log run: ${err}`);
    }
  }
}
