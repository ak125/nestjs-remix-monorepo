/**
 * Hook centralisé pour le reporting automatique des erreurs
 * Évite la duplication du code de reporting dans chaque composant d'erreur
 */

import { useEffect, useRef } from "react";

interface ErrorReportData {
  code: number;
  url?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook pour reporter automatiquement les erreurs au backend
 * SSR-safe - ne s'exécute que côté client
 */
export function useErrorAutoReport(data: ErrorReportData) {
  const reported = useRef(false);

  useEffect(() => {
    // Guard SSR + double-report
    if (reported.current || typeof window === "undefined") return;

    const errorData = {
      code: data.code,
      url: data.url || window.location.pathname,
      message: data.message,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      metadata: {
        ...data.metadata,
        screen: {
          width: screen.width,
          height: screen.height,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        connection:
          "connection" in navigator
            ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection
                ?.effectiveType
            : undefined,
        language: navigator.language,
        platform: navigator.platform,
      },
    };

    // Envoyer au backend - silent fail
    fetch("/api/errors/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Internal-Call": "true",
      },
      body: JSON.stringify(errorData),
    }).catch(() => {
      // Silent fail - le reporting ne doit pas bloquer l'UX
    });

    reported.current = true;
  }, [data.code, data.url, data.message, data.metadata]);
}
