/**
 * 🎨 @monorepo/design-system
 * 
 * Design System industrialisé pour NestJS-Remix Monorepo
 * Tokens → Thèmes → UI → Patterns → QA
 */

// Tokens
export * from './tokens';

// Themes
export * from './themes';

// Utils
export * from './lib/utils';

// Re-export des dépendances courantes
export { cva, type VariantProps } from 'class-variance-authority';
export { clsx } from 'clsx';
