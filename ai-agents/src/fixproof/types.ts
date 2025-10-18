/**
 * 🏗️ SYSTÈME FIX+PROOF - Types Core
 * 
 * Niveau : SRE/Platform/Staff Production-Grade
 * Paradigme : Prove-Then-Deploy, Zero-Trust, Gate-Driven
 * 
 * @version 2.0.0
 * @date 2025-10-18
 */

// ============================================================================
// PATCH & EVIDENCE
// ============================================================================

export type PatchScope = 
  | 'dead-code' 
  | 'duplication' 
  | 'split' 
  | 'cycle' 
  | 'css' 
  | 'config' 
  | 'contract'
  | 'lint';

export interface AtomicPatch {
  /** Unique identifier */
  id: string;
  
  /** Type of modification */
  scope: PatchScope;
  
  /** Files affected (max 5) */
  files: string[];
  
  /** Lines changed (max 200) */
  linesChanged: number;
  
  /** KPI target (e.g., "dead-code-15") */
  kpiTarget: string;
  
  /** Git hash of baseline */
  baselineHash: string;
  
  /** Tag for rollback */
  rollbackTag: string;
  
  /** Patch content (diff) */
  diff: string;
}

export interface Evidence {
  /** Timestamp ISO 8601 */
  timestamp: string;
  
  /** Agent identifier */
  agent: string;
  
  /** Action performed */
  action: string;
  
  /** Files affected */
  files: string[];
  
  /** SHA256 hashes before/after */
  hashes: Record<string, { before: string; after: string }>;
  
  /** Metrics captured */
  metrics: Metrics;
  
  /** Screenshots (base64 or URLs) */
  screenshots?: string[];
  
  /** Log entries */
  logs: string[];
}

export interface Metrics {
  /** p95 API latency (ms) */
  p95_API?: number;
  
  /** p95 SSR latency (ms) */
  p95_SSR?: number;
  
  /** Bundle size (KB) */
  bundleSize?: number;
  
  /** Build time (seconds) */
  buildTime?: number;
  
  /** Test coverage (%) */
  coverage?: number;
  
  /** Mutation score (%) */
  mutationScore?: number;
  
  /** Error rate (%) */
  errorRate?: number;
  
  /** Custom metrics */
  custom?: Record<string, number>;
}

// ============================================================================
// RISK & CONFIDENCE
// ============================================================================

export interface RiskScore {
  /** Overall risk (0-100) */
  overall: number;
  
  /** Surface area (0-100) */
  surface: number;
  
  /** Module criticality (0-100) */
  criticality: number;
  
  /** Historical bugs (0-100) */
  historicalBugs: number;
  
  /** Commit volatility (0-100) */
  instability: number;
  
  /** Formula: R = 0.4×surface + 0.3×criticality + 0.2×bugs + 0.1×instability */
  formula: string;
}

export interface ConfidenceScore {
  /** Overall confidence (0-100) */
  overall: number;
  
  /** Tests passing (0-100) */
  tests: number;
  
  /** Performance stable (0-100) */
  performance: number;
  
  /** Diff coverage (0-100) */
  diffCoverage: number;
  
  /** Evidence completeness (0-100) */
  evidence: number;
  
  /** Formula: C = 0.4×tests + 0.3×perf + 0.2×diff-cov + 0.1×evidence */
  formula: string;
}

// ============================================================================
// TEST GATES (M1-M7)
// ============================================================================

export type GateStatus = 'PASS' | 'FAIL' | 'SKIP';

export interface Gate {
  /** Gate identifier (M1-M7) */
  id: string;
  
  /** Gate name */
  name: string;
  
  /** Status */
  status: GateStatus;
  
  /** Details/reason */
  details: string;
  
  /** Metrics */
  metrics?: Metrics;
}

export interface TestMatrix {
  /** M1: Contracts & Invariants */
  m1_contracts: Gate;
  
  /** M2: Mutation Testing */
  m2_mutation: Gate;
  
  /** M3: Perceptual UI (SSIM) */
  m3_perceptual: Gate;
  
  /** M4: Shadow Traffic Replay */
  m4_shadow: Gate;
  
  /** M5: Budget Perf & Build */
  m5_budgets: Gate;
  
  /** M6: Graph & Layers */
  m6_graph: Gate;
  
  /** M7: Diff-Coverage */
  m7_diffCoverage: Gate;
}

// ============================================================================
// DECISION MATRIX
// ============================================================================

export type Action = 
  | 'CANARY_AUTO'         // R≤30 & C≥95 & M1-M7 ✅
  | 'REVIEW_REQUIRED'     // 30<R≤60 OR 90≤C<95
  | 'REJECT_NEEDS_HUMAN'; // R>60 OR C<90 OR M-Gate ❌

export interface DecisionCondition {
  risk: { min?: number; max?: number };
  confidence: { min?: number; max?: number };
  gates: 'ALL_GREEN' | 'ANY_GATE_KO' | 'MIXED';
}

export interface DecisionRule {
  condition: DecisionCondition;
  action: Action;
  reason: string;
}

export interface Decision {
  /** Recommended action */
  action: Action;
  
  /** Reason for decision */
  reason: string;
  
  /** Risk score */
  risk: RiskScore;
  
  /** Confidence score */
  confidence: ConfidenceScore;
  
  /** Test matrix results */
  testMatrix: TestMatrix;
  
  /** Matching rule */
  rule: DecisionRule;
}

// ============================================================================
// AGENT INTERFACES
// ============================================================================

export interface FixProofAgentInput {
  /** Constat from detection agents */
  constat: {
    type: PatchScope;
    files: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  
  /** Baseline metrics */
  baseline: Metrics;
  
  /** Configuration */
  config?: Record<string, any>;
}

export interface FixProofAgentOutput {
  /** Generated patches */
  patches: AtomicPatch[];
  
  /** Evidence collected */
  evidence: Evidence[];
  
  /** Risk score */
  risk: RiskScore;
  
  /** Confidence score */
  confidence: ConfidenceScore;
  
  /** Test matrix results */
  testMatrix: TestMatrix;
  
  /** Decision */
  decision: Decision;
  
  /** PR Draft content */
  prDraft: PRDraft;
}

export interface PRDraft {
  /** PR title */
  title: string;
  
  /** PR body (markdown) */
  body: string;
  
  /** Labels */
  labels: string[];
  
  /** Reviewers */
  reviewers: string[];
  
  /** Artifacts */
  artifacts: {
    evidenceLog: string;
    testReport: string;
    rollbackPlan: string;
  };
}

// ============================================================================
// CANARY CONTROLLER
// ============================================================================

export type RingStage = '0.5%' | '5%' | '25%' | '100%';

export interface CanaryRing {
  /** Ring stage */
  stage: RingStage;
  
  /** Duration (minutes) */
  duration: number;
  
  /** Metrics captured */
  metrics: Metrics;
  
  /** Status */
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'HALTED';
  
  /** Halt reason (if halted) */
  haltReason?: string;
}

export interface CanaryPlan {
  /** Rings sequence */
  rings: CanaryRing[];
  
  /** Auto-halt conditions */
  haltConditions: {
    p95_threshold: number;      // baseline × 1.10
    errorRate_threshold: number; // 0.005 (0.5%)
    critical404_threshold: number; // 1
  };
  
  /** Rollback SLA (minutes) */
  rollbackSLA: number; // 30 min
}

// ============================================================================
// SBOM & SECURITY
// ============================================================================

export interface SBOM {
  /** Format (CycloneDX) */
  format: 'CycloneDX';
  
  /** Version */
  version: string;
  
  /** Components (dependencies) */
  components: Component[];
  
  /** Vulnerabilities */
  vulnerabilities: Vulnerability[];
}

export interface Component {
  name: string;
  version: string;
  type: 'library' | 'framework' | 'application';
  licenses: string[];
  purl?: string; // Package URL
}

export interface Vulnerability {
  id: string; // CVE-XXXX-XXXX
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedComponents: string[];
  description: string;
  recommendation: string;
}

// ============================================================================
// DORA METRICS
// ============================================================================

export interface DORAMetrics {
  /** Lead Time (commit → deploy) */
  leadTime: number; // hours
  
  /** Change Failure Rate */
  changeFailureRate: number; // %
  
  /** Mean Time To Recover */
  mttr: number; // minutes
  
  /** Deployment Frequency */
  deploymentFrequency: string; // "daily" | "weekly" | etc.
  
  /** Targets */
  targets: {
    leadTime: number;         // < 24h
    changeFailureRate: number; // < 5%
    mttr: number;             // < 30min
  };
}
