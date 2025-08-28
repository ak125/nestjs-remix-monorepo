/**
 * Demo Phase 2 - Navigation Contextuelle Intelligente
 * Test des composants Navigation améliorés avec NavigationEnhancer
 */

import { type MetaFunction } from "@remix-run/node"
import { AdminSidebar } from "~/components/AdminSidebar"

export const meta: MetaFunction = () => {
  return [
    { title: "Phase 2 Demo - Navigation Contextuelle" },
    { name: "description", content: "Test de la navigation contextuelle intelligente" },
  ]
}

const mockStats = {
  totalUsers: 1247,
  totalOrders: 3891,
  totalRevenue: 125780,
  activeUsers: 89,
  pendingOrders: 23,
  completedOrders: 3868,
  totalSuppliers: 156,
  totalStock: 9432
}

export default function Phase2Demo() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* AdminSidebar avec NavigationEnhancer intégré */}
      <AdminSidebar stats={mockStats} />
      
      {/* Contenu principal */}
      <div className="lg:ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                🚀 Phase 2: Navigation Contextuelle
              </h1>
              <p className="text-xl text-gray-600 mb-6">
                Amélioration intelligente des composants existants
              </p>
            </div>

            {/* Fonctionnalités Phase 2 */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-persianIndigo to-bleu text-white rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">🎯 Actions Contextuelles</h3>
                <p className="text-sm opacity-90 mb-4">
                  Actions intelligentes basées sur la route actuelle
                </p>
                <div className="space-y-1 text-xs">
                  <div>• Alt+C pour voir les actions</div>
                  <div>• Alt+U pour créer utilisateur</div>
                  <div>• Alt+S pour statistiques</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-khmerCurry to-orange-500 text-white rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">⚡ Overlays Intelligents</h3>
                <p className="text-sm opacity-90 mb-4">
                  Interface contextuelle sans casser l'existant
                </p>
                <div className="space-y-1 text-xs">
                  <div>• Bouton contextuel en haut à droite</div>
                  <div>• Panel d'actions déroulant</div>
                  <div>• Intégration Command Palette</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-vert to-green-500 text-white rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">🔄 Préservation Totale</h3>
                <p className="text-sm opacity-90 mb-4">
                  Toute la logique existante conservée
                </p>
                <div className="space-y-1 text-xs">
                  <div>• AdminSidebar stats dynamiques</div>
                  <div>• Navigation badges & états</div>
                  <div>• Toutes routes préservées</div>
                </div>
              </div>
            </div>

            {/* Instructions d'utilisation */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                🎮 Comment tester Phase 2
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Raccourcis Contextuels :</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <kbd className="bg-white px-3 py-2 border border-gray-300 rounded text-sm font-mono">
                        Alt+C
                      </kbd>
                      <span className="text-gray-600">Afficher/masquer actions contextuelles</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="bg-white px-3 py-2 border border-gray-300 rounded text-sm font-mono">
                        Alt+U
                      </kbd>
                      <span className="text-gray-600">Action rapide "Créer utilisateur"</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <kbd className="bg-white px-3 py-2 border border-gray-300 rounded text-sm font-mono">
                        Alt+S
                      </kbd>
                      <span className="text-gray-600">Accès rapide statistiques</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Fonctionnalités :</h3>
                  <div className="space-y-2 text-gray-600">
                    <div className="flex items-start gap-2">
                      <span className="text-vert text-lg">✓</span>
                      <span>Bouton contextuel (coin supérieur droit de la sidebar)</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-vert text-lg">✓</span>
                      <span>Actions intelligentes basées sur la route /admin</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-vert text-lg">✓</span>
                      <span>Intégration automatique avec Command Palette</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-vert text-lg">✓</span>
                      <span>Indicateur discret du nombre d'actions disponibles</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Statistiques d'amélioration */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-persianIndigo mb-1">2</div>
                <div className="text-sm text-gray-600">Actions contextuelles</div>
                <div className="text-xs text-gray-500 mt-1">sur route /admin</div>
              </div>
              <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-khmerCurry mb-1">0</div>
                <div className="text-sm text-gray-600">Code supprimé</div>
                <div className="text-xs text-gray-500 mt-1">préservation totale</div>
              </div>
              <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-vert mb-1">1</div>
                <div className="text-sm text-gray-600">Composant ajouté</div>
                <div className="text-xs text-gray-500 mt-1">NavigationEnhancer</div>
              </div>
              <div className="text-center p-4 bg-white border border-gray-200 rounded-lg">
                <div className="text-2xl font-bold text-bleu mb-1">100%</div>
                <div className="text-sm text-gray-600">Compatibilité</div>
                <div className="text-xs text-gray-500 mt-1">avec existant</div>
              </div>
            </div>

            {/* Liens de navigation */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/test-command-palette"
                className="bg-persianIndigo hover:bg-persianIndigo/90 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 text-center"
              >
                ← Retour Phase 1 (Command Palette)
              </a>
              
              <button
                onClick={() => {
                  // Simuler Alt+C
                  const event = new KeyboardEvent('keydown', {
                    key: 'c',
                    altKey: true,
                    bubbles: true
                  })
                  document.dispatchEvent(event)
                }}
                className="bg-khmerCurry hover:bg-khmerCurry/90 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105"
              >
                🎯 Tester Actions Contextuelles
              </button>
              
              <a
                href="/admin"
                className="bg-vert hover:bg-vert/90 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 hover:scale-105 text-center"
              >
                Dashboard Admin →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tip flottant */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 text-white text-sm rounded-lg px-4 py-2 backdrop-blur-sm">
        💡 Cherchez le bouton contextuel dans la sidebar → puis essayez Alt+C
      </div>
    </div>
  )
}
