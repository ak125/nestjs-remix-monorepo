import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader() {
  const spacing = {
    scale: [
      { name: '0', value: '0px', rem: '0rem' },
      { name: '1', value: '4px', rem: '0.25rem' },
      { name: '2', value: '8px', rem: '0.5rem' },
      { name: '3', value: '12px', rem: '0.75rem' },
      { name: '4', value: '16px', rem: '1rem' },
      { name: '5', value: '20px', rem: '1.25rem' },
      { name: '6', value: '24px', rem: '1.5rem' },
      { name: '8', value: '32px', rem: '2rem' },
      { name: '10', value: '40px', rem: '2.5rem' },
      { name: '12', value: '48px', rem: '3rem' },
      { name: '16', value: '64px', rem: '4rem' },
      { name: '20', value: '80px', rem: '5rem' },
      { name: '24', value: '96px', rem: '6rem' },
      { name: '32', value: '128px', rem: '8rem' },
    ],
  };

  return json({ spacing });
}

export default function UIKitSpacing() {
  const { spacing } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
          Spacing
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Échelle d'espacement harmonique 4px-128px pour padding, margin, gap
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📏</span>
          <div>
            <h3 className="font-bold text-brand-900 mb-1">Échelle 4px</h3>
            <p className="text-sm text-brand-700">
              Utilise <code className="px-1 py-0.5 bg-brand-100 rounded">--space-*</code> pour cohérence. 
              Classes: <code className="px-1 py-0.5 bg-brand-100 rounded">.p-space-*</code>, 
              <code className="px-1 py-0.5 bg-brand-100 rounded">.m-space-*</code>, 
              <code className="px-1 py-0.5 bg-brand-100 rounded">.gap-space-*</code>
            </p>
          </div>
        </div>
      </div>

      {/* Spacing Scale */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Échelle d'espacement
        </h2>

        <div className="space-y-4">
          {spacing.scale.map((item) => (
            <div 
              key={item.name}
              className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6 hover:border-brand-300 transition-colors"
            >
              <div className="flex items-center gap-6">
                {/* Visual */}
                <div className="flex-shrink-0 w-32">
                  <div 
                    className="bg-brand-500 h-8 rounded"
                    style={{ width: item.value }}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-secondary-500 mb-1">Token</div>
                    <code className="font-mono font-bold text-secondary-900 dark:text-white">
                      space-{item.name}
                    </code>
                  </div>
                  <div>
                    <div className="text-xs text-secondary-500 mb-1">Valeur</div>
                    <span className="font-mono text-secondary-900 dark:text-white">
                      {item.value} / {item.rem}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-secondary-500 mb-1">Classes</div>
                    <code className="font-mono text-brand-600 text-xs">
                      .p-space-{item.name}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Examples */}
      <div className="border-t border-secondary-200 dark:border-secondary-800 pt-8">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Exemples d'usage
        </h2>

        <div className="space-y-6">
          {/* Padding */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Padding</h3>
            <div className="space-y-4">
              <div className="bg-brand-50 border border-brand-200 p-space-2">
                <div className="bg-white border border-brand-300 p-2 text-sm">
                  p-space-2 (8px)
                </div>
              </div>
              <div className="bg-brand-50 border border-brand-200 p-space-4">
                <div className="bg-white border border-brand-300 p-2 text-sm">
                  p-space-4 (16px)
                </div>
              </div>
              <div className="bg-brand-50 border border-brand-200 p-space-8">
                <div className="bg-white border border-brand-300 p-2 text-sm">
                  p-space-8 (32px)
                </div>
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="p-space-2">8px padding</div>
<div className="p-space-4">16px padding</div>
<div className="p-space-8">32px padding</div>`}
            </pre>
          </div>

          {/* Margin/Gap */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Gap (Flexbox/Grid)</h3>
            <div className="flex gap-space-4 bg-brand-50 border border-brand-200 p-6">
              <div className="w-16 h-16 bg-brand-500 rounded flex items-center justify-center text-white text-sm">1</div>
              <div className="w-16 h-16 bg-brand-500 rounded flex items-center justify-center text-white text-sm">2</div>
              <div className="w-16 h-16 bg-brand-500 rounded flex items-center justify-center text-white text-sm">3</div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="flex gap-space-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>`}
            </pre>
          </div>

          {/* Stacking */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Stack vertical (space-y)</h3>
            <div className="space-y-space-3 bg-brand-50 border border-brand-200 p-6">
              <div className="bg-white border border-brand-300 p-3 text-sm">Élément 1</div>
              <div className="bg-white border border-brand-300 p-3 text-sm">Élément 2</div>
              <div className="bg-white border border-brand-300 p-3 text-sm">Élément 3</div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="space-y-space-3">
  <div>Élément 1</div>
  <div>Élément 2</div>
  <div>Élément 3</div>
</div>`}
            </pre>
          </div>

          {/* Component Spacing */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Espacement de composants</h3>
            <div className="bg-brand-50 border border-brand-200 p-space-6">
              <div className="space-y-space-4">
                <div>
                  <h4 className="text-lg font-bold text-secondary-900 mb-space-2">
                    Titre de section
                  </h4>
                  <p className="text-sm text-secondary-600">
                    Paragraphe avec espacement sémantique utilisant les tokens spacing.
                  </p>
                </div>
                
                <div className="flex gap-space-3">
                  <button className="px-space-4 py-space-2 bg-brand-600 text-white rounded-lg text-sm font-medium">
                    Action primaire
                  </button>
                  <button className="px-space-4 py-space-2 bg-secondary-200 text-secondary-900 rounded-lg text-sm font-medium">
                    Action secondaire
                  </button>
                </div>
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="p-space-6">
  <div className="space-y-space-4">
    <div>
      <h4 className="mb-space-2">Titre</h4>
      <p>Texte</p>
    </div>
    
    <div className="flex gap-space-3">
      <button className="px-space-4 py-space-2">
        Bouton
      </button>
    </div>
  </div>
</div>`}
            </pre>
          </div>

          {/* Responsive */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Spacing responsive</h3>
            <div className="bg-brand-50 border border-brand-200 p-space-4 md:p-space-8">
              <div className="bg-white border border-brand-300 p-3 text-sm">
                Padding adaptatif: 16px mobile → 32px desktop
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<div className="p-space-4 md:p-space-8">
  Padding responsive
</div>`}
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
            <span><strong>Composants:</strong> Utilise space-2 à space-6 pour padding interne</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Sections:</strong> Utilise space-8 à space-16 pour margins entre sections</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✓</span>
            <span><strong>Layouts:</strong> Utilise space-16+ pour espacements de page</span>
          </li>
          <li className="flex items-start gap-2">
            <span>✗</span>
            <span><strong>Évite:</strong> Valeurs arbitraires (p-[13px]) sauf cas exceptionnels</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
