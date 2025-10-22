/**
 * 🎭 Vitrine Theme
 * Thème pour le site vitrine public
 */

import type { Theme } from './types';
import { designTokens } from '../tokens/generated';

export const vitrineThemeLight: Theme = {
  brand: 'vitrine',
  mode: 'light',
  colors: {
    primary: designTokens.colors.accent.bleu,
    secondary: designTokens.colors.primary['600'],
    accent: designTokens.colors.accent.vert,
    background: designTokens.colors.neutral.white,
    foreground: designTokens.colors.secondary['900'],
    muted: designTokens.colors.secondary['100'],
    border: designTokens.colors.secondary['200'],
  },
};

export const vitrineThemeDark: Theme = {
  brand: 'vitrine',
  mode: 'dark',
  colors: {
    primary: designTokens.colors.accent.bleuClair,
    secondary: designTokens.colors.primary['400'],
    accent: designTokens.colors.accent.vert,
    background: designTokens.colors.secondary['950'],
    foreground: designTokens.colors.secondary['50'],
    muted: designTokens.colors.secondary['800'],
    border: designTokens.colors.secondary['800'],
  },
};
