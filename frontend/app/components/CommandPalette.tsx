/**
 * Command Palette Universal - Interface unifiée pour la navigation
 * Intègre toutes les routes existantes des 3 composants de navigation
 * Utilise shadcn/ui Command + design system existant
 */

import * as React from "react"
import { useNavigate, useLocation } from "@remix-run/react"
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  Home,
  Users,
  ShoppingCart,
  BarChart3,
  Package,
  Truck,
  Store,
  Send,
  Shield,
  Search,
  Command as CommandIcon,
  FileText,
  DollarSign,
  TrendingUp
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "~/components/ui/command"

interface CommandAction {
  id: string
  label: string
  description?: string
  shortcut?: string
  icon: React.ReactNode
  href?: string
  action?: () => void
  group: 'navigation' | 'admin' | 'commercial' | 'actions' | 'recent'
  badge?: number
  keywords: string[]
}

export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Raccourci clavier Cmd+K / Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Actions consolidées des 3 navigations existantes
  const actions: CommandAction[] = [
    // Navigation principale (Navigation.tsx)
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      description: 'Vue d\'ensemble de l\'activité',
      icon: <Home className="h-4 w-4" />,
      href: '/admin',
      group: 'navigation',
      keywords: ['dashboard', 'accueil', 'overview', 'statistiques']
    },
    {
      id: 'commercial',
      label: 'Commercial',
      description: 'Gestion commerciale et ventes',
      icon: <BarChart3 className="h-4 w-4" />,
      href: '/commercial',
      group: 'navigation',
      keywords: ['commercial', 'ventes', 'business', 'chiffre']
    },
    
    // AdminSidebar.tsx - Gestion utilisateurs
    {
      id: 'users',
      label: 'Utilisateurs',
      description: 'Gestion des comptes utilisateurs',
      icon: <Users className="h-4 w-4" />,
      href: '/admin/users',
      group: 'admin',
      keywords: ['utilisateurs', 'users', 'comptes', 'membres']
    },
    {
      id: 'staff',
      label: 'Staff',
      description: 'Gestion de l\'équipe',
      icon: <Shield className="h-4 w-4" />,
      href: '/admin/staff',
      group: 'admin',
      keywords: ['staff', 'équipe', 'personnel', 'admin']
    },

    // Commandes et paiements
    {
      id: 'orders',
      label: 'Commandes',
      description: 'Gestion des commandes',
      icon: <ShoppingCart className="h-4 w-4" />,
      href: '/admin/orders',
      group: 'commercial',
      keywords: ['commandes', 'orders', 'achats', 'panier']
    },
    {
      id: 'payments',
      label: 'Paiements',
      description: 'Suivi des transactions',
      icon: <CreditCard className="h-4 w-4" />,
      href: '/admin/payments',
      group: 'commercial',
      keywords: ['paiements', 'payments', 'transactions', 'argent']
    },

    // Inventaire et produits
    {
      id: 'products',
      label: 'Produits',
      description: 'Catalogue des produits',
      icon: <Package className="h-4 w-4" />,
      href: '/admin/products',
      group: 'commercial',
      keywords: ['produits', 'products', 'catalogue', 'stock']
    },
    {
      id: 'suppliers',
      label: 'Fournisseurs',
      description: 'Gestion des fournisseurs',
      icon: <Truck className="h-4 w-4" />,
      href: '/admin/suppliers',
      group: 'commercial',
      keywords: ['fournisseurs', 'suppliers', 'partenaires']
    },

    // Rapports et analytics
    {
      id: 'reports',
      label: 'Rapports',
      description: 'Analytics et reporting',
      icon: <TrendingUp className="h-4 w-4" />,
      href: '/admin/reports',
      group: 'admin',
      keywords: ['rapports', 'reports', 'analytics', 'statistiques']
    },

    // Recherche véhicules (routes existantes)
    {
      id: 'vehicles-search',
      label: 'Recherche Véhicules',
      description: 'Recherche dans la base véhicules',
      icon: <Search className="h-4 w-4" />,
      href: '/commercial/vehicles/search',
      group: 'commercial',
      keywords: ['véhicules', 'recherche', 'cars', 'auto']
    },
    {
      id: 'vehicles-advanced',
      label: 'Recherche Avancée',
      description: 'Recherche avancée véhicules',
      icon: <Search className="h-4 w-4" />,
      href: '/commercial/vehicles/advanced-search',
      group: 'commercial',
      keywords: ['recherche avancée', 'advanced', 'filtres']
    },

    // Actions rapides
    {
      id: 'new-user',
      label: 'Nouvel Utilisateur',
      description: 'Créer un compte utilisateur',
      icon: <User className="h-4 w-4" />,
      action: () => navigate('/admin/users/new'),
      group: 'actions',
      shortcut: '⌘N',
      keywords: ['nouveau', 'créer', 'utilisateur', 'compte']
    },
    {
      id: 'settings',
      label: 'Paramètres',
      description: 'Configuration système',
      icon: <Settings className="h-4 w-4" />,
      href: '/admin/settings',
      group: 'admin',
      shortcut: '⌘,',
      keywords: ['paramètres', 'settings', 'config', 'configuration']
    }
  ]

  const executeAction = (action: CommandAction) => {
    setOpen(false)
    
    if (action.href) {
      navigate(action.href)
    } else if (action.action) {
      action.action()
    }
  }

  const groupedActions = actions.reduce((acc, action) => {
    if (!acc[action.group]) {
      acc[action.group] = []
    }
    acc[action.group].push(action)
    return acc
  }, {} as Record<string, CommandAction[]>)

  return (
    <>
      {/* Bouton d'activation visible (mobile principalement) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 lg:top-6 lg:right-6 lg:bottom-auto z-50 
                   bg-khmerCurry hover:bg-khmerCurry/90 text-white 
                   w-12 h-12 rounded-full shadow-lg flex items-center justify-center
                   transition-all duration-200 hover:scale-105"
        title="Ouvrir la palette de commandes (Cmd+K)"
      >
        <CommandIcon className="h-5 w-5" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Tapez une commande ou recherchez..." 
          className="text-base"
        />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          
          {groupedActions.navigation && (
            <CommandGroup heading="🧭 Navigation">
              {groupedActions.navigation.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => executeAction(action)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  {action.icon}
                  <div className="flex-1">
                    <div className="font-medium">{action.label}</div>
                    {action.description && (
                      <div className="text-sm text-muted-foreground">
                        {action.description}
                      </div>
                    )}
                  </div>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                  {action.badge && (
                    <span className="bg-khmerCurry text-white text-xs px-2 py-1 rounded-full">
                      {action.badge}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {groupedActions.admin && (
            <CommandGroup heading="⚙️ Administration">
              {groupedActions.admin.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => executeAction(action)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  {action.icon}
                  <div className="flex-1">
                    <div className="font-medium">{action.label}</div>
                    {action.description && (
                      <div className="text-sm text-muted-foreground">
                        {action.description}
                      </div>
                    )}
                  </div>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {groupedActions.commercial && (
            <CommandGroup heading="💼 Commercial">
              {groupedActions.commercial.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => executeAction(action)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  {action.icon}
                  <div className="flex-1">
                    <div className="font-medium">{action.label}</div>
                    {action.description && (
                      <div className="text-sm text-muted-foreground">
                        {action.description}
                      </div>
                    )}
                  </div>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />

          {groupedActions.actions && (
            <CommandGroup heading="⚡ Actions Rapides">
              {groupedActions.actions.map((action) => (
                <CommandItem
                  key={action.id}
                  onSelect={() => executeAction(action)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  {action.icon}
                  <div className="flex-1">
                    <div className="font-medium">{action.label}</div>
                    {action.description && (
                      <div className="text-sm text-muted-foreground">
                        {action.description}
                      </div>
                    )}
                  </div>
                  {action.shortcut && (
                    <CommandShortcut>{action.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>

        {/* Footer avec raccourcis */}
        <div className="border-t p-3 text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center justify-between">
            <span>Tapez pour rechercher...</span>
            <div className="flex gap-2">
              <kbd className="px-2 py-1 bg-background border rounded">↑↓</kbd>
              <span>naviguer</span>
              <kbd className="px-2 py-1 bg-background border rounded">↵</kbd>
              <span>sélectionner</span>
              <kbd className="px-2 py-1 bg-background border rounded">esc</kbd>
              <span>fermer</span>
            </div>
          </div>
        </div>
      </CommandDialog>
    </>
  )
}

export default CommandPalette
