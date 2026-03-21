/**
 * Agentic Engine Constants
 *
 * Single source of truth for phases, limits, timeouts, step types.
 * Pattern: as const tuples + type derivation (like keyword-plan.constants.ts)
 */

// ── Run Phases (state machine) ──

export const RUN_PHASES = [
  'created',
  'planning',
  'solving',
  'critiquing',
  'verifying',
  'arbitrating',
  'applying',
  'completed',
  'failed',
  'suspended',
] as const;
export type RunPhase = (typeof RUN_PHASES)[number];

// ── Valid phase transitions ──

export const PHASE_TRANSITIONS: Record<RunPhase, readonly RunPhase[]> = {
  created: ['planning', 'failed'],
  planning: ['solving', 'failed', 'suspended'],
  solving: ['critiquing', 'failed', 'suspended'],
  critiquing: ['verifying', 'planning', 'failed'], // planning = critic loop
  verifying: ['arbitrating', 'failed', 'suspended'],
  arbitrating: ['applying', 'failed', 'suspended'],
  applying: ['completed', 'failed'],
  completed: [],
  failed: [],
  suspended: ['planning', 'solving', 'critiquing', 'verifying', 'arbitrating'],
} as const;

// ── Step Types ──

export const STEP_TYPES = [
  'llm_call',
  'db_query',
  'db_write',
  'gate_check',
  'rag_fetch',
  'validation',
  'computation',
] as const;
export type StepType = (typeof STEP_TYPES)[number];

// ── Evidence Types ──

export const EVIDENCE_TYPES = [
  'llm_output',
  'db_result',
  'gate_check',
  'rag_citation',
  'human_input',
  'computation',
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

// ── Branch Statuses ──

export const BRANCH_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
  'pruned',
  'rejected',
] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

// ── Gate Verdicts ──

export const GATE_VERDICTS = ['PASS', 'WARN', 'FAIL', 'PENDING'] as const;
export type GateVerdict = (typeof GATE_VERDICTS)[number];

export const GATE_TYPES = ['hard', 'soft'] as const;
export type GateType = (typeof GATE_TYPES)[number];

// ── Safe-to-apply decision ──

export const APPLY_DECISIONS = ['apply', 'defer_to_human', 'block'] as const;
export type ApplyDecision = (typeof APPLY_DECISIONS)[number];

// ── Limits & Timeouts ──

export const AGENTIC_DEFAULTS = {
  /** Maximum parallel branches per run */
  MAX_BRANCHES: 3,
  /** Hard cap on branches (even with env override) */
  MAX_BRANCHES_CAP: 5,
  /** Maximum critic re-planning loops */
  MAX_CRITIC_LOOPS: 2,
  /** Hard cap on critic loops */
  MAX_CRITIC_LOOPS_CAP: 3,
  /** Default daily token budget per goal_type */
  DAILY_TOKEN_BUDGET: 100_000,
  /** Consecutive failures before auto-pause queue */
  AUTO_PAUSE_THRESHOLD: 3,
  /** Job timeouts (ms) */
  TIMEOUTS: {
    plan: 60_000,
    solve: 120_000,
    critique: 60_000,
    verify: 30_000,
    arbitrate: 30_000,
    apply: 60_000,
  },
  /** BullMQ retry config per job type */
  RETRIES: {
    plan: { attempts: 2, delay: 5_000 },
    solve: { attempts: 2, delay: 10_000 },
    critique: { attempts: 1, delay: 5_000 },
    verify: { attempts: 1, delay: 5_000 },
    arbitrate: { attempts: 0, delay: 0 },
    apply: { attempts: 2, delay: 5_000 },
  },
} as const;

// ── Goal Types ──

export const GOAL_TYPES = [
  'keyword_plan',
  'content_generation',
  'rag_quality_check',
  'seo_audit',
  'brand_content',
  'vehicle_content',
] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

// ── Goal Registry ──

export interface GoalRegistryEntry {
  /** Claude Code agents to invoke as branches */
  agents: string[];
  /** Target DB tables for output */
  targetTables: string[];
  /** RAG knowledge required? */
  ragRequired: boolean;
  /** Max parallel branches (override default) */
  maxBranches: number;
  /** Can trigger a chained run on completion? */
  chainable: boolean;
  /** Human-readable description */
  description: string;
}

export const GOAL_REGISTRY: Record<GoalType, GoalRegistryEntry> = {
  keyword_plan: {
    agents: [
      'r1-keyword-planner',
      'r3-keyword-planner',
      'r4-keyword-planner',
      'r5-keyword-planner',
      'r6-keyword-planner',
      'r7-keyword-planner',
      'r8-keyword-planner',
    ],
    targetTables: [
      '__seo_r1_keyword_plan',
      '__seo_r3_keyword_plan',
      '__seo_r4_keyword_plan',
      '__seo_r5_keyword_plan',
      '__seo_r6_keyword_plan',
      '__seo_r7_keyword_plan',
      '__seo_r8_keyword_plan',
    ],
    ragRequired: true,
    maxBranches: 3,
    chainable: true,
    description: 'Planification mots-cles SEO par role R*',
  },
  content_generation: {
    agents: [
      'r1-content-batch',
      'r4-content-batch',
      'r6-content-batch',
      'conseil-batch',
    ],
    targetTables: [
      '__seo_r1_gamme_slots',
      '__seo_reference',
      '__seo_gamme_purchase_guide',
      '__blog_conseils',
    ],
    ragRequired: true,
    maxBranches: 3,
    chainable: true,
    description: 'Generation contenu SEO par role R*',
  },
  rag_quality_check: {
    agents: ['phase1-auditor'],
    targetTables: [],
    ragRequired: true,
    maxBranches: 2,
    chainable: false,
    description: 'Audit qualite corpus RAG',
  },
  seo_audit: {
    agents: ['research-agent', 'brief-enricher', 'blog-hub-planner'],
    targetTables: ['__seo_research_brief'],
    ragRequired: true,
    maxBranches: 3,
    chainable: true,
    description: 'Audit SEO complet — gaps, intent, cannibalisation',
  },
  brand_content: {
    agents: ['r7-brand-rag-generator', 'r7-keyword-planner'],
    targetTables: ['__seo_r7_keyword_plan'],
    ragRequired: true,
    maxBranches: 2,
    chainable: true,
    description: 'Contenu hub marque constructeur',
  },
  vehicle_content: {
    agents: ['r8-keyword-planner', 'r8-vehicle-execution'],
    targetTables: ['__seo_r8_vehicle_plan'],
    ragRequired: true,
    maxBranches: 2,
    chainable: true,
    description: 'Contenu hub vehicule',
  },
} as const;

// ── BullMQ Queue Name ──

export const AGENTIC_QUEUE_NAME = 'agentic-engine' as const;

// ── Job Names ──

export const AGENTIC_JOB_NAMES = [
  'agentic-plan',
  'agentic-solve',
  'agentic-critique',
  'agentic-verify',
  'agentic-arbitrate',
  'agentic-apply',
] as const;
export type AgenticJobName = (typeof AGENTIC_JOB_NAMES)[number];

// ── Phase → Job mapping ──

export const PHASE_TO_JOB: Record<
  Extract<
    RunPhase,
    | 'planning'
    | 'solving'
    | 'critiquing'
    | 'verifying'
    | 'arbitrating'
    | 'applying'
  >,
  AgenticJobName
> = {
  planning: 'agentic-plan',
  solving: 'agentic-solve',
  critiquing: 'agentic-critique',
  verifying: 'agentic-verify',
  arbitrating: 'agentic-arbitrate',
  applying: 'agentic-apply',
} as const;
