/**
 * Sidebar de debug simple pour identifier le problème
 */

import { Link, useLocation } from '@remix-run/react';
import React, { useState, useEffect } from 'react';

export default function SimpleNavigation() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(true);

  // Détecter la taille d'écran côté client
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const navigationItems = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
    { name: 'Utilisateurs', href: '/admin/users', icon: '👥' },
    { name: 'Commandes', href: '/admin/orders', icon: '📦' },
    { name: 'Paiements', href: '/admin/payments', icon: '💳' },
    { name: 'Staff', href: '/admin/staff', icon: '👨‍💼' },
    { name: 'Rapports', href: '/admin/reports', icon: '📈' },
  ];

  return (
    <>
      {/* Bouton menu mobile */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 50,
          padding: '0.5rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          borderRadius: '0.375rem',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '16rem',
          backgroundColor: '#1e40af',
          color: 'white',
          transform: mobileMenuOpen || isLargeScreen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#1e3a8a', 
          borderBottom: '1px solid #3b82f6' 
        }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
            🚗 Admin
          </h1>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem' }}>
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                marginBottom: '0.5rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                color: location.pathname === item.href ? '#ffffff' : '#bfdbfe',
                backgroundColor: location.pathname === item.href ? '#3b82f6' : 'transparent'
              }}
              onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#3b82f6'}
              onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = location.pathname === item.href ? '#3b82f6' : 'transparent'}
            >
              <span style={{ marginRight: '0.75rem' }}>{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ 
          padding: '1rem', 
          borderTop: '1px solid #3b82f6',
          backgroundColor: '#1e3a8a'
        }}>
          <form method="POST" action="/auth/logout">
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'transparent',
                color: '#bfdbfe',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseOver={(e) => (e.target as HTMLElement).style.backgroundColor = '#3b82f6'}
              onMouseOut={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
            >
              🚪 Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 30
          }}
        />
      )}
    </>
  );
}
