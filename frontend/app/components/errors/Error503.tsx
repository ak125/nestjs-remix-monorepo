/**
 * Error503 - Service Unavailable avec auto-retry
 *
 * Affiche un countdown et recharge automatiquement la page
 * après le délai spécifié (par défaut 30s)
 */

import { useState, useEffect } from "react";
import { Link } from "@remix-run/react";
import { useErrorAutoReport } from "../../hooks/useErrorAutoReport";

interface Error503Props {
  retryAfter?: number; // secondes avant auto-retry
  message?: string;
  url?: string;
}

export function Error503({
  retryAfter = 30,
  message,
  url,
}: Error503Props) {
  const [countdown, setCountdown] = useState(retryAfter);
  const [isRetrying, setIsRetrying] = useState(false);

  // Reporting centralisé
  useErrorAutoReport({
    code: 503,
    url,
    message: message || "Service temporairement indisponible",
    metadata: { retryAfter },
  });

  // Countdown + auto-retry
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!isRetrying) {
      setIsRetrying(true);
      window.location.reload();
    }
  }, [countdown, isRetrying]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Animation 503 */}
        <div className="mb-8">
          <div className="relative inline-block">
            <span className="text-8xl md:text-9xl font-bold text-red-200 select-none">
              503
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-500 rounded-full p-4 shadow-lg animate-pulse">
                <svg
                  className="w-12 h-12 md:w-16 md:h-16 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Service temporairement indisponible
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          {message ||
            "Nous effectuons une maintenance. Merci de patienter quelques instants."}
        </p>

        {/* Countdown auto-retry */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <p className="text-sm text-gray-500 mb-3">
            Nouvelle tentative automatique dans
          </p>
          <div className="text-5xl font-mono font-bold text-blue-600 mb-2">
            {countdown}
            <span className="text-2xl">s</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${(countdown / retryAfter) * 100}%` }}
            />
          </div>

          {isRetrying && (
            <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <span className="font-medium">Reconnexion en cours...</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Réessayer maintenant
          </button>

          <Link
            to="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Retour à l'accueil
          </Link>
        </div>

        {/* Info supplémentaire */}
        <div className="mt-8 p-4 bg-white/50 rounded-lg">
          <p className="text-sm text-gray-500">
            Si le problème persiste, consultez notre{" "}
            <Link to="/status" className="text-blue-600 hover:underline">
              page de statut
            </Link>{" "}
            ou{" "}
            <Link to="/support/contact" className="text-blue-600 hover:underline">
              contactez le support
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
