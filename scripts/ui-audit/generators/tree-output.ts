/**
 * Tree Output Generator - Visual tree representation of audit results
 */

import type { PageScores, ScoreCategory } from '../contracts';
import type { SoftRuleViolation } from '../evaluators/rule-evaluator';
import { HARD_RULES } from '../rules/hard-rules';
import { SOFT_RULES } from '../rules/soft-rules';

const ICONS = {
  file: '📄',
  score: '📊',
  hardViolation: '❌',
  softWarning: '⚠️',
  quickWin: '💡',
  check: '✅',
  none: '(none)',
};

const TREE = {
  branch: '├──',
  lastBranch: '└──',
  vertical: '│',
  space: '   ',
};

/**
 * Generate a progress bar
 */
function progressBar(score: number, width: number = 10): string {
  const filled = Math.round(score);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Generate visual tree output for audit result
 */
export function generateTreeOutput(
  scores: PageScores,
  softViolations: SoftRuleViolation[],
  fileName: string
): string {
  const lines: string[] = [];

  // File header
  lines.push(`${ICONS.file} ${fileName}`);

  // Score section
  lines.push(`${TREE.branch} ${ICONS.score} Score: ${scores.global_score}/10`);

  const categories = Object.entries(scores.scores) as [ScoreCategory, number][];
  categories.forEach(([cat, score], index) => {
    const prefix = index === categories.length - 1 ? TREE.lastBranch : TREE.branch;
    const label = cat.replace(/_/g, '_').padEnd(15);
    const bar = progressBar(score);
    lines.push(`${TREE.vertical}   ${prefix} ${label} ${bar} ${score.toFixed(1)}`);
  });

  lines.push(`${TREE.vertical}`);

  // Hard violations section
  const hardCount = scores.hard_rule_violations.length;
  lines.push(`${TREE.branch} ${ICONS.hardViolation} Hard Violations (${hardCount})`);

  if (hardCount === 0) {
    lines.push(`${TREE.vertical}   ${TREE.lastBranch} ${ICONS.none}`);
  } else {
    scores.hard_rule_violations.forEach((v, index) => {
      const prefix = index === hardCount - 1 ? TREE.lastBranch : TREE.branch;
      const rule = HARD_RULES.find((r) => r.id === v.rule);
      lines.push(`${TREE.vertical}   ${prefix} ${v.rule}:L${v.line} ${rule?.name || ''}`);
    });
  }

  lines.push(`${TREE.vertical}`);

  // Soft warnings section
  const softCount = softViolations.length;
  lines.push(`${TREE.branch} ${ICONS.softWarning} Soft Warnings (${softCount})`);

  if (softCount === 0) {
    lines.push(`${TREE.vertical}   ${TREE.lastBranch} ${ICONS.none}`);
  } else {
    // Group by rule
    const byRule = new Map<string, SoftRuleViolation[]>();
    for (const v of softViolations) {
      if (!byRule.has(v.rule)) {
        byRule.set(v.rule, []);
      }
      byRule.get(v.rule)!.push(v);
    }

    const ruleEntries = Array.from(byRule.entries());
    ruleEntries.forEach(([ruleId, violations], ruleIndex) => {
      const prefix = ruleIndex === ruleEntries.length - 1 ? TREE.lastBranch : TREE.branch;
      const rule = SOFT_RULES.find((r) => r.id === ruleId);
      lines.push(
        `${TREE.vertical}   ${prefix} ${ruleId} (${violations.length}x): ${rule?.message || ''}`
      );
    });
  }

  lines.push(`${TREE.vertical}`);

  // Quick wins section
  const qwCount = scores.quick_wins.length;
  lines.push(`${TREE.lastBranch} ${ICONS.quickWin} Quick Wins (${qwCount})`);

  if (qwCount === 0) {
    lines.push(`    ${TREE.lastBranch} ${ICONS.none}`);
  } else {
    scores.quick_wins.forEach((qw, index) => {
      const prefix = index === qwCount - 1 ? TREE.lastBranch : TREE.branch;
      lines.push(`    ${prefix} ${qw.id}: ${qw.note}`);
    });
  }

  return lines.join('\n');
}

/**
 * Generate comparison tree (before vs after)
 */
export function generateComparisonTree(
  before: PageScores,
  after: PageScores,
  fileName: string
): string {
  const lines: string[] = [];

  lines.push(`${ICONS.file} ${fileName} - Comparison`);
  lines.push('');
  lines.push('                     BEFORE          AFTER           DELTA');
  lines.push('─'.repeat(65));

  // Global score
  const globalDelta = after.global_score - before.global_score;
  const deltaSign = globalDelta >= 0 ? '+' : '';
  lines.push(
    `${ICONS.score} Score:              ${before.global_score.toFixed(1).padEnd(15)} ${after.global_score.toFixed(1).padEnd(15)} ${deltaSign}${globalDelta.toFixed(1)}`
  );

  lines.push('');

  // Category scores
  const categories = Object.keys(before.scores) as ScoreCategory[];
  for (const cat of categories) {
    const beforeScore = before.scores[cat];
    const afterScore = after.scores[cat];
    const delta = afterScore - beforeScore;
    const sign = delta >= 0 ? '+' : '';

    const label = cat.replace(/_/g, ' ').padEnd(18);
    const beforeBar = progressBar(beforeScore, 8);
    const afterBar = progressBar(afterScore, 8);

    if (delta !== 0) {
      lines.push(`  ${label} ${beforeBar} ${beforeScore.toFixed(1).padEnd(6)} ${afterBar} ${afterScore.toFixed(1).padEnd(6)} ${sign}${delta.toFixed(1)}`);
    }
  }

  lines.push('');
  lines.push('─'.repeat(65));

  // Violations
  const hardBefore = before.hard_rule_violations.length;
  const hardAfter = after.hard_rule_violations.length;
  const hardDelta = hardAfter - hardBefore;

  lines.push(
    `${ICONS.hardViolation} Hard Violations:    ${hardBefore.toString().padEnd(15)} ${hardAfter.toString().padEnd(15)} ${hardDelta <= 0 ? '✅' : '❌'} ${hardDelta}`
  );

  return lines.join('\n');
}

export default generateTreeOutput;
