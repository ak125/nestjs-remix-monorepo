/**
 * 🧪 TEST LAYOUT COMPONENTS - Page de test pour GlobalSearch et NotificationCenter
 */

import { type MetaFunction } from "@remix-run/node";
import { GlobalSearch, useGlobalSearch, NotificationCenter, useNotificationCenter } from "../components/layout";

export const meta: MetaFunction = () => {
  return [
    { title: "Test Layout Components" },
    { name: "description", content: "Test des composants GlobalSearch et NotificationCenter" },
  ];
};

export default function TestLayoutComponents() {
  const { isOpen, open, close } = useGlobalSearch();
  const { unreadCount } = useNotificationCenter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header de test */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900">
              Test Layout Components
            </h1>
            
            <div className="flex items-center space-x-4">
              {/* Bouton pour ouvrir GlobalSearch */}
              <button
                onClick={open}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span>🔍</span>
                <span>Recherche globale</span>
                <span className="text-blue-200 text-sm">(Ctrl+K)</span>
              </button>

              {/* NotificationCenter */}
              <NotificationCenter />
            </div>
          </div>
        </div>
      </header>

      {/* GlobalSearch Modal */}
      <GlobalSearch 
        isOpen={isOpen} 
        onClose={close}
        placeholder="Rechercher produits, utilisateurs, commandes..."
      />

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Section GlobalSearch */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              🔍 GlobalSearch Component
            </h2>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Fonctionnalités testées :</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✅ Recherche en temps réel avec debounce (300ms)</li>
                  <li>✅ Raccourci clavier Ctrl+K / Cmd+K</li>
                  <li>✅ Filtres par catégorie</li>
                  <li>✅ Historique de recherche persistant</li>
                  <li>✅ Navigation clavier (↑↓ Enter ESC)</li>
                  <li>✅ Interface modale responsive</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">Actions de test :</h4>
                <button
                  onClick={open}
                  className="block w-full text-left px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Ouvrir la recherche globale
                </button>
                <p className="text-sm text-gray-600">
                  Ou utilisez <kbd className="bg-gray-200 px-2 py-1 rounded">Ctrl+K</kbd> n'importe où sur la page
                </p>
              </div>

              <div className="text-sm text-gray-600">
                <p><strong>Données de test :</strong></p>
                <p>Essayez de rechercher : "amortisseur", "jean", "commande", "stock", "notifications"</p>
              </div>
            </div>
          </div>

          {/* Section NotificationCenter */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              🔔 NotificationCenter Component
            </h2>
            
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900 mb-2">Fonctionnalités testées :</h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>✅ Auto-refresh configurable (30s)</li>
                  <li>✅ Types multiples (info, success, warning, error)</li>
                  <li>✅ Actions rapides sur notifications</li>
                  <li>✅ Marquer lu/non lu individuellement ou en masse</li>
                  <li>✅ Filtres par statut et type</li>
                  <li>✅ Suppression avec confirmation</li>
                  <li>✅ Badge compteur non lus</li>
                  <li>✅ Interface responsive dropdown</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">État actuel :</h4>
                <div className="bg-gray-100 p-3 rounded">
                  <p className="text-sm">
                    <strong>Notifications non lues :</strong> {unreadCount}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Cliquez sur l'icône 🔔 dans le header pour ouvrir le centre de notifications
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p><strong>Données de test :</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Nouvelle commande avec actions rapides</li>
                  <li>Alerte stock faible</li>
                  <li>Paiement confirmé (déjà lu)</li>
                  <li>Erreur de traitement avec actions</li>
                  <li>Nouvel utilisateur (déjà lu)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section Tests techniques */}
          <div className="bg-white rounded-lg shadow p-6 md:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              🧪 Tests Techniques
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">API Endpoints</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>/api/search/global</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>/api/notifications</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>/api/notifications/actions</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span>/api/notifications/count</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">Fonctionnalités React</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>Hooks personnalisés</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>useFetcher pour API</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>LocalStorage persistance</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>Keyboard navigation</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-700 mb-2">UX/UI Features</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    <span>Debounced search</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    <span>Loading states</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    <span>Responsive design</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                    <span>Accessibility ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
