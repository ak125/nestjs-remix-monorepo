/**
 * Error401 - Non autorisé avec redirection login
 *
 * Affiche un countdown et redirige automatiquement vers la page de connexion
 * après le délai spécifié (par défaut 5s)
 */

import { Link } from "@remix-run/react";
import { useState, useEffect } from "react";

import { useErrorAutoReport } from "../../hooks/useErrorAutoReport";

interface Error401Props {
  redirectTo?: string; // URL de retour après login
  message?: string;
  url?: string;
  countdown?: number; // secondes avant redirect (défaut: 5)
}

export function Error401({
  redirectTo,
  message,
  url,
  countdown: initialCountdown = 5,
}: Error401Props) {
  const [countdown, setCountdown] = useState(initialCountdown);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Construire l'URL de login avec redirect
  const currentPath =
    typeof window !== "undefined" ? window.location.pathname : url || "/";
  const loginUrl = `/login?redirect=${encodeURIComponent(redirectTo || currentPath)}`;

  // Reporting centralisé
  useErrorAutoReport({
    code: 401,
    url,
    message: message || "Authentification requise",
    metadata: { redirectTo: loginUrl },
  });

  // Countdown + auto-redirect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (!isRedirecting && typeof window !== "undefined") {
      setIsRedirecting(true);
      window.location.href = loginUrl;
    }
  }, [countdown, isRedirecting, loginUrl]);

  // SEO: noindex, follow - Google ne indexe pas cette page mais suit les liens
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute('content', 'noindex, follow');
    } else {
      const newMeta = document.createElement('meta');
      newMeta.name = 'robots';
      newMeta.content = 'noindex, follow';
      document.head.appendChild(newMeta);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icône cadenas */}
          <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Connexion requise
          </h1>

          <p className="text-gray-600 mb-6">
            {message || "Vous devez être connecté pour accéder à cette page."}
          </p>

          {/* Countdown */}
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Redirection vers la page de connexion dans{" "}
              <span className="font-bold text-lg">{countdown}s</span>
            </p>

            {/* Progress bar */}
            <div className="w-full bg-blue-200 rounded-full h-1.5 mt-3">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-1000"
                style={{ width: `${(countdown / initialCountdown) * 100}%` }}
              />
            </div>

            {isRedirecting && (
              <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                <span className="text-sm">Redirection en cours...</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              to={loginUrl}
              className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Se connecter maintenant
            </Link>

            <Link
              to="/register"
              className="block w-full px-6 py-3 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
            >
              Créer un compte
            </Link>

            <Link
              to="/"
              className="block w-full px-6 py-3 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Retour à l'accueil
            </Link>
          </div>

          {/* Help */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Problème de connexion ?{" "}
              <Link
                to="/forgot-password"
                className="text-blue-600 hover:underline"
              >
                Mot de passe oublié
              </Link>{" "}
              ou{" "}
              <Link
                to="/contact"
                className="text-blue-600 hover:underline"
              >
                contactez le support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
