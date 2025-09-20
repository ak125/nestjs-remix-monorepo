// app/components/ProSidebar.tsx
// Navigation latérale professionnelle appliquant "vérifier existant et utiliser le meilleur"

import { Link, useLocation } from '@remix-run/react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Settings,
  ChevronRight,
  Building2
} from 'lucide-react';

interface ProSidebarProps {
  isCollapsed?: boolean;
}

export default function ProSidebar({ isCollapsed = false }: ProSidebarProps) {
  const location = useLocation();
  
  const navigationItems = [
    {
      title: 'Tableau de Bord',
      href: '/pro',
      icon: LayoutDashboard,
      description: 'Vue d\'ensemble des activités'
    },
    {
      title: 'Produits PRO',
      href: '/pro/products',
      icon: Package,
      description: 'Catalogue et tarifs professionnels'
    },
    {
      title: 'Commandes',
      href: '/pro/orders',
      icon: ShoppingCart,
      description: 'Gestion des commandes clients'
    },
    {
      title: 'Clients',
      href: '/pro/customers',
      icon: Users,
      description: 'Base client professionnelle'
    },
    {
      title: 'Analyses',
      href: '/pro/analytics',
      icon: BarChart3,
      description: 'Statistiques et rapports'
    }
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/pro') {
      return location.pathname === '/pro' || location.pathname === '/pro/';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav className={`bg-white shadow-lg transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} min-h-screen`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-green-600 flex-shrink-0" />
          {!isCollapsed && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Interface PRO</h2>
              <p className="text-sm text-gray-500">Espace professionnel</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <div className="p-4 space-y-2">
        {navigationItems.map((item) => {
          const isActive = isActiveRoute(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group ${
                isActive
                  ? 'bg-green-50 text-green-700 border-l-4 border-green-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
              
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${isActive ? 'text-green-700' : 'text-gray-900'}`}>
                      {item.title}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {item.description}
                    </div>
                  </div>
                  
                  {isActive && (
                    <ChevronRight className="h-4 w-4 text-green-600" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>

      {/* Settings Footer */}
      <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
        <Link
          to="/pro/settings"
          className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group text-gray-600 hover:bg-gray-50 hover:text-gray-900`}
        >
          <Settings className="h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">
                Paramètres
              </div>
              <div className="text-xs text-gray-500">
                Configuration PRO
              </div>
            </div>
          )}
        </Link>
      </div>
    </nav>
  );
}
