import { Link } from "@remix-run/react";
import { useEffect, useState } from "react";

interface Error404Props {
  url?: string;
  suggestions?: string[];
  userAgent?: string;
  referrer?: string;
  method?: string;
}

export function Error404({
  url,
  suggestions: initialSuggestions,
  userAgent,
  referrer,
  method = "GET",
}: Error404Props) {
  const [suggestions, setSuggestions] = useState<string[]>(
    initialSuggestions || [],
  );
  const [loading, setLoading] = useState(false);
  const [reported, setReported] = useState(false);

  // Récupérer des suggestions dynamiques depuis le backend optimisé
  useEffect(() => {
    if (url && (!initialSuggestions || initialSuggestions.length === 0)) {
      setLoading(true);
      fetch(`/api/errors/suggestions?url=${encodeURIComponent(url)}`, {
        headers: { "Internal-Call": "true" },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
          }
        })
        .catch((error) => {
          console.error(
            "Erreur lors de la récupération des suggestions:",
            error,
          );
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [url, initialSuggestions]);

  // Reporter automatiquement l'erreur au backend optimisé avec données enrichies
  useEffect(() => {
    if (url && !reported) {
      const errorData = {
        code: 404,
        url,
        userAgent:
          userAgent ||
          (typeof navigator !== "undefined" ? navigator.userAgent : undefined),
        referrer:
          referrer ||
          (typeof document !== "undefined" ? document.referrer : undefined),
        method,
        metadata: {
          timestamp: new Date().toISOString(),
          screen:
            typeof screen !== "undefined"
              ? { width: screen.width, height: screen.height }
              : undefined,
          viewport:
            typeof window !== "undefined"
              ? { width: window.innerWidth, height: window.innerHeight }
              : undefined,
          language:
            typeof navigator !== "undefined" ? navigator.language : undefined,
          platform:
            typeof navigator !== "undefined" ? navigator.platform : undefined,
          connection:
            typeof navigator !== "undefined" && "connection" in navigator
              ? (navigator as any).connection?.effectiveType
              : undefined,
        },
      };

      fetch("/api/errors/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Internal-Call": "true",
        },
        body: JSON.stringify(errorData),
      })
        .then(() => setReported(true))
        .catch((error) => {
          console.error("Erreur lors du reporting:", error);
        });
    }
  }, [url, userAgent, referrer, method, reported]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Section principale 404 */}
          <div className="text-center mb-12">
            {/* Animation 404 avec design moderne */}
            <div className="mb-8">
              <div className="relative inline-block">
                <span className="text-8xl md:text-9xl font-bold text-gray-200 select-none">
                  404
                </span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-blue-500 rounded-full p-6 shadow-lg">
                    <svg
                      className="w-16 h-16 md:w-20 md:h-20 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Page non trouvée
            </h1>

            <p className="text-lg text-gray-600 mb-2 max-w-2xl mx-auto">
              Désolé, nous n'avons pas trouvé la page que vous recherchez.
            </p>

            {url && (
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-2">URL demandée :</p>
                <code className="text-sm text-gray-700 bg-gray-100 px-3 py-2 rounded-lg font-mono break-all">
                  {url}
                </code>
              </div>
            )}
          </div>

          {/* Suggestions intelligentes */}
          {(suggestions.length > 0 || loading) && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                {loading
                  ? "Recherche de pages similaires..."
                  : "Pages suggérées"}
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">
                    Analyse en cours...
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {suggestions.slice(0, 6).map((suggestion, index) => (
                    <Link
                      key={index}
                      to={suggestion}
                      className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 text-gray-400 group-hover:text-blue-500 mr-3 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                        <span className="text-blue-600 hover:text-blue-800 group-hover:underline">
                          {suggestion}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions principales */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              Que souhaitez-vous faire ?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/"
                className="flex items-center justify-center px-6 py-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Accueil
              </Link>

              <button
                onClick={() => window.history.back()}
                className="flex items-center justify-center px-6 py-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
                  />
                </svg>
                Retour
              </button>

              <Link
                to="/support/contact"
                className="flex items-center justify-center px-6 py-4 bg-success hover:bg-success/90 text-success-foreground rounded-lg transition-colors font-medium"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Support
              </Link>

              <Link
                to="/search"
                className="flex items-center justify-center px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Rechercher
              </Link>
            </div>
          </div>

          {/* Informations détaillées */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <svg
                className="w-6 h-6 mr-2 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Que s'est-il passé ?
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  Causes possibles :
                </h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <svg
                      className="w-5 h-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span>La page a été déplacée ou supprimée</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-5 h-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span>Erreur de frappe dans l'URL</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-5 h-5 text-orange-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <span>Lien obsolète ou expiré</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-800 mb-3">
                  Aide rapide :
                </h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Vérifiez l'orthographe de l'URL</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Utilisez la recherche ci-dessus</span>
                  </li>
                  <li className="flex items-start">
                    <svg
                      className="w-5 h-5 text-green-400 mt-0.5 mr-3 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Consultez nos pages suggérées</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer d'aide */}
            <div className="mt-6 pt-6 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-500">
                Si le problème persiste,{" "}
                <Link
                  to="/support/contact"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  contactez notre équipe support
                </Link>{" "}
                - nous sommes là pour vous aider 24h/24, 7j/7.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
