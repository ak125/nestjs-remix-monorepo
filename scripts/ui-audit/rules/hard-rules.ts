/**
 * Hard Rules - Bloquantes en CI
 *
 * Ces règles représentent des violations critiques qui doivent être corrigées.
 * Source: DESIGN-SYSTEM.automecanik.md + Skills ui-ux-pro-max
 */

import type { HardRule, ScoreCategory } from '../contracts';

export const HARD_RULES: HardRule[] = [
  // ============================================================================
  // HR-001: Grid Mobile-First
  // ============================================================================
  {
    id: 'HR-001',
    name: 'grid-mobile-first',
    pattern: /grid-cols-[2-9](?!.*grid-cols-1)/,
    message: 'Grid sans base mobile grid-cols-1',
    fix: 'Ajouter grid-cols-1 avant les breakpoints: grid-cols-1 sm:grid-cols-2 lg:grid-cols-{N}',
    category: 'mobile_first',
    penalty: 3,
  },

  // ============================================================================
  // HR-002: Overflow-X Wrapper
  // ============================================================================
  {
    id: 'HR-002',
    name: 'overflow-x-wrapper',
    pattern: /overflow-x-auto/,
    without: /max-w-|overflow-x-auto.*scroll-indicator|scroll-hint/,
    context: 'overflow-x-auto nécessite un wrapper avec max-w et indication visuelle de scroll',
    message: 'overflow-x-auto sans wrapper approprié',
    fix: 'Wrapper avec max-w-full et indication de scroll (gradient ou icône)',
    category: 'responsive',
    penalty: 2,
  },

  // ============================================================================
  // HR-003: Sidebar Mobile Drawer
  // ============================================================================
  {
    id: 'HR-003',
    name: 'sidebar-mobile-drawer',
    pattern: /<aside[^>]*className="[^"]*hidden\s+(?:sm:|md:|lg:|xl:)block/,
    message: 'Sidebar desktop-only sans alternative mobile (drawer/sheet)',
    fix: 'Ajouter Sheet ou Drawer pour mobile avec trigger visible',
    category: 'mobile_first',
    penalty: 4,
  },

  // ============================================================================
  // HR-004: Table Mobile Cards
  // ============================================================================
  {
    id: 'HR-004',
    name: 'table-mobile-cards',
    pattern: /<Table[^>]*>/,
    without: /hidden\s+(?:sm:|md:|lg:)|(?:sm:|md:|lg:)hidden|MobileCards|CardView/,
    context: 'Les tables doivent avoir une vue alternative cards pour mobile',
    message: 'Table sans fallback mobile (cards view)',
    fix: 'Ajouter une vue cards pour mobile: hidden lg:block pour Table, lg:hidden pour Cards',
    category: 'mobile_first',
    penalty: 4,
  },

  // ============================================================================
  // HR-005: Touch Target 44px
  // ============================================================================
  {
    id: 'HR-005',
    name: 'touch-target-44px',
    pattern: /<Button[^>]*className="[^"]*h-(?:[1-9]|10)(?:\s|")/,
    without: /h-11|h-12|h-14|h-16|min-h-\[44px\]/,
    context: 'Boutons interactifs doivent avoir minimum 44px de hauteur',
    message: 'Touch target trop petit (< 44px / h-11)',
    fix: 'Utiliser h-11 minimum pour les boutons (44px)',
    category: 'touch_ux',
    penalty: 3,
  },

  // ============================================================================
  // HR-006: Hidden Without Alternative
  // ============================================================================
  {
    id: 'HR-006',
    name: 'hidden-no-alternative',
    pattern: /hidden\s+(?:sm:|md:)block(?![^"]*sr-only)/,
    without: /aria-label|sr-only|visually-hidden/,
    context: 'Contenu masqué sur mobile doit avoir une alternative accessible',
    message: 'Contenu masqué sur mobile sans alternative accessible',
    fix: 'Ajouter sr-only avec contenu équivalent ou aria-label',
    category: 'a11y',
    penalty: 2,
  },

  // ============================================================================
  // HR-007: PDP CTA Above Fold
  // ============================================================================
  {
    id: 'HR-007',
    name: 'pdp-cta-above-fold',
    pattern: /<Button[^>]*(?:add-to-cart|ajouter|panier)[^>]*>/i,
    without: /sticky|fixed|top-|bottom-/,
    context: 'Pages PDP uniquement',
    message: 'CTA "Ajouter au panier" doit être visible sans scroll sur mobile',
    fix: 'Rendre le CTA sticky: fixed bottom-0 left-0 right-0 z-50 lg:relative',
    pageTypes: ['pdp', 'pieces', 'product'],
    category: 'ecommerce_ux',
    penalty: 5,
  },

  // ============================================================================
  // HR-008: Emoji Icons
  // ============================================================================
  {
    id: 'HR-008',
    name: 'no-emoji-icons',
    pattern: />\s*[\u{1F300}-\u{1F9FF}]/u,
    message: 'Emojis utilisés comme icônes',
    fix: 'Utiliser lucide-react: import { Icon } from "lucide-react"',
    category: 'design_system',
    penalty: 2,
  },

  // ============================================================================
  // HR-009: Hardcoded Hex Colors
  // ============================================================================
  {
    id: 'HR-009',
    name: 'no-hardcoded-hex',
    pattern: /(?:bg|text|border)-\[#[0-9A-Fa-f]{3,6}\]/,
    message: 'Couleur hexadécimale hardcodée',
    fix: 'Utiliser les CSS variables: bg-primary, text-destructive, etc.',
    category: 'design_system',
    penalty: 2,
  },

  // ============================================================================
  // HR-010: Dialog Without Title
  // ============================================================================
  {
    id: 'HR-010',
    name: 'dialog-requires-title',
    pattern: /<Dialog[^>]*>(?:(?!DialogTitle).)*?<\/Dialog>/s,
    message: 'Dialog sans DialogTitle (accessibilité)',
    fix: '<Dialog><DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>...</Dialog>',
    category: 'a11y',
    penalty: 3,
  },

  // ============================================================================
  // HR-011: Icon Button Aria Label
  // ============================================================================
  {
    id: 'HR-011',
    name: 'icon-button-aria',
    pattern: /<Button[^>]*size=["']icon["'][^>]*>(?![^<]*aria-label)/,
    message: 'Bouton icône sans aria-label',
    fix: '<Button size="icon" aria-label="Description">...',
    category: 'a11y',
    penalty: 3,
  },

  // ============================================================================
  // HR-012: Form Input Without Label
  // ============================================================================
  {
    id: 'HR-012',
    name: 'input-requires-label',
    pattern: /<Input[^>]*(?!.*(?:aria-label|id="[^"]*"[^>]*<label|FormField))/,
    without: /FormField|aria-label|aria-labelledby/,
    message: 'Input sans label associé',
    fix: 'Utiliser FormField ou ajouter aria-label',
    category: 'a11y',
    penalty: 3,
  },
];

/**
 * Get rules applicable to a specific page type
 */
export function getRulesForPageType(pageType: string): HardRule[] {
  return HARD_RULES.filter(rule => {
    if (!rule.pageTypes) return true;
    return rule.pageTypes.some(t => pageType.toLowerCase().includes(t));
  });
}

/**
 * Check content against a hard rule
 */
export function checkHardRule(
  rule: HardRule,
  content: string,
  lineOffset: number = 0
): Array<{ line: number; column: number; match: string }> {
  const violations: Array<{ line: number; column: number; match: string }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(rule.pattern);

    if (match) {
      // Check if "without" pattern exists (negation)
      if (rule.without && rule.without.test(line)) {
        continue; // Skip - the fix is already in place
      }

      violations.push({
        line: i + 1 + lineOffset,
        column: match.index || 0,
        match: match[0],
      });
    }
  }

  return violations;
}

export default HARD_RULES;
