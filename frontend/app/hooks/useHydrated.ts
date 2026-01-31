import { useState, useEffect } from "react";

/**
 * useHydrated - Hook pour détecter si le composant est hydraté côté client
 *
 * Utilisation : Différer le rendu de contenu client-only pour éviter
 * les erreurs d'hydration React (SSR mismatch).
 *
 * @example
 * ```tsx
 * function Footer() {
 *   const isHydrated = useHydrated();
 *   return <span>{isHydrated ? new Date().getFullYear() : '----'}</span>;
 * }
 * ```
 *
 * @returns true après l'hydration côté client, false côté serveur et au premier render
 */
export function useHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
