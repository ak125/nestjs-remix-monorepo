import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { useState } from 'react';

export async function loader() {
  // Import tokens from JSON
  const tokens = {
    primary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
    secondary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
    accent: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
    semantic: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
    },
    neutral: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  };

  return json({ tokens });
}

function ColorSwatch({ shade, category }: { shade: number | string; category: string }) {
  const [copied, setCopied] = useState(false);
  const cssVar = typeof shade === 'number' 
    ? `--color-${category}-${shade}` 
    : `--color-semantic-${shade}`;
  const utilityClass = typeof shade === 'number'
    ? `bg-${category}-${shade}`
    : `bg-${shade}`;
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(utilityClass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="group relative cursor-pointer"
      onClick={handleCopy}
    >
      <div 
        className={`h-20 rounded-lg border-2 border-secondary-200 ${utilityClass} flex items-center justify-center overflow-hidden`}
      >
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <span className={`text-${category}-${shade}-contrast text-sm font-mono px-2 py-1 bg-black/20 rounded`}>
            {copied ? '✓ Copié!' : 'Clic'}
          </span>
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <div className="text-sm font-mono font-bold text-secondary-900 dark:text-white">
          {shade}
        </div>
        <div className="text-xs font-mono text-secondary-500">
          {cssVar}
        </div>
        <div className="text-xs font-mono text-brand-600 mt-1">
          .{utilityClass}
        </div>
      </div>
    </div>
  );
}

export default function UIKitColors() {
  const { tokens } = useLoaderData<typeof loader>();

  const colorCategories = [
    { name: 'Primary', key: 'primary', description: 'Couleur de marque principale (Automecanik orange)' },
    { name: 'Secondary', key: 'secondary', description: 'Gris neutres pour textes et bordures' },
    { name: 'Accent', key: 'accent', description: 'Bleu Automecanik pour CTAs secondaires' },
    { name: 'Neutral', key: 'neutral', description: 'Échelle de gris pure' },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
          Couleurs
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Palettes de couleurs avec contrast auto WCAG AA. Cliquez pour copier la classe CSS.
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 mb-8">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-bold text-brand-900 mb-1">Contrast Auto</h3>
            <p className="text-sm text-brand-700">
              Chaque couleur possède une variante <code className="px-1 py-0.5 bg-brand-100 rounded">-contrast</code> 
              {' '}automatiquement calculée (noir ou blanc) pour garantir un contraste WCAG AA.
            </p>
            <p className="text-xs text-brand-600 mt-2 font-mono">
              Exemple: .bg-primary-600 + .text-primary-600-contrast
            </p>
          </div>
        </div>
      </div>

      {/* Color Categories */}
      {colorCategories.map((category) => (
        <div key={category.key} className="mb-12">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
              {category.name}
            </h2>
            <p className="text-sm text-secondary-600 dark:text-secondary-400">
              {category.description}
            </p>
          </div>

                    <div className="grid grid-cols-6 md:grid-cols-11 gap-4">
            {(Array.isArray(tokens[category.key as keyof typeof tokens]) 
              ? tokens[category.key as keyof typeof tokens] as number[]
              : []
            ).map((shade: number) => (
              <ColorSwatch
                key={shade}
                shade={shade}
                category={category.key}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Semantic Colors */}
      <div className="mb-12">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-secondary-900 dark:text-white">
            Couleurs Sémantiques
          </h2>
          <p className="text-sm text-secondary-600 dark:text-secondary-400">
            Couleurs pour états et feedbacks utilisateur
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {Object.entries(tokens.semantic).map(([name, value]) => (
            <div key={name} className="text-center">
              <div 
                className={`h-24 rounded-lg border-2 border-secondary-200 bg-${name} mb-3`}
              />
              <div className="text-sm font-bold text-secondary-900 dark:text-white capitalize">
                {name}
              </div>
              <div className="text-xs font-mono text-secondary-500">
                {value}
              </div>
              <div className="text-xs font-mono text-brand-600 mt-1">
                .bg-{name}
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

        <div className="grid gap-6">
          {/* Example 1 */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-3">Bouton avec contrast auto</h3>
            <div className="flex items-center gap-4 mb-4">
              <button className="px-6 py-3 bg-primary-600 text-primary-600-contrast rounded-lg font-medium hover:bg-primary-700 transition-colors">
                Call to Action
              </button>
              <button className="px-6 py-3 bg-accent-500 text-accent-500-contrast rounded-lg font-medium hover:bg-accent-600 transition-colors">
                Secondaire
              </button>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto">
{`<button className="bg-primary-600 text-primary-600-contrast">
  Call to Action
</button>`}
            </pre>
          </div>

          {/* Example 2 */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-3">Badges sémantiques</h3>
            <div className="flex flex-wrap gap-3 mb-4">
              <span className="px-3 py-1 bg-success text-white rounded-full text-sm font-medium">
                ✓ Succès
              </span>
              <span className="px-3 py-1 bg-warning text-white rounded-full text-sm font-medium">
                ⚠ Attention
              </span>
              <span className="px-3 py-1 bg-error text-white rounded-full text-sm font-medium">
                ✗ Erreur
              </span>
              <span className="px-3 py-1 bg-info text-white rounded-full text-sm font-medium">
                ℹ Info
              </span>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto">
{`<span className="bg-success text-white">Succès</span>
<span className="bg-warning text-white">Attention</span>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
