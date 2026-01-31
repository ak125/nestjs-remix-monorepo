/**
 * DensityContext - Système de densité UI configurable
 *
 * @see packages/design-tokens/DESIGN-SYSTEM.automecanik.md
 *
 * 3 profils:
 * - compact: Dashboards SEO (plus de data visible)
 * - comfortable: Admin général (lisibilité standard)
 * - reading: Blog/SEO content (large spacing)
 *
 * Persisté en localStorage
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type DensityMode = "compact" | "comfortable" | "reading";

export interface DensityTokens {
  spacing: {
    card: string;
    section: string;
    gap: string;
  };
  typography: {
    base: string;
    heading: string;
    label: string;
  };
  table: {
    rowHeight: string;
    cellPadding: string;
  };
}

/**
 * Tokens de densité par mode
 */
export const densityTokens: Record<DensityMode, DensityTokens> = {
  compact: {
    spacing: {
      card: "p-2 sm:p-3",
      section: "py-3 sm:py-4",
      gap: "gap-2 sm:gap-3",
    },
    typography: {
      base: "text-xs sm:text-sm",
      heading: "text-sm sm:text-base font-semibold",
      label: "text-[10px] sm:text-xs uppercase tracking-wide",
    },
    table: {
      rowHeight: "h-8 sm:h-9",
      cellPadding: "px-2 py-1 sm:px-3 sm:py-1.5",
    },
  },
  comfortable: {
    spacing: {
      card: "p-3 sm:p-4",
      section: "py-4 sm:py-6",
      gap: "gap-3 sm:gap-4",
    },
    typography: {
      base: "text-sm",
      heading: "text-base sm:text-lg font-semibold",
      label: "text-xs uppercase tracking-wide",
    },
    table: {
      rowHeight: "h-10 sm:h-12",
      cellPadding: "px-3 py-2 sm:px-4 sm:py-3",
    },
  },
  reading: {
    spacing: {
      card: "p-4 sm:p-6",
      section: "py-6 sm:py-8",
      gap: "gap-4 sm:gap-6",
    },
    typography: {
      base: "text-sm sm:text-base",
      heading: "text-lg sm:text-xl font-semibold",
      label: "text-xs sm:text-sm uppercase tracking-wide",
    },
    table: {
      rowHeight: "h-12 sm:h-14",
      cellPadding: "px-4 py-3 sm:px-6 sm:py-4",
    },
  },
};

/**
 * Labels pour l'UI
 */
export const densityLabels: Record<
  DensityMode,
  { label: string; description: string }
> = {
  compact: {
    label: "Compact",
    description: "Maximise les données visibles (dashboards)",
  },
  comfortable: {
    label: "Confortable",
    description: "Équilibre entre données et lisibilité",
  },
  reading: {
    label: "Lecture",
    description: "Optimisé pour la lecture longue",
  },
};

interface DensityContextValue {
  /** Mode de densité actuel */
  density: DensityMode;
  /** Changer le mode */
  setDensity: (mode: DensityMode) => void;
  /** Tokens du mode actuel */
  tokens: DensityTokens;
  /** Tous les labels */
  labels: typeof densityLabels;
}

const DensityContext = createContext<DensityContextValue | null>(null);

const STORAGE_KEY = "automecanik-density";

interface DensityProviderProps {
  children: ReactNode;
  /** Mode par défaut (avant localStorage) */
  defaultDensity?: DensityMode;
}

export function DensityProvider({
  children,
  defaultDensity = "comfortable",
}: DensityProviderProps) {
  const [density, setDensityState] = useState<DensityMode>(defaultDensity);
  const [isHydrated, setIsHydrated] = useState(false);

  // Charger depuis localStorage après hydration
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["compact", "comfortable", "reading"].includes(stored)) {
      setDensityState(stored as DensityMode);
    }
    setIsHydrated(true);
  }, []);

  // Persister les changements
  const setDensity = (mode: DensityMode) => {
    setDensityState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  };

  // Éviter le flash (retourner le mode par défaut avant hydration)
  const effectiveDensity = isHydrated ? density : defaultDensity;

  return (
    <DensityContext.Provider
      value={{
        density: effectiveDensity,
        setDensity,
        tokens: densityTokens[effectiveDensity],
        labels: densityLabels,
      }}
    >
      {children}
    </DensityContext.Provider>
  );
}

/**
 * Hook pour utiliser la densité
 */
export function useDensity(): DensityContextValue {
  const context = useContext(DensityContext);
  if (!context) {
    throw new Error("useDensity must be used within a DensityProvider");
  }
  return context;
}

/**
 * Hook pour obtenir juste les tokens (sans le setter)
 */
export function useDensityTokens(): DensityTokens {
  const { tokens } = useDensity();
  return tokens;
}
