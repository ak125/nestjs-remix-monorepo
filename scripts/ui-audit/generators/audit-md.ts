/**
 * Audit MD Generator - Generate markdown audit report
 */

import type { PageScores, HardRuleViolation, Risk, QuickWin } from '../contracts';
import type { SoftRuleViolation } from '../evaluators/rule-evaluator';
import { HARD_RULES } from '../rules/hard-rules';
import { SOFT_RULES } from '../rules/soft-rules';
import * as path from 'path';

export interface AuditReport {
  scores: PageScores;
  softViolations: SoftRuleViolation[];
  fileName: string;
  route: string;
}

/**
 * Generate markdown audit report
 */
export function generateAuditMd(report: AuditReport): string {
  const { scores, softViolations, fileName, route } = report;
  const lines: string[] = [];

  // Header
  lines.push(`# UI Audit — ${fileName}`);
  lines.push('');
  lines.push(`**File:** \`${path.basename(scores.file)}\``);
  lines.push(`**Route:** \`${route}\``);
  lines.push(`**Date:** ${new Date().toISOString().split('T')[0]}`);
  lines.push(`**Scope:** UI-only (JSX + Tailwind + shadcn). No loader/action/meta changes.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary Table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Score |');
  lines.push('|--------|-------|');
  lines.push(`| **Global** | **${scores.global_score}/10** |`);

  for (const [cat, score] of Object.entries(scores.scores)) {
    const label = cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(`| ${label} | ${score.toFixed(1)} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  // Hard Rule Violations
  if (scores.hard_rule_violations.length > 0) {
    lines.push(`## Hard Rule Violations (${scores.hard_rule_violations.length} violations)`);
    lines.push('');
    lines.push('| Rule | Line | Severity | Description |');
    lines.push('|------|------|----------|-------------|');

    for (const v of scores.hard_rule_violations) {
      const rule = HARD_RULES.find((r) => r.id === v.rule);
      const severity = rule && rule.penalty >= 2 ? '❌ High' : '⚠️ Medium';
      lines.push(`| **${v.rule}** | ${v.line} | ${severity} | ${rule?.message || v.note} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Soft Rule Warnings
  if (softViolations.length > 0) {
    // Group by rule
    const byRule = new Map<string, SoftRuleViolation[]>();
    for (const v of softViolations) {
      if (!byRule.has(v.rule)) {
        byRule.set(v.rule, []);
      }
      byRule.get(v.rule)!.push(v);
    }

    lines.push(`## Soft Rule Warnings (${softViolations.length} warnings)`);
    lines.push('');
    lines.push('| Rule | Count | Impact | Description |');
    lines.push('|------|-------|--------|-------------|');

    for (const [ruleId, violations] of byRule) {
      const rule = SOFT_RULES.find((r) => r.id === ruleId);
      const impact = rule?.impact && rule.impact >= 2 ? 'Medium' : 'Low';
      lines.push(`| ${ruleId} | ${violations.length} | ${impact} | ${rule?.message || ''} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Top Risks
  if (scores.top_risks.length > 0) {
    lines.push('## Top Risks');
    lines.push('');

    for (const risk of scores.top_risks) {
      const icon = risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢';
      lines.push(`${icon} **[${risk.severity.toUpperCase()}]** ${risk.note}`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Quick Wins
  if (scores.quick_wins.length > 0) {
    lines.push('## Quick Wins');
    lines.push('');
    lines.push('| ID | Impact | Effort | Description |');
    lines.push('|----|--------|--------|-------------|');

    for (const qw of scores.quick_wins) {
      lines.push(`| ${qw.id} | ${qw.impact.toUpperCase()} | ${qw.effort.toUpperCase()} | ${qw.note} |`);
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Detailed Violations (if any hard violations)
  if (scores.hard_rule_violations.length > 0) {
    lines.push('## Detailed Violations');
    lines.push('');

    // Group by rule
    const byRule = new Map<string, HardRuleViolation[]>();
    for (const v of scores.hard_rule_violations) {
      if (!byRule.has(v.rule)) {
        byRule.set(v.rule, []);
      }
      byRule.get(v.rule)!.push(v);
    }

    for (const [ruleId, violations] of byRule) {
      const rule = HARD_RULES.find((r) => r.id === ruleId);
      lines.push(`### ${ruleId}: ${rule?.name || 'Unknown'}`);
      lines.push('');

      for (const v of violations) {
        lines.push(`**Line ${v.line}**`);
        lines.push('```');
        lines.push(`Fix: ${rule?.fix || 'See rule documentation'}`);
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  // Verdict
  lines.push('## Verdict');
  lines.push('');

  const verdictEmoji = scores.global_score >= 8 ? '✅' : scores.global_score >= 6 ? '⚠️' : '❌';
  const verdictText =
    scores.global_score >= 8
      ? 'Good - Minor issues only'
      : scores.global_score >= 6
        ? 'Acceptable - Some improvements needed'
        : 'Needs Work - Significant issues found';

  lines.push(`**Score: ${scores.global_score}/10** ${verdictEmoji} ${verdictText}`);
  lines.push('');

  if (scores.hard_rule_violations.length > 0) {
    lines.push(`**Action Required:** Fix ${scores.hard_rule_violations.length} hard rule violation(s) before deployment.`);
  }

  lines.push('');

  return lines.join('\n');
}

export default generateAuditMd;
