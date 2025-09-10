import { Link } from "@remix-run/react";
import { useEffect, useState } from "react";

interface Error404Props {
  url?: string;
  suggestions?: string[];
}

export function Error404({ url, suggestions: initialSuggestions }: Error404Props) {
  const [suggestions, setSuggestions] = useState<string[]>(initialSuggestions || []);
  const [loading, setLoading] = useState(false);

  // Récupérer des suggestions dynamiques depuis le backend
  useEffect(() => {
    if (url && (!initialSuggestions || initialSuggestions.length === 0)) {
      setLoading(true);
      fetch(`/api/errors/suggestions?url=${encodeURIComponent(url)}`)
        .then(response => response.json())
        .then(data => {
          if (data.suggestions && data.suggestions.length > 0) {
            setSuggestions(data.suggestions);
          }
        })
        .catch(error => {
          console.error('Erreur lors de la récupération des suggestions:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [url, initialSuggestions]);

  // Reporter automatiquement l'erreur au backend
  useEffect(() => {
    if (url) {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 404,
          url,
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          timestamp: new Date().toISOString(),
          metadata: {
            screen: { width: screen.width, height: screen.height },
            viewport: { width: window.innerWidth, height: window.innerHeight },
            language: navigator.language,
            platform: navigator.platform
          }
        })
      }).catch(error => {
        console.error('Erreur lors du reporting:', error);
      });
    }
  }, [url]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="max-w-max mx-auto">
        <main className="sm:flex">
          <p className="text-4xl font-bold text-indigo-600 sm:text-5xl">404</p>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl">
                Page non trouvée
              </h1>
              <p className="mt-1 text-base text-gray-500">
                {url ? (
                  <>La page <code className="bg-gray-100 px-2 py-1 rounded text-sm">{url}</code> n'existe pas.</>
                ) : (
                  "Désolé, nous ne trouvons pas la page que vous cherchez."
                )}
              </p>
            </div>
            
            {/* Suggestions de pages similaires */}
            {(suggestions.length > 0 || loading) && (
              <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
                <h2 className="text-lg font-medium text-gray-900">
                  {loading ? "Recherche de pages similaires..." : "Pages similaires :"}
                </h2>
                {loading ? (
                  <div className="mt-2 flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    <span className="ml-2 text-sm text-gray-500">Chargement...</span>
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {suggestions.slice(0, 5).map((suggestion, index) => (
                      <li key={index}>
                        <Link 
                          to={suggestion}
                          className="text-indigo-600 hover:text-indigo-500 text-sm"
                        >
                          {suggestion}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            
            <div className="mt-10 flex space-x-3 sm:border-l sm:border-gray-200 sm:pl-6">
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Retour à l'accueil
              </Link>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Page précédente
              </button>
            </div>
            
            {/* Informations de contact */}
            <div className="mt-8 sm:border-l sm:border-gray-200 sm:pl-6">
              <p className="text-sm text-gray-500">
                Si vous pensez qu'il s'agit d'une erreur, {" "}
                <Link 
                  to="/support/contact" 
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  contactez notre support
                </Link>
                .
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
