/**
 * UI Audit Agent - Contracts & Types
 *
 * @see /home/deploy/.claude/plans/tidy-spinning-shamir.md
 */

// ============================================================================
// BLOCK DETECTION
// ============================================================================

export interface BlockInfo {
  /** Unique identifier: PageName:SectionName:BlockType:Index */
  id: string;
  /** Type of block (component name or element type) */
  type: string;
  /** Line number in source file */
  line: number;
  /** Column number */
  column: number;
  /** Element tag (div, section, header, etc.) */
  element?: string;
  /** Component name if shadcn/custom */
  component?: string;
  /** Raw className string */
  className?: string;
  /** Parsed Tailwind classes */
  tailwindClasses?: string[];
  /** Child blocks */
  children?: BlockInfo[];
  /** data-ui-block attribute if present */
  dataUiBlock?: string;
}

export interface SectionInfo {
  /** Section identifier: PageName:SectionName */
  id: string;
  /** Line number */
  line: number;
  /** Element type (section, header, main, aside, footer) */
  element: string;
  /** data-ui-section attribute if present */
  dataUiSection?: string;
  /** Blocks within this section */
  blocks: BlockInfo[];
}

export interface BlockMap {
  /** Source file path */
  file: string;
  /** Route pattern */
  route: string;
  /** Page name derived from file */
  pageName: string;
  /** Detected sections */
  sections: SectionInfo[];
  /** Total block count */
  totalBlocks: number;
}

// ============================================================================
// SCORING
// ============================================================================

export type ScoreCategory =
  | 'mobile_first'
  | 'responsive'
  | 'touch_ux'
  | 'readability'
  | 'ecommerce_ux'
  | 'a11y'
  | 'design_system';

export interface BlockScore {
  /** Block ID */
  blockId: string;
  /** Scores by category (0-10) */
  scores: Record<ScoreCategory, number>;
  /** Weighted global score */
  globalScore: number;
  /** Issues found */
  issues: ScoreIssue[];
}

export interface ScoreIssue {
  /** Issue ID */
  id: string;
  /** Category */
  category: ScoreCategory;
  /** Severity */
  severity: 'high' | 'medium' | 'low';
  /** Description */
  message: string;
  /** Line number */
  line?: number;
  /** Suggested fix */
  fix?: string;
}

export interface PageScores {
  /** Source file */
  file: string;
  /** Route */
  route: string;
  /** Timestamp */
  timestamp: string;
  /** Global score (weighted average) */
  global_score: number;
  /** Scores by category */
  scores: Record<ScoreCategory, number>;
  /** Hard rule violations */
  hard_rule_violations: HardRuleViolation[];
  /** Top risks */
  top_risks: Risk[];
  /** Quick wins */
  quick_wins: QuickWin[];
  /** Block-level scores */
  block_scores?: BlockScore[];
}

// ============================================================================
// RULES
// ============================================================================

export type RuleSeverity = 'error' | 'warning';

export interface HardRule {
  /** Rule ID (HR-001, HR-002, etc.) */
  id: string;
  /** Rule name */
  name: string;
  /** Regex pattern to detect violation */
  pattern: RegExp;
  /** Pattern that should NOT match (negation) */
  without?: RegExp;
  /** Context description */
  context?: string;
  /** Error message */
  message: string;
  /** Suggested fix */
  fix: string;
  /** Applicable to specific page types */
  pageTypes?: string[];
  /** Category this rule affects */
  category: ScoreCategory;
  /** Score penalty when violated (0-10) */
  penalty: number;
}

export interface SoftRule {
  /** Rule ID (SR-001, etc.) */
  id: string;
  /** Rule name */
  name: string;
  /** Pattern to detect */
  pattern: RegExp;
  /** Recommended pattern */
  recommended?: RegExp;
  /** Message */
  message: string;
  /** Suggested fix */
  fix: string;
  /** Category */
  category: ScoreCategory;
  /** Score impact (0-5) */
  impact: number;
}

export interface HardRuleViolation {
  /** Rule ID */
  rule: string;
  /** Line number */
  line: number;
  /** Column */
  column?: number;
  /** Note/description */
  note: string;
  /** Block ID if applicable */
  blockId?: string;
}

// ============================================================================
// RISKS & QUICK WINS
// ============================================================================

export interface Risk {
  /** Risk ID */
  id: string;
  /** Severity */
  severity: 'high' | 'medium' | 'low';
  /** Affected block */
  block?: string;
  /** Description */
  note: string;
  /** Category */
  category?: ScoreCategory;
}

export interface QuickWin {
  /** Quick win ID */
  id: string;
  /** Impact level */
  impact: 'high' | 'medium' | 'low';
  /** Effort level */
  effort: 'low' | 'medium' | 'high';
  /** Description */
  note: string;
  /** Affected block */
  block?: string;
  /** Suggested patch ID */
  patchRef?: string;
}

// ============================================================================
// PATCHES
// ============================================================================

export type PatchType = 'search_replace' | 'insert_before' | 'insert_after' | 'wrap' | 'delete';

export interface Patch {
  /** Patch ID */
  id: string;
  /** Patch type */
  type: PatchType;
  /** Scope (always ui_only) */
  scope: 'ui_only';
  /** Affected block */
  block?: string;
  /** Reason for change */
  reason: string;
  /** Line number (for context) */
  line?: number;
  /** For search_replace: string to find */
  search?: string;
  /** For search_replace: replacement string */
  replace?: string;
  /** For insert: content to insert */
  content?: string;
  /** Effort estimate */
  effort?: 'low' | 'medium' | 'high';
  /** Category this patch addresses */
  category?: ScoreCategory;
}

export interface PatchPlan {
  /** Source file */
  file: string;
  /** Patches to apply */
  patches: Patch[];
  /** Safety guards */
  forbidden_changes_guard: {
    no_loader_action_meta: boolean;
    no_new_deps: boolean;
    no_inline_styles: boolean;
    no_business_logic: boolean;
  };
}

// ============================================================================
// AUDIT REPORT
// ============================================================================

export interface BlockAudit {
  /** Block ID */
  id: string;
  /** Block role/purpose */
  role: string;
  /** Purpose description */
  purpose: string;
  /** Score (0-10) */
  score: number;
  /** Current issues */
  issues: AuditIssue[];
  /** Mobile-first fixes */
  mobileFixes: string[];
  /** Responsive fixes */
  responsiveFixes: string[];
  /** UX e-commerce fixes */
  uxFixes: string[];
  /** A11y fixes */
  a11yFixes: string[];
  /** Proposed patches */
  patchRefs: string[];
  /** Notes/constraints */
  notes?: string;
}

export interface AuditIssue {
  /** Issue number within block */
  number: number;
  /** Description */
  description: string;
  /** Severity */
  severity: 'high' | 'medium' | 'low';
  /** Category */
  category: ScoreCategory;
}

export interface SectionAudit {
  /** Section ID */
  id: string;
  /** Blocks in this section */
  blocks: BlockAudit[];
}

export interface AuditReport {
  /** Source file */
  file: string;
  /** Route */
  route: string;
  /** Timestamp */
  timestamp: string;
  /** Scope reminder */
  scope: string;
  /** Global score */
  globalScore: number;
  /** Scores by category */
  scores: Record<ScoreCategory, number>;
  /** Top risks */
  topRisks: Risk[];
  /** Quick wins */
  quickWins: QuickWin[];
  /** Hard rule violations */
  hardRuleViolations: HardRuleViolation[];
  /** Section audits */
  sections: SectionAudit[];
  /** Patches summary */
  patchesSummary: Array<{
    id: string;
    block: string;
    type: PatchType;
    effort: string;
  }>;
}

// ============================================================================
// ANALYZER OUTPUTS
// ============================================================================

export interface TailwindAnalysis {
  /** All classes found */
  allClasses: string[];
  /** Responsive classes (sm:, md:, lg:, xl:, 2xl:) */
  responsiveClasses: Map<string, string[]>;
  /** Layout classes (flex, grid, etc.) */
  layoutClasses: string[];
  /** Spacing classes (p-, m-, gap-) */
  spacingClasses: string[];
  /** Typography classes (text-, font-) */
  typographyClasses: string[];
  /** Color classes (bg-, text-, border-) */
  colorClasses: string[];
  /** Interactive classes (hover:, focus:, active:) */
  interactiveClasses: string[];
  /** Issues detected */
  issues: TailwindIssue[];
}

export interface TailwindIssue {
  /** Issue type */
  type: 'hardcoded_color' | 'missing_mobile_base' | 'missing_responsive' | 'deprecated_class';
  /** Class that caused the issue */
  class: string;
  /** Line number */
  line: number;
  /** Message */
  message: string;
  /** Suggested fix */
  fix: string;
}

export interface ShadcnAnalysis {
  /** Components used */
  componentsUsed: string[];
  /** Components that should be used but aren't */
  componentsSuggested: string[];
  /** Pattern compliance issues */
  patternIssues: ShadcnIssue[];
}

export interface ShadcnIssue {
  /** Issue type */
  type: 'missing_component' | 'wrong_pattern' | 'accessibility' | 'deprecated';
  /** Component involved */
  component: string;
  /** Line number */
  line: number;
  /** Message */
  message: string;
  /** Fix */
  fix: string;
}

// ============================================================================
// CLI OPTIONS
// ============================================================================

export interface AuditOptions {
  /** Input file(s) or glob pattern */
  input: string[];
  /** Output directory */
  outDir: string;
  /** Output formats */
  formats: ('md' | 'json' | 'all')[];
  /** CI mode (fail on hard rules) */
  ci: boolean;
  /** Fail on hard rule violations */
  failOnHardRules: boolean;
  /** Verbose output */
  verbose: boolean;
  /** Only generate specific outputs */
  only?: ('audit' | 'score' | 'patch' | 'blockmap')[];
}

// ============================================================================
// WEIGHT CONFIGURATION
// ============================================================================

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
 * Calculate weighted global score from category scores
 */
export function calculateGlobalScore(scores: Record<ScoreCategory, number>): number {
  let total = 0;
  for (const [category, weight] of Object.entries(SCORE_WEIGHTS)) {
    total += (scores[category as ScoreCategory] || 0) * weight;
  }
  return Math.round(total * 10) / 10;
}
