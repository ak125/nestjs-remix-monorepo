/**
 * Soft Rules - Recommandations (non-bloquantes)
 *
 * Ces règles génèrent des warnings mais ne bloquent pas le CI.
 * Elles représentent des bonnes pratiques et optimisations.
 */

import type { SoftRule, ScoreCategory } from '../contracts';

export const SOFT_RULES: SoftRule[] = [
  // ============================================================================
  // SR-001: Prefer Semantic Colors
  // ============================================================================
  {
    id: 'SR-001',
    name: 'prefer-semantic-colors',
    pattern: /(?:text|bg)-gray-[0-9]+/,
    recommended: /(?:text|bg)-(?:muted|foreground|primary|secondary)/,
    message: 'Préférer les couleurs sémantiques aux grays directs',
    fix: 'text-muted-foreground, bg-muted au lieu de text-gray-500, bg-gray-100',
    category: 'design_system',
    impact: 2,
  },

  // ============================================================================
  // SR-002: Clickable Cursor Pointer
  // ============================================================================
  {
    id: 'SR-002',
    name: 'clickable-cursor-pointer',
    pattern: /<(?:div|span)[^>]*onClick[^>]*(?!cursor-pointer)/,
    message: 'Éléments cliquables doivent avoir cursor-pointer',
    fix: 'Ajouter cursor-pointer aux éléments avec onClick',
    category: 'touch_ux',
    impact: 1,
  },

  // ============================================================================
  // SR-003: Avoid Inline Styles
  // ============================================================================
  {
    id: 'SR-003',
    name: 'avoid-inline-styles',
    pattern: /style=\{\{[^}]+\}\}/,
    message: 'Éviter les styles inline, préférer Tailwind',
    fix: 'Convertir en classes Tailwind équivalentes',
    category: 'design_system',
    impact: 1,
  },

  // ============================================================================
  // SR-004: Prefer shadcn Select
  // ============================================================================
  {
    id: 'SR-004',
    name: 'prefer-shadcn-select',
    pattern: /<select[^>]*>/,
    message: 'Utiliser shadcn Select au lieu de select natif',
    fix: 'import { Select, SelectTrigger, SelectValue, SelectContent } from "~/components/ui/select"',
    category: 'design_system',
    impact: 2,
  },

  // ============================================================================
  // SR-005: Remove Unnecessary React Import
  // ============================================================================
  {
    id: 'SR-005',
    name: 'no-react-import',
    pattern: /^import React from ['"]react['"]/m,
    message: 'Import React inutile avec le JSX transform moderne',
    fix: 'Supprimer "import React from \'react\'"',
    category: 'design_system',
    impact: 0.5,
  },

  // ============================================================================
  // SR-006: Use Transition for Hovers
  // ============================================================================
  {
    id: 'SR-006',
    name: 'hover-needs-transition',
    pattern: /hover:[^"]*$/,
    recommended: /transition(?:-[a-z]+)?/,
    message: 'États hover devraient avoir une transition',
    fix: 'Ajouter transition-colors ou transition-all',
    category: 'touch_ux',
    impact: 1,
  },

  // ============================================================================
  // SR-007: Prefer Gap Over Space
  // ============================================================================
  {
    id: 'SR-007',
    name: 'prefer-gap',
    pattern: /space-[xy]-[0-9]+/,
    recommended: /gap-[0-9]+/,
    message: 'Préférer gap à space-x/space-y pour les layouts flex/grid',
    fix: 'Remplacer space-x-4 par gap-4 avec flex ou grid',
    category: 'readability',
    impact: 0.5,
  },

  // ============================================================================
  // SR-008: Loading States
  // ============================================================================
  {
    id: 'SR-008',
    name: 'button-loading-state',
    pattern: /<Button[^>]*(?:isLoading|loading)[^>]*>/,
    message: 'Boutons avec état loading doivent désactiver les interactions',
    fix: 'Ajouter disabled={isLoading} et afficher un spinner',
    category: 'touch_ux',
    impact: 2,
  },

  // ============================================================================
  // SR-009: Truncate Long Text
  // ============================================================================
  {
    id: 'SR-009',
    name: 'truncate-long-text',
    pattern: /<(?:h[1-6]|p|span)[^>]*className="[^"]*(?!truncate|line-clamp)/,
    message: 'Textes longs devraient être tronqués sur mobile',
    fix: 'Ajouter truncate ou line-clamp-2 pour le texte qui peut déborder',
    category: 'responsive',
    impact: 1,
  },

  // ============================================================================
  // SR-010: Focus Visible States
  // ============================================================================
  {
    id: 'SR-010',
    name: 'focus-visible',
    pattern: /<(?:Button|a\s|input)[^>]*className=/,
    recommended: /focus:|focus-visible:/,
    message: 'Éléments interactifs doivent avoir des états focus visibles',
    fix: 'shadcn/ui gère cela automatiquement, vérifier les composants custom',
    category: 'a11y',
    impact: 2,
  },

  // ============================================================================
  // SR-011: Image Alt Text
  // ============================================================================
  {
    id: 'SR-011',
    name: 'image-alt-text',
    pattern: /<img[^>]*(?!.*alt=)/,
    message: 'Images doivent avoir un attribut alt',
    fix: 'Ajouter alt="description" ou alt="" pour images décoratives',
    category: 'a11y',
    impact: 3,
  },

  // ============================================================================
  // SR-012: Prefer Skeleton Loading
  // ============================================================================
  {
    id: 'SR-012',
    name: 'prefer-skeleton',
    pattern: /(?:Loading\.\.\.|Chargement|isLoading \? "Loading")/i,
    message: 'Préférer les skeletons aux textes de chargement',
    fix: 'Utiliser Skeleton de shadcn/ui pour un meilleur UX',
    category: 'ecommerce_ux',
    impact: 2,
  },

  // ============================================================================
  // SR-013: Price Formatting
  // ============================================================================
  {
    id: 'SR-013',
    name: 'price-formatting',
    pattern: /\{.*?\.toFixed\(2\)\}.*?€|€.*?\{.*?\.toFixed\(2\)\}/,
    message: 'Prix devraient utiliser Intl.NumberFormat pour le formatage',
    fix: 'new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(price)',
    category: 'readability',
    impact: 1,
  },

  // ============================================================================
  // SR-014: Consistent Button Sizes
  // ============================================================================
  {
    id: 'SR-014',
    name: 'consistent-button-sizes',
    pattern: /<Button[^>]*className="[^"]*(?:h-8|h-9|h-10)[^"]*"/,
    message: 'Tailles de boutons devraient être cohérentes (h-11 recommandé)',
    fix: 'Standardiser sur h-11 pour les boutons principaux, size="sm" pour secondaires',
    category: 'design_system',
    impact: 1,
  },

  // ============================================================================
  // SR-015: Responsive Text Sizes
  // ============================================================================
  {
    id: 'SR-015',
    name: 'responsive-text',
    // Match text-size NOT preceded by breakpoint (sm:/md:/lg:) and NOT followed by responsive variant
    pattern: /className="[^"]*(?<!sm:)(?<!md:)(?<!lg:)text-(?:xs|sm|base|lg|xl|2xl)/,
    recommended: /(?:sm:|md:|lg:)text-/,
    message: 'Tailles de texte pourraient bénéficier de responsive',
    fix: 'text-sm md:text-base lg:text-lg pour une meilleure lisibilité',
    category: 'readability',
    impact: 1,
  },
];

/**
 * Check content against a soft rule
 */
export function checkSoftRule(
  rule: SoftRule,
  content: string
): Array<{ line: number; match: string }> {
  const violations: Array<{ line: number; match: string }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(rule.pattern);

    if (match) {
      // Check if recommended pattern is already used
      if (rule.recommended && rule.recommended.test(line)) {
        continue;
      }

      violations.push({
        line: i + 1,
        match: match[0],
      });
    }
  }

  return violations;
}

/**
 * Get soft rules by category
 */
export function getSoftRulesByCategory(category: ScoreCategory): SoftRule[] {
  return SOFT_RULES.filter(rule => rule.category === category);
}

export default SOFT_RULES;
