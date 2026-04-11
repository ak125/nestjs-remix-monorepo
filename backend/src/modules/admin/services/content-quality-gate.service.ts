import { Injectable, Logger } from '@nestjs/common';
import {
  MIN_R3_SECTION_LENGTH,
  MIN_R6_HTC_LENGTH,
  MIN_R6_INTRO_LENGTH,
  MIN_R6_RISK_LENGTH,
  MIN_R1_CONTENT_LENGTH,
  MIN_R4_DEFINITION_LENGTH,
  FORBIDDEN_VOCAB_GLOBAL,
  VOCAB_FALSE_POSITIVES_R3,
} from '../../../config/buying-guide-quality.constants';

/**
 * Unified content quality gate for all SEO roles (R1, R3, R4, R6).
 *
 * Used by:
 * - ConseilEnricherService (R3 sections)
 * - R1EnricherService (sg_content)
 * - BuyingGuideEnricherService (R6 how_to_choose)
 * - Audit cron (weekly quality check)
 *
 * Pure sync logic — no DB, no I/O.
 */

export interface ContentGateResult {
  ok: boolean;
  violations: ContentViolation[];
}

export interface ContentViolation {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  value?: number;
  threshold?: number;
}

@Injectable()
export class ContentQualityGateService {
  private readonly logger = new Logger(ContentQualityGateService.name);

  /**
   * Validate R3 section content before writing to DB.
   */
  validateR3Section(
    sectionType: string,
    content: string,
    mustNotContain: string[] = [],
  ): ContentGateResult {
    const violations: ContentViolation[] = [];

    // Skip META and S_GARAGE — no length requirements
    if (['META', 'S_GARAGE'].includes(sectionType)) {
      return { ok: true, violations: [] };
    }

    // Gate 1: Minimum length
    if (content.length < MIN_R3_SECTION_LENGTH) {
      violations.push({
        rule: 'MIN_LENGTH',
        severity: 'error',
        message: `R3 ${sectionType} content too short (${content.length}c < ${MIN_R3_SECTION_LENGTH}c minimum)`,
        value: content.length,
        threshold: MIN_R3_SECTION_LENGTH,
      });
    }

    // Gate 2: Forbidden vocabulary (global)
    const vocabViolations = this.checkForbiddenVocab(content, 'R3');
    violations.push(...vocabViolations);

    // Gate 3: RAG-specific must_not_contain
    const ragViolations = this.checkMustNotContain(
      content,
      mustNotContain,
      sectionType,
    );
    violations.push(...ragViolations);

    const hasErrors = violations.some((v) => v.severity === 'error');
    return { ok: !hasErrors, violations };
  }

  /**
   * Validate R1 sg_content before writing to DB.
   */
  validateR1Content(
    content: string,
    mustNotContain: string[] = [],
  ): ContentGateResult {
    const violations: ContentViolation[] = [];

    if (content.length < MIN_R1_CONTENT_LENGTH) {
      violations.push({
        rule: 'MIN_LENGTH',
        severity: 'error',
        message: `R1 sg_content too short (${content.length}c < ${MIN_R1_CONTENT_LENGTH}c minimum)`,
        value: content.length,
        threshold: MIN_R1_CONTENT_LENGTH,
      });
    }

    violations.push(...this.checkForbiddenVocab(content, 'R1'));
    violations.push(...this.checkMustNotContain(content, mustNotContain, 'R1'));

    const hasErrors = violations.some((v) => v.severity === 'error');
    return { ok: !hasErrors, violations };
  }

  /**
   * Validate R4 definition before writing to DB.
   */
  validateR4Definition(
    definition: string,
    mustNotContain: string[] = [],
  ): ContentGateResult {
    const violations: ContentViolation[] = [];

    if (definition.length < MIN_R4_DEFINITION_LENGTH) {
      violations.push({
        rule: 'MIN_LENGTH',
        severity: 'error',
        message: `R4 definition too short (${definition.length}c < ${MIN_R4_DEFINITION_LENGTH}c minimum)`,
        value: definition.length,
        threshold: MIN_R4_DEFINITION_LENGTH,
      });
    }

    violations.push(...this.checkForbiddenVocab(definition, 'R4'));
    violations.push(
      ...this.checkMustNotContain(definition, mustNotContain, 'R4'),
    );

    const hasErrors = violations.some((v) => v.severity === 'error');
    return { ok: !hasErrors, violations };
  }

  /**
   * Validate R6 purchase guide fields before writing to DB.
   */
  validateR6PurchaseGuide(fields: {
    introRole?: string;
    riskExplanation?: string;
    howToChoose?: string;
    mustNotContain?: string[];
  }): ContentGateResult {
    const violations: ContentViolation[] = [];
    const mnc = fields.mustNotContain ?? [];

    if (fields.introRole && fields.introRole.length < MIN_R6_INTRO_LENGTH) {
      violations.push({
        rule: 'MIN_LENGTH',
        severity: 'warning',
        message: `R6 intro_role short (${fields.introRole.length}c < ${MIN_R6_INTRO_LENGTH}c)`,
        value: fields.introRole.length,
        threshold: MIN_R6_INTRO_LENGTH,
      });
    }

    if (
      fields.riskExplanation &&
      fields.riskExplanation.length < MIN_R6_RISK_LENGTH
    ) {
      violations.push({
        rule: 'MIN_LENGTH',
        severity: 'warning',
        message: `R6 risk_explanation short (${fields.riskExplanation.length}c < ${MIN_R6_RISK_LENGTH}c)`,
        value: fields.riskExplanation.length,
        threshold: MIN_R6_RISK_LENGTH,
      });
    }

    if (fields.howToChoose) {
      if (fields.howToChoose.length < MIN_R6_HTC_LENGTH) {
        violations.push({
          rule: 'MIN_LENGTH',
          severity: 'error',
          message: `R6 how_to_choose too short (${fields.howToChoose.length}c < ${MIN_R6_HTC_LENGTH}c minimum)`,
          value: fields.howToChoose.length,
          threshold: MIN_R6_HTC_LENGTH,
        });
      }

      violations.push(...this.checkForbiddenVocab(fields.howToChoose, 'R6'));
      violations.push(
        ...this.checkMustNotContain(fields.howToChoose, mnc, 'R6'),
      );
    }

    const hasErrors = violations.some((v) => v.severity === 'error');
    return { ok: !hasErrors, violations };
  }

  /**
   * Check global forbidden vocabulary.
   * Returns warnings (not errors) for terms in VOCAB_FALSE_POSITIVES_R3 when role is R3.
   */
  private checkForbiddenVocab(
    content: string,
    role: string,
  ): ContentViolation[] {
    const violations: ContentViolation[] = [];
    const lower = content.toLowerCase();

    for (const term of FORBIDDEN_VOCAB_GLOBAL) {
      if (lower.includes(term.toLowerCase())) {
        violations.push({
          rule: 'FORBIDDEN_VOCAB',
          severity: 'warning',
          message: `Forbidden term "${term}" found in ${role} content`,
        });
      }
    }

    return violations;
  }

  /**
   * Check RAG-specific must_not_contain terms.
   * "adaptable" in R3 context is a known false positive.
   */
  private checkMustNotContain(
    content: string,
    mustNotContain: string[],
    context: string,
  ): ContentViolation[] {
    const violations: ContentViolation[] = [];
    const lower = content.toLowerCase();

    for (const term of mustNotContain) {
      if (lower.includes(term.toLowerCase())) {
        const isFalsePositive =
          context.startsWith('R3') || context.startsWith('S')
            ? VOCAB_FALSE_POSITIVES_R3.includes(term.toLowerCase())
            : false;

        violations.push({
          rule: 'RAG_MUST_NOT_CONTAIN',
          severity: isFalsePositive ? 'warning' : 'error',
          message: `RAG must_not_contain term "${term}" found in ${context}${isFalsePositive ? ' (false positive in R3 context)' : ''}`,
        });
      }
    }

    return violations;
  }

  /**
   * Run a full audit query — returns SQL for use in cron/Paperclip routine.
   */
  getAuditSQL(): string {
    return `
-- Quality Audit — R1+R3+R4+R6 — run weekly
SELECT 'R1' as role, 'content_short' as issue, COUNT(*) as count
FROM __seo_gamme WHERE LENGTH(sg_content) < ${MIN_R1_CONTENT_LENGTH}
UNION ALL
SELECT 'R1', 'missing_meta', COUNT(*)
FROM __seo_gamme WHERE sg_descrip IS NULL AND sg_descrip_draft IS NULL
UNION ALL
SELECT 'R3', 'section_short', COUNT(*)
FROM __seo_gamme_conseil c
JOIN __seo_r3_keyword_plan kp ON kp.skp_pg_id = c.sgc_pg_id::int
WHERE kp.skp_status = 'validated' AND c.sgc_section_type NOT IN ('META','S_GARAGE')
  AND LENGTH(c.sgc_content) < ${MIN_R3_SECTION_LENGTH}
UNION ALL
SELECT 'R4', 'definition_short', COUNT(*)
FROM __seo_reference WHERE LENGTH(definition) < ${MIN_R4_DEFINITION_LENGTH}
UNION ALL
SELECT 'R6', 'htc_short', COUNT(*)
FROM __seo_gamme_purchase_guide WHERE LENGTH(sgpg_how_to_choose) < ${MIN_R6_HTC_LENGTH}
ORDER BY role, issue;`;
  }
}
