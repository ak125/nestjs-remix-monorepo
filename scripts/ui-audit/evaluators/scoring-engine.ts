/**
 * Scoring Engine - Calculate weighted scores
 *
 * Responsibilities:
 * - Calculate category scores
 * - Apply penalties for hard rule violations
 * - Apply impacts for soft rule violations
 * - Calculate weighted global score
 * - Identify top risks and quick wins
 */

import type {
  PageScores,
  HardRuleViolation,
  ScoreCategory,
  Risk,
  QuickWin,
} from '../contracts';
import { HARD_RULES } from '../rules/hard-rules';
import type { SoftRuleViolation } from './rule-evaluator';

/**
 * Score weights by category (must sum to 1.0)
 */
export const SCORE_WEIGHTS: Record<ScoreCategory, number> = {
  mobile_first: 0.20,
  responsive: 0.15,
  touch_ux: 0.15,
  readability: 0.10,
  ecommerce_ux: 0.20,
  a11y: 0.10,
  design_system: 0.10,
};

/**
 * Calculate page scores from violations
 */
export function calculateScores(
  hardViolations: HardRuleViolation[],
  softViolations: SoftRuleViolation[],
  file: string,
  route: string
): PageScores {
  // Initialize scores (start at 10)
  const scores: Record<ScoreCategory, number> = {
    mobile_first: 10,
    responsive: 10,
    touch_ux: 10,
    readability: 10,
    ecommerce_ux: 10,
    a11y: 10,
    design_system: 10,
  };

  // Apply hard rule penalties
  for (const violation of hardViolations) {
    const rule = HARD_RULES.find((r) => r.id === violation.rule);
    if (rule) {
      scores[rule.category] = Math.max(0, scores[rule.category] - rule.penalty);
    }
  }

  // Apply soft rule impacts
  for (const violation of softViolations) {
    scores[violation.category] = Math.max(
      0,
      scores[violation.category] - violation.impact * 0.5
    );
  }

  // Calculate weighted global score
  let globalScore = 0;
  for (const [category, weight] of Object.entries(SCORE_WEIGHTS)) {
    globalScore += scores[category as ScoreCategory] * weight;
  }

  // Round to 1 decimal
  globalScore = Math.round(globalScore * 10) / 10;

  // Identify top risks
  const topRisks = identifyRisks(hardViolations, softViolations);

  // Identify quick wins
  const quickWins = identifyQuickWins(hardViolations, softViolations);

  return {
    file,
    route,
    timestamp: new Date().toISOString(),
    global_score: globalScore,
    scores,
    hard_rule_violations: hardViolations,
    top_risks: topRisks,
    quick_wins: quickWins,
  };
}

/**
 * Identify top risks (high severity issues)
 */
function identifyRisks(
  hardViolations: HardRuleViolation[],
  softViolations: SoftRuleViolation[]
): Risk[] {
  const risks: Risk[] = [];

  // Group hard violations by rule
  const hardByRule = new Map<string, HardRuleViolation[]>();
  for (const v of hardViolations) {
    if (!hardByRule.has(v.rule)) {
      hardByRule.set(v.rule, []);
    }
    hardByRule.get(v.rule)!.push(v);
  }

  // Create risks for hard rule violations
  for (const [ruleId, violations] of hardByRule) {
    const rule = HARD_RULES.find((r) => r.id === ruleId);
    if (rule) {
      const severity = rule.penalty >= 2 ? 'high' : rule.penalty >= 1 ? 'medium' : 'low';
      risks.push({
        id: `RISK-${ruleId}`,
        severity,
        note: `${rule.name}: ${violations.length} violation(s) - ${rule.message}`,
        category: rule.category,
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  risks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return risks.slice(0, 5); // Top 5 risks
}

/**
 * Identify quick wins (high impact, low effort fixes)
 */
function identifyQuickWins(
  hardViolations: HardRuleViolation[],
  softViolations: SoftRuleViolation[]
): QuickWin[] {
  const quickWins: QuickWin[] = [];

  // Group hard violations by rule
  const hardByRule = new Map<string, HardRuleViolation[]>();
  for (const v of hardViolations) {
    if (!hardByRule.has(v.rule)) {
      hardByRule.set(v.rule, []);
    }
    hardByRule.get(v.rule)!.push(v);
  }

  // Quick wins are rules with simple fixes (single line changes)
  const easyRules = ['HR-001', 'HR-008', 'HR-009', 'HR-005'];

  for (const ruleId of easyRules) {
    const violations = hardByRule.get(ruleId);
    if (violations && violations.length > 0) {
      const rule = HARD_RULES.find((r) => r.id === ruleId);
      if (rule) {
        quickWins.push({
          id: `QW-${ruleId}`,
          impact: rule.penalty >= 2 ? 'high' : 'medium',
          effort: 'low',
          note: `Fix ${violations.length} ${rule.name} violation(s): ${rule.fix}`,
          patchRef: `PATCH-${ruleId}`,
        });
      }
    }
  }

  return quickWins;
}

/**
 * Calculate global score from category scores
 */
export function calculateGlobalScore(scores: Record<ScoreCategory, number>): number {
  let total = 0;
  for (const [category, weight] of Object.entries(SCORE_WEIGHTS)) {
    total += scores[category as ScoreCategory] * weight;
  }
  return Math.round(total * 10) / 10;
}

export default calculateScores;
