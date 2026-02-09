import { Link } from "@remix-run/react";
import { useEffect, memo } from "react";
import { Alert } from "~/components/ui/alert";
import { useErrorAutoReport } from "../../hooks/useErrorAutoReport";
import { ErrorSearchBar } from "./ErrorSearchBar";
import { PopularCategories } from "./PopularCategories";

interface Error410Props {
  url?: string;
  isOldLink?: boolean;
  redirectTo?: string;
  userAgent?: string;
  referrer?: string;
  method?: string;
}

export const Error410 = memo(function Error410({
  url,
  isOldLink,
  redirectTo,
}: Error410Props) {
  // Reporting centralisé via hook
  useErrorAutoReport({
    code: 410,
    url,
    message: isOldLink ? "Lien obsolète" : "Contenu supprimé",
    metadata: { isOldLink, redirectTo, pageType: "410_gone" },
  });

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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          {/* Header avec animation 410 */}
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
              <span className="text-9xl font-bold text-orange-200 animate-pulse">
                410
              </span>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  className="w-32 h-32 text-orange-500 animate-bounce"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              {isOldLink
                ? "Lien obsolète détecté"
                : "Contenu définitivement supprimé"}
            </h1>

            <p className="text-lg text-gray-600 mb-2">
              {isOldLink
                ? "Ce lien utilise un ancien format d'URL qui n'est plus supporté."
                : "Cette page a été définitivement supprimée et n'est plus disponible."}
            </p>

            {url && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-gray-600 mb-2">URL demandée :</p>
                <p className="font-mono text-sm text-gray-800 break-all">
                  {url}
                </p>
              </div>
            )}
          </div>

          {/* Zone d'information contextuelle */}
          {isOldLink && (
            <div className="mb-8 p-6 bg-white rounded-lg shadow-md">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-orange-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Pourquoi ce changement ?
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Nous avons restructuré notre site pour améliorer votre
                    expérience de navigation et optimiser les performances. Les
                    anciennes URL ne sont plus valides.
                  </p>
                  <p className="text-gray-600">
                    Tout le contenu reste accessible via notre nouveau système
                    de navigation optimisé.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Redirection suggérée */}
          {redirectTo && (
            <Alert className="mb-8 p-6    rounded-lg" variant="success">
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-green-500 mr-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    Contenu similaire disponible
                  </h3>
                  <p className="text-gray-600 mb-3">
                    Nous avons trouvé du contenu équivalent sur notre nouveau
                    site.
                  </p>
                  <Link
                    to={redirectTo}
                    className="inline-flex items-center px-4 py-2 bg-success hover:bg-success/90 text-success-foreground rounded-lg transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                    Accéder au nouveau contenu
                  </Link>
                </div>
              </div>
            </Alert>
          )}

          {/* Grid d'actions principales */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 text-center">
              Où aller maintenant ?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/"
                className="flex flex-col items-center p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-blue-500 mb-3"
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
                <span className="font-medium text-gray-900">Accueil</span>
                <span className="text-sm text-gray-500 text-center mt-1">
                  Retour à la page principale
                </span>
              </Link>

              <Link
                to="/#catalogue"
                className="flex flex-col items-center p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-orange-500 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <span className="font-medium text-gray-900">Catalogue</span>
                <span className="text-sm text-gray-500 text-center mt-1">
                  Parcourir nos pièces
                </span>
              </Link>

              <Link
                to="/search"
                className="flex flex-col items-center p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-green-500 mb-3"
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
                <span className="font-medium text-gray-900">Recherche</span>
                <span className="text-sm text-gray-500 text-center mt-1">
                  Trouver du contenu
                </span>
              </Link>

              <Link
                to="/contact"
                className="flex flex-col items-center p-6 bg-white rounded-lg shadow hover:shadow-lg transition-all hover:scale-105"
              >
                <svg
                  className="w-8 h-8 text-purple-500 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium text-gray-900">Support</span>
                <span className="text-sm text-gray-500 text-center mt-1">
                  Obtenir de l'aide
                </span>
              </Link>
            </div>
          </div>

          {/* Barre de recherche */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">
              Rechercher du contenu
            </h3>
            <ErrorSearchBar placeholder="Rechercher une pièce, un véhicule..." />
          </div>

          {/* Catégories populaires */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <PopularCategories title="Catégories populaires" columns={4} />
          </div>

          {/* Section d'aide détaillée */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Ressources utiles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Navigation</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>
                    <Link
                      to="/#catalogue"
                      className="text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      → Catalogue complet des pièces
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/#catalogue"
                      className="text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      → Parcourir par marque
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/blog-pieces-auto"
                      className="text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      → Guides et conseils
                    </Link>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Assistance</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>
                    <Link
                      to="/contact"
                      className="text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      → Nous contacter
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/blog-pieces-auto"
                      className="text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      → Articles et tutoriels
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/"
                      className="text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      → Retour à l'accueil
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
