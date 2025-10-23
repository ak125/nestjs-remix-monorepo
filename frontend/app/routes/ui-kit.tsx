import { designTokens } from '@fafa/design-tokens';
import { json, type MetaFunction } from '@remix-run/node';
import { Link, Outlet, useLocation } from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [
    { title: 'UI-Kit - Design System' },
    { name: 'description', content: 'Showcase du Design System industrialisé' },
    { name: 'robots', content: 'noindex' }, // Pas d'indexation
  ];
};

export async function loader() {
  return json({
    tokens: {
      colors: Object.keys(designTokens.colors || {}).length,
      spacing: Object.keys(designTokens.spacing || {}).length,
      typography: Object.keys(designTokens.typography || {}).length,
    },
  });
}

const navigation = [
  { name: 'Aperçu', href: '/ui-kit', icon: '🎨' },
  { name: 'Couleurs', href: '/ui-kit/colors', icon: '🌈' },
  { name: 'Typographie', href: '/ui-kit/typography', icon: '📝' },
  { name: 'Spacing', href: '/ui-kit/spacing', icon: '📏' },
  { name: 'Shadows', href: '/ui-kit/shadows', icon: '🌑' },
  { name: 'Composants', href: '/ui-kit/components', icon: '🧩' },
  { name: 'Layouts', href: '/ui-kit/layouts', icon: '🏢' },
  { name: 'Patterns', href: '/ui-kit/patterns', icon: '🏛️' },
];

export default function UIKitLayout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-secondary-950">
      {/* Header */}
      <header className="sticky top-0 z-modal bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-sm text-secondary-600 hover:text-secondary-900">
                ← Retour au site
              </Link>
              <div className="h-6 w-px bg-secondary-300" />
              <h1 className="text-xl font-bold text-secondary-900 dark:text-white">
                🎨 Design System UI-Kit
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Theme Switcher */}
              <div className="flex items-center gap-2">
                <label htmlFor="theme-select" className="text-xs font-medium text-secondary-600">
                  Thème:
                </label>
                <select
                  id="theme-select"
                  className="text-xs border border-secondary-300 rounded px-2 py-1 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
                  onChange={(e) => {
                    document.documentElement.setAttribute('data-theme', e.target.value);
                    localStorage.setItem('theme', e.target.value);
                  }}
                  defaultValue={typeof window !== 'undefined' ? localStorage.getItem('theme') || 'vitrine' : 'vitrine'}
                >
                  <option value="vitrine">🏪 Vitrine</option>
                  <option value="admin">👔 Admin</option>
                </select>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-2">
                <label htmlFor="mode-select" className="text-xs font-medium text-secondary-600">
                  Mode:
                </label>
                <select
                  id="mode-select"
                  className="text-xs border border-secondary-300 rounded px-2 py-1 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
                  onChange={(e) => {
                    document.documentElement.setAttribute('data-mode', e.target.value);
                    localStorage.setItem('mode', e.target.value);
                  }}
                  defaultValue={typeof window !== 'undefined' ? localStorage.getItem('mode') || 'light' : 'light'}
                >
                  <option value="light">☀️ Light</option>
                  <option value="dark">🌙 Dark</option>
                </select>
              </div>

              {/* Density Switcher */}
              <div className="flex items-center gap-2">
                <label htmlFor="density-select" className="text-xs font-medium text-secondary-600">
                  Density:
                </label>
                <select
                  id="density-select"
                  className="text-xs border border-secondary-300 rounded px-2 py-1 bg-white dark:bg-secondary-800 text-secondary-900 dark:text-white"
                  onChange={(e) => {
                    document.documentElement.setAttribute('data-density', e.target.value);
                    localStorage.setItem('density', e.target.value);
                  }}
                  defaultValue={typeof window !== 'undefined' ? localStorage.getItem('density') || 'comfy' : 'comfy'}
                >
                  <option value="compact">📏 Compact</option>
                  <option value="comfy">🛋️ Comfy</option>
                </select>
              </div>

              <div className="h-6 w-px bg-secondary-300" />
              
              <span className="text-xs text-secondary-500">
                @fafa/design-tokens v1.0.0
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 bg-secondary-50 dark:bg-secondary-900 border-r border-secondary-200 dark:border-secondary-800 min-h-[calc(100vh-4rem)] sticky top-16">
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-brand-600 text-white' 
                      : 'text-secondary-700 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Quick Stats */}
          <div className="p-4 border-t border-secondary-200 dark:border-secondary-800 mt-4">
            <h3 className="text-xs font-semibold text-secondary-500 uppercase tracking-wide mb-2">
              Tokens
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-600">Couleurs</span>
                <span className="font-mono text-secondary-900 dark:text-white">5</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Spacing</span>
                <span className="font-mono text-secondary-900 dark:text-white">14</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Shadows</span>
                <span className="font-mono text-secondary-900 dark:text-white">8</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
