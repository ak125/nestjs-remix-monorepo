import { useSubmit } from "@remix-run/react";

/**
 * Hook pour intégrer avec le service ErrorService backend
 * Envoie automatiquement les erreurs au backend pour logging et suggestions
 */
export function useErrorReporting() {
  const submit = useSubmit();

  const reportError = async (errorData: {
    status: number;
    url: string;
    message?: string;
    userAgent?: string;
    stack?: string;
    userId?: string;
  }) => {
    try {
      // Envoyer l'erreur au backend via le service ErrorService
      submit(
        {
          action: "reportError",
          errorData: JSON.stringify({
            code: errorData.status,
            url: errorData.url,
            message: errorData.message,
            userAgent: errorData.userAgent || navigator.userAgent,
            stack: errorData.stack,
            userId: errorData.userId,
            timestamp: new Date().toISOString(),
            referrer: document.referrer,
            metadata: {
              screen: {
                width: screen.width,
                height: screen.height
              },
              viewport: {
                width: window.innerWidth,
                height: window.innerHeight
              },
              language: navigator.language,
              platform: navigator.platform
            }
          })
        },
        {
          method: "post",
          action: "/api/errors/report",
          encType: "application/json"
        }
      );
    } catch (error) {
      // En cas d'erreur lors du reporting, on log simplement en console
      console.error("Erreur lors du reporting d'erreur:", error);
    }
  };

  const getSuggestions = async (url: string): Promise<string[]> => {
    try {
      const response = await fetch(`/api/errors/suggestions?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return data.suggestions || [];
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des suggestions:", error);
    }
    return [];
  };

  return {
    reportError,
    getSuggestions
  };
}

/**
 * Hook pour gérer les redirections automatiques
 */
export function useRedirectHandler() {
  const checkRedirect = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/redirects/check?url=${encodeURIComponent(url)}`);
      if (response.ok) {
        const data = await response.json();
        return data.destination || null;
      }
    } catch (error) {
      console.error("Erreur lors de la vérification de redirection:", error);
    }
    return null;
  };

  const performRedirect = (destination: string, permanent: boolean = false) => {
    if (permanent) {
      window.location.replace(destination);
    } else {
      window.location.href = destination;
    }
  };

  return {
    checkRedirect,
    performRedirect
  };
}

/**
 * Hook combiné pour la gestion complète des erreurs
 */
export function useErrorHandling() {
  const { reportError, getSuggestions } = useErrorReporting();
  const { checkRedirect, performRedirect } = useRedirectHandler();

  const handleError = async (errorInfo: {
    status: number;
    url: string;
    message?: string;
    stack?: string;
    userId?: string;
  }) => {
    // 1. Reporter l'erreur au backend
    await reportError(errorInfo);

    // 2. Pour les erreurs 404, vérifier s'il y a une redirection
    if (errorInfo.status === 404) {
      const redirectDestination = await checkRedirect(errorInfo.url);
      if (redirectDestination) {
        performRedirect(redirectDestination);
        return;
      }
    }

    // 3. Récupérer les suggestions pour améliorer l'UX
    const suggestions = await getSuggestions(errorInfo.url);
    return suggestions;
  };

  return {
    handleError,
    reportError,
    getSuggestions,
    checkRedirect,
    performRedirect
  };
}
