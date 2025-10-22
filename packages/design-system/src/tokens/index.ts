/**
 * 🎨 Design Tokens
 * 
 * Système de tokens centralisé pour le Design System.
 * Tous les tokens sont générés à partir de design-tokens.json
 */

export * from './generated';

// Utilitaires pour les tokens
export { cn } from '../lib/utils';

// Types de tokens
export type { DesignTokens, ColorToken, SpacingToken, TypographyToken } from './generated';
