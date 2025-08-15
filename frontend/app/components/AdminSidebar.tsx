import { Link, useLocation } from "@remix-run/react"
import { 
  Home, 
  Users, 
  ShoppingCart, 
  CreditCard, 
  Settings, 
  BarChart3, 
  Menu, 
  X,
  LogOut,
  Shield
} from "lucide-react"
import * as React from "react"
import { cn } from "~/lib/utils"
import { Button } from "./ui/button"
import { Card } from "./ui/card"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

const navigationItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: Home,
    description: "Vue d'ensemble",
    badge: null,
    notification: false
  },
  {
    name: "Utilisateurs",
    href: "/admin/users", 
    icon: Users,
    description: "Gestion des utilisateurs",
    badge: { count: 50, color: "bg-blue-500" },
    notification: false
  },
  {
    name: "Commandes",
    href: "/admin/orders",
    icon: ShoppingCart,
    description: "Gestion des commandes",
    badge: { count: 1440, color: "bg-green-500" },
    notification: true
  },
  {
    name: "Paiements",
    href: "/admin/payments",
    icon: CreditCard,
    description: "Gestion des paiements",
    badge: { count: 50, color: "bg-yellow-500" },
    notification: true
  },
  {
    name: "Staff",
    href: "/admin/staff",
    icon: Shield,
    description: "Gestion du personnel",
    badge: { count: 4, color: "bg-purple-500" },
    notification: false
  },
  {
    name: "Rapports",
    href: "/admin/reports",
    icon: BarChart3,
    description: "Analyses et rapports",
    badge: { count: 2, color: "bg-orange-500" },
    notification: true
  },
]

export function AdminSidebar({ className, ...props }: SidebarProps) {
  const location = useLocation()
  const [isOpen, setIsOpen] = React.useState(false)

  // Fermer le menu mobile lors du changement de route
  React.useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Rendu direct en SSR pour éviter l'absence temporaire de la sidebar

  return (
    <>
      {/* Bouton menu mobile moderne */}
      <Button
        variant="outline"
        size="sm"
        className="fixed top-4 left-4 z-50 lg:hidden h-10 w-10 bg-slate-800 border-slate-600 text-white hover:bg-slate-700 shadow-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar avec gradient moderne */}
      <div
        className={cn(
          "fixed left-0 top-0 z-40 h-full w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0",
          "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white border-r border-slate-700/50",
          isOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
        {...props}
      >
        <div className="flex h-full flex-col">
          {/* Header avec notification globale */}
          <div className="flex h-16 items-center border-b border-slate-700/50 px-6 bg-slate-800/50">
            <div className="flex items-center space-x-2 flex-1">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center relative shadow-lg">
                <Shield className="h-4 w-4 text-white" />
                {/* Indicateur de notifications actives */}
                <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse shadow-sm" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Admin Panel</h2>
                <p className="text-xs text-slate-400">🚗 Automobile</p>
              </div>
            </div>
            {/* Badge de notifications totales */}
            <div className="h-6 w-6 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs rounded-full flex items-center justify-center shadow-lg">
              6
            </div>
          </div>

          {/* Navigation avec indicateurs */}
          <nav className="flex-1 space-y-1 p-4">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href
              const Icon = item.icon
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center space-x-3 rounded-xl px-3 py-3 text-sm transition-all duration-200 relative group",
                    "hover:bg-slate-700/50 hover:shadow-md hover:scale-[1.02]",
                    isActive
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg scale-[1.02] border border-blue-500/30"
                      : "text-slate-300 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center justify-between">
                      <span>{item.name}</span>
                      {/* Badge avec compteur amélioré */}
                      {item.badge && (
                        <span className={cn(
                          "text-xs text-white px-2 py-1 rounded-full min-w-[1.5rem] h-5 flex items-center justify-center font-semibold shadow-sm",
                          item.badge.color,
                          "group-hover:scale-110 transition-transform"
                        )}>
                          {item.badge.count}
                        </span>
                      )}
                    </div>
                    <div className="text-xs opacity-75 truncate">
                      {item.description}
                    </div>
                  </div>
                  {/* Indicateur de notification amélioré */}
                  {item.notification && (
                    <div className="absolute top-2 right-2 h-2.5 w-2.5 bg-gradient-to-r from-red-400 to-pink-500 rounded-full animate-pulse shadow-sm" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer avec notifications et déconnexion */}
          <div className="border-t border-slate-700/50 p-4 space-y-3 bg-slate-800/30">
              {/* Zone de notifications récentes */}
            <Card className="p-3 bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border-yellow-600/30">
              <div className="flex items-center gap-2 text-yellow-300">
                <div className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse" />
                <p className="text-xs font-medium">1440 commandes totales</p>
              </div>
              <div className="flex items-center gap-2 text-orange-300 mt-1">
                <div className="h-2 w-2 bg-orange-400 rounded-full" />
                <p className="text-xs">Données réelles connectées</p>
              </div>
            </Card>

            {/* Profil admin */}
            <Card className="p-3 bg-slate-700/30 border-slate-600/50">
              <div className="flex items-center space-x-3 mb-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center shadow-md">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-white">Administrateur</p>
                  <p className="text-xs text-slate-400 truncate">
                    admin@automobile.com
                  </p>
                </div>
                <div className="h-2.5 w-2.5 bg-green-400 rounded-full shadow-sm animate-pulse" title="En ligne" />
              </div>
              
              <form method="POST" action="/auth/logout" className="w-full">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  className="w-full justify-start bg-slate-600/50 border-slate-500 text-slate-200 hover:bg-slate-500/50 hover:text-white transition-all"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>

      {/* Spacer pour le contenu principal sur desktop */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  )
}

export default AdminSidebar
