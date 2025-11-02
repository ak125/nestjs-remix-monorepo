/**
 * 🎭 Theme Provider
 * Context provider pour le système de thèmes
 */

import React, { createContext, useEffect, useState } from 'react';
import  { type ThemeMode, type ThemeBrand } from './types';

export interface ThemeContextValue {
  brand: ThemeBrand;
  mode: ThemeMode;
  setBrand: (brand: ThemeBrand) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultBrand?: ThemeBrand;
  defaultMode?: ThemeMode;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultBrand = 'vitrine',
  defaultMode = 'light',
  storageKey = 'monorepo-theme',
}: ThemeProviderProps) {
  // 🔧 FIX SSR: Initialize from defaultProps, load from storage on client only
  const [brand, setBrandState] = useState<ThemeBrand>(defaultBrand);
  const [mode, setModeState] = useState<ThemeMode>(defaultMode);
  const [isHydrated, setIsHydrated] = useState(false);

  // Charger le thème depuis localStorage au montage (client-side only)
  useEffect(() => {
    setIsHydrated(true);
    
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const { brand: storedBrand, mode: storedMode } = JSON.parse(stored);
          if (storedBrand) setBrandState(storedBrand);
          if (storedMode) setModeState(storedMode);
        } catch (e) {
          console.warn('Failed to parse stored theme:', e);
        }
      }
    }
  }, [storageKey]);

  // Appliquer le thème au DOM et persister (client-side only)
  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return;

    const root = window.document.documentElement;

    // Remove previous theme classes
    root.classList.remove('light', 'dark', 'vitrine', 'admin');

    // Add current theme classes
    root.classList.add(mode, brand);

    // Save to localStorage
    localStorage.setItem(storageKey, JSON.stringify({ brand, mode }));
  }, [brand, mode, storageKey, isHydrated]);

  const setBrand = (newBrand: ThemeBrand) => {
    setBrandState(newBrand);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
  };

  const toggleMode = () => {
    setModeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const value: ThemeContextValue = {
    brand,
    mode,
    setBrand,
    setMode,
    toggleMode,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export { ThemeContext };
