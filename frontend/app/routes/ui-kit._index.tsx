import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';

export async function loader() {
  return json({
    stats: {
      tokens: 51,
      utilities: 287,
      components: 0, // À venir
      patterns: 0,   // À venir
    } as const,
    version: '1.0.0' as const,
    lastUpdate: new Date().toISOString(),
  } as const);
}

export default function UIKitIndex() {
  const { stats, version } = useLoaderData<typeof loader>();

  const sections = [
    {
      title: 'Tokens',
      description: '140+ design tokens avec auto-génération (JSON → CSS vars + TS types + Tailwind)',
      icon: '🎨',
      href: '/ui-kit/colors',
      stats: [`${stats.tokens} tokens`, 'CSS vars', 'TypeScript types'],
      color: 'bg-brand-50 border-brand-200',
    },
    {
      title: 'Utilities CSS',
      description: 'Classes sémantiques pour migration douce (bg-brand-600, text-semantic-error, etc.)',
      icon: '✨',
      href: '/ui-kit/colors',
      stats: [`${stats.utilities} classes`, 'Contrast auto', 'Z-Index'],
      color: 'bg-secondary-50 border-secondary-200',
    },
    {
      title: 'Composants',
      description: 'Bibliothèque shadcn/ui + CVA sans HEX, variants pilotées par tokens',
      icon: '🧩',
      href: '/ui-kit/components',
      stats: [`${stats.components} composants`, 'Radix UI', 'A11Y'],
      color: 'bg-success border-success/20',
      badge: 'À venir',
    },
    {
      title: 'Patterns',
      description: 'Patterns compositionnels stateless (ProductCard, VehicleSelector, AdminShell)',
      icon: '🏛️',
      href: '/ui-kit/patterns',
      stats: [`${stats.patterns} patterns`, 'Stateless', 'Composables'],
      color: 'bg-warning/10 border-warning/20',
      badge: 'À venir',
    },
  ];

  const features = [
    { icon: '✅', text: 'Contrast auto WCAG AA', detail: 'Accessibilité garantie' },
    { icon: '🎨', text: 'Multi-brand', detail: 'Vitrine + Admin' },
    { icon: '🌙', text: 'Dark mode', detail: 'SSR-safe' },
    { icon: '🚫', text: 'Anti-HEX', detail: 'ESLint enforced' },
    { icon: '📦', text: 'Tree-shaking', detail: 'Packages séparés' },
    { icon: '🔄', text: 'CI/CD ready', detail: 'npm workspaces' },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Hero */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 border border-brand-200 rounded-full mb-4">
          <span className="text-xs font-semibold text-brand-700">v{version}</span>
          <span className="text-xs text-brand-600">Production Ready</span>
        </div>
        
        <h1 className="text-4xl font-bold text-secondary-900 dark:text-white mb-4">
          Design System Industrialisé
        </h1>
        
        <p className="text-lg text-secondary-600 dark:text-secondary-400 max-w-3xl">
          Architecture modulaire <strong>tokens → thèmes → UI → patterns</strong> pour Remix 2.15 + Tailwind + shadcn/ui, 
          multi-marques (vitrine / admin), dark-mode, et contrôlé en CI.
        </p>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {sections.map((section) => (
          <Link
            key={section.href}
            to={section.href}
            className={`
              relative block p-6 rounded-lg border-2 transition-all hover:shadow-lg
              ${section.color}
            `}
          >
            {section.badge && (
              <span className="absolute top-4 right-4 px-2 py-1 bg-white text-xs font-medium text-secondary-600 rounded border border-secondary-200">
                {section.badge}
              </span>
            )}
            
            <div className="text-3xl mb-3">{section.icon}</div>
            
            <h3 className="text-xl font-bold text-secondary-900 mb-2">
              {section.title}
            </h3>
            
            <p className="text-sm text-secondary-600 mb-4">
              {section.description}
            </p>
            
            <div className="flex flex-wrap gap-2">
              {section.stats.map((stat) => (
                <span
                  key={stat}
                  className="px-2 py-1 bg-white text-xs font-mono text-secondary-700 rounded border border-secondary-200"
                >
                  {stat}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      {/* Features */}
      <div className="bg-secondary-50 dark:bg-secondary-900 rounded-lg p-6 mb-12">
        <h2 className="text-lg font-bold text-secondary-900 dark:text-white mb-4">
          Caractéristiques
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div key={feature.text} className="flex items-start gap-2">
              <span className="text-xl">{feature.icon}</span>
              <div>
                <div className="text-sm font-medium text-secondary-900 dark:text-white">
                  {feature.text}
                </div>
                <div className="text-xs text-secondary-500">
                  {feature.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="border-t border-secondary-200 dark:border-secondary-800 pt-8">
        <h2 className="text-lg font-bold text-secondary-900 dark:text-white mb-4">
          Liens Rapides
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="https://github.com/ak125/nestjs-remix-monorepo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 bg-white border border-secondary-200 rounded-lg hover:border-brand-300 transition-colors"
          >
            <span>📦</span>
            <div>
              <div className="text-sm font-medium text-secondary-900">Repository</div>
              <div className="text-xs text-secondary-500">GitHub monorepo</div>
            </div>
          </a>
          
          <Link
            to="/ui-kit/colors"
            className="flex items-center gap-2 p-4 bg-white border border-secondary-200 rounded-lg hover:border-brand-300 transition-colors"
          >
            <span>🎨</span>
            <div>
              <div className="text-sm font-medium text-secondary-900">Tokens</div>
              <div className="text-xs text-secondary-500">Couleurs, spacing, etc.</div>
            </div>
          </Link>
          
          <Link
            to="/ui-kit/components"
            className="flex items-center gap-2 p-4 bg-white border border-secondary-200 rounded-lg hover:border-brand-300 transition-colors"
          >
            <span>🧩</span>
            <div>
              <div className="text-sm font-medium text-secondary-900">Composants</div>
              <div className="text-xs text-secondary-500">UI library</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
