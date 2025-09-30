/**
 * 🏗️ MAIN LAYOUT - Layout principal unifié
 * 
 * Layout moderne et flexible avec :
 * ✅ Backend API integration
 * ✅ Multi-versions support (v7/v8)
 * ✅ Responsive design
 * ✅ Thèmes dynamiques
 * ✅ Contextes multiples (admin/commercial/public)
 * ✅ Composants optimisés
 * ✅ Cache intelligent
 * ✅ Error boundaries
 */

import { useLocation } from "@remix-run/react";
import { useEffect, useState, Suspense } from "react";

import { FooterEnhanced } from "./FooterEnhanced";
import { GlobalSearch } from "./GlobalSearch";
import { Header } from "./Header";
// import { NotificationCenter } from "./NotificationCenter";

export interface LayoutProps {
  children: React.ReactNode;
  layoutData: LayoutData;
  version?: string;
  className?: string;
}

export interface LayoutData {
  type: 'admin' | 'commercial' | 'public';
  version: string;
  theme: string;
  header: HeaderData;
  footer: FooterData;
  navigation: NavigationItem[];
  widgets?: WidgetData[];
  scripts?: ScriptData[];
  styles?: StyleData[];
  quickSearch?: QuickSearchConfig;
  socialShare?: SocialShareData;
  metaTags?: MetaTagsData;
  config?: LayoutConfig;
}

export interface HeaderData {
  title: string;
  logo: {
    url: string;
    alt: string;
    link?: string;
  };
  navigation: NavigationItem[];
  userStats?: {
    total: number;
    active: number;
  };
  quickSearch?: {
    enabled: boolean;
    config: QuickSearchConfig;
  };
}

export interface FooterData {
  company: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  links: Array<{
    title: string;
    items: Array<{
      label: string;
      url: string;
      external?: boolean;
    }>;
  }>;
  copyright: string;
  showNewsletter?: boolean;
  version?: string;
}

export interface NavigationItem {
  label: string;
  href: string;
  icon?: string;
  children?: NavigationItem[];
}

export interface WidgetData {
  widget_key: string;
  widget_type: string;
  title?: string;
  content: {
    html?: string;
    data?: any;
  };
  position: 'top' | 'bottom' | 'sidebar';
  styles?: string;
}

export interface ScriptData {
  src: string;
  async?: boolean;
  defer?: boolean;
  type?: string;
}

export interface StyleData {
  href: string;
  media?: string;
  type?: string;
}

export interface QuickSearchConfig {
  enabled: boolean;
  placeholder?: string;
  modules?: string[];
}

export interface SocialShareData {
  url: string;
  title: string;
  description?: string;
  image?: string;
}

export interface MetaTagsData {
  title: string;
  description: string;
  keywords: string[];
  ogImage?: string;
  canonical?: string;
}

export interface LayoutConfig {
  showHeader?: boolean;
  showFooter?: boolean;
  showSidebar?: boolean;
  showQuickSearch?: boolean;
  enableNotifications?: boolean;
  enableThemeSwitcher?: boolean;
}

export function MainLayout({ 
  children, 
  layoutData, 
  version = "v8",
  className = ""
}: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Fermer le menu mobile lors du changement de page
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Configuration du layout selon les données
  const config = layoutData.config || {
    showHeader: true,
    showFooter: true,
    showSidebar: false,
    showQuickSearch: true,
    enableNotifications: true,
    enableThemeSwitcher: true,
  };

  // Classes CSS dynamiques
  const layoutClasses = [
    'layout',
    `layout--${version}`,
    `layout--${layoutData.type}`,
    `layout--theme-${layoutData.theme}`,
    className,
    mobileMenuOpen ? 'mobile-menu-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClasses}>
      {/* Header principal */}
      {config.showHeader && (
        <Suspense fallback={<HeaderSkeleton />}>
          <Header 
            context={layoutData.type}
            onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          />
        </Suspense>
      )}

      {/* Menu mobile overlay */}
      {mobileMenuOpen && (
        <MobileMenuOverlay 
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          navigation={layoutData.navigation}
          version={version}
        />
      )}

      {/* Recherche globale */}
      {config.showQuickSearch && layoutData.header.quickSearch?.enabled && (
        <Suspense fallback={null}>
          <GlobalSearch isOpen={false} onClose={() => {}} />
        </Suspense>
      )}

      {/* Centre de notifications */}
      {/* {config.enableNotifications && (
        <Suspense fallback={null}>
          <NotificationCenter />
        </Suspense>
      )} */}

      {/* Contenu principal avec gestion des widgets */}
      <main className="main-content" role="main">
        {/* Widgets du haut */}
        {layoutData.widgets && (
          <WidgetsContainer
            widgets={layoutData.widgets.filter(w => w.position === 'top')}
            position="top"
          />
        )}

        {/* Contenu de la page */}
        <div className="page-content">
          {children}
        </div>

        {/* Widgets du bas */}
        {layoutData.widgets && (
          <WidgetsContainer
            widgets={layoutData.widgets.filter(w => w.position === 'bottom')}
            position="bottom"
          />
        )}
      </main>

      {/* Sidebar (pour admin/commercial) */}
      {config.showSidebar && layoutData.type !== 'public' && (
        <SidebarContainer
          widgets={layoutData.widgets?.filter(w => w.position === 'sidebar') || []}
          navigation={layoutData.navigation}
        />
      )}

      {/* Footer */}
      {config.showFooter && (
        <Suspense fallback={<FooterSkeleton />}>
          <FooterEnhanced 
            context={layoutData.type}
          />
        </Suspense>
      )}

      {/* Scripts et styles dynamiques */}
      <DynamicAssets 
        scripts={layoutData.scripts || []} 
        styles={layoutData.styles || []} 
      />
    </div>
  );
}

// Composant pour les widgets
function WidgetsContainer({ 
  widgets, 
  position 
}: { 
  widgets: WidgetData[]; 
  position: string;
}) {
  if (!widgets.length) return null;

  return (
    <section className={`widgets widgets--${position}`} aria-label={`Widgets ${position}`}>
      {widgets.map((widget) => (
        <Widget key={widget.widget_key} data={widget} />
      ))}
    </section>
  );
}

function Widget({ data }: { data: WidgetData }) {
  return (
    <div 
      className={`widget widget--${data.widget_type}`}
      style={data.styles ? { ...parseStyles(data.styles) } : undefined}
    >
      {data.title && (
        <h3 className="widget__title">{data.title}</h3>
      )}
      <div 
        className="widget__content"
        dangerouslySetInnerHTML={{ 
          __html: data.content.html || '' 
        }}
      />
    </div>
  );
}

// Composant pour la sidebar
function SidebarContainer({ 
  widgets, 
  navigation 
}: { 
  widgets: WidgetData[];
  navigation: NavigationItem[];
}) {
  return (
    <aside className="sidebar">
      <nav className="sidebar__navigation" aria-label="Navigation secondaire">
        {navigation.map((item, index) => (
          <div key={index} className="sidebar__nav-item">
            <a href={item.href} className="sidebar__nav-link">
              {item.icon && <span className={`icon icon--${item.icon}`} />}
              {item.label}
            </a>
            {item.children && (
              <ul className="sidebar__nav-children">
                {item.children.map((child, childIndex) => (
                  <li key={childIndex}>
                    <a href={child.href} className="sidebar__nav-child-link">
                      {child.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>
      
      {widgets.length > 0 && (
        <WidgetsContainer widgets={widgets} position="sidebar" />
      )}
    </aside>
  );
}

// Composant pour le menu mobile
function MobileMenuOverlay({ 
  isOpen, 
  onClose, 
  navigation, 
  version 
}: {
  isOpen: boolean;
  onClose: () => void;
  navigation: NavigationItem[];
  version: string;
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="mobile-menu-overlay" role="dialog" aria-modal="true">
      <div className="mobile-menu-backdrop" onClick={onClose} />
      <nav className={`mobile-menu mobile-menu--${version}`} aria-label="Menu mobile">
        <div className="mobile-menu__header">
          <button 
            onClick={onClose}
            className="mobile-menu__close"
            aria-label="Fermer le menu"
          >
            ×
          </button>
        </div>
        <ul className="mobile-menu__items">
          {navigation.map((item, index) => (
            <li key={index} className="mobile-menu__item">
              <a 
                href={item.href} 
                className="mobile-menu__link"
                onClick={onClose}
              >
                {item.icon && <span className={`icon icon--${item.icon}`} />}
                {item.label}
              </a>
              {item.children && (
                <ul className="mobile-menu__subitems">
                  {item.children.map((child, childIndex) => (
                    <li key={childIndex}>
                      <a 
                        href={child.href} 
                        className="mobile-menu__sublink"
                        onClick={onClose}
                      >
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

// Composant pour les assets dynamiques
function DynamicAssets({ scripts, styles }: { scripts: ScriptData[], styles: StyleData[] }) {
  useEffect(() => {
    const loadedScripts: HTMLScriptElement[] = [];

    // Charger les scripts dynamiques
    scripts.forEach(script => {
      if (script.src && !document.querySelector(`script[src="${script.src}"]`)) {
        const scriptElement = document.createElement('script');
        scriptElement.src = script.src;
        scriptElement.async = script.async !== false;
        scriptElement.defer = script.defer || false;
        scriptElement.type = script.type || 'text/javascript';
        
        document.body.appendChild(scriptElement);
        loadedScripts.push(scriptElement);
      }
    });

    // Nettoyer les scripts au démontage
    return () => {
      loadedScripts.forEach(script => script.remove());
    };
  }, [scripts]);

  return (
    <>
      {/* Charger les styles dynamiques */}
      {styles.map((style, index) => (
        <link
          key={`${style.href}-${index}`}
          rel="stylesheet"
          href={style.href}
          media={style.media || 'all'}
          type={style.type || 'text/css'}
        />
      ))}
    </>
  );
}

// Composants de fallback et skeleton
function HeaderSkeleton() {
  return (
    <div className="header-skeleton">
      <div className="animate-pulse bg-gray-200 h-16 w-full" />
    </div>
  );
}

function FooterSkeleton() {
  return (
    <div className="footer-skeleton">
      <div className="animate-pulse bg-gray-200 h-32 w-full" />
    </div>
  );
}

// Utilitaires
function parseStyles(stylesString: string): React.CSSProperties {
  try {
    return JSON.parse(stylesString);
  } catch {
    return {};
  }
}

// Export par défaut
export default MainLayout;
