/**
 * Composant Navigation - Menu principal de l'application
 * Inclut toutes les fonctionnalités migrées du PHP legacy
 */

import React, { useState } from 'react';
import { Link, useLocation } from '@remix-run/react';

interface NavigationItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  submenu?: NavigationItem[];
}

export default function Navigation() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<string[]>([]);

  const toggleSubmenu = (name: string) => {
    setOpenSubmenus(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  const navigation: NavigationItem[] = [
    {
      name: 'Tableau de bord',
      href: '/admin',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
        </svg>
      ),
    },
    {
      name: 'Utilisateurs',
      href: '/admin/users',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      submenu: [
        { name: 'Tous les utilisateurs', href: '/admin/users', icon: null },
        { name: 'Utilisateurs actifs', href: '/admin/users?active=true', icon: null },
        { name: 'Revendeurs', href: '/admin/users?level=5', icon: null },
        { name: 'Staff & Admins', href: '/admin/users?level=8', icon: null },
      ],
    },
    {
      name: 'Commandes',
      href: '/admin/orders',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      submenu: [
        { name: 'Toutes les commandes', href: '/admin/orders', icon: null },
        { name: 'En attente', href: '/admin/orders?status=pending', icon: null },
        { name: 'Commandes automobile', href: '/admin/orders?automotive=true', icon: null },
        { name: 'Expédiées', href: '/admin/orders?status=shipped', icon: null },
      ],
    },
    {
      name: 'Automobile',
      href: '/admin/automotive',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      submenu: [
        { name: 'Commandes auto', href: '/admin/automotive/orders', icon: null },
        { name: 'Validation VIN', href: '/admin/automotive/validation', icon: null },
        { name: 'Données véhicules', href: '/admin/automotive/vehicles', icon: null },
        { name: 'Calculs taxes', href: '/admin/automotive/taxes', icon: null },
      ],
    },
    {
      name: 'Produits',
      href: '/admin/products',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      submenu: [
        { name: 'Catalogue', href: '/admin/products', icon: null },
        { name: 'Gammes auto', href: '/admin/products/automotive', icon: null },
        { name: 'Stock', href: '/admin/products/stock', icon: null },
        { name: 'Pièces équivalentes', href: '/admin/products/equivalent', icon: null },
      ],
    },
    {
      name: 'Paiements',
      href: '/admin/payments',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
      submenu: [
        { name: 'Transactions', href: '/admin/payments/transactions', icon: null },
        { name: 'Remboursements', href: '/admin/payments/refunds', icon: null },
        { name: 'Configuration Cyberplus', href: '/admin/payments/config', icon: null },
      ],
    },
    {
      name: 'Rapports',
      href: '/admin/reports',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      submenu: [
        { name: 'Ventes', href: '/admin/reports/sales', icon: null },
        { name: 'Utilisateurs', href: '/admin/reports/users', icon: null },
        { name: 'Performance auto', href: '/admin/reports/automotive', icon: null },
        { name: 'Export données', href: '/admin/reports/export', icon: null },
      ],
    },
    {
      name: 'Configuration',
      href: '/admin/config',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      submenu: [
        { name: 'Paramètres généraux', href: '/admin/config/general', icon: null },
        { name: 'API externe', href: '/admin/config/apis', icon: null },
        { name: 'Email templates', href: '/admin/config/emails', icon: null },
        { name: 'Sauvegardes', href: '/admin/config/backup', icon: null },
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === '/admin' && location.pathname === '/admin') return true;
    if (href !== '/admin' && location.pathname.startsWith(href)) return true;
    return false;
  };

  const NavItem = ({ item, isSubmenuItem = false }: { item: NavigationItem; isSubmenuItem?: boolean }) => {
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isSubmenuOpen = openSubmenus.includes(item.name);
    const active = isActive(item.href);

    return (
      <div>
        {hasSubmenu ? (
          <button
            onClick={() => toggleSubmenu(item.name)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-700 text-white'
                : 'text-blue-100 hover:bg-blue-700 hover:text-white'
            } ${isSubmenuItem ? 'pl-6' : ''}`}
          >
            <div className="flex items-center">
              {item.icon && <span className="mr-3">{item.icon}</span>}
              <span>{item.name}</span>
              {item.badge && (
                <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-800 text-blue-100">
                  {item.badge}
                </span>
              )}
            </div>
            <svg
              className={`w-4 h-4 transition-transform ${isSubmenuOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          <Link
            to={item.href}
            className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-700 text-white'
                : 'text-blue-100 hover:bg-blue-700 hover:text-white'
            } ${isSubmenuItem ? 'pl-6' : ''}`}
          >
            {item.icon && <span className="mr-3">{item.icon}</span>}
            <span>{item.name}</span>
            {item.badge && (
              <span className="ml-auto inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-800 text-blue-100">
                {item.badge}
              </span>
            )}
          </Link>
        )}

        {hasSubmenu && isSubmenuOpen && (
          <div className="mt-1 space-y-1">
            {item.submenu!.map((subitem) => (
              <NavItem key={subitem.name} item={subitem} isSubmenuItem />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="inline-flex items-center justify-center p-2 rounded-md text-blue-400 hover:text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-blue-800 transform transition-transform lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-blue-900">
            <h1 className="text-xl font-bold text-white">🚗 AutoParts Admin</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} />
            ))}
          </nav>

          {/* User info */}
          <div className="border-t border-blue-700 p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-white">A</span>
                </div>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-white">Admin User</div>
                <div className="text-xs text-blue-300">admin@autoparts.com</div>
              </div>
            </div>
            <div className="mt-3">
              <Link
                to="/logout"
                className="w-full flex items-center px-3 py-2 text-sm text-blue-300 hover:text-white hover:bg-blue-700 rounded-md transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Déconnexion
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
