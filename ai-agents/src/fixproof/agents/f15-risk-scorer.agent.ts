/**
 * 🎯 F15 - CHANGE RISK SCORER
 * 
 * Agent : SRE/Platform-grade Risk & Confidence calculator
 * Responsabilité : Calculer R (Risk) et C (Confidence) pour décision Auto/Review/Reject
 * 
 * Formules :
 *   R = 0.4×surface + 0.3×criticité + 0.2×bugs + 0.1×instabilité
 *   C = 0.4×tests + 0.3×perf + 0.2×diff-cov + 0.1×preuves
 * 
 * Decision Matrix :
 *   R≤30 & C≥95 & M1-M7✅ → CANARY_AUTO
 *   30<R≤60 OR 90≤C<95   → REVIEW_REQUIRED
 *   R>60 OR C<90 OR M-Gate❌ → REJECT_NEEDS_HUMAN
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

import {
  RiskScore,
  ConfidenceScore,
  Decision,
  DecisionRule,
  Action,
  TestMatrix,
  GateStatus,
  Metrics,
  AtomicPatch,
  Evidence,
} from '../types';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DECISION_RULES: DecisionRule[] = [
  {
    condition: {
      risk: { max: 30 },
      confidence: { min: 95 },
      gates: 'ALL_GREEN',
    },
    action: 'CANARY_AUTO',
    reason: '🟢 Low risk, high confidence, all gates pass → Progressive auto-deploy',
  },
  {
    condition: {
      risk: { min: 30.01, max: 60 },
      confidence: { min: 90, max: 94.99 },
      gates: 'MIXED',
    },
    action: 'REVIEW_REQUIRED',
    reason: '🟡 Moderate risk or confidence → Human review + manual canary',
  },
  {
    condition: {
      risk: { min: 60.01 },
      confidence: { max: 89.99 },
      gates: 'ANY_GATE_KO',
    },
    action: 'REJECT_NEEDS_HUMAN',
    reason: '🔴 High risk or low confidence or gate failure → Reject, needs human intervention',
  },
];

// ============================================================================
// RISK CALCULATOR
// ============================================================================

export interface RiskCalculatorInput {
  /** Files modified */
  files: string[];
  
  /** Lines changed */
  linesChanged: number;
  
  /** Module paths */
  modules: string[];
  
  /** Git history (last 90 days) */
  gitHistory: {
    file: string;
    bugs: number;      // Commits with "fix" keyword
    commits: number;   // Total commits
  }[];
}

/**
 * Calculate Surface Area (0-100)
 * 
 * Heuristique :
 *   - Files ≤3 & lines ≤100 → 10
 *   - Files ≤5 & lines ≤200 → 30
 *   - Files >5 OR lines >200 → 50+
 */
function calculateSurface(input: RiskCalculatorInput): number {
  const { files, linesChanged } = input;
  
  if (files.length <= 3 && linesChanged <= 100) return 10;
  if (files.length <= 5 && linesChanged <= 200) return 30;
  
  // Progressive scoring
  const fileScore = Math.min(files.length * 5, 50);
  const lineScore = Math.min(linesChanged / 10, 50);
  
  return Math.min(fileScore + lineScore, 100);
}

/**
 * Calculate Module Criticality (0-100)
 * 
 * Heuristique :
 *   - auth/, payment/, database/ → 90
 *   - api/, services/ → 70
 *   - components/, utils/ → 40
 *   - styles/, config/ → 20
 */
function calculateCriticality(input: RiskCalculatorInput): number {
  const criticalPatterns = [
    { regex: /auth|payment|database|prisma/i, score: 90 },
    { regex: /api|services|backend\/src\/modules/i, score: 70 },
    { regex: /components|hooks|lib/i, score: 40 },
    { regex: /styles|css|config|scripts/i, score: 20 },
  ];
  
  const scores = input.files.map(file => {
    for (const pattern of criticalPatterns) {
      if (pattern.regex.test(file)) return pattern.score;
    }
    return 30; // default
  });
  
  return Math.max(...scores);
}

/**
 * Calculate Historical Bugs (0-100)
 * 
 * Heuristique :
 *   - Ratio bugs/commits sur 90j
 *   - >50% bugs → 80
 *   - 25-50% → 50
 *   - <25% → 20
 */
function calculateHistoricalBugs(input: RiskCalculatorInput): number {
  const totalBugs = input.gitHistory.reduce((sum, h) => sum + h.bugs, 0);
  const totalCommits = input.gitHistory.reduce((sum, h) => sum + h.commits, 0);
  
  if (totalCommits === 0) return 10; // No history = low risk
  
  const bugRatio = totalBugs / totalCommits;
  
  if (bugRatio > 0.5) return 80;
  if (bugRatio > 0.25) return 50;
  return 20;
}

/**
 * Calculate Instability (0-100)
 * 
 * Heuristique :
 *   - Commits > 20/month → 70
 *   - Commits 10-20 → 40
 *   - Commits < 10 → 20
 */
function calculateInstability(input: RiskCalculatorInput): number {
  const totalCommits = input.gitHistory.reduce((sum, h) => sum + h.commits, 0);
  const commitsPerMonth = totalCommits / 3; // 90 days ≈ 3 months
  
  if (commitsPerMonth > 20) return 70;
  if (commitsPerMonth > 10) return 40;
  return 20;
}

/**
 * Calculate Risk Score
 * 
 * R = 0.4×surface + 0.3×criticité + 0.2×bugs + 0.1×instabilité
 */
export function calculateRiskScore(input: RiskCalculatorInput): RiskScore {
  const surface = calculateSurface(input);
  const criticality = calculateCriticality(input);
  const historicalBugs = calculateHistoricalBugs(input);
  const instability = calculateInstability(input);
  
  const overall = 
    0.4 * surface +
    0.3 * criticality +
    0.2 * historicalBugs +
    0.1 * instability;
  
  return {
    overall: Math.round(overall),
    surface,
    criticality,
    historicalBugs,
    instability,
    formula: 'R = 0.4×surface + 0.3×criticality + 0.2×bugs + 0.1×instability',
  };
}

// ============================================================================
// CONFIDENCE CALCULATOR
// ============================================================================

export interface ConfidenceCalculatorInput {
  /** Test results */
  tests: {
    passed: number;
    total: number;
  };
  
  /** Performance metrics */
  performance: {
    baseline_p95_API: number;
    current_p95_API: number;
    baseline_p95_SSR: number;
    current_p95_SSR: number;
  };
  
  /** Diff coverage (%) */
  diffCoverage: number;
  
  /** Evidence collected */
  evidence: Evidence[];
}

/**
 * Calculate Tests Score (0-100)
 * 
 * Heuristique :
 *   - 100% pass → 100
 *   - 95-99% → 90
 *   - <95% → (passed/total)×90
 */
function calculateTestsScore(input: ConfidenceCalculatorInput): number {
  const { passed, total } = input.tests;
  
  if (total === 0) return 0; // No tests = no confidence
  
  const passRate = passed / total;
  
  if (passRate === 1) return 100;
  if (passRate >= 0.95) return 90;
  return passRate * 90;
}

/**
 * Calculate Performance Score (0-100)
 * 
 * Heuristique :
 *   - Delta p95 ≤ +5% → 100
 *   - Delta +5-10% → 80
 *   - Delta +10-15% → 60
 *   - Delta >15% → 30
 */
function calculatePerformanceScore(input: ConfidenceCalculatorInput): number {
  const { performance } = input;
  
  const apiDelta = (performance.current_p95_API - performance.baseline_p95_API) / performance.baseline_p95_API;
  const ssrDelta = (performance.current_p95_SSR - performance.baseline_p95_SSR) / performance.baseline_p95_SSR;
  
  const maxDelta = Math.max(apiDelta, ssrDelta);
  
  if (maxDelta <= 0.05) return 100;
  if (maxDelta <= 0.10) return 80;
  if (maxDelta <= 0.15) return 60;
  return 30;
}

/**
 * Calculate Diff Coverage Score (0-100)
 * 
 * Heuristique :
 *   - ≥90% → 100
 *   - 80-89% → 90
 *   - 70-79% → 70
 *   - <70% → score
 */
function calculateDiffCoverageScore(input: ConfidenceCalculatorInput): number {
  const cov = input.diffCoverage;
  
  if (cov >= 90) return 100;
  if (cov >= 80) return 90;
  if (cov >= 70) return 70;
  return cov;
}

/**
 * Calculate Evidence Score (0-100)
 * 
 * Heuristique :
 *   - Complete evidence (logs, hashes, metrics, screenshots) → 100
 *   - Partial → 50-80
 *   - Minimal → 30
 */
function calculateEvidenceScore(input: ConfidenceCalculatorInput): number {
  const { evidence } = input;
  
  if (evidence.length === 0) return 0;
  
  const hasLogs = evidence.every(e => e.logs.length > 0);
  const hasHashes = evidence.every(e => Object.keys(e.hashes).length > 0);
  const hasMetrics = evidence.every(e => e.metrics !== undefined);
  const hasScreenshots = evidence.some(e => e.screenshots && e.screenshots.length > 0);
  
  let score = 0;
  if (hasLogs) score += 30;
  if (hasHashes) score += 30;
  if (hasMetrics) score += 30;
  if (hasScreenshots) score += 10;
  
  return score;
}

/**
 * Calculate Confidence Score
 * 
 * C = 0.4×tests + 0.3×perf + 0.2×diff-cov + 0.1×preuves
 */
export function calculateConfidenceScore(input: ConfidenceCalculatorInput): ConfidenceScore {
  const tests = calculateTestsScore(input);
  const performance = calculatePerformanceScore(input);
  const diffCoverage = calculateDiffCoverageScore(input);
  const evidence = calculateEvidenceScore(input);
  
  const overall = 
    0.4 * tests +
    0.3 * performance +
    0.2 * diffCoverage +
    0.1 * evidence;
  
  return {
    overall: Math.round(overall),
    tests,
    performance,
    diffCoverage,
    evidence,
    formula: 'C = 0.4×tests + 0.3×perf + 0.2×diff-cov + 0.1×evidence',
  };
}

// ============================================================================
// DECISION ENGINE
// ============================================================================

/**
 * Check if all gates are green
 */
function areAllGatesGreen(testMatrix: TestMatrix): boolean {
  return Object.values(testMatrix).every(gate => gate.status === 'PASS');
}

/**
 * Check if any gate failed
 */
function isAnyGateKO(testMatrix: TestMatrix): boolean {
  return Object.values(testMatrix).some(gate => gate.status === 'FAIL');
}

/**
 * Determine gate condition
 */
function getGateCondition(testMatrix: TestMatrix): 'ALL_GREEN' | 'ANY_GATE_KO' | 'MIXED' {
  if (areAllGatesGreen(testMatrix)) return 'ALL_GREEN';
  if (isAnyGateKO(testMatrix)) return 'ANY_GATE_KO';
  return 'MIXED';
}

/**
 * Make decision based on R, C, and test matrix
 */
export function makeDecision(
  risk: RiskScore,
  confidence: ConfidenceScore,
  testMatrix: TestMatrix,
): Decision {
  const gateCondition = getGateCondition(testMatrix);
  
  // Evaluate rules in order
  for (const rule of DECISION_RULES) {
    const { condition } = rule;
    
    // Check risk bounds
    const riskMatch = 
      (condition.risk.min === undefined || risk.overall >= condition.risk.min) &&
      (condition.risk.max === undefined || risk.overall <= condition.risk.max);
    
    // Check confidence bounds
    const confidenceMatch = 
      (condition.confidence.min === undefined || confidence.overall >= condition.confidence.min) &&
      (condition.confidence.max === undefined || confidence.overall <= condition.confidence.max);
    
    // Check gates
    const gatesMatch = condition.gates === gateCondition;
    
    // If all conditions match, return this action
    if (riskMatch && confidenceMatch && gatesMatch) {
      return {
        action: rule.action,
        reason: rule.reason,
        risk,
        confidence,
        testMatrix,
        rule,
      };
    }
  }
  
  // Fallback: reject if no rule matches
  return {
    action: 'REJECT_NEEDS_HUMAN',
    reason: '⚠️ No rule matched → Default to reject for safety',
    risk,
    confidence,
    testMatrix,
    rule: DECISION_RULES[2], // Most restrictive rule
  };
}

// ============================================================================
// AGENT F15 - MAIN INTERFACE
// ============================================================================

export interface F15Input {
  /** Patches to evaluate */
  patches: AtomicPatch[];
  
  /** Git history (90 days) */
  gitHistory: {
    file: string;
    bugs: number;
    commits: number;
  }[];
  
  /** Test results */
  tests: {
    passed: number;
    total: number;
  };
  
  /** Performance metrics */
  performance: {
    baseline_p95_API: number;
    current_p95_API: number;
    baseline_p95_SSR: number;
    current_p95_SSR: number;
  };
  
  /** Diff coverage (%) */
  diffCoverage: number;
  
  /** Evidence collected */
  evidence: Evidence[];
  
  /** Test matrix results */
  testMatrix: TestMatrix;
}

export interface F15Output {
  risk: RiskScore;
  confidence: ConfidenceScore;
  decision: Decision;
}

/**
 * 🎯 Agent F15 - Calculate R/C and make decision
 */
export async function runF15RiskScorer(input: F15Input): Promise<F15Output> {
  // 1. Calculate Risk Score
  const riskInput: RiskCalculatorInput = {
    files: input.patches.flatMap(p => p.files),
    linesChanged: input.patches.reduce((sum, p) => sum + p.linesChanged, 0),
    modules: input.patches.flatMap(p => p.files.map(f => f.split('/')[0])),
    gitHistory: input.gitHistory,
  };
  
  const risk = calculateRiskScore(riskInput);
  
  // 2. Calculate Confidence Score
  const confidenceInput: ConfidenceCalculatorInput = {
    tests: input.tests,
    performance: input.performance,
    diffCoverage: input.diffCoverage,
    evidence: input.evidence,
  };
  
  const confidence = calculateConfidenceScore(confidenceInput);
  
  // 3. Make Decision
  const decision = makeDecision(risk, confidence, input.testMatrix);
  
  return {
    risk,
    confidence,
    decision,
  };
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  runF15RiskScorer,
  calculateRiskScore,
  calculateConfidenceScore,
  makeDecision,
};
