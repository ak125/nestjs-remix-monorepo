// Re-export design tokens JSON
export { default as designTokens } from './tokens/design-tokens.json';

// Re-export generated TypeScript types (après build)
export * from './tokens/generated';

// Type pour accès aux tokens
export type DesignTokens = typeof import('./tokens/design-tokens.json');
