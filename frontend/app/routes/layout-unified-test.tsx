/**
 * 🧪 ROUTE DE TEST LAYOUT UNIFIÉ
 * 
 * Page de démonstration du système de layout complet
 * ✅ Test Core layout
 * ✅ Test Massdoc layout
 * ✅ Test sections modulaires
 * ✅ Mode édition
 */

import type { LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { useLoaderData, useNavigate, useSearchParams } from '@remix-run/react';
import { useState } from 'react';

// Import des composants (à ajuster selon la structure réelle)
// import { LayoutUnified } from '~/components/layout/LayoutUnified';

interface LoaderData {
  availableLayouts: Array<{
    type: string;
    name: string;
    description: string;
    features: string[];
  }>;
  defaultConfig: any;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const layoutType = url.searchParams.get('type') || 'core';

  const availableLayouts = [
    {
      type: 'core',
      name: 'Core Layout',
      description: 'Layout système interne avec interface minimale',
      features: [
        'Header minimal',
        'Navigation sidebar',
        'Dashboard intégré',
        'Cache optimisé',
      ],
    },
    {
      type: 'massdoc',
      name: 'Massdoc Layout',
      description: 'Layout commercial avec fonctionnalités complètes',
      features: [
        'Header étendu',
        'Footer complet',
        'Sections modulaires',
        'SEO optimisé',
      ],
    },
    {
      type: 'admin',
      name: 'Admin Layout',
      description: 'Interface d\'administration avancée',
      features: [
        'Sidebar avancée',
        'Analytics intégrés',
        'Gestion utilisateurs',
        'Configuration système',
      ],
    },
  ];

  const defaultConfig = {
    type: layoutType,
    page: 'test',
    version: 'latest',
    theme: 'light',
    showHeader: true,
    showFooter: true,
    showQuickSearch: true,
  };

  return json({ availableLayouts, defaultConfig });
}

export default function LayoutTestPage() {
  const { availableLayouts, defaultConfig } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [currentConfig, setCurrentConfig] = useState(defaultConfig);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Mettre à jour la configuration
  const updateConfig = (updates: any) => {
    const newConfig = { ...currentConfig, ...updates };
    setCurrentConfig(newConfig);
    
    // Mettre à jour l'URL
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, String(value));
      } else {
        params.delete(key);
      }
    });
    navigate(`?${params.toString()}`, { replace: true });
  };

  // Simuler l'édition d'une section
  const handleEditSection = (section: any) => {
    console.log('Édition section:', section);
    alert(`Édition de la section: ${section.name}`);
  };

  // Simuler l'ajout d'une section
  const handleAddSection = () => {
    console.log('Ajout nouvelle section');
    alert('Ajout d\'une nouvelle section');
  };

  return (
    <div className="layout-test-page">
      {/* Interface de contrôle */}
      <div className="fixed top-4 left-4 z-50 bg-white shadow-lg rounded-lg p-4 max-w-sm">
        <h3 className="font-bold mb-3">🎛️ Contrôles Layout</h3>
        
        {/* Sélecteur de layout */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Type de Layout:</label>
          <select
            value={currentConfig.type}
            onChange={(e) => updateConfig({ type: e.target.value })}
            className="w-full p-2 border rounded"
          >
            {availableLayouts.map((layout) => (
              <option key={layout.type} value={layout.type}>
                {layout.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sélecteur de thème */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Thème:</label>
          <select
            value={currentConfig.theme}
            onChange={(e) => updateConfig({ theme: e.target.value })}
            className="w-full p-2 border rounded"
          >
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
            <option value="auto">Automatique</option>
          </select>
        </div>

        {/* Options d'affichage */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Composants:</label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentConfig.showHeader}
                onChange={(e) => updateConfig({ showHeader: e.target.checked })}
                className="mr-2"
              />
              Header
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentConfig.showFooter}
                onChange={(e) => updateConfig({ showFooter: e.target.checked })}
                className="mr-2"
              />
              Footer
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={currentConfig.showQuickSearch}
                onChange={(e) => updateConfig({ showQuickSearch: e.target.checked })}
                className="mr-2"
              />
              Recherche rapide
            </label>
          </div>
        </div>

        {/* Mode édition */}
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isEditMode}
              onChange={(e) => setIsEditMode(e.target.checked)}
              className="mr-2"
            />
            Mode édition
          </label>
        </div>

        {/* Bouton configuration */}
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="w-full bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600"
        >
          {showConfig ? 'Masquer' : 'Voir'} Config
        </button>
      </div>

      {/* Configuration JSON */}
      {showConfig && (
        <div className="fixed bottom-4 left-4 z-50 bg-black text-green-400 p-4 rounded font-mono text-xs max-w-md max-h-64 overflow-auto">
          <pre>{JSON.stringify(currentConfig, null, 2)}</pre>
        </div>
      )}

      {/* Layout principal - Version simplifiée pour test */}
      <div className={`layout-demo layout-type--${currentConfig.type} layout-theme--${currentConfig.theme}`}>
        {/* Header simulé */}
        {currentConfig.showHeader && (
          <header className="bg-blue-600 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
              <h1 className="text-xl font-bold">
                {currentConfig.type === 'core' && '🔧 Core System'}
                {currentConfig.type === 'massdoc' && '📚 Massdoc'}
                {currentConfig.type === 'admin' && '⚙️ Administration'}
              </h1>
              
              {currentConfig.showQuickSearch && (
                <div className="flex items-center">
                  <input
                    type="search"
                    placeholder="Rechercher..."
                    className="px-3 py-1 rounded text-black"
                  />
                </div>
              )}
            </div>
          </header>
        )}

        {/* Contenu principal */}
        <main className="min-h-screen bg-gray-50 p-8">
          <div className="container mx-auto">
            {/* Informations sur le layout actuel */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">
                Test du Layout {availableLayouts.find(l => l.type === currentConfig.type)?.name}
              </h2>
              
              <p className="text-gray-600 mb-4">
                {availableLayouts.find(l => l.type === currentConfig.type)?.description}
              </p>

              <div>
                <h3 className="font-semibold mb-2">Fonctionnalités:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {availableLayouts.find(l => l.type === currentConfig.type)?.features.map((feature, index) => (
                    <li key={index} className="text-gray-600">{feature}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Sections de démonstration */}
            <div className="space-y-8">
              {/* Section Hero simulée */}
              <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-12 text-center">
                <h2 className="text-4xl font-bold mb-4">Section Hero de Démonstration</h2>
                <p className="text-xl mb-6">Cette section démontre le système de layout modulaire</p>
                {isEditMode && (
                  <button
                    onClick={() => handleEditSection({ id: 'hero-demo', name: 'Hero Demo' })}
                    className="bg-white text-blue-600 px-4 py-2 rounded mr-4"
                  >
                    ✏️ Éditer cette section
                  </button>
                )}
                <a href="#" className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50">
                  Call to Action
                </a>
              </section>

              {/* Section Features simulée */}
              <section className="bg-white rounded-lg p-8">
                <h2 className="text-3xl font-bold text-center mb-8">Fonctionnalités du Système</h2>
                <div className="grid md:grid-cols-3 gap-6">
                  {[
                    { icon: '🧩', title: 'Modulaire', desc: 'Sections réutilisables' },
                    { icon: '⚡', title: 'Performant', desc: 'Cache intelligent' },
                    { icon: '🎨', title: 'Personnalisable', desc: 'Styles dynamiques' },
                  ].map((feature, index) => (
                    <div key={index} className="text-center">
                      <div className="text-4xl mb-4">{feature.icon}</div>
                      <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                      <p className="text-gray-600">{feature.desc}</p>
                    </div>
                  ))}
                </div>
                {isEditMode && (
                  <div className="text-center mt-6">
                    <button
                      onClick={() => handleEditSection({ id: 'features-demo', name: 'Features Demo' })}
                      className="bg-blue-500 text-white px-4 py-2 rounded mr-4"
                    >
                      ✏️ Éditer cette section
                    </button>
                  </div>
                )}
              </section>

              {/* Bouton d'ajout de section en mode édition */}
              {isEditMode && (
                <section className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <button
                    onClick={handleAddSection}
                    className="bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600"
                  >
                    ➕ Ajouter une nouvelle section
                  </button>
                </section>
              )}
            </div>
          </div>
        </main>

        {/* Footer simulé */}
        {currentConfig.showFooter && (
          <footer className="bg-gray-800 text-white p-8">
            <div className="container mx-auto text-center">
              <p>&copy; 2024 Système de Layout Unifié - Mode: {currentConfig.type}</p>
            </div>
          </footer>
        )}
      </div>

      {/* Styles dynamiques pour la démo */}
      <style>{`
        .layout-type--core {
          --primary-color: #3b82f6;
        }
        .layout-type--massdoc {
          --primary-color: #059669;
        }
        .layout-type--admin {
          --primary-color: #7c3aed;
        }
        .layout-theme--dark {
          filter: invert(1) hue-rotate(180deg);
        }
      `}</style>
    </div>
  );
}
