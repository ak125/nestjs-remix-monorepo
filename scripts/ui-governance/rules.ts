/**
 * UI Governance Rules
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md
 *
 * Rules extracted from:
 * - .claude/skills/ui-ux-pro-max/SKILL.md
 * - .claude/skills/ui-ux-pro-max/data/stacks/shadcn.csv
 * - .claude/skills/frontend-design/SKILL.md
 */

export type Severity = 'error' | 'warning';

export interface DiffGateRule {
  /** Unique rule identifier */
  id: string;
  /** Source reference (file:line or csv:row) */
  source: string;
  /** Regex pattern to match violations */
  pattern: RegExp;
  /** Severity level */
  severity: Severity;
  /** Human-readable error message */
  message: string;
  /** Suggested fix */
  fix: string;
  /** File patterns to check (glob) */
  include?: string[];
  /** File patterns to exclude (glob) */
  exclude?: string[];
}

/**
 * ERROR rules - These will block CI
 */
const ERROR_RULES: DiffGateRule[] = [
  {
    id: 'no-emoji-icons',
    source: 'SKILL.md:78,349',
    pattern: />\s*[📋🎨🚀⚙️⏳💳👤📦🔄✅❌⚠️🛒📝🏷️🔧⚡🚗🔩🏠📊📈📉🔍💡🎯🛠️]/u,
    severity: 'error',
    message: 'Emojis as icons are forbidden',
    fix: 'Use lucide-react: ClipboardList, Cog, Clock, Package, User, etc.',
    include: ['**/*.tsx'],
  },
  {
    id: 'no-hardcoded-hex-bg',
    source: 'shadcn.csv:R4',
    pattern: /className="[^"]*bg-\[#[0-9A-Fa-f]{3,6}\]/,
    severity: 'error',
    message: 'Hardcoded hex colors in bg- are forbidden',
    fix: 'Use CSS variables: bg-primary, bg-success/10, bg-destructive/10',
    include: ['**/*.tsx'],
  },
  {
    id: 'no-hardcoded-hex-text',
    source: 'shadcn.csv:R4',
    pattern: /className="[^"]*text-\[#[0-9A-Fa-f]{3,6}\]/,
    severity: 'error',
    message: 'Hardcoded hex colors in text- are forbidden',
    fix: 'Use CSS variables: text-primary, text-success, text-destructive',
    include: ['**/*.tsx'],
  },
  {
    id: 'no-hardcoded-hex-border',
    source: 'shadcn.csv:R4',
    pattern: /className="[^"]*border-\[#[0-9A-Fa-f]{3,6}\]/,
    severity: 'error',
    message: 'Hardcoded hex colors in border- are forbidden',
    fix: 'Use CSS variables: border-primary, border-muted',
    include: ['**/*.tsx'],
  },
  {
    id: 'dialog-requires-title',
    source: 'shadcn.csv:R11-13',
    pattern: /<Dialog[^>]*>(?:(?!<DialogTitle).)*?<\/Dialog>/s,
    severity: 'error',
    message: 'Dialog must include DialogTitle for accessibility',
    fix: '<Dialog><DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>...</Dialog>',
    include: ['**/*.tsx'],
  },
  {
    id: 'icon-button-aria-label',
    source: 'shadcn.csv:R54',
    pattern: /<Button[^>]*size=["']icon["'][^>]*>(?!.*aria-label)/,
    severity: 'error',
    message: 'Icon-only buttons must have aria-label',
    fix: '<Button size="icon" aria-label="Description">...',
    include: ['**/*.tsx'],
  },
];

/**
 * WARNING rules - These will generate warnings but not block
 */
const WARNING_RULES: DiffGateRule[] = [
  {
    id: 'prefer-semantic-colors',
    source: 'DESIGN-SYSTEM.automecanik.md',
    pattern: /className="[^"]*(?:text-gray-|bg-gray-)[0-9]+/,
    severity: 'warning',
    message: 'Prefer semantic colors over gray-*',
    fix: 'Use text-muted-foreground, bg-muted instead of text-gray-500, bg-gray-100',
    include: ['**/*.tsx'],
  },
  {
    id: 'clickable-cursor-pointer',
    source: 'SKILL.md:79',
    pattern: /<(?:div|span)[^>]*onClick[^>]*(?!cursor-pointer)/,
    severity: 'warning',
    message: 'Clickable elements should have cursor-pointer',
    fix: 'Add className="cursor-pointer" to clickable elements',
    include: ['**/*.tsx'],
  },
  {
    id: 'avoid-inline-styles',
    source: 'shadcn.csv',
    pattern: /style=\{\{[^}]+\}\}/,
    severity: 'warning',
    message: 'Avoid inline styles, prefer Tailwind classes',
    fix: 'Use Tailwind CSS utility classes instead',
    include: ['**/*.tsx'],
    exclude: ['**/node_modules/**'],
  },
  {
    id: 'prefer-shadcn-select',
    source: 'shadcn.csv:R20-21',
    pattern: /<select[^>]*>/,
    severity: 'warning',
    message: 'Use shadcn Select component instead of native select',
    fix: 'import { Select, SelectTrigger, SelectValue, SelectContent } from "~/components/ui/select"',
    include: ['**/*.tsx'],
  },
  {
    id: 'no-react-import',
    source: 'CLAUDE.md',
    pattern: /^import React from ['"]react['"]/m,
    severity: 'warning',
    message: 'Unnecessary React import with modern JSX transform',
    fix: 'Remove "import React from \'react\'" - it\'s not needed with modern React',
    include: ['**/*.tsx'],
  },
];

/**
 * All rules combined
 */
export const RULES: DiffGateRule[] = [...ERROR_RULES, ...WARNING_RULES];

/**
 * Get rules by severity
 */
export function getRulesBySeverity(severity: Severity): DiffGateRule[] {
  return RULES.filter((rule) => rule.severity === severity);
}

/**
 * Get rule by ID
 */
export function getRuleById(id: string): DiffGateRule | undefined {
  return RULES.find((rule) => rule.id === id);
}
