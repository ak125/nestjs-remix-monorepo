import { useEffect, useLayoutEffect, useState } from "react";
import { logger } from "~/utils/logger";

// 🏭 Hook pour éviter les erreurs SSR avec les effets
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// 🌐 Hook pour détecter si on est côté client
export function useIsBrowser() {
  return typeof window !== "undefined";
}

// 📱 Hook pour détecter si on est sur mobile (hydration-safe)
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ),
    );
  }, []);

  return isMobile;
}

// 🔧 Hook pour les APIs du navigateur avec fallback SSR
export function useBrowserAPI<T>(apiFactory: () => T, fallback: T): T {
  const isBrowser = useIsBrowser();

  if (!isBrowser) return fallback;

  try {
    return apiFactory();
  } catch (error) {
    logger.warn("Browser API unavailable:", error);
    return fallback;
  }
}
