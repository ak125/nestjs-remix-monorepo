/**
 * Navigation Contextuelle Intelligente - Phase 2
 * Améliore les 3 composants existants avec des overlays Command Palette
 * Sans casser la logique existante
 */

import { useLocation } from "@remix-run/react"
import { Command } from "lucide-react"
import * as React from "react"
import { cn } from "~/lib/utils"

interface NavigationEnhancerProps {
  children: React.ReactNode
  className?: string
}

interface ContextualAction {
  id: string
  label: string
  shortcut?: string
  icon?: React.ReactNode
  action: () => void
  context: string[]
}

export function NavigationEnhancer({ children, className }: NavigationEnhancerProps) {
  const location = useLocation()
  const [showContextualActions, setShowContextualActions] = React.useState(false)
  
  // Actions contextuelles basées sur la route actuelle
  const getContextualActions = (): ContextualAction[] => {
    const path = location.pathname
    const actions: ContextualAction[] = []

    // Actions contextuelles pour /admin
    if (path.startsWith('/admin')) {
      actions.push(
        {
          id: 'quick-user-create',
          label: 'Créer utilisateur',
          shortcut: 'Alt+U',
          action: () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true
            }))
            // Pré-remplir avec "Nouvel Utilisateur"
            setTimeout(() => {
              const input = document.querySelector('[cmdk-input]') as HTMLInputElement
              if (input) input.value = 'Nouvel Utilisateur'
            }, 100)
          },
          context: ['admin', 'users']
        },
        {
          id: 'quick-stats-view',
          label: 'Voir statistiques',
          shortcut: 'Alt+S',
          action: () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true
            }))
            setTimeout(() => {
              const input = document.querySelector('[cmdk-input]') as HTMLInputElement
              if (input) input.value = 'Rapports'
            }, 100)
          },
          context: ['admin', 'dashboard']
        }
      )
    }

    // Actions contextuelles pour /commercial
    if (path.startsWith('/commercial')) {
      actions.push(
        {
          id: 'quick-vehicle-search',
          label: 'Recherche véhicule',
          shortcut: 'Alt+V',
          action: () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true
            }))
            setTimeout(() => {
              const input = document.querySelector('[cmdk-input]') as HTMLInputElement
              if (input) input.value = 'Recherche Véhicules'
            }, 100)
          },
          context: ['commercial', 'vehicles']
        },
        {
          id: 'quick-order-create',
          label: 'Nouvelle commande',
          shortcut: 'Alt+O',
          action: () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'k',
              metaKey: true,
              bubbles: true
            }))
            setTimeout(() => {
              const input = document.querySelector('[cmdk-input]') as HTMLInputElement
              if (input) input.value = 'Commandes'
            }, 100)
          },
          context: ['commercial', 'orders']
        }
      )
    }

    return actions
  }

  const contextualActions = getContextualActions()

  // Gestion des raccourcis contextuels
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        contextualActions.forEach(action => {
          const shortcutKey = action.shortcut?.split('+')[1]?.toLowerCase()
          if (shortcutKey && e.key.toLowerCase() === shortcutKey) {
            e.preventDefault()
            action.action()
          }
        })
      }
      
      // Alt+C pour voir les actions contextuelles
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        setShowContextualActions(prev => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [contextualActions])

  // Masquer les actions contextuelles lors du changement de route
  React.useEffect(() => {
    setShowContextualActions(false)
  }, [location.pathname])

  return (
    <div className={cn("relative", className)}>
      {children}
      
      {/* Overlay contextuel */}
      {contextualActions.length > 0 && (
        <div className="absolute top-0 right-0 m-4 z-40">
          {/* Bouton d'aide contextuelle */}
          <button
            onClick={() => setShowContextualActions(prev => !prev)}
            className={cn(
              "w-8 h-8 rounded-full transition-all duration-200 flex items-center justify-center",
              "bg-persianIndigo/10 hover:bg-persianIndigo/20 text-persianIndigo",
              "border border-persianIndigo/20 hover:border-persianIndigo/40",
              showContextualActions && "bg-persianIndigo text-white"
            )}
            title="Actions contextuelles (Alt+C)"
          >
            <Command className="w-4 h-4" />
          </button>

          {/* Panel d'actions contextuelles */}
          {showContextualActions && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
              <div className="p-3 bg-persianIndigo text-white">
                <h3 className="font-semibold text-sm">Actions Contextuelles</h3>
                <p className="text-xs opacity-90">Page: {location.pathname}</p>
              </div>
              
              <div className="p-1">
                {contextualActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.action()
                      setShowContextualActions(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 rounded transition-colors"
                  >
                    {action.icon && (
                      <span className="text-persianIndigo">{action.icon}</span>
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {action.label}
                      </div>
                    </div>
                    {action.shortcut && (
                      <kbd className="px-2 py-1 bg-gray-100 text-xs rounded">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
              
              <div className="p-2 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-600 text-center">
                  Tip: <kbd className="bg-white px-1 rounded">Alt+C</kbd> pour toggle
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Indicateur discret des raccourcis disponibles */}
      {contextualActions.length > 0 && !showContextualActions && (
        <div className="absolute bottom-4 right-4 text-xs text-gray-400 bg-white/80 backdrop-blur-sm rounded px-2 py-1 shadow-sm">
          {contextualActions.length} raccourci{contextualActions.length > 1 ? 's' : ''} dispo{contextualActions.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export default NavigationEnhancer
