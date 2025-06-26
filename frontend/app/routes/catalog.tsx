import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Catalog - Modern App" },
    { name: "description", content: "Gestion des catalog" },
  ];
};

export default function Catalog() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Catalog
          </h1>
          <p className="text-lg text-gray-600">
            Interface de gestion pour les catalog
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Actions disponibles
              </h2>
              <div className="space-y-2">
                <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                  Voir tous les catalog
                </button>
                <button className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors">
                  Créer un nouveau catalog
                </button>
                <button className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors">
                  Rechercher
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Informations
              </h2>
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600">
                  Cette interface permet de gérer les catalog du système.
                  Utilisez les boutons ci-contre pour effectuer les actions disponibles.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <h3 className="font-medium text-blue-800">Gestion</h3>
            <p className="text-sm text-blue-600 mt-1">
              CRUD complet pour les catalog
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <h3 className="font-medium text-green-800">API</h3>
            <p className="text-sm text-green-600 mt-1">
              Interface REST moderne
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <h3 className="font-medium text-purple-800">TypeScript</h3>
            <p className="text-sm text-purple-600 mt-1">
              Typage strict et sécurisé
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
