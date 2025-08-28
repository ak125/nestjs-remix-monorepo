/**
 * Page de test pour la Command Palette Universal
 * Route: /test-command-palette
 */

import { type MetaFunction } from "@remix-run/node"

export const meta: MetaFunction = () => {
  return [
    { title: "Test Command Palette" },
    { name: "description", content: "Test de la Command Palette Universal" },
  ]
}

export default function TestCommandPalette() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-persianIndigo via-bleu to-vert p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-persianIndigo mb-4">
              🎯 Command Palette Universal
            </h1>
            <p className="text-xl text-gray-600 mb-6">
              Interface unifiée pour votre backoffice
            </p>
            
            {/* Instructions d'utilisation */}
            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                ⚡ Comment utiliser
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-khmerCurry mb-2">Raccourcis clavier :</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-center gap-2">
                      <kbd className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
                        Cmd+K
                      </kbd>
                      <span>ou</span>
                      <kbd className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
                        Ctrl+K
                      </kbd>
                      <span>Ouvrir/Fermer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <kbd className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
                        ↑↓
                      </kbd>
                      <span>Naviguer dans les résultats</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <kbd className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
                        Enter
                      </kbd>
                      <span>Exécuter l'action</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <kbd className="px-3 py-1 bg-white border border-gray-300 rounded text-sm font-mono">
                        Esc
                      </kbd>
                      <span>Fermer</span>
                    </li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-khmerCurry mb-2">Fonctionnalités :</h3>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start gap-2">
                      <span className="text-vert">✓</span>
                      <span>Navigation unifiée (3 composants intégrés)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vert">✓</span>
                      <span>Recherche intelligente multi-contexte</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vert">✓</span>
                      <span>Actions rapides et raccourcis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vert">✓</span>
                      <span>Historique des actions récentes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vert">✓</span>
                      <span>Design system shadcn/ui intégré</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-vert">✓</span>
                      <span>Mobile-first responsive</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Bouton d'action */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => {
                  // Simuler le raccourci Cmd+K
                  const event = new KeyboardEvent('keydown', {
                    key: 'k',
                    metaKey: true,
                    bubbles: true
                  })
                  document.dispatchEvent(event)
                }}
                className="bg-khmerCurry hover:bg-khmerCurry/90 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
              >
                🚀 Tester la Command Palette
              </button>
              
              <a
                href="/admin"
                className="bg-persianIndigo hover:bg-persianIndigo/90 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
              >
                📊 Aller au Dashboard
              </a>
            </div>

            {/* Stats d'intégration */}
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-3xl font-bold text-khmerCurry mb-2">3</div>
                <div className="text-gray-600">Navigations unifiées</div>
                <div className="text-sm text-gray-500 mt-1">
                  Navigation.tsx, AdminSidebar.tsx, SimpleNavigation.tsx
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-3xl font-bold text-persianIndigo mb-2">15+</div>
                <div className="text-gray-600">Actions disponibles</div>
                <div className="text-sm text-gray-500 mt-1">
                  Navigation, Admin, Commercial, Actions rapides
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="text-3xl font-bold text-vert mb-2">100%</div>
                <div className="text-gray-600">Preservation</div>
                <div className="text-sm text-gray-500 mt-1">
                  Aucune logique existante supprimée
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Command Palette sera disponible via root.tsx */}
      <div className="fixed bottom-4 right-4 text-white text-sm bg-black/20 backdrop-blur-sm rounded-lg p-3">
        💡 Tip: Pressez <kbd className="bg-white/20 px-2 py-1 rounded">Cmd+K</kbd> n'importe où
      </div>
    </div>
  )
}
