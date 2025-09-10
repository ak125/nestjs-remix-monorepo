import { Link } from "@remix-run/react";

interface Error410Props {
  url?: string;
  isOldLink?: boolean;
  redirectTo?: string;
}

export function Error410({ url, isOldLink, redirectTo }: Error410Props) {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="max-w-max mx-auto">
        <main className="sm:flex">
          <p className="text-4xl font-bold text-orange-600 sm:text-5xl">410</p>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl">
                Contenu supprimé
              </h1>
              <p className="mt-1 text-base text-gray-500">
                {url ? (
                  <>La page <code className="bg-gray-100 px-2 py-1 rounded text-sm">{url}</code> a été définitivement supprimée.</>
                ) : (
                  "Ce contenu n'est plus disponible et a été définitivement supprimé."
                )}
              </p>
              
              {isOldLink && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-orange-700">
                        <strong>Lien obsolète détecté</strong><br />
                        Il semble que vous ayez utilisé un ancien lien. Le contenu a été restructuré ou supprimé.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Redirection suggérée */}
            {redirectTo && (
              <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
                <h2 className="text-lg font-medium text-gray-900">Contenu similaire :</h2>
                <div className="mt-2">
                  <Link 
                    to={redirectTo}
                    className="inline-flex items-center text-indigo-600 hover:text-indigo-500 text-sm"
                  >
                    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Accéder au nouveau contenu
                  </Link>
                </div>
              </div>
            )}
            
            <div className="mt-10 flex space-x-3 sm:border-l sm:border-gray-200 sm:pl-6">
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Retour à l'accueil
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
              >
                Rechercher du contenu
              </Link>
            </div>
            
            {/* Archive et alternatives */}
            <div className="mt-8 sm:border-l sm:border-gray-200 sm:pl-6">
              <h3 className="text-sm font-medium text-gray-900">Alternatives :</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>
                  <Link to="/sitemap" className="text-indigo-600 hover:text-indigo-500">
                    Consulter le plan du site
                  </Link>
                </li>
                <li>
                  <Link to="/support/contact" className="text-indigo-600 hover:text-indigo-500">
                    Contacter le support
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
