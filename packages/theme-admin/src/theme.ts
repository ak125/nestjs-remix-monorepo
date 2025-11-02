/**
 * 🎭 Admin Theme
 * Thème pour l'interface d'administration
 */

import { designTokens } from '@fafa/design-tokens';
import  { type Theme } from './types';

export const adminThemeLight: Theme = {
  brand: 'admin',
  mode: 'light',
  colors: {
    primary: designTokens.colors.accent.persianIndigo,
    secondary: designTokens.colors.secondary['600'],
    accent: designTokens.colors.accent.khmerCurry,
    background: designTokens.colors.neutral.white,
    foreground: designTokens.colors.secondary['900'],
    muted: designTokens.colors.secondary['50'],
    border: designTokens.colors.neutral.iron,
  },
};

export const adminThemeDark: Theme = {
  brand: 'admin',
  mode: 'dark',
  colors: {
    primary: designTokens.colors.primary['400'],
    secondary: designTokens.colors.secondary['400'],
    accent: designTokens.colors.accent.khmerCurry,
    background: designTokens.colors.secondary['950'],
    foreground: designTokens.colors.secondary['50'],
    muted: designTokens.colors.secondary['900'],
    border: designTokens.colors.secondary['800'],
  },
};
