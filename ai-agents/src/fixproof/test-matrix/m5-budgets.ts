/**
 * 🧪 M5 - BUDGET PERF & BUILD
 * 
 * Gate : Vérifie que les budgets de performance et build ne dépassent pas les seuils
 * 
 * Objectif :
 *   - Prevent performance regressions
 *   - Enforce bundle size limits
 *   - Ensure build time doesn't explode
 * 
 * Critères :
 *   - p95 API ≤ baseline × 1.10 (+10% max)
 *   - p95 SSR ≤ baseline × 1.10 (+10% max)
 *   - Bundle size ≤ baseline × 1.03 (+3% max)
 *   - Build time ≤ baseline × 1.05 (+5% max)
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

import { Gate, GateStatus, Metrics } from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const BUDGET_THRESHOLDS = {
  P95_API: 1.10,        // +10% max
  P95_SSR: 1.10,        // +10% max
  BUNDLE_SIZE: 1.03,    // +3% max
  BUILD_TIME: 1.05,     // +5% max
};

// ============================================================================
// BUDGET CHECKER
// ============================================================================

export interface BudgetInput {
  /** Baseline metrics */
  baseline: {
    p95_API: number;      // ms
    p95_SSR: number;      // ms
    bundleSize: number;   // KB
    buildTime: number;    // seconds
  };
  
  /** Current metrics */
  current: {
    p95_API: number;
    p95_SSR: number;
    bundleSize: number;
    buildTime: number;
  };
  
  /** Custom thresholds (optional) */
  thresholds?: Partial<typeof BUDGET_THRESHOLDS>;
}

export interface BudgetResult {
  metric: string;
  baseline: number;
  current: number;
  delta: number;        // percentage change
  threshold: number;    // max allowed delta
  passed: boolean;
}

/**
 * Check if metric is within budget
 */
function checkBudget(
  metric: string,
  baseline: number,
  current: number,
  threshold: number,
): BudgetResult {
  const delta = (current - baseline) / baseline;
  const passed = delta <= threshold;
  
  return {
    metric,
    baseline,
    current,
    delta,
    threshold,
    passed,
  };
}

/**
 * Check all budgets
 */
export function checkAllBudgets(input: BudgetInput): BudgetResult[] {
  const thresholds = { ...BUDGET_THRESHOLDS, ...input.thresholds };
  
  return [
    checkBudget('p95_API', input.baseline.p95_API, input.current.p95_API, thresholds.P95_API),
    checkBudget('p95_SSR', input.baseline.p95_SSR, input.current.p95_SSR, thresholds.P95_SSR),
    checkBudget('bundleSize', input.baseline.bundleSize, input.current.bundleSize, thresholds.BUNDLE_SIZE),
    checkBudget('buildTime', input.baseline.buildTime, input.current.buildTime, thresholds.BUILD_TIME),
  ];
}

// ============================================================================
// GATE M5 - BUDGET PERF & BUILD
// ============================================================================

export interface M5Input extends BudgetInput {}

export interface M5Output {
  gate: Gate;
  results: BudgetResult[];
  violations: BudgetResult[];
}

/**
 * Run M5 Gate - Budget Perf & Build
 * 
 * PASS if:
 *   - All budgets within thresholds
 * 
 * FAIL if:
 *   - Any budget exceeded
 */
export async function runM5BudgetsGate(input: M5Input): Promise<M5Output> {
  // 1. Check all budgets
  const results = checkAllBudgets(input);
  
  // 2. Identify violations
  const violations = results.filter(r => !r.passed);
  
  // 3. Determine gate status
  if (violations.length === 0) {
    const details = results
      .map(r => `  ✅ ${r.metric}: ${r.current.toFixed(1)} (${(r.delta * 100).toFixed(1)}% from baseline)`)
      .join('\n');
    
    return {
      gate: {
        id: 'M5',
        name: 'Budget Perf & Build',
        status: 'PASS',
        details: `✅ All budgets within thresholds:\n${details}`,
        metrics: {
          p95_API: input.current.p95_API,
          p95_SSR: input.current.p95_SSR,
          bundleSize: input.current.bundleSize,
          buildTime: input.current.buildTime,
        },
      },
      results,
      violations,
    };
  }
  
  // 4. Budget exceeded → FAIL
  const violationDetails = violations
    .map(v => `  ❌ ${v.metric}: ${v.current.toFixed(1)} (+${(v.delta * 100).toFixed(1)}% > threshold ${(v.threshold * 100).toFixed(0)}%)`)
    .join('\n');
  
  return {
    gate: {
      id: 'M5',
      name: 'Budget Perf & Build',
      status: 'FAIL',
      details: `❌ ${violations.length} budget(s) exceeded:\n${violationDetails}`,
      metrics: {
        p95_API: input.current.p95_API,
        p95_SSR: input.current.p95_SSR,
        bundleSize: input.current.bundleSize,
        buildTime: input.current.buildTime,
      },
    },
    results,
    violations,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  runM5BudgetsGate,
  checkBudget,
  checkAllBudgets,
};
