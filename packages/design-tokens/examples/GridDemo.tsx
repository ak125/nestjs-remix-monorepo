/**
 * Composant de démonstration du système de grille et espacement
 * Affiche le système de layout responsive avec containers et grids
 */

import React from 'react';

export function GridDemo() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="py-section-md bg-white border-b">
        <div className="container">
          <h1 className="text-4xl font-bold mb-2">
            📐 Système de Grille & Espacement
          </h1>
          <p className="text-lg text-gray-600">
            8px grid + Spacings fluides + Layout responsive (4/8/12/16 colonnes)
          </p>
          <div className="mt-4 flex gap-4 flex-wrap">
            <span className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full font-semibold text-sm">
              ✅ 92 tokens générés
            </span>
            <span className="px-4 py-2 bg-green-100 text-green-800 rounded-full font-semibold text-sm">
              ✨ 11 spacings fluides (clamp)
            </span>
            <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full font-semibold text-sm">
              📱 4-16 colonnes responsive
            </span>
          </div>
        </div>
      </div>

      {/* Section: Spacing System */}
      <section className="py-section-lg">
        <div className="container">
          <h2 className="text-3xl font-bold mb-6">🔢 8px Grid System</h2>
          
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h3 className="text-xl font-semibold mb-4">Espacements Fixes</h3>
            <div className="space-y-3">
              {[
                { name: 'xs', value: '4px', use: 'Espacement minimal' },
                { name: 'sm', value: '8px', use: 'Base 8px grid' },
                { name: 'md', value: '16px', use: 'Espacement standard' },
                { name: 'lg', value: '24px', use: 'Espacement confortable' },
                { name: 'xl', value: '32px', use: 'Espacement large' },
                { name: '2xl', value: '40px', use: 'Grande séparation' },
                { name: '3xl', value: '48px', use: 'Très grande séparation' },
                { name: '4xl', value: '64px', use: 'Section spacing' },
                { name: '6xl', value: '96px', use: 'Hero spacing' },
              ].map((spacing) => (
                <div key={spacing.name} className="flex items-center gap-4">
                  <code className="text-sm bg-gray-100 px-3 py-1 rounded font-mono w-24">
                    {spacing.name}
                  </code>
                  <div 
                    style={{ 
                      width: spacing.value,
                      height: '24px',
                      background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)'
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600 font-mono">{spacing.value}</span>
                  <span className="text-sm text-gray-500">— {spacing.use}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4">✨ Espacements Fluides (Responsive)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Ces espacements s'adaptent automatiquement à la taille de l'écran avec <code className="bg-gray-100 px-2 py-0.5 rounded">clamp()</code>
            </p>
            <div className="space-y-3">
              {[
                { name: 'section-xs', min: '24px', max: '32px', use: 'Petites sections' },
                { name: 'section-sm', min: '32px', max: '48px', use: 'Sections standard' },
                { name: 'section-md', min: '48px', max: '64px', use: 'Sections moyennes' },
                { name: 'section-lg', min: '64px', max: '96px', use: 'Grandes sections' },
                { name: 'section-xl', min: '96px', max: '128px', use: 'Très grandes sections' },
                { name: 'gap-sm', min: '12px', max: '16px', use: 'Gap flex/grid petit' },
                { name: 'gap-md', min: '16px', max: '24px', use: 'Gap flex/grid moyen' },
                { name: 'gap-lg', min: '24px', max: '32px', use: 'Gap flex/grid large' },
              ].map((spacing) => (
                <div key={spacing.name} className="flex items-center gap-4">
                  <code className="text-sm bg-purple-100 px-3 py-1 rounded font-mono w-32">
                    {spacing.name}
                  </code>
                  <div className="flex-1">
                    <div className="h-6 bg-gradient-to-r from-purple-400 to-pink-500 rounded" 
                         style={{ width: `var(--spacing-fluid-${spacing.name})` }} 
                    />
                  </div>
                  <span className="text-sm text-gray-600 font-mono whitespace-nowrap">
                    {spacing.min} → {spacing.max}
                  </span>
                  <span className="text-sm text-gray-500 w-48">— {spacing.use}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Container System */}
      <section className="py-section-lg bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold mb-6">📦 Container System</h2>
          
          <div className="space-y-4">
            {[
              { name: 'sm', width: '640px', desc: 'Mobile landscape' },
              { name: 'md', width: '768px', desc: 'Tablet portrait' },
              { name: 'lg', width: '1024px', desc: 'Tablet landscape / Small desktop' },
              { name: 'xl', width: '1280px', desc: 'Desktop' },
              { name: '2xl', width: '1536px', desc: 'Large desktop' },
            ].map((container) => (
              <div key={container.name} className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <code className="text-sm bg-white px-3 py-1 rounded font-mono font-semibold">
                      container-{container.name}
                    </code>
                    <span className="text-sm text-gray-600 font-mono">
                      max-width: {container.width}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{container.desc}</span>
                </div>
                <div 
                  className={`container-${container.name} bg-gradient-to-r from-blue-400 to-purple-500 rounded h-8`}
                  style={{ margin: '0 auto' }}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <p className="text-sm text-blue-900">
              <strong>💡 Astuce:</strong> Utilisez <code className="bg-blue-100 px-2 py-0.5 rounded">.container</code> 
              {' '}pour un container responsive automatique qui s'adapte aux breakpoints.
            </p>
          </div>
        </div>
      </section>

      {/* Section: Grid System */}
      <section className="py-section-xl">
        <div className="container">
          <h2 className="text-3xl font-bold mb-6">🎯 Grid System Responsive</h2>
          
          {/* Grid Demo: Mobile (4 cols) */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📱 Mobile</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                4 colonnes
              </code>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                gutter: 16px
              </code>
            </h3>
            <div className="grid-container lg:hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div 
                  key={i}
                  className="bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg p-4 text-white text-center font-semibold"
                >
                  Col {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Grid Demo: Tablet (8 cols) */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>📲 Tablet</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                8 colonnes
              </code>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                gutter: 24px
              </code>
            </h3>
            <div className="grid-container hidden md:grid lg:hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div 
                  key={i}
                  className="bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg p-4 text-white text-center font-semibold"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Grid Demo: Desktop (12 cols) */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>💻 Desktop</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                12 colonnes
              </code>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
                gutter: 32px
              </code>
            </h3>
            <div className="grid-container hidden lg:grid">
              {Array.from({ length: 12 }).map((_, i) => (
                <div 
                  key={i}
                  className="bg-gradient-to-br from-green-400 to-green-600 rounded-lg p-4 text-white text-center font-semibold"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Grid Span Examples */}
          <div className="mt-12">
            <h3 className="text-xl font-semibold mb-4">📐 Grid Column Spans</h3>
            <div className="grid-container">
              <div className="col-span-12 bg-gradient-to-r from-red-400 to-pink-500 rounded-lg p-4 text-white font-semibold">
                col-span-12 (full width)
              </div>
              <div className="col-span-6 bg-gradient-to-r from-blue-400 to-blue-500 rounded-lg p-4 text-white font-semibold">
                col-span-6 (half)
              </div>
              <div className="col-span-6 bg-gradient-to-r from-purple-400 to-purple-500 rounded-lg p-4 text-white font-semibold">
                col-span-6 (half)
              </div>
              <div className="col-span-4 bg-gradient-to-r from-green-400 to-green-500 rounded-lg p-4 text-white font-semibold">
                col-span-4
              </div>
              <div className="col-span-4 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg p-4 text-white font-semibold">
                col-span-4
              </div>
              <div className="col-span-4 bg-gradient-to-r from-red-400 to-red-500 rounded-lg p-4 text-white font-semibold">
                col-span-4
              </div>
              <div className="col-span-3 bg-gradient-to-r from-indigo-400 to-indigo-500 rounded-lg p-4 text-white font-semibold">
                3
              </div>
              <div className="col-span-3 bg-gradient-to-r from-pink-400 to-pink-500 rounded-lg p-4 text-white font-semibold">
                3
              </div>
              <div className="col-span-3 bg-gradient-to-r from-cyan-400 to-cyan-500 rounded-lg p-4 text-white font-semibold">
                3
              </div>
              <div className="col-span-3 bg-gradient-to-r from-orange-400 to-orange-500 rounded-lg p-4 text-white font-semibold">
                3
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Usage Examples */}
      <section className="py-section-lg bg-white">
        <div className="container">
          <h2 className="text-3xl font-bold mb-6">💡 Exemples d'Utilisation</h2>

          <div className="space-y-6">
            {/* Example 1: Card Grid */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">1. Card Grid Responsive</h3>
              <div className="grid-container gap-gap-md">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div 
                    key={i}
                    className="col-span-12 md:col-span-4 lg:col-span-3 bg-white rounded-lg shadow-lg p-6"
                  >
                    <div className="w-full h-32 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg mb-4" />
                    <h4 className="font-semibold text-lg mb-2">Card {i + 1}</h4>
                    <p className="text-sm text-gray-600">
                      Utilise <code className="bg-gray-100 px-1 rounded">col-span-*</code> pour s'adapter
                    </p>
                  </div>
                ))}
              </div>
              <pre className="mt-4 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`<div className="grid-container gap-gap-md">
  <div className="col-span-12 md:col-span-4 lg:col-span-3">
    {/* Card content */}
  </div>
</div>`}
              </pre>
            </div>

            {/* Example 2: Section Spacing */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">2. Section Spacing Fluide</h3>
              <div className="space-y-4">
                <div className="py-section-sm bg-blue-100 rounded-lg px-6">
                  <p className="font-semibold">Section Small (32-48px)</p>
                  <code className="text-sm bg-white px-2 py-1 rounded">py-section-sm</code>
                </div>
                <div className="py-section-md bg-purple-100 rounded-lg px-6">
                  <p className="font-semibold">Section Medium (48-64px)</p>
                  <code className="text-sm bg-white px-2 py-1 rounded">py-section-md</code>
                </div>
                <div className="py-section-lg bg-green-100 rounded-lg px-6">
                  <p className="font-semibold">Section Large (64-96px)</p>
                  <code className="text-sm bg-white px-2 py-1 rounded">py-section-lg</code>
                </div>
              </div>
              <pre className="mt-4 bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`<section className="py-section-lg">
  <div className="container">
    {/* Content adapts automatically */}
  </div>
</section>`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Section: CSS Variables Reference */}
      <section className="py-section-xl bg-gray-900 text-white">
        <div className="container">
          <h2 className="text-3xl font-bold mb-6">📚 Référence CSS Variables</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-blue-400">Spacing Fluide</h3>
              <code className="text-xs text-gray-300 block space-y-1">
                <div>--spacing-fluid-section-xs</div>
                <div>--spacing-fluid-section-sm</div>
                <div>--spacing-fluid-section-md</div>
                <div>--spacing-fluid-section-lg</div>
                <div>--spacing-fluid-section-xl</div>
                <div>--spacing-fluid-gap-sm</div>
                <div>--spacing-fluid-gap-md</div>
                <div>--spacing-fluid-gap-lg</div>
              </code>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-purple-400">Container</h3>
              <code className="text-xs text-gray-300 block space-y-1">
                <div>--container-sm (640px)</div>
                <div>--container-md (768px)</div>
                <div>--container-lg (1024px)</div>
                <div>--container-xl (1280px)</div>
                <div>--container-2xl (1536px)</div>
              </code>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-3 text-green-400">Grid</h3>
              <code className="text-xs text-gray-300 block space-y-1">
                <div>--grid-columns-mobile (4)</div>
                <div>--grid-columns-tablet (8)</div>
                <div>--grid-columns-desktop (12)</div>
                <div>--grid-columns-wide (16)</div>
                <div>--grid-gutter-mobile</div>
                <div>--grid-gutter-tablet</div>
                <div>--grid-gutter-desktop</div>
              </code>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default GridDemo;
