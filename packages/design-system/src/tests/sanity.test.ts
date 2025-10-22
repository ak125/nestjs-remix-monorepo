/**
 * 🧪 Sanity Tests
 * Vérifie que tous les exports principaux sont accessibles
 */

import { describe, it, expect } from 'vitest';

describe('Design System - Sanity Checks', () => {
  it('should allow importing main barrel export', async () => {
    // @ts-expect-error - Testing dynamic import
    const DS = await import('../index');
    expect(DS).toBeDefined();
  });

  it('should allow importing tokens', async () => {
    // @ts-expect-error - Testing dynamic import
    const Tokens = await import('../tokens/index');
    expect(Tokens).toBeDefined();
  });

  it('should allow importing themes', async () => {
    // @ts-expect-error - Testing dynamic import
    const Themes = await import('../themes/index');
    expect(Themes).toBeDefined();
  });

  it('should have design tokens structure', async () => {
    // @ts-expect-error - Testing dynamic import
    const { designTokens } = await import('../tokens/generated');
    
    expect(designTokens).toBeDefined();
    expect(designTokens.colors).toBeDefined();
    expect(designTokens.spacing).toBeDefined();
    expect(designTokens.typography).toBeDefined();
    expect(designTokens.shadows).toBeDefined();
    expect(designTokens.borderRadius).toBeDefined();
  });

  it('should have valid color tokens', async () => {
    // @ts-expect-error - Testing dynamic import
    const { designTokens } = await import('../tokens/generated');
    
    expect(designTokens.colors.primary).toBeDefined();
    expect(designTokens.colors.secondary).toBeDefined();
    expect(designTokens.colors.accent).toBeDefined();
    
    // Vérifie que les valeurs HEX sont valides
    const primaryColor = designTokens.colors.primary['500'];
    expect(primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('should have valid spacing tokens', async () => {
    // @ts-expect-error - Testing dynamic import
    const { designTokens } = await import('../tokens/generated');
    
    const spacing = designTokens.spacing;
    expect(spacing['0']).toBe('0');
    expect(spacing['4']).toBe('1rem');
    expect(spacing['8']).toBe('2rem');
  });

  it('should have valid typography tokens', async () => {
    // @ts-expect-error - Testing dynamic import
    const { designTokens } = await import('../tokens/generated');
    
    const { fontFamily, fontSize, lineHeight } = designTokens.typography;
    
    expect(fontFamily.sans).toBeDefined();
    expect(fontSize.base).toBe('1rem');
    expect(lineHeight.normal).toBe('1.5');
  });
});

describe('Design System - Export Structure', () => {
  it('should have proper TypeScript types', async () => {
    // @ts-expect-error - Testing dynamic import
    const { designTokens } = await import('../tokens/generated');
    
    // Type checking at runtime
    type DesignTokens = typeof designTokens;
    type ColorToken = keyof typeof designTokens.colors;
    
    const primaryKey: ColorToken = 'primary';
    expect(designTokens.colors[primaryKey]).toBeDefined();
  });
});
