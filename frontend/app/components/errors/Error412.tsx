import { Link } from "@remix-run/react";
import { useEffect } from "react";
import { useErrorAutoReport } from "../../hooks/useErrorAutoReport";
import { ErrorSearchBar } from "./ErrorSearchBar";

interface Error412Props {
  url?: string;
  condition?: string;
  requirement?: string;
  userAgent?: string;
  referrer?: string;
  method?: string;
}

export function Error412({
  url,
  condition,
  requirement,
}: Error412Props) {
  // Reporting centralisé via hook
  useErrorAutoReport({
    code: 412,
    url,
    message: "Condition préalable échouée",
    metadata: { condition, requirement },
  });

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
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section avec Animation 412 */}
          <div className="text-center mb-12">
            <div className="mb-8">
              <div className="relative inline-block">
                <span className="text-9xl font-bold text-yellow-200">412</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-32 h-32 text-yellow-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Condition préalable échouée
            </h1>
            
            <p className="text-lg text-gray-600 mb-8">
              Une condition préalable spécifiée dans votre requête n'a pas été satisfaite.
            </p>

            {/* URL demandée */}
            {url && (
              <div className="mb-8 p-4 bg-white rounded-lg shadow-sm">
                <p className="text-sm text-gray-600 mb-2">URL demandée :</p>
                <p className="font-mono text-sm text-gray-800 break-all">{url}</p>
              </div>
            )}

            {/* Barre de recherche */}
            <div className="mb-8">
              <ErrorSearchBar placeholder="Rechercher une pièce, un véhicule..." />
            </div>
          </div>

          {/* Détails de l'erreur */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Condition échouée */}
            {condition && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Condition échouée</h3>
                    <p className="text-gray-600 text-sm">{condition}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Requirement */}
            {requirement && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Requis</h3>
                    <p className="text-gray-600 text-sm">{requirement}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid d'actions principales */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Actions recommandées
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg className="w-8 h-8 text-yellow-500 mb-3 group-hover:text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Actualiser
                </span>
              </button>

              <Link
                to="/"
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg className="w-8 h-8 text-blue-500 mb-3 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Accueil
                </span>
              </Link>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.back();
                  }
                }}
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg className="w-8 h-8 text-green-500 mb-3 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Retour
                </span>
              </button>

              <Link
                to="/contact"
                className="group flex flex-col items-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
              >
                <svg className="w-8 h-8 text-purple-500 mb-3 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Support
                </span>
              </Link>
            </div>
          </div>

          {/* Sections d'aide */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Causes communes */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Causes communes
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Version de contenu obsolète ou modifiée
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  En-têtes de cache ou ETags non correspondants
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Conditions de modification temporelle non satisfaites
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-warning/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Permissions ou authentification requises
                </li>
              </ul>
            </div>

            {/* Solutions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Solutions suggérées
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Actualiser la page pour obtenir la dernière version
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Vider le cache de votre navigateur
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Vérifier vos autorisations d'accès
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-success/60 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  Réessayer votre requête avec de nouveaux paramètres
                </li>
              </ul>
            </div>
          </div>

          {/* Footer d'assistance */}
          <div className="mt-12 text-center">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-gray-600">
                Si le problème persiste après avoir essayé ces solutions,{" "}
                <Link
                  to="/contact"
                  className="text-yellow-600 hover:text-yellow-700 font-medium"
                >
                  contactez notre support technique
                </Link>
                {" "}avec le code d'erreur <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm">412</span>.
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Notre équipe vous aidera à résoudre ce problème de condition préalable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
