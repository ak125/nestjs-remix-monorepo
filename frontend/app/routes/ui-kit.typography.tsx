import { json } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';

export async function loader() {
  const typography = {
    fontFamilies: {
      sans: 'Inter, system-ui, -apple-system, sans-serif',
      mono: '"JetBrains Mono", "Fira Code", monospace',
    },
    fontSizes: {
      xs: { size: '0.75rem', lineHeight: '1rem' },
      sm: { size: '0.875rem', lineHeight: '1.25rem' },
      base: { size: '1rem', lineHeight: '1.5rem' },
      lg: { size: '1.125rem', lineHeight: '1.75rem' },
      xl: { size: '1.25rem', lineHeight: '1.75rem' },
      '2xl': { size: '1.5rem', lineHeight: '2rem' },
      '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  };

  return json({ typography });
}

export default function UIKitTypography() {
  const { typography } = useLoaderData<typeof loader>();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-2">
          Typographie
        </h1>
        <p className="text-secondary-600 dark:text-secondary-400">
          Système typographique avec scales harmoniques et line-heights optimisés
        </p>
      </div>

      {/* Font Families */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Familles de Police
        </h2>

        <div className="space-y-4">
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-bold text-secondary-700">Sans-serif (défaut)</h3>
              <code className="text-xs font-mono text-brand-600">font-sans</code>
            </div>
            <p className="text-2xl mb-2" style={{ fontFamily: typography.fontFamilies.sans }}>
              The quick brown fox jumps over the lazy dog
            </p>
            <p className="text-sm text-secondary-500 font-mono">
              {typography.fontFamilies.sans}
            </p>
          </div>

          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-sm font-bold text-secondary-700">Monospace</h3>
              <code className="text-xs font-mono text-brand-600">font-mono</code>
            </div>
            <p className="text-2xl mb-2 font-mono" style={{ fontFamily: typography.fontFamilies.mono }}>
              The quick brown fox jumps over the lazy dog
            </p>
            <p className="text-sm text-secondary-500 font-mono">
              {typography.fontFamilies.mono}
            </p>
          </div>
        </div>
      </div>

      {/* Font Sizes */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Tailles de Police
        </h2>

        <div className="space-y-1">
          {Object.entries(typography.fontSizes).map(([name, { size, lineHeight }]) => (
            <div 
              key={name}
              className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6 hover:border-brand-300 transition-colors"
            >
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className="text-secondary-900 dark:text-white"
                  style={{ fontSize: size, lineHeight }}
                >
                  Exemple de texte en {name}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <code className="font-mono text-brand-600">text-{name}</code>
                  <span className="text-secondary-500">{size}</span>
                  <span className="text-secondary-400">LH: {lineHeight}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Font Weights */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Graisses
        </h2>

        <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
          <div className="space-y-4">
            {Object.entries(typography.fontWeights).map(([name, weight]) => (
              <div key={name} className="flex items-baseline justify-between">
                <span
                  className="text-2xl text-secondary-900 dark:text-white"
                  style={{ fontWeight: weight }}
                >
                  The quick brown fox
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <code className="font-mono text-brand-600">font-{name}</code>
                  <span className="text-secondary-500">{weight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="border-t border-secondary-200 dark:border-secondary-800 pt-8">
        <h2 className="text-xl font-bold text-secondary-900 dark:text-white mb-4">
          Exemples d'usage
        </h2>

        <div className="space-y-6">
          {/* Heading Scale */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Échelle de titres</h3>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">
                H1 - Titre principal (text-3xl font-bold)
              </h1>
              <h2 className="text-2xl font-bold text-secondary-900 dark:text-white">
                H2 - Sous-titre (text-2xl font-bold)
              </h2>
              <h3 className="text-xl font-bold text-secondary-900 dark:text-white">
                H3 - Section (text-xl font-bold)
              </h3>
              <h4 className="text-lg font-semibold text-secondary-900 dark:text-white">
                H4 - Sous-section (text-lg font-semibold)
              </h4>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<h1 className="text-3xl font-bold">Titre principal</h1>
<h2 className="text-2xl font-bold">Sous-titre</h2>
<h3 className="text-xl font-bold">Section</h3>
<h4 className="text-lg font-semibold">Sous-section</h4>`}
            </pre>
          </div>

          {/* Body Text */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Corps de texte</h3>
            <div className="space-y-3">
              <p className="text-base text-secondary-900 dark:text-white">
                <strong>Paragraphe principal (text-base):</strong> Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
                Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
              <p className="text-sm text-secondary-600 dark:text-secondary-400">
                <strong>Texte secondaire (text-sm):</strong> Ut enim ad minim veniam, quis nostrud exercitation ullamco 
                laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p className="text-xs text-secondary-500 dark:text-secondary-500">
                <strong>Note légale (text-xs):</strong> Duis aute irure dolor in reprehenderit in voluptate velit esse 
                cillum dolore eu fugiat nulla pariatur.
              </p>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<p className="text-base text-secondary-900">Principal</p>
<p className="text-sm text-secondary-600">Secondaire</p>
<p className="text-xs text-secondary-500">Note</p>`}
            </pre>
          </div>

          {/* Code Blocks */}
          <div className="bg-white dark:bg-secondary-900 border border-secondary-200 rounded-lg p-6">
            <h3 className="text-sm font-bold text-secondary-700 mb-4">Code & Data</h3>
            <div className="space-y-3">
              <p className="text-base text-secondary-900 dark:text-white">
                Inline code: <code className="px-2 py-1 bg-secondary-100 dark:bg-secondary-800 rounded font-mono text-sm text-brand-600">npm install</code>
              </p>
              <div className="bg-secondary-900 rounded-lg p-4">
                <pre className="text-sm font-mono text-green-400 overflow-x-auto">
{`function hello() {
  console.log("Hello, World!");
}`}
                </pre>
              </div>
            </div>
            <pre className="text-xs font-mono bg-secondary-50 p-3 rounded overflow-x-auto mt-4">
{`<code className="font-mono text-sm">npm install</code>
<pre className="font-mono text-sm">Code block</pre>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
