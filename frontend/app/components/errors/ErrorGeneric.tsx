import { Link } from "@remix-run/react";
import { useEffect, memo } from "react";

interface ErrorGenericProps {
  status?: number;
  message?: string;
  details?: string;
  showStackTrace?: boolean;
  stack?: string;
}

export const ErrorGeneric = memo(function ErrorGeneric({
  status = 500,
  message = "Une erreur inattendue s'est produite",
  details,
  showStackTrace = false,
  stack,
}: ErrorGenericProps) {
  const isServerError = status >= 500;
  const isClientError = status >= 400 && status < 500;

  const getStatusColor = () => {
    if (isServerError) return "red";
    if (isClientError) return "orange";
    return "gray";
  };

  const getStatusDescription = () => {
    switch (status) {
      case 400:
        return "Requête incorrecte";
      case 401:
        return "Non autorisé";
      case 403:
        return "Accès interdit";
      case 405:
        return "Méthode non autorisée";
      case 408:
        return "Délai d'attente dépassé";
      case 429:
        return "Trop de requêtes";
      case 500:
        return "Erreur serveur interne";
      case 502:
        return "Passerelle incorrecte";
      case 503:
        return "Service indisponible";
      case 504:
        return "Délai d'attente de la passerelle";
      default:
        return "Erreur";
    }
  };

  const color = getStatusColor();
  const statusDescription = getStatusDescription();

  // SEO: noindex, follow - Google ne indexe pas cette page mais suit les liens
  useEffect(() => {
    const meta = document.querySelector('meta[name="robots"]');
    if (meta) {
      meta.setAttribute("content", "noindex, follow");
    } else {
      const newMeta = document.createElement("meta");
      newMeta.name = "robots";
      newMeta.content = "noindex, follow";
      document.head.appendChild(newMeta);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="max-w-max mx-auto">
        <main className="sm:flex">
          <p className={`text-4xl font-bold text-${color}-600 sm:text-5xl`}>
            {status}
          </p>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl">
                {statusDescription}
              </h1>
              <p className="mt-1 text-base text-gray-500">{message}</p>

              {details && (
                <div
                  className={`mt-4 p-4 bg-${color}-50 border border-${color}-200 rounded-md`}
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg
                        className={`h-5 w-5 text-${color}-400`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm text-${color}-700`}>
                        <strong>Détails :</strong>
                        <br />
                        {details}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Informations contextuelles selon le type d'erreur */}
            <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
              <h2 className="text-lg font-medium text-gray-900">
                {isServerError ? "Que s'est-il passé ?" : "Comment résoudre ?"}
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                {isServerError ? (
                  <>
                    <li>
                      • Un problème technique est survenu sur nos serveurs
                    </li>
                    <li>
                      • Nos équipes techniques ont été automatiquement notifiées
                    </li>
                    <li>
                      • Le problème sera résolu dans les plus brefs délais
                    </li>
                  </>
                ) : isClientError ? (
                  <>
                    <li>• Vérifiez l'URL saisie</li>
                    <li>• Assurez-vous d'être connecté si nécessaire</li>
                    <li>• Vérifiez vos permissions d'accès</li>
                  </>
                ) : (
                  <>
                    <li>• Actualisez la page</li>
                    <li>• Vérifiez votre connexion internet</li>
                    <li>• Réessayez dans quelques instants</li>
                  </>
                )}
              </ul>
            </div>

            {/* Stack trace en développement */}
            {showStackTrace && stack && (
              <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
                <details className="group">
                  <summary className="cursor-pointer text-lg font-medium text-gray-900 hover:text-gray-700">
                    Détails techniques (développement)
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-800 text-green-400 text-xs overflow-x-auto rounded-md max-h-60">
                    {stack}
                  </pre>
                </details>
              </div>
            )}

            <div className="mt-10 flex space-x-3 sm:border-l sm:border-gray-200 sm:pl-6">
              <button
                onClick={() => window.location.reload()}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-${color}-600 hover:bg-${color}-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-${color}-500`}
              >
                <svg
                  className="mr-2 -ml-1 h-4 w-4"
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
                Réessayer
              </button>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Retour à l'accueil
              </Link>
            </div>

            {/* Historique et navigation */}
            <div className="mt-8 sm:border-l sm:border-gray-200 sm:pl-6">
              <div className="flex space-x-4 text-sm">
                <button
                  onClick={() => window.history.back()}
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  ← Page précédente
                </button>
                <Link
                  to="/contact"
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  Signaler le problème
                </Link>
                <Link
                  to="/blog-pieces-auto"
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  Guides et conseils
                </Link>
              </div>
            </div>

            {/* Informations système pour le support */}
            <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
              <details className="group">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  Informations pour le support
                </summary>
                <div className="mt-2 text-xs text-gray-400 space-y-1">
                  <div>Erreur: {status}</div>
                  <div>Timestamp: {new Date().toISOString()}</div>
                  <div>
                    URL:{" "}
                    {typeof window !== "undefined"
                      ? window.location.href
                      : "N/A"}
                  </div>
                  <div>
                    User Agent:{" "}
                    {typeof navigator !== "undefined"
                      ? navigator.userAgent
                      : "N/A"}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
});
