/**
 * Rule Evaluator - Apply hard and soft rules to content
 *
 * Responsibilities:
 * - Run hard rules (blocking violations)
 * - Run soft rules (warnings)
 * - Track line numbers for each violation
 */

import type { HardRule, SoftRule, HardRuleViolation, ScoreCategory } from '../contracts';
import { HARD_RULES } from '../rules/hard-rules';
import { SOFT_RULES } from '../rules/soft-rules';

export interface SoftRuleViolation {
  /** Rule ID */
  rule: string;
  /** Line number */
  line: number;
  /** Column */
  column?: number;
  /** Matched content */
  match: string;
  /** Category */
  category: ScoreCategory;
  /** Impact score */
  impact: number;
}

export interface EvaluationResult {
  /** Hard rule violations (blocking) */
  hardViolations: HardRuleViolation[];
  /** Soft rule violations (warnings) */
  softViolations: SoftRuleViolation[];
  /** Count by category */
  violationsByCategory: Record<ScoreCategory, number>;
}

/**
 * Evaluate content against all rules
 */
export function evaluateRules(
  content: string,
  startLine: number = 1,
  pageType?: string
): EvaluationResult {
  const hardViolations = evaluateHardRules(content, startLine, pageType);
  const softViolations = evaluateSoftRules(content, startLine);

  // Count violations by category
  const violationsByCategory = {} as Record<ScoreCategory, number>;
  const categories: ScoreCategory[] = [
    'mobile_first',
    'responsive',
    'touch_ux',
    'readability',
    'ecommerce_ux',
    'a11y',
    'design_system',
  ];

  for (const cat of categories) {
    violationsByCategory[cat] = 0;
  }

  for (const v of hardViolations) {
    const rule = HARD_RULES.find((r) => r.id === v.rule);
    if (rule) {
      violationsByCategory[rule.category]++;
    }
  }

  for (const v of softViolations) {
    violationsByCategory[v.category]++;
  }

  return {
    hardViolations,
    softViolations,
    violationsByCategory,
  };
}

/**
 * Evaluate hard rules
 */
function evaluateHardRules(
  content: string,
  startLine: number,
  pageType?: string
): HardRuleViolation[] {
  const violations: HardRuleViolation[] = [];
  const lines = content.split('\n');

  for (const rule of HARD_RULES) {
    // Skip if rule is for specific page types and doesn't match
    if (rule.pageTypes && pageType && !rule.pageTypes.includes(pageType)) {
      continue;
    }

    // Find all matches
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const matches = line.match(rule.pattern);

      if (matches) {
        // Check if "without" pattern exists and matches (negation)
        if (rule.without && rule.without.test(line)) {
          continue; // Skip - the correct pattern is present
        }

        violations.push({
          rule: rule.id,
          line: startLine + i,
          note: `${rule.message}. Fix: ${rule.fix}`,
        });
      }
    }
  }

  return violations;
}

/**
 * Evaluate soft rules
 */
function evaluateSoftRules(content: string, startLine: number): SoftRuleViolation[] {
  const violations: SoftRuleViolation[] = [];
  const lines = content.split('\n');

  for (const rule of SOFT_RULES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(rule.pattern);

      if (match) {
        // Check if recommended pattern already present
        if (rule.recommended && rule.recommended.test(line)) {
          continue;
        }

        violations.push({
          rule: rule.id,
          line: startLine + i,
          match: match[0],
          category: rule.category,
          impact: rule.impact,
        });
      }
    }
  }

  return violations;
}

/**
 * Get rule by ID
 */
export function getHardRule(id: string): HardRule | undefined {
  return HARD_RULES.find((r) => r.id === id);
}

/**
 * Get soft rule by ID
 */
export function getSoftRule(id: string): SoftRule | undefined {
  return SOFT_RULES.find((r) => r.id === id);
}

export default evaluateRules;
