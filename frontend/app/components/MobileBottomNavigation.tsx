/**
 * Mobile Bottom Navigation - Phase 3
 * Navigation native mobile avec gestures et safe area
 */

import { useLocation, useNavigate } from "@remix-run/react"
import { Home, Users, ShoppingCart, Package, BarChart3 } from "lucide-react"
import * as React from "react"
import { cn } from "~/lib/utils"
import { useMobileNavigation } from "~/hooks/useMobileNavigation"

interface BottomNavItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
  notification?: boolean
}

interface MobileBottomNavigationProps {
  className?: string
}

export function MobileBottomNavigation({ className }: MobileBottomNavigationProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { 
    isMobile, 
    shouldUseBottomTabs, 
    preferences,
    getSafeAreaInsets
  } = useMobileNavigation()

  const [isVisible, setIsVisible] = React.useState(true)
  const [lastScrollY, setLastScrollY] = React.useState(0)

  // Items de navigation mobile (priorité élevée seulement)
  const bottomNavItems: BottomNavItem[] = [
    {
      id: 'dashboard',
      label: 'Accueil',
      href: '/admin',
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'users',
      label: 'Utilisateurs',
      href: '/admin/users',
      icon: <Users className="w-5 h-5" />,
    },
    {
      id: 'orders',
      label: 'Commandes',
      href: '/admin/orders',
      icon: <ShoppingCart className="w-5 h-5" />,
      badge: 3, // Exemple
      notification: true
    },
    {
      id: 'products',
      label: 'Produits',
      href: '/admin/products',
      icon: <Package className="w-5 h-5" />,
    },
    {
      id: 'reports',
      label: 'Stats',
      href: '/admin/reports',
      icon: <BarChart3 className="w-5 h-5" />,
    }
  ]

  // Masquer/afficher lors du scroll (UX native)
  React.useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      
      // Masquer si on scroll vers le bas, afficher si vers le haut
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false)
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true)
      }
      
      setLastScrollY(currentScrollY)
    }

    if (isMobile) {
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [isMobile, lastScrollY])

  // Détection de l'item actif
  const isActive = (item: BottomNavItem) => {
    if (item.href === '/admin' && location.pathname === '/admin') return true
    if (item.href !== '/admin' && location.pathname.startsWith(item.href)) return true
    return false
  }

  // Gestion du clic avec haptic feedback
  const handleItemClick = (item: BottomNavItem) => {
    // Haptic feedback sur mobile (si supporté)
    if ('vibrate' in navigator) {
      navigator.vibrate(50)
    }
    
    navigate(item.href)
  }

  // Ne s'affiche que sur mobile avec bottom tabs
  if (!isMobile || !shouldUseBottomTabs) {
    return null
  }

  const safeArea = getSafeAreaInsets()

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-white border-t border-gray-200",
        "transition-all duration-300 ease-in-out",
        isVisible ? "translate-y-0" : "translate-y-full",
        className
      )}
      style={{
        paddingBottom: safeArea.bottom + 8, // Safe area + padding
        paddingLeft: safeArea.left,
        paddingRight: safeArea.right
      }}
    >
      {/* Navigation items */}
      <div className="flex">
        {bottomNavItems.map((item) => {
          const active = isActive(item)
          
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 px-1",
                "relative transition-all duration-200",
                "active:scale-95", // Animation tactile
                active 
                  ? "text-persianIndigo" 
                  : "text-gray-500 active:text-persianIndigo"
              )}
            >
              {/* Indicateur actif */}
              {active && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-persianIndigo rounded-full" />
              )}

              {/* Container icon avec notification */}
              <div className="relative mb-1">
                <div className={cn(
                  "transition-transform duration-200",
                  active ? "scale-110" : "scale-100"
                )}>
                  {item.icon}
                </div>

                {/* Badge de notification */}
                {item.notification && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-khmerCurry rounded-full animate-pulse" />
                )}

                {/* Badge numérique */}
                {item.badge && item.badge > 0 && (
                  <div className="absolute -top-2 -right-2 bg-khmerCurry text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </div>
                )}
              </div>

              {/* Label (affiché selon préférences) */}
              {preferences.showLabels && (
                <span className={cn(
                  "text-xs font-medium transition-opacity duration-200",
                  active ? "opacity-100" : "opacity-70"
                )}>
                  {item.label}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Floating Action Button pour Command Palette */}
      <button
        onClick={() => {
          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(100)
          }
          
          // Ouvrir Command Palette
          window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: true,
            bubbles: true
          }))
        }}
        className={cn(
          "absolute -top-6 right-4",
          "w-12 h-12 bg-gradient-to-r from-persianIndigo to-bleu",
          "text-white rounded-full shadow-lg",
          "flex items-center justify-center",
          "transition-all duration-300",
          "hover:shadow-xl hover:scale-105 active:scale-95"
        )}
        title="Commandes rapides"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      </button>

      {/* Indicateur de swipe (premier usage) */}
      {preferences.enableGestures && (
        <div className="absolute top-1 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-300 rounded-full opacity-50" />
      )}
    </div>
  )
}

export default MobileBottomNavigation
