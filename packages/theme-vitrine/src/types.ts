/**
 * 🎨 Theme Types
 */

export type ThemeMode = 'light' | 'dark';
export type ThemeBrand = 'vitrine' | 'admin';

export interface Theme {
  brand: ThemeBrand;
  mode: ThemeMode;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
    border: string;
  };
}

export interface ThemeConfig {
  defaultBrand: ThemeBrand;
  defaultMode: ThemeMode;
  storageKey?: string;
}
