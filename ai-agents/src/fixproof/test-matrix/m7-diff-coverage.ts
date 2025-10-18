/**
 * 🧬 M7 - DIFF-COVERAGE
 * 
 * Gate : Vérifie que la couverture de tests sur les lignes modifiées est ≥80%
 * 
 * Objectif :
 *   - Prevent untested code from being deployed
 *   - Focus on changed lines (not overall coverage)
 *   - Enforce quality on new/modified code
 * 
 * Critères :
 *   - Diff coverage ≥80% → PASS
 *   - 70-79% → PASS with warning
 *   - <70% → FAIL
 * 
 * Tools :
 *   - Jest with --coverage --changedSince=baseline
 *   - Istanbul coverage reports
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

import { Gate, GateStatus } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CONFIGURATION
// ============================================================================

const COVERAGE_THRESHOLDS = {
  PASS: 80,         // ≥80% → PASS
  WARN: 70,         // 70-79% → PASS with warning
  FAIL: 70,         // <70% → FAIL
};

// ============================================================================
// COVERAGE PARSING
// ============================================================================

export interface CoverageReport {
  /** File path */
  file: string;
  
  /** Lines coverage (%) */
  lines: number;
  
  /** Branches coverage (%) */
  branches: number;
  
  /** Functions coverage (%) */
  functions: number;
  
  /** Statements coverage (%) */
  statements: number;
}

/**
 * Parse Jest coverage report (JSON format)
 * 
 * Expected format:
 * {
 *   "coverage": {
 *     "/path/to/file.ts": {
 *       "lines": { "total": 100, "covered": 85, "pct": 85 },
 *       "branches": { "total": 20, "covered": 18, "pct": 90 },
 *       ...
 *     }
 *   }
 * }
 */
export function parseCoverageReport(reportPath: string): CoverageReport[] {
  try {
    const content = fs.readFileSync(reportPath, 'utf8');
    const report = JSON.parse(content);
    
    const coverage: CoverageReport[] = [];
    
    for (const [file, data] of Object.entries(report.coverage || {})) {
      const fileData = data as any;
      
      coverage.push({
        file,
        lines: fileData.lines?.pct || 0,
        branches: fileData.branches?.pct || 0,
        functions: fileData.functions?.pct || 0,
        statements: fileData.statements?.pct || 0,
      });
    }
    
    return coverage;
  } catch (error) {
    console.error(`Failed to parse coverage report: ${error}`);
    return [];
  }
}

/**
 * Filter coverage for changed files only
 */
export function filterDiffCoverage(
  coverage: CoverageReport[],
  changedFiles: string[],
): CoverageReport[] {
  return coverage.filter(c => 
    changedFiles.some(f => c.file.includes(f) || f.includes(c.file))
  );
}

/**
 * Calculate average diff coverage
 */
export function calculateDiffCoverage(coverage: CoverageReport[]): number {
  if (coverage.length === 0) return 0;
  
  const totalLines = coverage.reduce((sum, c) => sum + c.lines, 0);
  return totalLines / coverage.length;
}

// ============================================================================
// GATE M7 - DIFF-COVERAGE
// ============================================================================

export interface M7Input {
  /** Changed files */
  changedFiles: string[];
  
  /** Path to coverage report (JSON) */
  coverageReportPath: string;
  
  /** Custom threshold (optional) */
  threshold?: number;
}

export interface M7Output {
  gate: Gate;
  diffCoverage: number;
  coveredFiles: CoverageReport[];
  uncoveredFiles: string[];
}

/**
 * Run M7 Gate - Diff-Coverage
 * 
 * PASS if:
 *   - Diff coverage ≥80%
 *   - 70-79% (with warning)
 * 
 * FAIL if:
 *   - Diff coverage <70%
 *   - Coverage report not found
 */
export async function runM7DiffCoverageGate(input: M7Input): Promise<M7Output> {
  const { changedFiles, coverageReportPath, threshold = COVERAGE_THRESHOLDS.PASS } = input;
  
  // 1. Check if coverage report exists
  if (!fs.existsSync(coverageReportPath)) {
    return {
      gate: {
        id: 'M7',
        name: 'Diff-Coverage',
        status: 'FAIL',
        details: `❌ Coverage report not found: ${coverageReportPath}`,
      },
      diffCoverage: 0,
      coveredFiles: [],
      uncoveredFiles: changedFiles,
    };
  }
  
  // 2. Parse coverage report
  const allCoverage = parseCoverageReport(coverageReportPath);
  
  // 3. Filter for changed files only
  const diffCoverage = filterDiffCoverage(allCoverage, changedFiles);
  
  // 4. Calculate average diff coverage
  const avgCoverage = calculateDiffCoverage(diffCoverage);
  
  // 5. Identify uncovered files
  const coveredFilePaths = diffCoverage.map(c => c.file);
  const uncoveredFiles = changedFiles.filter(f => 
    !coveredFilePaths.some(cf => cf.includes(f) || f.includes(cf))
  );
  
  // 6. Determine gate status
  if (avgCoverage >= threshold) {
    return {
      gate: {
        id: 'M7',
        name: 'Diff-Coverage',
        status: 'PASS',
        details: `✅ Diff coverage: ${avgCoverage.toFixed(1)}% (≥${threshold}%)`,
        metrics: {
          coverage: avgCoverage,
          custom: {
            coveredFiles: diffCoverage.length,
            uncoveredFiles: uncoveredFiles.length,
          },
        },
      },
      diffCoverage: avgCoverage,
      coveredFiles: diffCoverage,
      uncoveredFiles,
    };
  }
  
  if (avgCoverage >= COVERAGE_THRESHOLDS.WARN) {
    return {
      gate: {
        id: 'M7',
        name: 'Diff-Coverage',
        status: 'PASS',
        details: `⚠️ Diff coverage: ${avgCoverage.toFixed(1)}% (warning: below ${threshold}%, but ≥${COVERAGE_THRESHOLDS.WARN}%)`,
        metrics: {
          coverage: avgCoverage,
        },
      },
      diffCoverage: avgCoverage,
      coveredFiles: diffCoverage,
      uncoveredFiles,
    };
  }
  
  // 7. Coverage too low → FAIL
  return {
    gate: {
      id: 'M7',
      name: 'Diff-Coverage',
      status: 'FAIL',
      details: `❌ Diff coverage: ${avgCoverage.toFixed(1)}% (<${COVERAGE_THRESHOLDS.WARN}%)\nUncovered files (${uncoveredFiles.length}):\n${uncoveredFiles.map(f => `  - ${f}`).join('\n')}`,
      metrics: {
        coverage: avgCoverage,
      },
    },
    diffCoverage: avgCoverage,
    coveredFiles: diffCoverage,
    uncoveredFiles,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  runM7DiffCoverageGate,
  parseCoverageReport,
  filterDiffCoverage,
  calculateDiffCoverage,
};
