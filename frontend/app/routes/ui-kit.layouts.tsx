import {
  AdminShell,
  AdminSidebar,
  AdminSidebarHeader,
  AdminSidebarNav,
  AdminSidebarFooter,
  Button,
} from '@fafa/ui';
import { type MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [
    { title: 'Layouts | Design System FAFA' },
    { name: 'description', content: 'Patterns de layouts pour admin et vitrine' },
  ];
};

export default function UIKitLayouts() {
  return (
    <div className="space-y-12">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-2">Layouts</h1>
        <p className="text-lg text-[var(--text-secondary)]">
          Structures de page réutilisables avec slots asChild, z-index tokens et responsive
        </p>
      </div>

      {/* AdminShell Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">AdminShell</h2>
          <p className="text-[var(--text-secondary)]">
            Layout pattern pour pages admin avec sidebar + topbar. Responsive avec hamburger mobile,
            z-index management, et density control.
          </p>
        </div>

        {/* Code example */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Usage</h3>
          <pre className="text-sm text-[var(--text-secondary)] overflow-x-auto">
            {`<AdminShell
  sidebar={
    <AdminSidebar>
      <AdminSidebarHeader>
        <Logo />
      </AdminSidebarHeader>
      <AdminSidebarNav>
        <NavItem href="/admin/dashboard">Dashboard</NavItem>
        <NavItem href="/admin/users">Utilisateurs</NavItem>
      </AdminSidebarNav>
      <AdminSidebarFooter>
        <UserProfile />
      </AdminSidebarFooter>
    </AdminSidebar>
  }
  topbar={
    <div className="flex items-center gap-4">
      <Breadcrumbs />
      <UserMenu />
    </div>
  }
  density="compact"
>
  <PageContent />
</AdminShell>`}
          </pre>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[var(--color-primary-700)] mb-2">
              📱 Responsive Mobile
            </h3>
            <ul className="space-y-2 text-sm text-[var(--color-primary-900)]">
              <li>✅ Hamburger menu automatique sur mobile</li>
              <li>✅ Sidebar slide in/out avec backdrop</li>
              <li>✅ Tailwind breakpoints (lg:hidden, lg:flex)</li>
              <li>✅ Animations smooth (transition-transform 300ms)</li>
            </ul>
          </div>

          <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[var(--color-primary-700)] mb-2">
              🎨 Z-index Tokens
            </h3>
            <ul className="space-y-2 text-sm text-[var(--color-primary-900)]">
              <li>✅ Sidebar: z-navigation (40)</li>
              <li>✅ Topbar sticky: z-sticky (30)</li>
              <li>✅ Mobile backdrop: z-modalBackdrop (50)</li>
              <li>✅ Mobile sidebar: z-modal (60)</li>
            </ul>
          </div>

          <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[var(--color-primary-700)] mb-2">
              🔧 Density Control
            </h3>
            <ul className="space-y-2 text-sm text-[var(--color-primary-900)]">
              <li>✅ Comfy: w-72, p-6, h-16 (spacieux)</li>
              <li>✅ Compact: w-64, p-4, h-14 (optimisé admin)</li>
              <li>✅ Default: compact (pour dashboard dense)</li>
            </ul>
          </div>

          <div className="bg-[var(--color-primary-50)] border border-[var(--color-primary-200)] rounded-lg p-6">
            <h3 className="text-lg font-semibold text-[var(--color-primary-700)] mb-2">
              🎯 Slots asChild
            </h3>
            <ul className="space-y-2 text-sm text-[var(--color-primary-900)]">
              <li>✅ sidebarAsChild prop (Radix Slot)</li>
              <li>✅ topbarAsChild prop (composition)</li>
              <li>✅ Helpers: AdminSidebar, Header, Nav, Footer</li>
            </ul>
          </div>
        </div>

        {/* Live Preview iframe (optionnel) */}
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Preview</h3>
          <div className="border-2 border-[var(--border-primary)] rounded-lg overflow-hidden">
            <div className="bg-[var(--bg-secondary)] p-4 border-b border-[var(--border-primary)]">
              <p className="text-sm text-[var(--text-secondary)]">
                💡 Redimensionnez la fenêtre pour voir le responsive (breakpoint: lg = 1024px)
              </p>
            </div>
            
            {/* Mini preview */}
            <div className="h-96 relative overflow-hidden">
              <AdminShell
                density="compact"
                sidebar={
                  <AdminSidebar>
                    <AdminSidebarHeader>
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-600)] flex items-center justify-center text-white font-bold">
                        FA
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-[var(--text-primary)]">FAFA Admin</div>
                        <div className="text-xs text-[var(--text-secondary)]">Design System</div>
                      </div>
                    </AdminSidebarHeader>

                    <AdminSidebarNav>
                      <NavItem icon="📊" href="#" active>
                        Dashboard
                      </NavItem>
                      <NavItem icon="👥" href="#">
                        Utilisateurs
                      </NavItem>
                      <NavItem icon="🛒" href="#">
                        Commandes
                      </NavItem>
                      <NavItem icon="📦" href="#">
                        Produits
                      </NavItem>
                      <NavItem icon="📈" href="#">
                        Analytics
                      </NavItem>
                      <NavItem icon="⚙️" href="#">
                        Paramètres
                      </NavItem>
                    </AdminSidebarNav>

                    <AdminSidebarFooter>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-600)] flex items-center justify-center text-white text-sm font-bold">
                          JD
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                            John Doe
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] truncate">
                            admin@fafa.fr
                          </div>
                        </div>
                      </div>
                    </AdminSidebarFooter>
                  </AdminSidebar>
                }
                topbar={
                  <>
                    <div className="flex items-center gap-4">
                      <nav className="flex items-center gap-2 text-sm">
                        <span className="text-[var(--text-secondary)]">Admin</span>
                        <span className="text-[var(--text-secondary)]">/</span>
                        <span className="text-[var(--text-primary)] font-medium">Dashboard</span>
                      </nav>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" intent="ghost" radius="full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                        </svg>
                      </Button>
                      <Button size="sm" intent="ghost" radius="full">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </Button>
                    </div>
                  </>
                }
              >
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
                      Dashboard
                    </h2>
                    <p className="text-[var(--text-secondary)]">
                      Bienvenue dans votre espace d'administration
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard title="Utilisateurs" value="1,234" change="+12%" />
                    <StatCard title="Commandes" value="456" change="+8%" />
                    <StatCard title="Revenu" value="12,456€" change="+15%" />
                  </div>
                </div>
              </AdminShell>
            </div>
          </div>
        </div>

        {/* Density variants */}
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Density variants
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border-primary)]">
                <code className="text-sm">density="compact"</code>
              </div>
              <div className="h-48 overflow-hidden">
                <div className="text-xs text-[var(--text-secondary)] p-4">
                  Sidebar: w-64, p-4 • Topbar: h-14, px-4 • Main: p-4
                </div>
              </div>
            </div>

            <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
              <div className="bg-[var(--bg-secondary)] px-4 py-2 border-b border-[var(--border-primary)]">
                <code className="text-sm">density="comfy"</code>
              </div>
              <div className="h-48 overflow-hidden">
                <div className="text-xs text-[var(--text-secondary)] p-4">
                  Sidebar: w-72, p-6 • Topbar: h-16, px-6 • Main: p-6
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info box */}
      <div className="border-2 border-[var(--color-primary-500)] bg-[var(--color-primary-50)] p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-[var(--color-primary-700)] mb-2">
          ✅ AdminShell Features
        </h3>
        <ul className="space-y-2 text-sm text-[var(--color-primary-900)]">
          <li>✅ Responsive mobile-first (Tailwind breakpoints)</li>
          <li>✅ Z-index tokens (z-navigation, z-sticky, z-modal)</li>
          <li>✅ Density variants (compact/comfy)</li>
          <li>✅ Slots asChild pour composition</li>
          <li>✅ Hamburger menu automatique sur mobile</li>
          <li>✅ Sidebar slide in/out avec backdrop</li>
          <li>✅ React state pour toggle mobile</li>
          <li>✅ CSS variables pour theming</li>
          <li>✅ Accessibility (aria-labels, focus-visible)</li>
        </ul>
      </div>
    </div>
  );
}

// Helper component pour NavItem
interface NavItemProps {
  icon: string;
  href: string;
  active?: boolean;
  children: React.ReactNode;
}

function NavItem({ icon, href, active = false, children }: NavItemProps) {
  return (
    <Link
      to={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
        'hover:bg-[var(--bg-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-500)]',
        active
          ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-medium'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      )}
    >
      <span className="text-lg">{icon}</span>
      <span>{children}</span>
    </Link>
  );
}

// Helper component pour StatCard
interface StatCardProps {
  title: string;
  value: string;
  change: string;
}

function StatCard({ title, value, change }: StatCardProps) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-6">
      <div className="text-sm text-[var(--text-secondary)] mb-1">{title}</div>
      <div className="text-2xl font-bold text-[var(--text-primary)] mb-2">{value}</div>
      <div className="text-sm text-[var(--color-success)] font-medium">{change}</div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
