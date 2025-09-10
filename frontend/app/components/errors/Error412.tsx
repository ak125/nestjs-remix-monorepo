import { Link } from "@remix-run/react";

interface Error412Props {
  condition?: string;
  requirement?: string;
}

export function Error412({ condition, requirement }: Error412Props) {
  return (
    <div className="min-h-screen bg-gray-100 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
      <div className="max-w-max mx-auto">
        <main className="sm:flex">
          <p className="text-4xl font-bold text-yellow-600 sm:text-5xl">412</p>
          <div className="sm:ml-6">
            <div className="sm:border-l sm:border-gray-200 sm:pl-6">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl">
                Condition préalable échouée
              </h1>
              <p className="mt-1 text-base text-gray-500">
                Une condition préalable spécifiée dans votre requête n'a pas été satisfaite.
              </p>
              
              {condition && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        <strong>Condition échouée :</strong><br />
                        {condition}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {requirement && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-blue-700">
                        <strong>Requis :</strong><br />
                        {requirement}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Causes communes */}
            <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
              <h2 className="text-lg font-medium text-gray-900">Causes communes :</h2>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>• Version de contenu obsolète ou modifiée</li>
                <li>• En-têtes de cache ou ETags non correspondants</li>
                <li>• Conditions de modification temporelle non satisfaites</li>
                <li>• Permissions ou authentification requises</li>
              </ul>
            </div>
            
            {/* Actions suggérées */}
            <div className="mt-6 sm:border-l sm:border-gray-200 sm:pl-6">
              <h2 className="text-lg font-medium text-gray-900">Actions suggérées :</h2>
              <ul className="mt-2 space-y-1 text-sm text-gray-500">
                <li>• Actualiser la page pour obtenir la dernière version</li>
                <li>• Vider le cache de votre navigateur</li>
                <li>• Vérifier vos autorisations d'accès</li>
                <li>• Réessayer votre requête</li>
              </ul>
            </div>
            
            <div className="mt-10 flex space-x-3 sm:border-l sm:border-gray-200 sm:pl-6">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualiser la page
              </button>
              <Link
                to="/"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
              >
                Retour à l'accueil
              </Link>
            </div>
            
            {/* Support technique */}
            <div className="mt-8 sm:border-l sm:border-gray-200 sm:pl-6">
              <p className="text-sm text-gray-500">
                Si le problème persiste, {" "}
                <Link 
                  to="/support/contact" 
                  className="text-indigo-600 hover:text-indigo-500"
                >
                  contactez notre support technique
                </Link>
                {" "}avec le code d'erreur 412.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
