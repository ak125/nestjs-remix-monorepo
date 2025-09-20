import { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Page non trouvée - 404' },
    { name: 'description', content: 'La page que vous recherchez n\'existe pas.' },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const requestedPath = url.pathname;

  // Ici nous pourrions appeler l'API d'erreurs pour enregistrer la 404
  // et chercher des redirections potentielles

  return {
    requestedPath,
    timestamp: new Date().toISOString(),
  };
}

export default function NotFound() {
  const { requestedPath } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        {/* Icône 404 */}
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-indigo-600 mb-4">404</h1>
          <div className="w-24 h-1 bg-indigo-600 mx-auto rounded"></div>
        </div>

        {/* Message d'erreur */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Page non trouvée
          </h2>
          <p className="text-gray-600 mb-2">
            La page que vous recherchez n'existe pas ou a été déplacée.
          </p>
          {requestedPath && (
            <p className="text-sm text-gray-500 font-mono bg-gray-100 px-3 py-2 rounded mt-4">
              Chemin demandé : {requestedPath}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Retour à l'accueil
          </Link>
          
          <div className="flex justify-center space-x-4">
            <Link
              to="/contact"
              className="text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Nous contacter
            </Link>
            <span className="text-gray-400">•</span>
            <Link
              to="/sitemap"
              className="text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Plan du site
            </Link>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mt-12 p-6 bg-white rounded-lg shadow-sm">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Que souhaitez-vous faire ?
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              to="/vehicules"
              className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
            >
              <div className="text-indigo-600 group-hover:text-indigo-700 font-medium">
                🚗 Véhicules
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Explorer nos véhicules
              </div>
            </Link>
            
            <Link
              to="/pieces"
              className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
            >
              <div className="text-indigo-600 group-hover:text-indigo-700 font-medium">
                🔧 Pièces
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Trouver des pièces
              </div>
            </Link>
            
            <Link
              to="/support"
              className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
            >
              <div className="text-indigo-600 group-hover:text-indigo-700 font-medium">
                💬 Support
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Obtenir de l'aide
              </div>
            </Link>
            
            <Link
              to="/guides"
              className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
            >
              <div className="text-indigo-600 group-hover:text-indigo-700 font-medium">
                📚 Guides
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Consulter nos guides
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
