/**
 * R1KeywordPlanGatesService — Audit-first keyword planning for R1 (transactional) pages.
 * Mirror of KeywordPlanGatesService (R3) adapted for __seo_gamme_purchase_guide columns.
 *
 * KP0 Audit → score existing sgpg_* sections → skip healthy gammes
 * G1-G7 Gates → validate keyword plans before writing
 * R3 Risk Score → anti-cannibalization R1↔R3
 */
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import type {
  GateResult,
  AuditResult,
  PriorityFix,
} from '../../../config/r1-keyword-plan.constants';
import {
  R1_SECTION_CONFIG,
  R1_PLANNABLE_SECTIONS,
  R1_GATE_DEFINITIONS,
  R1_KP_QUALITY_THRESHOLDS,
  R1_AUDIT_PRIORITY_WEIGHTS,
  R3_FORBIDDEN_IN_R1,
  R1_GENERIC_PHRASES,
  type R1PlannableSection,
} from '../../../config/r1-keyword-plan.constants';

// ── Row shape (matches __seo_r1_keyword_plan columns) ──

export interface RkpRow {
  rkp_pg_id: number;
  rkp_pg_alias: string;
  rkp_gamme_name?: string;
  rkp_primary_intent?: Record<string, unknown>;
  rkp_secondary_intents?: unknown[];
  rkp_boundaries?: Record<string, unknown>;
  rkp_heading_plan?: Record<string, unknown>;
  rkp_query_clusters?: Record<string, unknown>;
  rkp_section_terms?: Record<string, R1SectionTerms>;
  rkp_gate_report?: Record<string, GateResult> | null;
}

export interface R1SectionTerms {
  include_terms?: string[];
  micro_phrases?: string[];
  forbidden_overlap?: string[];
  internal_links?: string[];
}

export interface R1KeywordPlanGateReport {
  gateReport: Record<string, GateResult>;
  qualityScore: number;
  duplicationScore: number;
  r3RiskScore: number;
  coverageScore: number;
}

@Injectable()
export class R1KeywordPlanGatesService extends SupabaseBaseService {
  protected override readonly logger = new Logger(
    R1KeywordPlanGatesService.name,
  );

  // ── KP0: Audit existing R1 sections ──────────────────

  async auditR1Sections(pgId: string): Promise<AuditResult> {
    // Fetch purchase guide row (sgpg_* columns)
    const { data: pgRow } = await this.client
      .from('__seo_gamme_purchase_guide')
      .select('*')
      .eq('sgpg_pg_id', pgId)
      .single();

    // Fetch SEO gamme row (sg_* columns, used by R1_S0_SERP)
    const { data: sgRow } = await this.client
      .from('__seo_gamme')
      .select('sg_title_draft, sg_descrip_draft')
      .eq('sg_pg_id', pgId)
      .single();

    if (!pgRow) {
      // No purchase guide at all — every section is missing
      const allRequired = R1_PLANNABLE_SECTIONS.filter(
        (s) => R1_SECTION_CONFIG[s].required,
      );
      return {
        priority_score:
          allRequired.length * R1_AUDIT_PRIORITY_WEIGHTS.missingRequiredSection,
        priority_fixes: allRequired.map((s) => ({
          section: s,
          issue: 'missing' as const,
          current_score: null,
          fix_type: 'create' as const,
        })),
        sections_to_create: [...allRequired],
        sections_to_improve: [],
        section_scores: {},
        missing_sections: [...allRequired],
        weak_phrases_ratio: {},
        content_lengths: {},
        audit_summary: `No purchase guide for pgId=${pgId}. All ${allRequired.length} required sections missing.`,
      };
    }

    const sectionScores: Record<string, number> = {};
    const contentLengths: Record<string, number> = {};
    const weakPhrasesRatio: Record<string, number> = {};
    const sectionsToCreate: string[] = [];
    const sectionsToImprove: string[] = [];
    const priorityFixes: PriorityFix[] = [];
    let priorityScore = 0;

    for (const sectionId of R1_PLANNABLE_SECTIONS) {
      const config = R1_SECTION_CONFIG[sectionId];
      const content = this.extractSectionContent(
        pgRow,
        sgRow,
        config.sgpg_columns,
        config.sg_columns,
      );
      const charCount = content.length;
      const wordCount = content.split(/\s+/).filter(Boolean).length;

      contentLengths[sectionId] = charCount;

      if (charCount === 0) {
        // Section missing
        sectionScores[sectionId] = 0;
        if (config.required) {
          sectionsToCreate.push(sectionId);
          priorityScore += R1_AUDIT_PRIORITY_WEIGHTS.missingRequiredSection;
          priorityFixes.push({
            section: sectionId,
            issue: 'missing',
            current_score: null,
            fix_type: 'create',
          });
        }
        continue;
      }

      // Score the section
      const score = this.scoreSection(sectionId, content, wordCount, charCount);
      sectionScores[sectionId] = score;

      // Check generic phrases
      const genericRatio = this.computeGenericRatio(content);
      weakPhrasesRatio[sectionId] = genericRatio;

      if (score < R1_KP_QUALITY_THRESHOLDS.improvementScoreThreshold) {
        sectionsToImprove.push(sectionId);
        priorityScore += R1_AUDIT_PRIORITY_WEIGHTS.sectionBelowScore;
        priorityFixes.push({
          section: sectionId,
          issue: 'low_score',
          current_score: score,
          fix_type: 'improve',
        });
      }

      if (genericRatio > R1_KP_QUALITY_THRESHOLDS.weakPhraseRatio) {
        priorityScore += R1_AUDIT_PRIORITY_WEIGHTS.highGenericPhraseRatio;
        priorityFixes.push({
          section: sectionId,
          issue: 'weak_phrases',
          current_score: score,
          fix_type: 'improve',
        });
      }

      if (
        config.min_chars > 0 &&
        charCount < config.min_chars * R1_KP_QUALITY_THRESHOLDS.thinContentRatio
      ) {
        priorityScore += R1_AUDIT_PRIORITY_WEIGHTS.thinContent;
        priorityFixes.push({
          section: sectionId,
          issue: 'thin_content',
          current_score: score,
          fix_type: 'improve',
        });
      }
    }

    const totalSections = R1_PLANNABLE_SECTIONS.length;
    const populatedSections = totalSections - sectionsToCreate.length;
    const coverageRatio = populatedSections / totalSections;

    return {
      priority_score: priorityScore,
      priority_fixes: priorityFixes,
      sections_to_create: sectionsToCreate,
      sections_to_improve: sectionsToImprove,
      section_scores: sectionScores,
      missing_sections: sectionsToCreate,
      weak_phrases_ratio: weakPhrasesRatio,
      content_lengths: contentLengths,
      audit_summary: `pgId=${pgId}: ${populatedSections}/${totalSections} sections populated, ${sectionsToImprove.length} weak, priority=${priorityScore}, coverage=${(coverageRatio * 100).toFixed(0)}%`,
    };
  }

  // ── Should skip gamme (healthy enough) ───────────────

  shouldSkipGamme(audit: AuditResult): boolean {
    const requiredSections = R1_PLANNABLE_SECTIONS.filter(
      (s) => R1_SECTION_CONFIG[s].required,
    );

    // All required sections must exist
    const allRequiredPresent = requiredSections.every(
      (s) => !audit.sections_to_create.includes(s),
    );
    if (!allRequiredPresent) return false;

    // All scored sections must be >= healthyScoreMin
    const allHealthy = Object.values(audit.section_scores).every(
      (score) => score >= R1_KP_QUALITY_THRESHOLDS.healthyScoreMin,
    );
    if (!allHealthy) return false;

    // Coverage must be >= minCoverageForSkip
    const totalSections = R1_PLANNABLE_SECTIONS.length;
    const populated = totalSections - audit.sections_to_create.length;
    const coverage = populated / totalSections;

    return coverage >= R1_KP_QUALITY_THRESHOLDS.minCoverageForSkip;
  }

  // ── Run R1 gates RG1-RG7 (C.4) ─────────────────────

  async runR1Gates(row: RkpRow): Promise<R1KeywordPlanGateReport> {
    const gates: Record<string, GateResult> = {};
    let totalPenalty = 0;

    // RG1: Intent alignment
    gates.RG1_INTENT_ALIGNMENT = this.checkIntentAlignment(row);
    if (gates.RG1_INTENT_ALIGNMENT.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG1_INTENT_ALIGNMENT.penalty;
    }

    // RG2: Boundary respect (no R3 terms)
    gates.RG2_BOUNDARY_RESPECT = this.checkBoundaryRespect(row);
    if (gates.RG2_BOUNDARY_RESPECT.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG2_BOUNDARY_RESPECT.penalty;
    }

    // RG3: Cluster coverage
    gates.RG3_CLUSTER_COVERAGE = this.checkClusterCoverage(row);
    if (gates.RG3_CLUSTER_COVERAGE.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG3_CLUSTER_COVERAGE.penalty;
    }

    // RG4: Section overlap
    gates.RG4_SECTION_OVERLAP = this.checkSectionOverlap(row);
    if (gates.RG4_SECTION_OVERLAP.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG4_SECTION_OVERLAP.penalty;
    }

    // RG5: FAQ dedup (async — cross-checks R1 FAQ vs R3 S8)
    gates.RG5_FAQ_DEDUP = await this.checkFaqDedup(row);
    if (gates.RG5_FAQ_DEDUP.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG5_FAQ_DEDUP.penalty;
    }

    // RG6: Anchor validity
    gates.RG6_ANCHOR_VALIDITY = this.checkAnchorValidity(row);
    if (gates.RG6_ANCHOR_VALIDITY.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG6_ANCHOR_VALIDITY.penalty;
    }

    // RG7: R3 risk (cross-check include_terms R1 vs R3)
    const r3RiskScore = await this.computeR3RiskScore(row);
    gates.RG7_R3_RISK = this.checkR3Risk(r3RiskScore);
    if (gates.RG7_R3_RISK.status === 'fail') {
      totalPenalty += R1_GATE_DEFINITIONS.RG7_R3_RISK.penalty;
    }

    const qualityScore = Math.max(0, 100 - totalPenalty);
    const duplicationScore = this.computeDuplicationScore(row);
    const coverageScore = this.computeCoverageScore(row);

    return {
      gateReport: gates,
      qualityScore,
      duplicationScore,
      r3RiskScore,
      coverageScore,
    };
  }

  // ── R3 Risk Score (anti-cannibalization mirror) ──────

  async computeR3RiskScore(row: RkpRow): Promise<number> {
    if (!row.rkp_section_terms) return 0;

    // Collect all R1 include_terms
    const r1Terms = new Set<string>();
    for (const section of Object.values(row.rkp_section_terms)) {
      for (const term of section.include_terms || []) {
        r1Terms.add(term.toLowerCase());
      }
    }
    if (r1Terms.size === 0) return 0;

    // Get R3 keyword plan for same gamme
    const { data: r3Plan } = await this.client
      .from('__seo_r3_keyword_plan')
      .select('skp_section_terms')
      .eq('skp_pg_id', row.rkp_pg_id)
      .eq('skp_status', 'validated')
      .single();

    if (!r3Plan?.skp_section_terms) return 0;

    // Collect all R3 include_terms
    const r3Terms = new Set<string>();
    const r3SectionTerms = r3Plan.skp_section_terms as Record<
      string,
      { include_terms?: string[] }
    >;
    for (const section of Object.values(r3SectionTerms)) {
      for (const term of section.include_terms || []) {
        r3Terms.add(term.toLowerCase());
      }
    }
    if (r3Terms.size === 0) return 0;

    // Jaccard-like overlap
    let intersection = 0;
    for (const term of r1Terms) {
      if (r3Terms.has(term)) intersection++;
    }
    const union = new Set([...r1Terms, ...r3Terms]).size;

    return union > 0 ? intersection / union : 0;
  }

  // ── Upsert R1 keyword plan ──────────────────────────

  async upsertR1KeywordPlan(
    pgId: string,
    data: Partial<Record<string, unknown>>,
  ): Promise<void> {
    const payload = {
      rkp_pg_id: Number(pgId),
      ...data,
      rkp_built_at: new Date().toISOString(),
    };

    const { error } = await this.client
      .from('__seo_r1_keyword_plan')
      .upsert(payload, { onConflict: 'rkp_pg_id,rkp_version' });

    if (error) {
      this.logger.error(
        `Failed to upsert R1 keyword plan for pgId=${pgId}: ${error.message}`,
      );
    }
  }

  // ── Private helpers ──────────────────────────────────

  private extractSectionContent(
    pgRow: Record<string, unknown> | null,
    sgRow: Record<string, unknown> | null,
    sgpg_columns: string[],
    sg_columns?: string[],
  ): string {
    const parts: string[] = [];

    // sgpg_columns from purchase_guide row
    for (const col of sgpg_columns) {
      const val = pgRow?.[col];
      if (!val) continue;
      if (typeof val === 'string') {
        parts.push(val);
      } else if (Array.isArray(val)) {
        parts.push(
          val
            .map((item) =>
              typeof item === 'object' ? JSON.stringify(item) : String(item),
            )
            .join(' '),
        );
      } else if (typeof val === 'object') {
        parts.push(JSON.stringify(val));
      }
    }

    // sg_columns from seo_gamme row (used by R1_S0_SERP)
    if (sg_columns) {
      for (const col of sg_columns) {
        const val = sgRow?.[col];
        if (!val) continue;
        if (typeof val === 'string') {
          parts.push(val);
        } else if (typeof val === 'object') {
          parts.push(JSON.stringify(val));
        }
      }
    }

    return parts.join(' ').trim();
  }

  private scoreSection(
    sectionId: string,
    content: string,
    wordCount: number,
    charCount: number,
  ): number {
    const config = R1_SECTION_CONFIG[sectionId as R1PlannableSection];
    if (!config) return 0;

    let score = 100;

    // Penalty for thin content
    if (config.min_chars > 0 && charCount < config.min_chars) {
      const ratio = charCount / config.min_chars;
      score -= Math.round((1 - ratio) * 30);
    }

    if (config.min_words > 0 && wordCount < config.min_words) {
      const ratio = wordCount / config.min_words;
      score -= Math.round((1 - ratio) * 20);
    }

    // Penalty for generic phrases
    const genericRatio = this.computeGenericRatio(content);
    if (genericRatio > R1_KP_QUALITY_THRESHOLDS.weakPhraseRatio) {
      score -= config.generic_penalty;
    }

    // Penalty for R3 forbidden terms found in R1 content
    const lower = content.toLowerCase();
    let forbiddenCount = 0;
    for (const term of R3_FORBIDDEN_IN_R1) {
      if (lower.includes(term.toLowerCase())) forbiddenCount++;
    }
    if (forbiddenCount > 0) {
      score -= Math.min(forbiddenCount * 5, 20);
    }

    return Math.max(0, Math.min(100, score));
  }

  private computeGenericRatio(content: string): number {
    if (!content) return 0;
    const lower = content.toLowerCase();
    const words = lower.split(/\s+/).filter(Boolean);
    if (words.length === 0) return 0;

    let genericWordCount = 0;
    for (const phrase of R1_GENERIC_PHRASES) {
      const phraseWords = phrase.toLowerCase().split(/\s+/).length;
      if (lower.includes(phrase.toLowerCase())) {
        genericWordCount += phraseWords;
      }
    }

    return genericWordCount / words.length;
  }

  // ── Gate checks ──────────────────────────────────────

  private static readonly VALID_R1_INTENTS = [
    'transactional',
    'navigational',
    'commercial_investigation',
  ];

  private checkIntentAlignment(row: RkpRow): GateResult {
    const intentObj = row.rkp_primary_intent || {};
    const intent =
      typeof intentObj === 'string'
        ? intentObj
        : (intentObj as Record<string, string>).intent || 'transactional';
    if (R1KeywordPlanGatesService.VALID_R1_INTENTS.includes(intent)) {
      return {
        gate: 'RG1',
        status: 'pass',
        message: `Intent "${intent}" is valid`,
      };
    }
    return {
      gate: 'RG1',
      status: 'fail',
      message: `Intent "${intent}" is not valid for R1`,
    };
  }

  private checkBoundaryRespect(row: RkpRow): GateResult {
    const found: string[] = [];
    const searchText =
      JSON.stringify(row.rkp_heading_plan || {}).toLowerCase() +
      JSON.stringify(row.rkp_section_terms || {}).toLowerCase();

    for (const term of R3_FORBIDDEN_IN_R1) {
      if (searchText.includes(term.toLowerCase())) {
        found.push(term);
      }
    }

    if (found.length === 0) {
      return { gate: 'RG2', status: 'pass', message: 'No R3 terms found' };
    }
    return {
      gate: 'RG2',
      status: found.length > 2 ? 'fail' : 'warn',
      message: `R3 terms found: ${found.join(', ')}`,
    };
  }

  private checkClusterCoverage(row: RkpRow): GateResult {
    if (!row.rkp_query_clusters) {
      return { gate: 'RG3', status: 'pass', message: 'No clusters to check' };
    }
    const clusters = row.rkp_query_clusters as Record<
      string,
      { section_target?: string }
    >;
    const unmapped = Object.entries(clusters).filter(
      ([, c]) => !c.section_target,
    );
    if (unmapped.length === 0) {
      return {
        gate: 'RG3',
        status: 'pass',
        message: 'All clusters mapped to sections',
      };
    }
    return {
      gate: 'RG3',
      status: 'fail',
      message: `${unmapped.length} clusters not mapped`,
    };
  }

  private checkSectionOverlap(row: RkpRow): GateResult {
    if (!row.rkp_section_terms) {
      return { gate: 'RG4', status: 'pass', message: 'No section terms' };
    }

    const sections = Object.entries(row.rkp_section_terms);
    let maxOverlap = 0;

    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const termsA = new Set(
          (sections[i][1].include_terms || []).map((t) => t.toLowerCase()),
        );
        const termsB = new Set(
          (sections[j][1].include_terms || []).map((t) => t.toLowerCase()),
        );
        if (termsA.size === 0 || termsB.size === 0) continue;

        let intersection = 0;
        for (const t of termsA) {
          if (termsB.has(t)) intersection++;
        }
        const smaller = Math.min(termsA.size, termsB.size);
        const overlap = intersection / smaller;
        if (overlap > maxOverlap) maxOverlap = overlap;
      }
    }

    if (maxOverlap <= 0.15) {
      return {
        gate: 'RG4',
        status: 'pass',
        message: `Max overlap: ${(maxOverlap * 100).toFixed(0)}%`,
      };
    }
    return {
      gate: 'RG4',
      status: 'fail',
      message: `Section overlap too high: ${(maxOverlap * 100).toFixed(0)}%`,
    };
  }

  private async checkFaqDedup(row: RkpRow): Promise<GateResult> {
    // Load R1 FAQ from sgpg_faq (actual page FAQ, not keyword plan terms)
    try {
      const { data: pgRow } = await this.client
        .from('__seo_gamme_purchase_guide')
        .select('sgpg_faq')
        .eq('sgpg_pg_id', String(row.rkp_pg_id))
        .maybeSingle();

      const r1Faq: Array<{ question: string; answer?: string }> = Array.isArray(
        pgRow?.sgpg_faq,
      )
        ? pgRow.sgpg_faq
        : [];
      if (r1Faq.length === 0) {
        return {
          gate: 'RG5',
          status: 'pass',
          message: 'No R1 FAQ to dedup',
        };
      }
      const r1Questions = r1Faq.map((f) => f.question);

      // Fetch R3 S8 FAQ content
      const { data: r3FaqRow } = await this.client
        .from('__seo_gamme_conseil')
        .select('sgc_content')
        .eq('sgc_pg_id', row.rkp_pg_id)
        .eq('sgc_section_type', 'S8')
        .maybeSingle();

      if (!r3FaqRow?.sgc_content) {
        return {
          gate: 'RG5',
          status: 'pass',
          message: 'No R3 S8 FAQ to compare',
        };
      }

      // Extract questions from R3 HTML (<summary> tags)
      const summaryRegex = /<summary[^>]*>(.*?)<\/summary>/gi;
      const r3Questions: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = summaryRegex.exec(r3FaqRow.sgc_content)) !== null) {
        r3Questions.push(this.normalizeForDedup(match[1]));
      }
      if (r3Questions.length === 0) {
        return {
          gate: 'RG5',
          status: 'pass',
          message: 'No R3 FAQ questions found in S8 HTML',
        };
      }

      // Cross-check R1 FAQ vs R3 FAQ (Jaccard 0.4 = semantic overlap)
      const r1Normalized = r1Questions.map((q) => this.normalizeForDedup(q));
      const duplicates: string[] = [];

      for (let i = 0; i < r1Normalized.length; i++) {
        const r1Q = r1Normalized[i];
        for (const r3Q of r3Questions) {
          if (
            r1Q.includes(r3Q) ||
            r3Q.includes(r1Q) ||
            this.jaccardSimilarity(r1Q, r3Q) > 0.4
          ) {
            duplicates.push(r1Questions[i]);
            break;
          }
        }
      }

      if (duplicates.length > 2) {
        return {
          gate: 'RG5',
          status: 'fail',
          message: `${duplicates.length} R1 FAQ overlap with R3 S8: ${duplicates.slice(0, 3).join('; ')}`,
        };
      }
      if (duplicates.length > 0) {
        return {
          gate: 'RG5',
          status: 'warn',
          message: `${duplicates.length} R1 FAQ overlap with R3 S8`,
        };
      }
      return {
        gate: 'RG5',
        status: 'pass',
        message: 'No R1/R3 FAQ overlap detected',
      };
    } catch (err) {
      this.logger.warn(
        `[RG5] FAQ dedup check failed for pgId=${row.rkp_pg_id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        gate: 'RG5',
        status: 'pass',
        message: 'FAQ dedup check skipped (DB error)',
      };
    }
  }

  private normalizeForDedup(text: string): string {
    return text
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[?!.,;:'"«»]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private jaccardSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(' '));
    const setB = new Set(b.split(' '));
    const intersection = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? intersection / union : 0;
  }

  private checkAnchorValidity(row: RkpRow): GateResult {
    if (!row.rkp_section_terms) {
      return { gate: 'RG6', status: 'pass', message: 'No anchors to check' };
    }

    const invalidAnchors: string[] = [];
    for (const section of Object.values(row.rkp_section_terms)) {
      for (const link of section.internal_links || []) {
        if (!link.startsWith('/pieces/')) {
          invalidAnchors.push(link);
        }
      }
    }

    if (invalidAnchors.length === 0) {
      return { gate: 'RG6', status: 'pass', message: 'All anchors valid' };
    }
    return {
      gate: 'RG6',
      status: 'fail',
      message: `Invalid anchors: ${invalidAnchors.slice(0, 3).join(', ')}`,
    };
  }

  private checkR3Risk(r3RiskScore: number): GateResult {
    if (r3RiskScore <= R1_KP_QUALITY_THRESHOLDS.maxR3RiskScore) {
      return {
        gate: 'RG7',
        status: 'pass',
        message: `R3 risk score: ${(r3RiskScore * 100).toFixed(0)}% (max ${(R1_KP_QUALITY_THRESHOLDS.maxR3RiskScore * 100).toFixed(0)}%)`,
      };
    }
    return {
      gate: 'RG7',
      status: 'fail',
      message: `R3 risk score too high: ${(r3RiskScore * 100).toFixed(0)}% (max ${(R1_KP_QUALITY_THRESHOLDS.maxR3RiskScore * 100).toFixed(0)}%)`,
    };
  }

  private computeDuplicationScore(row: RkpRow): number {
    if (!row.rkp_section_terms) return 0;
    // Simplified: ratio of shared terms between all section pairs
    const allTerms: string[] = [];
    const uniqueTerms = new Set<string>();
    for (const section of Object.values(row.rkp_section_terms)) {
      for (const term of section.include_terms || []) {
        const lower = term.toLowerCase();
        allTerms.push(lower);
        uniqueTerms.add(lower);
      }
    }
    if (allTerms.length === 0) return 0;
    return 1 - uniqueTerms.size / allTerms.length;
  }

  private computeCoverageScore(row: RkpRow): number {
    if (!row.rkp_section_terms) return 0;
    const totalSections = R1_PLANNABLE_SECTIONS.length;
    const coveredSections = R1_PLANNABLE_SECTIONS.filter(
      (s) => row.rkp_section_terms?.[s]?.include_terms?.length,
    ).length;
    return coveredSections / totalSections;
  }
}
