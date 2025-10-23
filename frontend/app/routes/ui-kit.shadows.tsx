import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader() {
  const shadows = [
    { 
      name: 'xs', 
      value: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      usage: 'Cartes légères, boutons subtils'
    },
    { 
      name: 'sm', 
      value: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
      usage: 'Cartes standards, inputs focus'
    },
    { 
      name: 'base', 
      value: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      usage: 'Cartes élevées, dropdowns'
    },
    { 
      name: 'md', 
      value: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      usage: 'Menus contextuels, popovers'
    },
    { 
      name: 'lg', 
      value: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      usage: 'Modales, dialogs'
    },
    { 
      name: 'xl', 
      value: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      usage: 'Grands panneaux, sidebars'
    },
    { 
      name: '2xl', 
      value: '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
      usage: 'Fullscreen overlays'
    },
    { 
      name: 'none', 
      value: 'none',
      usage: 'Supprimer ombre'
    },
  ];

  return json({ shadows });
}

export default function UIKitShadows() {
  const { shadows } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
          Shadows
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Échelle d'élévation avec 8 niveaux pour hiérarchie visuelle et profondeur
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🌑</span>
          <div>
            <h3 className="font-bold text-brand-900 mb-1">Élévation progressive</h3>
            <p className="text-sm text-brand-700">
              Les ombres créent une hiérarchie visuelle. Plus l'élément est important, plus l'ombre est prononcée.
              Utilise <code className="px-1 py-0.5 bg-brand-100 rounded">shadow-{'{size}'}</code> pour appliquer.
            </p>
          </div>
        </div>
      </div>

      {/* Shadow Scale */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-6">
          Échelle d'élévation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {shadows.filter(s => s.name !== 'none').map((shadow) => (
            <div key={shadow.name} className="text-center">
              <div className="bg-secondary-50 dark:bg-secondary-900 rounded-lg p-12 mb-4">
                <div 
                  className="bg-white dark:bg-secondary-800 rounded-lg p-8 mx-auto max-w-[200px]"
                  style={{ boxShadow: shadow.value }}
                >
                  <div className="text-4xl mb-2">📦</div>
                  <div className="text-sm font-bold text-secondary-900 dark:text-white">
                    shadow-{shadow.name}
                  </div>
                </div>
              </div>
              
              <div className="text-left bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-4">
                <div className="flex items-baseline justify-between mb-2">
                  <code className="font-mono font-bold text-brand-600 text-sm">
                    shadow-{shadow.name}
                  </code>
                  <span className="text-xs text-secondary-500 capitalize">
                    {shadow.name}
                  </span>
                </div>
                <p className="text-xs text-secondary-600 mb-2">
                  {shadow.usage}
                </p>
                <code className="text-xs font-mono text-secondary-500 break-all">
                  {shadow.value}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="border-t border-secondary-200 dark:border-secondary-800 pt-8">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-6">
          Exemples d'usage
        </h2>

        <div className="space-y-6">
          {/* Cards */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Cartes produits</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-secondary-50 p-6 rounded-lg">
              <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="w-full h-32 bg-brand-100 rounded mb-3" />
                <h4 className="font-bold text-secondary-900 mb-1">Produit 1</h4>
                <p className="text-sm text-secondary-600">shadow-sm → shadow-md</p>
              </div>
              <div className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="w-full h-32 bg-accent-100 rounded mb-3" />
                <h4 className="font-bold text-secondary-900 mb-1">Produit 2</h4>
                <p className="text-sm text-secondary-600">shadow-md → shadow-lg</p>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow cursor-pointer">
                <div className="w-full h-32 bg-secondary-100 rounded mb-3" />
                <h4 className="font-bold text-secondary-900 mb-1">Produit Featured</h4>
                <p className="text-sm text-secondary-600">shadow-lg → shadow-xl</p>
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="shadow-sm hover:shadow-md">
  Card avec hover effect
</div>`}
            </pre>
          </div>

          {/* Dropdown */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Menu dropdown</h3>
            <div className="bg-secondary-50 p-12 rounded-lg">
              <div className="relative inline-block">
                <button className="px-4 py-2 bg-brand-600 text-white rounded-lg shadow-sm">
                  Menu ▼
                </button>
                <div className="absolute top-full mt-2 left-0 bg-white rounded-lg shadow-lg py-2 min-w-[200px] border border-secondary-200">
                  <button className="block w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-brand-50">Option 1</button>
                  <button className="block w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-brand-50">Option 2</button>
                  <button className="block w-full text-left px-4 py-2 text-sm text-secondary-700 hover:bg-brand-50">Option 3</button>
                </div>
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="shadow-lg rounded-lg">
  Dropdown menu
</div>`}
            </pre>
          </div>

          {/* Modal */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Modale</h3>
            <div className="bg-secondary-900/50 p-12 rounded-lg flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-secondary-900">Confirmer l'action</h4>
                  <button className="text-secondary-500 hover:text-secondary-700">✕</button>
                </div>
                <p className="text-sm text-secondary-600 mb-6">
                  Êtes-vous sûr de vouloir continuer cette action ?
                </p>
                <div className="flex gap-3 justify-end">
                  <button className="px-4 py-2 bg-secondary-200 text-secondary-900 rounded-lg text-sm">
                    Annuler
                  </button>
                  <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm shadow-sm">
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="shadow-2xl rounded-lg">
  Modal overlay
</div>`}
            </pre>
          </div>

          {/* Buttons */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Boutons avec élévation</h3>
            <div className="flex flex-wrap gap-4 bg-secondary-50 p-6 rounded-lg">
              <button className="px-6 py-3 bg-brand-600 text-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                Flat (shadow-sm)
              </button>
              <button className="px-6 py-3 bg-accent-500 text-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
                Raised (shadow-md)
              </button>
              <button className="px-6 py-3 bg-secondary-700 text-white rounded-lg shadow-lg hover:shadow-xl transition-shadow">
                Floating (shadow-lg)
              </button>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<button className="shadow-sm hover:shadow-md">
  Flat Button
</button>
<button className="shadow-md hover:shadow-lg">
  Raised Button
</button>`}
            </pre>
          </div>
        </div>
      </div>

      {/* Guidelines */}
      <div className="mt-12 bg-secondary-50 dark:bg-secondary-900 rounded-lg p-6">
        <h2 className="text-lg font-bold text-secondary-900 dark:text-white mb-4">
          Recommandations
        </h2>
        
        <ul className="space-y-2 text-sm text-secondary-700 dark:text-secondary-300">
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Cartes:</strong> shadow-sm par défaut, shadow-md au hover</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Dropdowns/Popovers:</strong> shadow-lg pour bien se détacher</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Modales:</strong> shadow-2xl pour overlay principal</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Transitions:</strong> Animer shadow au hover pour feedback</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✗</span>
            <span><strong>Évite:</strong> Trop d'éléments avec shadow-2xl (perd hiérarchie)</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✗</span>
            <span><strong>Évite:</strong> Shadows custom (utilise l'échelle)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
