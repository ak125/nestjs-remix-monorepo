/**
 * UI Audit Agent - Main Orchestrator
 *
 * Usage:
 *   import { auditPage } from './index';
 *   const result = await auditPage('frontend/app/routes/cart.tsx');
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseFile, type ParsedFile } from './analyzer/file-parser';
import { evaluateRules, type EvaluationResult } from './evaluators/rule-evaluator';
import { calculateScores } from './evaluators/scoring-engine';
import { generateScoresJson, generateScoreSummary } from './generators/scores';
import { generateAuditMd, type AuditReport } from './generators/audit-md';
import type { PageScores } from './contracts';

export interface AuditOptions {
  /** Output directory for audit files */
  outDir?: string;
  /** Generate only specific formats */
  format?: 'all' | 'json' | 'md';
  /** Verbose output */
  verbose?: boolean;
  /** CI mode - exit with error if hard violations */
  ci?: boolean;
}

export interface AuditResult {
  /** Parsed file info */
  file: ParsedFile;
  /** Evaluation results */
  evaluation: EvaluationResult;
  /** Page scores */
  scores: PageScores;
  /** Generated files */
  outputFiles: string[];
  /** Has hard violations */
  hasHardViolations: boolean;
}

/**
 * Audit a single page file
 */
export async function auditPage(
  filePath: string,
  options: AuditOptions = {}
): Promise<AuditResult> {
  const {
    outDir = path.join(path.dirname(filePath), '../../scripts/ui-audit/audits'),
    format = 'all',
    verbose = false,
  } = options;

  // 1. Parse file
  if (verbose) console.log(`Parsing ${filePath}...`);
  const file = parseFile(filePath);

  // 2. Evaluate rules
  if (verbose) console.log(`Evaluating rules...`);
  const evaluation = evaluateRules(file.jsxContent, file.jsxStartLine);

  // 3. Calculate scores
  if (verbose) console.log(`Calculating scores...`);
  const scores = calculateScores(
    evaluation.hardViolations,
    evaluation.softViolations,
    file.filePath,
    file.route
  );

  // 4. Generate output files
  const outputFiles: string[] = [];

  // Ensure output directory exists
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const baseName = file.fileName.replace(/\./g, '-');

  // Generate score.json
  if (format === 'all' || format === 'json') {
    const scoreFile = path.join(outDir, `${baseName}.score.json`);
    fs.writeFileSync(scoreFile, generateScoresJson(scores));
    outputFiles.push(scoreFile);
    if (verbose) console.log(`Generated ${scoreFile}`);
  }

  // Generate audit.md
  if (format === 'all' || format === 'md') {
    const auditReport: AuditReport = {
      scores,
      softViolations: evaluation.softViolations,
      fileName: file.fileName,
      route: file.route,
    };
    const auditFile = path.join(outDir, `${baseName}.audit.md`);
    fs.writeFileSync(auditFile, generateAuditMd(auditReport));
    outputFiles.push(auditFile);
    if (verbose) console.log(`Generated ${auditFile}`);
  }

  return {
    file,
    evaluation,
    scores,
    outputFiles,
    hasHardViolations: evaluation.hardViolations.length > 0,
  };
}

/**
 * Audit multiple files
 */
export async function auditPages(
  filePaths: string[],
  options: AuditOptions = {}
): Promise<AuditResult[]> {
  const results: AuditResult[] = [];

  for (const filePath of filePaths) {
    try {
      const result = await auditPage(filePath, options);
      results.push(result);
    } catch (error) {
      console.error(`Error auditing ${filePath}:`, error);
    }
  }

  return results;
}

/**
 * Print audit summary to console
 */
export function printAuditSummary(result: AuditResult): void {
  console.log('');
  console.log('═'.repeat(60));
  console.log(`UI AUDIT: ${result.file.fileName}`);
  console.log('═'.repeat(60));
  console.log('');
  console.log(generateScoreSummary(result.scores));
  console.log('');

  if (result.hasHardViolations) {
    console.log('⚠️  HARD VIOLATIONS:');
    for (const v of result.evaluation.hardViolations) {
      console.log(`   Line ${v.line}: [${v.rule}] ${v.note}`);
    }
    console.log('');
  }

  if (result.scores.quick_wins.length > 0) {
    console.log('💡 QUICK WINS:');
    for (const qw of result.scores.quick_wins) {
      console.log(`   [${qw.impact.toUpperCase()}] ${qw.note}`);
    }
    console.log('');
  }

  console.log('═'.repeat(60));
}

export default auditPage;
