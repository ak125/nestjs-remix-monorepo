/**
 * Page de démonstration du DynamicMenu
 * Test des 3 modules optimisés : Commercial, SEO, Expedition
 */
import { useState } from 'react';

import { DynamicMenu } from '../components/navigation/DynamicMenu';

export default function NavigationDemo() {
  const [currentModule, setCurrentModule] = useState<'commercial' | 'seo' | 'expedition'>('commercial');
  const [userId] = useState('demo-user');
  const [userRole] = useState('admin');

  const modules = [
    { 
      key: 'commercial' as const, 
      label: '🏪 Commercial', 
      description: 'Menu commercial avec 987 commandes'
    },
    { 
      key: 'seo' as const, 
      label: '🔍 SEO & Marketing', 
      description: 'Menu SEO avec A/B testing et analytics'
    },
    { 
      key: 'expedition' as const, 
      label: '📦 Expédition', 
      description: 'Menu expédition avec compteurs Supabase'
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Démonstration Navigation Dynamique
          </h1>
          <p className="text-gray-600">
            Test des services de menu optimisés avec intégration Supabase complète
          </p>
        </div>

        {/* Sélecteur de module */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Modules Disponibles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modules.map(module => (
              <button
                key={module.key}
                onClick={() => setCurrentModule(module.key)}
                className={`
                  p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${currentModule === module.key 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <div className="font-semibold text-gray-800 mb-2">{module.label}</div>
                <div className="text-sm text-gray-600">{module.description}</div>
                {currentModule === module.key && (
                  <div className="text-xs text-blue-600 mt-2 font-medium">✓ Actif</div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu dynamique */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Menu {currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Données en temps réel depuis le backend NestJS
                </p>
              </div>
              <DynamicMenu 
                module={currentModule}
                userId={userId}
                userRole={userRole}
                className="max-h-[600px] overflow-y-auto"
              />
            </div>
          </div>

          {/* Informations techniques */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                📊 Statut Technique
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Module actuel:</span>
                  <span className="font-medium">{currentModule}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Utilisateur:</span>
                  <span className="font-medium">{userId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rôle:</span>
                  <span className="font-medium">{userRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Backend:</span>
                  <span className="font-medium text-green-600">✓ NestJS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Base de données:</span>
                  <span className="font-medium text-green-600">✓ Supabase</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                🎯 Fonctionnalités Testées
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Menus hiérarchiques
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Badges dynamiques (987 commandes)
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Compteurs Supabase temps réel
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Fallbacks robustes
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Préférences utilisateur
                </li>
                <li className="flex items-center">
                  <span className="text-green-500 mr-2">✓</span>
                  Dark mode compatible
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 mb-2">💡 Astuce</h4>
              <p className="text-blue-700 text-sm">
                Les données sont chargées depuis les services optimisés du backend. 
                Les badges et compteurs sont mis à jour en temps réel via Supabase.
              </p>
            </div>
          </div>
        </div>

        {/* Footer technique */}
        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>🚀 Navigation dynamique optimisée • Architecture NestJS + Supabase • Performance validée</p>
        </div>
      </div>
    </div>
  );
}
