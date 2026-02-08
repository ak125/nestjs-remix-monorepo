/**
 * Score Generator - Generate score.json output
 */

import type { PageScores } from '../contracts';

/**
 * Generate JSON score output
 */
export function generateScoresJson(scores: PageScores): string {
  return JSON.stringify(scores, null, 2);
}

/**
 * Generate summary text for score
 */
export function generateScoreSummary(scores: PageScores): string {
  const lines: string[] = [];

  lines.push(`Score: ${scores.global_score}/10`);
  lines.push('');
  lines.push('By Category:');

  for (const [cat, score] of Object.entries(scores.scores)) {
    const bar = '█'.repeat(Math.round(score)) + '░'.repeat(10 - Math.round(score));
    lines.push(`  ${cat.padEnd(15)} ${bar} ${score.toFixed(1)}`);
  }

  if (scores.hard_rule_violations.length > 0) {
    lines.push('');
    lines.push(`Hard Violations: ${scores.hard_rule_violations.length}`);
  }

  return lines.join('\n');
}

export default generateScoresJson;
