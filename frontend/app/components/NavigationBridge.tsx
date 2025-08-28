/**
 * PHASE 3 - Unification Progressive des Navigations
 * Bridge intelligent entre les 3 composants Navigation existants
 * Mobile-first experience avec performance optimisée
 */

import { useLocation } from "@remix-run/react"
import { Home, Users, ShoppingCart, Settings, BarChart3, Package, Truck } from "lucide-react"
import * as React from "react"
import { cn } from "~/lib/utils"

interface UnifiedNavigationItem {
  id: string
  label: string
  href: string
  icon: React.ReactNode
  badge?: number
  notification?: boolean
  category: 'main' | 'admin' | 'commercial'
  priority: number
  mobileVisible: boolean
  description?: string
}

interface NavigationBridgeProps {
  currentComponent: 'Navigation' | 'AdminSidebar' | 'SimpleNavigation'
  className?: string
  isMobile?: boolean
}

export function NavigationBridge({ currentComponent, className, isMobile = false }: NavigationBridgeProps) {
  const location = useLocation()
  const [stats, setStats] = React.useState({
    totalUsers: 0,
    totalOrders: 0,
    pendingActions: 0
  })

  // Navigation unifiée consolidée des 3 composants
  const unifiedNavigation: UnifiedNavigationItem[] = [
    // Core Navigation (haute priorité)
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/admin',
      icon: <Home className="w-5 h-5" />,
      category: 'main',
      priority: 1,
      mobileVisible: true,
      description: 'Vue d\'ensemble générale'
    },
    
    // Admin Navigation
    {
      id: 'users',
      label: 'Utilisateurs',
      href: '/admin/users',
      icon: <Users className="w-5 h-5" />,
      category: 'admin',
      priority: 2,
      mobileVisible: true,
      badge: stats.totalUsers > 1000 ? Math.floor(stats.totalUsers / 100) : undefined
    },
    {
      id: 'orders',
      label: 'Commandes',
      href: '/admin/orders',
      icon: <ShoppingCart className="w-5 h-5" />,
      category: 'admin',
      priority: 3,
      mobileVisible: true,
      badge: stats.pendingActions,
      notification: stats.pendingActions > 0
    },
    
    // Commercial Navigation
    {
      id: 'products',
      label: 'Produits',
      href: '/admin/products',
      icon: <Package className="w-5 h-5" />,
      category: 'commercial',
      priority: 4,
      mobileVisible: true
    },
    {
      id: 'suppliers',
      label: 'Fournisseurs',
      href: '/admin/suppliers',
      icon: <Truck className="w-5 h-5" />,
      category: 'commercial',
      priority: 5,
      mobileVisible: false // Masqué sur mobile pour économiser l'espace
    },
    {
      id: 'reports',
      label: 'Rapports',
      href: '/admin/reports',
      icon: <BarChart3 className="w-5 h-5" />,
      category: 'admin',
      priority: 6,
      mobileVisible: false
    },
    {
      id: 'settings',
      label: 'Paramètres',
      href: '/admin/settings',
      icon: <Settings className="w-5 h-5" />,
      category: 'main',
      priority: 7,
      mobileVisible: false
    }
  ]

  // Stats en temps réel (simulées)
  React.useEffect(() => {
    const updateStats = () => {
      setStats({
        totalUsers: Math.floor(Math.random() * 2000) + 1000,
        totalOrders: Math.floor(Math.random() * 500) + 100,
        pendingActions: Math.floor(Math.random() * 10)
      })
    }
    
    updateStats()
    const interval = setInterval(updateStats, 30000) // Update toutes les 30s
    return () => clearInterval(interval)
  }, [])

  // Filtrage intelligent selon contexte
  const getVisibleItems = () => {
    let items = unifiedNavigation

    // Filtrage mobile
    if (isMobile) {
      items = items.filter(item => item.mobileVisible)
    }

    // Tri par priorité
    items.sort((a, b) => a.priority - b.priority)

    // Limite mobile (max 5 items principaux)
    if (isMobile) {
      items = items.slice(0, 5)
    }

    return items
  }

  // Détection de l'item actif
  const isActive = (item: UnifiedNavigationItem) => {
    if (item.href === '/admin' && location.pathname === '/admin') return true
    if (item.href !== '/admin' && location.pathname.startsWith(item.href)) return true
    return false
  }

  // Adaptation du style selon le composant source
  const getItemStyles = (item: UnifiedNavigationItem, active: boolean) => {
    const baseStyles = "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 relative"
    
    switch (currentComponent) {
      case 'Navigation':
        return cn(baseStyles, 
          active 
            ? "bg-blue-700 text-white" 
            : "text-blue-100 hover:bg-blue-700 hover:text-white"
        )
      case 'AdminSidebar':
        return cn(baseStyles,
          active
            ? "bg-persianIndigo text-white"
            : "text-gray-700 hover:bg-gray-100"
        )
      case 'SimpleNavigation':
        return cn(baseStyles,
          active
            ? "bg-gray-900 text-white"
            : "text-gray-600 hover:bg-gray-200"
        )
      default:
        return cn(baseStyles, "text-gray-700 hover:bg-gray-100")
    }
  }

  const visibleItems = getVisibleItems()

  return (
    <div className={cn("navigation-bridge", className)}>
      {/* Header unifié avec stats temps réel */}
      {!isMobile && (
        <div className="mb-6 p-4 bg-gradient-to-r from-persianIndigo/10 to-bleu/10 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-persianIndigo">{stats.totalUsers}</div>
              <div className="text-xs text-gray-600">Utilisateurs</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-khmerCurry">{stats.totalOrders}</div>
              <div className="text-xs text-gray-600">Commandes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-vert">{stats.pendingActions}</div>
              <div className="text-xs text-gray-600">En attente</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation unifiée */}
      <nav className="space-y-1">
        {visibleItems.map((item) => {
          const active = isActive(item)
          
          return (
            <a
              key={item.id}
              href={item.href}
              className={getItemStyles(item, active)}
              title={item.description}
            >
              {/* Icône */}
              <span className="flex-shrink-0">
                {item.icon}
              </span>

              {/* Label et description */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                {!isMobile && item.description && (
                  <div className="text-xs opacity-70 truncate">{item.description}</div>
                )}
              </div>

              {/* Badge et notifications */}
              <div className="flex items-center gap-2">
                {item.notification && (
                  <div className="w-2 h-2 bg-khmerCurry rounded-full animate-pulse" />
                )}
                {item.badge && item.badge > 0 && (
                  <span className={cn(
                    "px-2 py-1 text-xs font-medium rounded-full",
                    active 
                      ? "bg-white/20 text-white" 
                      : "bg-gray-200 text-gray-700"
                  )}>
                    {item.badge}
                  </span>
                )}
              </div>
            </a>
          )
        })}
      </nav>

      {/* Mobile: Actions rapides en bas */}
      {isMobile && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <button 
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-persianIndigo transition-colors"
              onClick={() => {
                // Ouvrir Command Palette
                window.dispatchEvent(new KeyboardEvent('keydown', {
                  key: 'k',
                  metaKey: true,
                  bubbles: true
                }))
              }}
            >
              <Settings className="w-4 h-4" />
              <span>Actions</span>
            </button>
            <button 
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-persianIndigo transition-colors"
              onClick={() => {
                // Stats rapides
                alert(`📊 Stats: ${stats.totalUsers} users, ${stats.totalOrders} commandes, ${stats.pendingActions} en attente`)
              }}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Stats</span>
            </button>
          </div>
        </div>
      )}

      {/* Indicateur de source (debug) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-500 text-center">
          Bridge: {currentComponent} → Unified
        </div>
      )}
    </div>
  )
}

export default NavigationBridge
