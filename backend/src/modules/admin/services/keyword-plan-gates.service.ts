/**
 * KeywordPlanGatesService — Quality gates G1-G6 for __seo_r3_keyword_plan.
 * Validates keyword plans before writing to DB.
 *
 * Gate    | Description                              | Penalty
 * -------|------------------------------------------|--------
 * G1     | Intent alignment (R3 = info/how-to)      | 30
 * G2     | Boundary respect (no R1 pricing terms)   | 25
 * G3     | Cluster coverage (head queries → sections)| 20
 * G4     | Section overlap (include_terms < 15%)    | 15
 * G5     | FAQ dedup (no PAA duplication)            | 10
 * G6     | Anchor validity (valid internal prefixes) | 10
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  type GateResult,
  type AuditResult,
  type PriorityFix,
  type MediaSlot,
  GATE_DEFINITIONS,
  KP_QUALITY_THRESHOLDS,
  AUDIT_THRESHOLDS,
  AUDIT_PRIORITY_WEIGHTS,
  MEDIA_BUDGET,
  R3_ALLOWED_INTENTS,
  VALID_ANCHOR_PREFIXES,
} from '../../../config/keyword-plan.constants';
import {
  PACK_DEFINITIONS,
  GENERIC_PHRASES,
  SECTION_QUALITY_CRITERIA,
} from '../../../config/conseil-pack.constants';
import { PRIX_PAS_CHER } from '../../seo/seo-v4.types';

// ── Row shape (matches __seo_r3_keyword_plan columns) ──

export interface SkpRow {
  skp_pg_id: number;
  skp_pg_alias: string;
  skp_primary_intent?: string | null;
  skp_secondary_intents?: string[] | null;
  skp_boundaries?: Record<string, unknown> | null;
  skp_heading_plan?: Record<string, unknown> | null;
  skp_query_clusters?: Record<string, unknown> | null;
  skp_section_terms?: Record<string, SectionTerms> | null;
  skp_seo_brief?: SeoBrief | null;
  skp_gate_report?: Record<string, GateResult> | null;
}

interface SectionTerms {
  include_terms?: string[];
  micro_phrases?: string[];
  faq_questions?: string[];
  forbidden_overlap?: string[];
  snippet_block?: Record<string, unknown>;
  internal_links?: string[];
  media_slots?: MediaSlot[];
}

interface SeoBrief {
  meta_title?: string;
  meta_description?: string;
  canonical_policy?: string;
  recommended_anchors?: string[];
}

// ── Output ──

export interface KeywordPlanGateReport {
  gateReport: Record<string, GateResult>;
  qualityScore: number;
  duplicationScore: number;
  r1RiskScore: number;
  coverageScore: number;
}

@Injectable()
export class KeywordPlanGatesService {
  private readonly logger = new Logger(KeywordPlanGatesService.name);

  // ── Regex built once ──
  private static readonly PRICING_RE = new RegExp(
    PRIX_PAS_CHER.join('|'),
    'gi',
  );

  // ── G1: Intent Alignment ──

  checkIntentAlignment(plan: SkpRow): GateResult {
    const intent = plan.skp_primary_intent?.toLowerCase().trim();
    if (!intent) {
      return {
        gate: 'G1_INTENT_ALIGNMENT',
        status: 'fail',
        message: 'Missing primary_intent',
      };
    }
    if (!(R3_ALLOWED_INTENTS as readonly string[]).includes(intent)) {
      return {
        gate: 'G1_INTENT_ALIGNMENT',
        status: 'fail',
        message: `Intent "${intent}" not in R3 allowed list [${R3_ALLOWED_INTENTS.join(', ')}]`,
      };
    }
    return {
      gate: 'G1_INTENT_ALIGNMENT',
      status: 'pass',
      message: `Intent "${intent}" is valid for R3`,
    };
  }

  // ── G2: Boundary Respect ──

  checkBoundaryRespect(plan: SkpRow): GateResult {
    const headings = this.extractHeadings(plan);
    const violations: string[] = [];

    for (const heading of headings) {
      const lower = heading.toLowerCase();
      for (const term of PRIX_PAS_CHER) {
        if (lower.includes(term.toLowerCase())) {
          violations.push(`"${heading}" contains forbidden term "${term}"`);
        }
      }
    }

    // Also check boundaries object for leaking terms
    if (plan.skp_boundaries) {
      const boundaryStr = JSON.stringify(plan.skp_boundaries).toLowerCase();
      for (const term of PRIX_PAS_CHER) {
        if (boundaryStr.includes(term.toLowerCase())) {
          violations.push(`Boundaries object contains "${term}"`);
        }
      }
    }

    if (violations.length > 0) {
      return {
        gate: 'G2_BOUNDARY_RESPECT',
        status: 'fail',
        message: `${violations.length} R1 pricing violations: ${violations.slice(0, 3).join('; ')}`,
        fixes_applied: [],
      };
    }
    return {
      gate: 'G2_BOUNDARY_RESPECT',
      status: 'pass',
      message: 'No R1 pricing terms in headings or boundaries',
    };
  }

  // ── G3: Cluster Coverage ──

  checkClusterCoverage(plan: SkpRow): GateResult {
    const clusters = plan.skp_query_clusters as Record<
      string,
      { head?: string[]; section_target?: string }[]
    > | null;

    if (!clusters || Object.keys(clusters).length === 0) {
      return {
        gate: 'G3_CLUSTER_COVERAGE',
        status: 'warn',
        message: 'No query clusters defined',
      };
    }

    // Collect head queries and check section mapping
    let totalHead = 0;
    let mappedHead = 0;
    const unmapped: string[] = [];

    for (const [, queries] of Object.entries(clusters)) {
      if (!Array.isArray(queries)) continue;
      for (const q of queries) {
        if (q.head && q.head.length > 0) {
          totalHead += q.head.length;
          if (q.section_target) {
            mappedHead += q.head.length;
          } else {
            unmapped.push(...q.head.slice(0, 2));
          }
        }
      }
    }

    if (totalHead === 0) {
      return {
        gate: 'G3_CLUSTER_COVERAGE',
        status: 'warn',
        message: 'No head queries found in clusters',
      };
    }

    const coverage = mappedHead / totalHead;
    if (coverage < KP_QUALITY_THRESHOLDS.minCoverageScore) {
      return {
        gate: 'G3_CLUSTER_COVERAGE',
        status: 'fail',
        message: `Coverage ${(coverage * 100).toFixed(0)}% < ${KP_QUALITY_THRESHOLDS.minCoverageScore * 100}% — unmapped: ${unmapped.slice(0, 3).join(', ')}`,
      };
    }
    return {
      gate: 'G3_CLUSTER_COVERAGE',
      status: 'pass',
      message: `${(coverage * 100).toFixed(0)}% head queries mapped to sections`,
    };
  }

  // ── G4: Section Overlap ──

  checkSectionOverlap(plan: SkpRow): GateResult {
    const sectionTerms = plan.skp_section_terms;
    if (!sectionTerms || Object.keys(sectionTerms).length < 2) {
      return {
        gate: 'G4_SECTION_OVERLAP',
        status: 'pass',
        message: 'Fewer than 2 sections — no overlap possible',
      };
    }

    const sections = Object.entries(sectionTerms);
    let totalPairs = 0;
    let overlapPairs = 0;
    const violations: string[] = [];

    for (let i = 0; i < sections.length; i++) {
      for (let j = i + 1; j < sections.length; j++) {
        const [nameA, termsA] = sections[i];
        const [nameB, termsB] = sections[j];

        const setA = new Set(
          (termsA.include_terms ?? []).map((t) => t.toLowerCase()),
        );
        const setB = new Set(
          (termsB.include_terms ?? []).map((t) => t.toLowerCase()),
        );

        if (setA.size === 0 || setB.size === 0) continue;

        totalPairs++;
        const intersection = [...setA].filter((t) => setB.has(t));
        const overlapRatio =
          intersection.length / Math.min(setA.size, setB.size);

        if (overlapRatio > KP_QUALITY_THRESHOLDS.maxDuplicationScore) {
          overlapPairs++;
          violations.push(
            `${nameA}↔${nameB}: ${(overlapRatio * 100).toFixed(0)}% overlap [${intersection.slice(0, 3).join(', ')}]`,
          );
        }
      }
    }

    const duplicationScore = totalPairs > 0 ? overlapPairs / totalPairs : 0;

    if (violations.length > 0) {
      return {
        gate: 'G4_SECTION_OVERLAP',
        status:
          duplicationScore > KP_QUALITY_THRESHOLDS.maxDuplicationScore
            ? 'fail'
            : 'warn',
        message: `${violations.length} overlapping pairs: ${violations.slice(0, 2).join('; ')}`,
      };
    }
    return {
      gate: 'G4_SECTION_OVERLAP',
      status: 'pass',
      message: `No significant term overlap across ${sections.length} sections`,
    };
  }

  // ── G5: FAQ Dedup ──

  checkFaqDedup(plan: SkpRow): GateResult {
    const sectionTerms = plan.skp_section_terms;
    if (!sectionTerms) {
      return {
        gate: 'G5_FAQ_DEDUP',
        status: 'pass',
        message: 'No section terms — nothing to check',
      };
    }

    // Collect PAA questions from clusters
    const paaQuestions = new Set<string>();
    const clusters = plan.skp_query_clusters as Record<
      string,
      { paa_questions?: string[] }[]
    > | null;
    if (clusters) {
      for (const [, queries] of Object.entries(clusters)) {
        if (!Array.isArray(queries)) continue;
        for (const q of queries) {
          if (q.paa_questions) {
            for (const paa of q.paa_questions) {
              paaQuestions.add(this.normalizeQuestion(paa));
            }
          }
        }
      }
    }

    if (paaQuestions.size === 0) {
      return {
        gate: 'G5_FAQ_DEDUP',
        status: 'pass',
        message: 'No PAA questions to check against',
      };
    }

    // Check FAQ questions in each section against PAA
    const duplicates: string[] = [];
    for (const [section, terms] of Object.entries(sectionTerms)) {
      if (!terms.faq_questions) continue;
      for (const faq of terms.faq_questions) {
        const normalized = this.normalizeQuestion(faq);
        if (paaQuestions.has(normalized)) {
          duplicates.push(`${section}: "${faq}"`);
        }
      }
    }

    if (duplicates.length > 0) {
      return {
        gate: 'G5_FAQ_DEDUP',
        status: duplicates.length > 2 ? 'fail' : 'warn',
        message: `${duplicates.length} FAQ questions duplicated from PAA: ${duplicates.slice(0, 3).join('; ')}`,
      };
    }
    return {
      gate: 'G5_FAQ_DEDUP',
      status: 'pass',
      message: 'No FAQ/PAA duplication',
    };
  }

  // ── G6: Anchor Validity ──

  checkAnchorValidity(plan: SkpRow): GateResult {
    const anchors = plan.skp_seo_brief?.recommended_anchors ?? [];

    if (anchors.length === 0) {
      return {
        gate: 'G6_ANCHOR_VALIDITY',
        status: 'pass',
        message: 'No recommended anchors to validate',
      };
    }

    const invalid: string[] = [];
    for (const anchor of anchors) {
      const isValid = VALID_ANCHOR_PREFIXES.some((prefix) =>
        anchor.startsWith(prefix),
      );
      if (!isValid) {
        invalid.push(anchor);
      }
    }

    if (invalid.length > 0) {
      return {
        gate: 'G6_ANCHOR_VALIDITY',
        status: 'fail',
        message: `${invalid.length} invalid anchors (must start with ${VALID_ANCHOR_PREFIXES.join(' or ')}): ${invalid.slice(0, 3).join(', ')}`,
      };
    }
    return {
      gate: 'G6_ANCHOR_VALIDITY',
      status: 'pass',
      message: `All ${anchors.length} anchors have valid prefixes`,
    };
  }

  // ── G7: Media Budget ──

  checkMediaBudget(plan: SkpRow): GateResult {
    const sectionTerms = plan.skp_section_terms;
    if (!sectionTerms) {
      return {
        gate: 'G7_MEDIA_BUDGET',
        status: 'pass',
        message: 'No section terms to validate',
      };
    }

    let imageCount = 0;
    const violations: string[] = [];

    for (const [section, terms] of Object.entries(sectionTerms)) {
      if (!terms.media_slots) continue;
      for (const slot of terms.media_slots) {
        if (slot.type === 'image') {
          imageCount += slot.budget_cost;
        }
        const isZeroCost = (
          MEDIA_BUDGET.zeroCostTypes as readonly string[]
        ).includes(slot.type);
        if (isZeroCost && slot.budget_cost !== 0) {
          violations.push(`${section}: ${slot.type} should have budget_cost=0`);
        }
      }
    }

    if (imageCount > MEDIA_BUDGET.maxInArticleImages) {
      return {
        gate: 'G7_MEDIA_BUDGET',
        status: 'fail',
        message: `${imageCount} in-article images exceed max ${MEDIA_BUDGET.maxInArticleImages}`,
      };
    }
    if (violations.length > 0) {
      return {
        gate: 'G7_MEDIA_BUDGET',
        status: 'warn',
        message: `Budget violations: ${violations.join('; ')}`,
      };
    }
    return {
      gate: 'G7_MEDIA_BUDGET',
      status: 'pass',
      message: `${imageCount} in-article images within budget (max ${MEDIA_BUDGET.maxInArticleImages})`,
    };
  }

  // ── Run all gates ──

  runAllGates(plan: SkpRow): KeywordPlanGateReport {
    const results: GateResult[] = [
      this.checkIntentAlignment(plan),
      this.checkBoundaryRespect(plan),
      this.checkClusterCoverage(plan),
      this.checkSectionOverlap(plan),
      this.checkFaqDedup(plan),
      this.checkAnchorValidity(plan),
      this.checkMediaBudget(plan),
    ];

    // Build gate report map
    const gateReport: Record<string, GateResult> = {};
    for (const r of results) {
      gateReport[r.gate] = r;
    }

    // Compute quality score (100 - sum of penalties for failed gates)
    let qualityScore = 100;
    for (const r of results) {
      if (r.status === 'fail') {
        const def = GATE_DEFINITIONS[r.gate];
        qualityScore -= def?.penalty ?? 0;
      } else if (r.status === 'warn') {
        const def = GATE_DEFINITIONS[r.gate];
        qualityScore -= Math.floor((def?.penalty ?? 0) / 2);
      }
    }
    qualityScore = Math.max(0, qualityScore);

    // Compute sub-scores
    const duplicationScore = this.computeDuplicationScore(plan);
    const r1RiskScore = this.computeR1RiskScore(plan);
    const coverageScore = this.computeCoverageScore(plan);

    this.logger.log(
      `Gates for ${plan.skp_pg_alias}: score=${qualityScore}, dup=${duplicationScore.toFixed(2)}, r1Risk=${r1RiskScore.toFixed(2)}, cov=${coverageScore.toFixed(2)}`,
    );

    return {
      gateReport,
      qualityScore,
      duplicationScore,
      r1RiskScore,
      coverageScore,
    };
  }

  // ── Private helpers ──

  /** Extract all heading strings from heading_plan */
  private extractHeadings(plan: SkpRow): string[] {
    const headings: string[] = [];
    if (!plan.skp_heading_plan) return headings;

    const walk = (obj: unknown) => {
      if (typeof obj === 'string') {
        headings.push(obj);
      } else if (Array.isArray(obj)) {
        for (const item of obj) walk(item);
      } else if (obj && typeof obj === 'object') {
        for (const val of Object.values(obj as Record<string, unknown>)) {
          walk(val);
        }
      }
    };
    walk(plan.skp_heading_plan);
    return headings;
  }

  /** Normalize a question for dedup comparison */
  private normalizeQuestion(q: string): string {
    return q.toLowerCase().replace(/[?!.]/g, '').replace(/\s+/g, ' ').trim();
  }

  /** Compute duplication score across all section include_terms */
  private computeDuplicationScore(plan: SkpRow): number {
    const sectionTerms = plan.skp_section_terms;
    if (!sectionTerms || Object.keys(sectionTerms).length < 2) return 0;

    const allTermSets = Object.values(sectionTerms).map(
      (s) => new Set((s.include_terms ?? []).map((t) => t.toLowerCase())),
    );

    // Count how many terms appear in >1 section
    const termCount = new Map<string, number>();
    for (const set of allTermSets) {
      for (const t of set) {
        termCount.set(t, (termCount.get(t) ?? 0) + 1);
      }
    }

    const totalTerms = termCount.size;
    if (totalTerms === 0) return 0;

    const duplicated = [...termCount.values()].filter((c) => c > 1).length;
    return duplicated / totalTerms;
  }

  /** Compute R1 risk score (ratio of pricing terms found) */
  private computeR1RiskScore(plan: SkpRow): number {
    const sectionTerms = plan.skp_section_terms;
    if (!sectionTerms) return 0;

    const allText = JSON.stringify(sectionTerms).toLowerCase();
    let pricingHits = 0;
    for (const term of PRIX_PAS_CHER) {
      if (allText.includes(term.toLowerCase())) {
        pricingHits++;
      }
    }
    return pricingHits / PRIX_PAS_CHER.length;
  }

  /** Compute coverage score (sections with include_terms / total sections) */
  private computeCoverageScore(plan: SkpRow): number {
    const sectionTerms = plan.skp_section_terms;
    if (!sectionTerms) return 0;

    const sections = Object.values(sectionTerms);
    if (sections.length === 0) return 0;

    const withTerms = sections.filter(
      (s) => s.include_terms && s.include_terms.length > 0,
    ).length;
    return withTerms / sections.length;
  }

  // ══════════════════════════════════════════════════════════
  // ── V4 Audit-First Methods ───────────────────────────────
  // ══════════════════════════════════════════════════════════

  /**
   * Run all 6 audit gates (GA1-GA6) on existing sections.
   * Returns structured report with unclamped priority score (0-300+).
   */
  runAuditGates(
    sections: ConseilSectionRow[],
    packLevel: 'standard' | 'pro' | 'eeat' = 'standard',
  ): AuditGateReport {
    const ga1 = this.checkRequiredSections(sections, packLevel);
    const ga2 = this.checkScoreThreshold(sections);
    const ga3 = this.checkCrossSectionDedup(sections);
    const ga4 = this.checkGenericPhrases(sections);
    const ga5 = this.checkEeatSources(sections);
    const ga6 = this.checkThinContent(sections);

    const gateReport: Record<string, GateResult> = {
      GA1_REQUIRED_SECTIONS: ga1.result,
      GA2_SCORE_THRESHOLD: ga2.result,
      GA3_CROSS_SECTION_DEDUP: ga3.result,
      GA4_GENERIC_PHRASES: ga4.result,
      GA5_EEAT_SOURCES: ga5.result,
      GA6_THIN_CONTENT: ga6.result,
    };

    const priorityFixes: PriorityFix[] = [
      ...ga1.fixes,
      ...ga2.fixes,
      ...ga4.fixes,
      ...ga5.fixes,
      ...ga6.fixes,
    ];

    // Compute unclamped priority score
    let priorityScore = 0;
    const w = AUDIT_PRIORITY_WEIGHTS;
    priorityScore += ga1.fixes.length * w.missingRequiredSection;
    priorityScore += ga2.fixes.length * w.sectionBelowScore;
    priorityScore += ga4.fixes.length * w.highGenericPhraseRatio;
    priorityScore += ga5.fixes.length * w.noSources;
    priorityScore += ga6.fixes.length * w.thinContent;

    const sectionsToCreate = ga1.fixes
      .filter((f) => f.fix_type === 'create')
      .map((f) => f.section);
    const sectionsToImprove = [...ga2.fixes, ...ga4.fixes, ...ga6.fixes]
      .filter((f) => f.fix_type === 'improve')
      .map((f) => f.section)
      .filter((s, i, arr) => arr.indexOf(s) === i);

    return {
      priorityScore,
      priorityFixes,
      sectionsToImprove,
      sectionsToCreate,
      gateReport,
    };
  }

  /**
   * Full audit returning AuditResult for DB storage.
   * Uses runAuditGates() internally.
   */
  auditFromSections(
    existingSections: ConseilSectionRow[],
    packLevel: 'standard' | 'pro' | 'eeat' = 'standard',
  ): AuditResult {
    const pack = PACK_DEFINITIONS[packLevel];
    const required = new Set(pack.requiredSections);

    // ── Section scores + content lengths + weak phrases ──
    const sectionScores: Record<string, number> = {};
    const contentLengths: Record<string, number> = {};
    const weakPhrasesRatio: Record<string, number> = {};

    for (const row of existingSections) {
      sectionScores[row.section_type] = row.quality_score ?? 0;
      contentLengths[row.section_type] = row.content_len ?? 0;

      if (row.content) {
        const ratio = this.computeGenericRatio(row.content, row.section_type);
        if (ratio > 0) {
          weakPhrasesRatio[row.section_type] = Math.round(ratio * 100) / 100;
        }
      }
    }

    // ── Run audit gates ──
    const report = this.runAuditGates(existingSections, packLevel);

    // ── Summary ──
    const totalRequired = required.size;
    const presentRequired = totalRequired - report.sectionsToCreate.length;
    const coverage = totalRequired > 0 ? presentRequired / totalRequired : 1;
    const avgScore =
      existingSections.length > 0
        ? Math.round(
            existingSections.reduce(
              (sum, r) => sum + (r.quality_score ?? 0),
              0,
            ) / existingSections.length,
          )
        : 0;

    const auditSummary = `${presentRequired}/${totalRequired} sections (${(coverage * 100).toFixed(0)}%), avg=${avgScore}, improve=${report.sectionsToImprove.length}, create=${report.sectionsToCreate.length}, priority=${report.priorityScore}`;

    this.logger.log(`Audit: ${auditSummary}`);

    return {
      priority_score: report.priorityScore,
      priority_fixes: report.priorityFixes,
      sections_to_improve: report.sectionsToImprove,
      sections_to_create: report.sectionsToCreate,
      section_scores: sectionScores,
      missing_sections: report.sectionsToCreate,
      weak_phrases_ratio: weakPhrasesRatio,
      content_lengths: contentLengths,
      audit_summary: auditSummary,
    };
  }

  /** Determine if a gamme can be skipped entirely (all sections healthy). */
  shouldSkipGamme(
    audit: AuditResult,
    packLevel: 'standard' | 'pro' | 'eeat' = 'standard',
  ): boolean {
    const pack = PACK_DEFINITIONS[packLevel];
    const required = pack.requiredSections;

    if (audit.missing_sections.length > 0) return false;
    if (audit.sections_to_improve.length > 0) return false;

    for (const section of required) {
      const score = audit.section_scores[section];
      if (score === undefined || score < AUDIT_THRESHOLDS.healthyScoreMin) {
        return false;
      }
    }

    const presentCount = required.filter(
      (s) => audit.section_scores[s] !== undefined,
    ).length;
    return (
      presentCount / required.length >= AUDIT_THRESHOLDS.minCoverageForSkip
    );
  }

  // ── GA1: Required Sections ──

  private checkRequiredSections(
    sections: ConseilSectionRow[],
    packLevel: 'standard' | 'pro' | 'eeat',
  ): { result: GateResult; fixes: PriorityFix[] } {
    const pack = PACK_DEFINITIONS[packLevel];
    const present = new Set(sections.map((s) => s.section_type));
    const missing = pack.requiredSections.filter((s) => !present.has(s));
    const fixes: PriorityFix[] = missing.map((s) => ({
      section: s,
      issue: 'missing' as const,
      current_score: null,
      fix_type: 'create' as const,
    }));
    return {
      result: {
        gate: 'GA1_REQUIRED_SECTIONS',
        status: missing.length === 0 ? 'pass' : 'fail',
        message:
          missing.length === 0
            ? `All ${pack.requiredSections.length} required sections present`
            : `Missing ${missing.length} sections: ${missing.join(', ')}`,
      },
      fixes,
    };
  }

  // ── GA2: Score Threshold ──

  private checkScoreThreshold(sections: ConseilSectionRow[]): {
    result: GateResult;
    fixes: PriorityFix[];
  } {
    const low = sections.filter(
      (s) =>
        (s.quality_score ?? 0) < AUDIT_THRESHOLDS.improvementScoreThreshold,
    );
    const fixes: PriorityFix[] = low.map((s) => ({
      section: s.section_type,
      issue: 'low_score' as const,
      current_score: s.quality_score,
      fix_type: 'improve' as const,
    }));
    return {
      result: {
        gate: 'GA2_SCORE_THRESHOLD',
        status: low.length === 0 ? 'pass' : 'fail',
        message:
          low.length === 0
            ? 'All sections score >= 70'
            : `${low.length} sections below 70: ${low.map((s) => `${s.section_type}=${s.quality_score}`).join(', ')}`,
      },
      fixes,
    };
  }

  // ── GA3: Cross-Section Deduplication ──

  private checkCrossSectionDedup(sections: ConseilSectionRow[]): {
    result: GateResult;
    fixes: PriorityFix[];
  } {
    const paragraphMap = new Map<string, string>();
    let dupCount = 0;

    for (const row of sections) {
      if (!row.content) continue;
      const text = this.stripHtml(row.content);
      const paragraphs = text
        .split(/\.\s+/)
        .map((p) => p.trim().toLowerCase())
        .filter((p) => p.length > 40);

      for (const p of paragraphs) {
        const existing = paragraphMap.get(p);
        if (existing && existing !== row.section_type) {
          dupCount++;
        } else if (!existing) {
          paragraphMap.set(p, row.section_type);
        }
      }
    }

    return {
      result: {
        gate: 'GA3_CROSS_SECTION_DEDUP',
        status: dupCount === 0 ? 'pass' : 'warn',
        message:
          dupCount === 0
            ? 'No duplicate paragraphs across sections'
            : `${dupCount} duplicate paragraph(s) found across sections`,
      },
      fixes: [],
    };
  }

  // ── GA4: Generic Phrases ──

  private checkGenericPhrases(sections: ConseilSectionRow[]): {
    result: GateResult;
    fixes: PriorityFix[];
  } {
    const fixes: PriorityFix[] = [];

    for (const row of sections) {
      if (!row.content) continue;
      const ratio = this.computeGenericRatio(row.content, row.section_type);
      const criteria = SECTION_QUALITY_CRITERIA[row.section_type];
      if (criteria && ratio > criteria.maxGenericRatio) {
        fixes.push({
          section: row.section_type,
          issue: 'weak_phrases',
          current_score: row.quality_score,
          fix_type: 'improve',
        });
      }
    }

    return {
      result: {
        gate: 'GA4_GENERIC_PHRASES',
        status: fixes.length === 0 ? 'pass' : 'warn',
        message:
          fixes.length === 0
            ? 'All sections within generic phrase threshold'
            : `${fixes.length} sections exceed generic phrase ratio`,
      },
      fixes,
    };
  }

  // ── GA5: E-E-A-T Sources ──

  private checkEeatSources(sections: ConseilSectionRow[]): {
    result: GateResult;
    fixes: PriorityFix[];
  } {
    const noSource = sections.filter(
      (s) => !s.sources || s.sources.trim().length === 0,
    );
    const fixes: PriorityFix[] = noSource.map((s) => ({
      section: s.section_type,
      issue: 'no_sources' as const,
      current_score: s.quality_score,
      fix_type: 'improve' as const,
    }));
    return {
      result: {
        gate: 'GA5_EEAT_SOURCES',
        status: noSource.length === 0 ? 'pass' : 'warn',
        message:
          noSource.length === 0
            ? 'All sections have E-E-A-T sources'
            : `${noSource.length} sections missing sources: ${noSource.map((s) => s.section_type).join(', ')}`,
      },
      fixes,
    };
  }

  // ── GA6: Thin Content ──

  private checkThinContent(sections: ConseilSectionRow[]): {
    result: GateResult;
    fixes: PriorityFix[];
  } {
    const fixes: PriorityFix[] = [];

    for (const row of sections) {
      const criteria = SECTION_QUALITY_CRITERIA[row.section_type];
      if (!criteria) continue;
      const minLen =
        criteria.minContentLength * AUDIT_THRESHOLDS.thinContentRatio;
      if ((row.content_len ?? 0) < minLen) {
        fixes.push({
          section: row.section_type,
          issue: 'thin_content',
          current_score: row.quality_score,
          fix_type: 'improve',
        });
      }
    }

    return {
      result: {
        gate: 'GA6_THIN_CONTENT',
        status: fixes.length === 0 ? 'pass' : 'fail',
        message:
          fixes.length === 0
            ? 'All sections meet minimum content length'
            : `${fixes.length} sections below 50% min length`,
      },
      fixes,
    };
  }

  // ── V4 private helpers ──

  /** Strip HTML tags and normalize whitespace */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-zA-Z]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Compute generic phrase ratio for a section's content */
  private computeGenericRatio(
    htmlContent: string,
    _sectionType: string,
  ): number {
    const text = this.stripHtml(htmlContent);
    const words = text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return 0;

    let matchedWords = 0;
    const lower = text.toLowerCase();
    for (const pattern of GENERIC_PHRASES) {
      const matches = lower.match(pattern);
      if (matches) {
        for (const match of matches) {
          matchedWords += match.split(/\s+/).length;
        }
      }
    }

    return matchedWords / words.length;
  }
}

// ── V4 row shape for audit input ──

export interface ConseilSectionRow {
  section_type: string;
  quality_score: number | null;
  content_len: number | null;
  content?: string | null;
  sources?: string | null;
}

export interface AuditGateReport {
  priorityScore: number;
  priorityFixes: PriorityFix[];
  sectionsToImprove: string[];
  sectionsToCreate: string[];
  gateReport: Record<string, GateResult>;
}
